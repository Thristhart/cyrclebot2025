import {
  getQueueForServer,
  removeObjectFromQueue,
  updateObjectPlaybackPosition,
} from "@cyrclebot/data";
import { getMediaObjectsFromYoutubeURL } from "@cyrclebot/youtube";
import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  demuxProbe,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import assert from "node:assert";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { Stream } from "node:stream";
import { ReadableStream } from "node:stream/web";
import { MediaObjectDBO } from "../../data/model";
import { client } from "./bot";
import { ytdlp } from "./ytdlp";

async function probeAndCreateResource(readableStream: Stream.Readable) {
  const { stream, type } = await demuxProbe(readableStream);
  return createAudioResource(stream, { inputType: type });
}

async function getYtdlpStream(mediaObject: MediaObjectDBO) {
  console.log("ytdlp-ing", mediaObject.url);
  const results = await ytdlp(mediaObject.url, {
    dumpSingleJson: true,
    noWarnings: true,
    noCallHome: true,
    preferFreeFormats: true,
    skipDownload: true,
    simulate: true,
    format: "ba/ba*",
  });
  if (
    results &&
    typeof results === "object" &&
    "url" in results &&
    results.url &&
    typeof results.url === "string"
  ) {
    console.log("Got yt-dlp info for", mediaObject.url);
    const response = await fetch(results.url, {
      method: "GET",
      headers: { "User-Agent": "cyrclebot" },
      keepalive: true,
    });
    assert(response.body);
    const [left, right] = response.body.tee();

    // HACKHACK: i honestly have no idea why this is necessary
    // something about piping to a createWriteStream stream does _something_ to the stream that makes it stay alive properly
    // if i don't do this, the stream terminates near the end
    await mkdir("./tmp", { recursive: true });
    const stupidTempPath = "./tmp/" + crypto.randomUUID();
    const writeStream = createWriteStream(stupidTempPath, {
      emitClose: false,
    });
    const stream = Stream.Readable.fromWeb(left as ReadableStream<any>);
    stream.pipe(writeStream);
    stream.on("end", () => {
      rm(stupidTempPath);
    });

    const rightStream = Stream.Readable.fromWeb(right as ReadableStream<any>);
    return rightStream;
  }
  return undefined;
}

async function getAudioResourceFromMediaObject(mediaObject: MediaObjectDBO) {
  const youtubeObjects = await getMediaObjectsFromYoutubeURL(mediaObject.url);
  if (youtubeObjects.length > 0) {
    const stream = await getYtdlpStream(mediaObject);
    if (stream) {
      return probeAndCreateResource(stream);
    }
  }
}

const mapVoiceConnectionToAudioPlayer = new WeakMap<
  VoiceConnection,
  AudioPlayer
>();

interface CustomResourceProps {
  mediaObjectId: number;
  mediaStartTime: number | null;
}

export async function checkPlaybackStatus() {
  const guilds = await client.guilds.fetch();
  for (const [, guildInfo] of guilds) {
    const queue = getQueueForServer(guildInfo.id);
    const guild = await client.guilds.fetch(guildInfo.id);
    if (queue.length === 0) {
      const existingVoiceConnection = getVoiceConnection(guild.id);
      // nothing in the queue, but we're in a channel, so d/c
      if (existingVoiceConnection) {
        existingVoiceConnection.disconnect();
      }
      continue;
    }
    const currentMediaObject = queue[0];

    const existingVoiceConnection = getVoiceConnection(guild.id);

    if (!currentMediaObject.channel_id) {
      continue;
    }
    const voiceConnection = joinVoiceChannel({
      channelId: currentMediaObject.channel_id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: true,
    });

    if (!existingVoiceConnection) {
      voiceConnection.on(
        VoiceConnectionStatus.Disconnected,
        async (oldState, newState) => {
          try {
            await Promise.race([
              entersState(
                voiceConnection,
                VoiceConnectionStatus.Signalling,
                5_000
              ),
              entersState(
                voiceConnection,
                VoiceConnectionStatus.Connecting,
                5_000
              ),
            ]);
            // Seems to be reconnecting to a new channel - ignore disconnect
          } catch {
            // Seems to be a real disconnect which SHOULDN'T be recovered from
            voiceConnection.destroy();
          }
        }
      );
    }

    let player = mapVoiceConnectionToAudioPlayer.get(voiceConnection);
    if (!player) {
      player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Stop },
      });
      voiceConnection.subscribe(player);
      mapVoiceConnectionToAudioPlayer.set(voiceConnection, player);
      player.on("stateChange", (oldState, newState) => {
        if (
          oldState.status === AudioPlayerStatus.Playing &&
          newState.status === AudioPlayerStatus.Idle
        ) {
          const oldId = (oldState.resource as unknown as CustomResourceProps)
            .mediaObjectId;
          if (oldId !== undefined) {
            removeObjectFromQueue(oldId);
            checkPlaybackStatus();
          }
        }
      });
      let playbackInterval = setInterval(() => {
        if (!player) {
          clearInterval(playbackInterval);
          return;
        }
        if (player.state.status === AudioPlayerStatus.Playing) {
          const customProps = player.state
            .resource as unknown as CustomResourceProps;
          const currentPos =
            (customProps.mediaStartTime ?? 0) +
            player.state.resource.playbackDuration;

          updateObjectPlaybackPosition(customProps.mediaObjectId, currentPos);
        }
      }, 300);
    }
    if (player.state.status === AudioPlayerStatus.Idle) {
      // we're idle, but we have something to play, so play it
      const audioResource =
        await getAudioResourceFromMediaObject(currentMediaObject);
      if (audioResource) {
        const customProps = audioResource as unknown as CustomResourceProps;
        customProps.mediaObjectId = currentMediaObject.id;
        // TODO: if I ever implement seeking, this should be currentMediaObject.playback_position_ms
        customProps.mediaStartTime = 0;
        player.play(audioResource);
      } else {
        console.error(
          "Failed to create an audio resource from",
          currentMediaObject
        );
      }
    }
  }
}

export function stopCurrent(guildId: string) {
  const existingVoiceConnection = getVoiceConnection(guildId);
  if (!existingVoiceConnection) {
    return;
  }
  const player = mapVoiceConnectionToAudioPlayer.get(existingVoiceConnection);
  player?.stop();
}

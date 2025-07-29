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
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { ActivityType, PresenceData } from "discord.js";
import assert from "node:assert";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Stream } from "node:stream";
import { ReadableStream } from "node:stream/web";
import { MediaObjectDBO } from "../../data/model";
import { client } from "./bot";
import { hour, minute, second } from "./time";
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
    console.log("Got yt-dlp info for", mediaObject.url, "url:", results.url);
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
    await mkdir(process.env.TEMP_LOCATION ?? "./tmp", { recursive: true });
    const stupidTempPath = `${process.env.TEMP_LOCATION ?? "./tmp/"}${crypto.randomUUID()}`;
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
  console.error("Didn't get a URL in ytldp results:", results);
  return undefined;
}

async function getAudioResourceFromMediaObject(mediaObject: MediaObjectDBO) {
  if (mediaObject.url.startsWith(`file://`)) {
    const filePath = mediaObject.url.slice("file://".length);
    const resolved = path.resolve(filePath);
    // only allow file paths to load from the bandle data dir
    if (!resolved.startsWith(path.resolve(process.env.BANDLE_DATA_LOCATION!))) {
      console.error(
        "got bad filepath",
        resolved,
        "doesn't start with",
        path.resolve(process.env.BANDLE_DATA_LOCATION!)
      );
      removeObjectFromQueue(mediaObject.id);
      return undefined;
    }
    const fileStream = createReadStream(resolved, { emitClose: false });
    return createAudioResource(fileStream, { inputType: StreamType.Arbitrary });
  }
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

  let presence: PresenceData | undefined = undefined;

  for (const [, guildInfo] of guilds) {
    const queue = getQueueForServer(guildInfo.id);
    const guild = await client.guilds.fetch(guildInfo.id);
    if (queue.length === 0) {
      const existingVoiceConnection = getVoiceConnection(guild.id);
      // nothing in the queue, but we're in a channel, so d/c
      if (existingVoiceConnection) {
        console.log(
          `[${guildInfo.id}]`,
          "nothing in the queue and we're in a channel, so d/cing"
        );
        existingVoiceConnection.disconnect();
        client.user.setPresence({});
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
        console.log(`[${guildInfo.id}]`, "stateChange", newState.status);
        if (
          oldState.status === AudioPlayerStatus.Playing &&
          newState.status === AudioPlayerStatus.Idle
        ) {
          const oldId = (oldState.resource as unknown as CustomResourceProps)
            .mediaObjectId;
          if (oldId !== undefined) {
            console.log(`[${guildInfo.id}]`, "finished playing", oldId);
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
          checkPlaybackStatus();
        }
      }, 300);
    }
    if (player.state.status === AudioPlayerStatus.Idle) {
      console.log(`[${guildInfo.id}]`, "playing", currentMediaObject);
      // we're idle, but we have something to play, so play it
      const audioResource =
        await getAudioResourceFromMediaObject(currentMediaObject);
      if (audioResource) {
        const customProps = audioResource as unknown as CustomResourceProps;
        customProps.mediaObjectId = currentMediaObject.id;
        // TODO: if I ever implement seeking, this should be currentMediaObject.playback_position_ms
        customProps.mediaStartTime = 0;
        await entersState(voiceConnection, VoiceConnectionStatus.Ready, 30_000);
        player.play(audioResource);
      } else {
        console.error(
          `[${guildInfo.id}]`,
          "Failed to create an audio resource from",
          currentMediaObject
        );
      }
    }

    let progressBar = "";
    if (
      currentMediaObject.playback_position_ms !== null &&
      currentMediaObject.duration_ms !== null
    ) {
      progressBar += "|";
      const indicatorIndex = Math.floor(
        10 *
          (currentMediaObject.playback_position_ms /
            currentMediaObject.duration_ms)
      );
      for (let i = 0; i < 10; i++) {
        progressBar += i === indicatorIndex ? "o" : "-";
      }
      progressBar += "| ";
      progressBar += `(${formatMilliseconds(currentMediaObject.playback_position_ms)}/${formatMilliseconds(currentMediaObject.duration_ms)})`;
    }

    presence = {
      activities: [
        {
          name: currentMediaObject.title ?? "something",
          type: ActivityType.Listening,
          state: progressBar ? progressBar : undefined,
          url: currentMediaObject.url,
        },
      ],
    };
  }
  if (presence) {
    client.user.setPresence(presence);
  } else {
    client.user.setPresence({});
  }
}

const formatter = new Intl.DurationFormat("en", {
  style: "digital",
  hoursDisplay: "auto",
});
function formatMilliseconds(milliseconds: number) {
  const duration: Intl.DurationInput = {};
  while (milliseconds >= hour) {
    milliseconds -= hour;
    duration.hours = (duration.hours ?? 0) + 1;
  }
  while (milliseconds >= minute) {
    milliseconds -= minute;
    duration.minutes = (duration.minutes ?? 0) + 1;
  }
  while (milliseconds >= second) {
    milliseconds -= second;
    duration.seconds = (duration.seconds ?? 0) + 1;
  }
  duration.milliseconds = 0;
  return formatter.format(duration);
}

export function stopCurrent(guildId: string) {
  const existingVoiceConnection = getVoiceConnection(guildId);
  if (!existingVoiceConnection) {
    return;
  }
  const player = mapVoiceConnectionToAudioPlayer.get(existingVoiceConnection);
  player?.stop();
}

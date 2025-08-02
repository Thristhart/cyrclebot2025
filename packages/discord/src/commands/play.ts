import { addToEndOfQueue } from "@cyrclebot/data";
import { getMediaObjectsFromYoutubeURL } from "@cyrclebot/youtube";
import {
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  DiscordAPIError,
  Guild,
  SlashCommandBuilder,
  StageChannel,
  User,
  VoiceBasedChannel,
  VoiceChannel,
} from "discord.js";
import assert from "node:assert";
import { checkPlaybackStatus } from "../playback";

export async function executePlayCommand(
  guild: Guild | null,
  client: Client,
  user: User,
  url: string,
  voiceChannel: StageChannel | VoiceChannel | null,
  reply: (message: string) => Promise<unknown>
) {
  if (voiceChannel) {
    assert(
      ((c: typeof voiceChannel): c is VoiceBasedChannel =>
        c.type === ChannelType.GuildVoice ||
        c.type === ChannelType.GuildStageVoice)(voiceChannel),
      "Must specify valid voice channel"
    );
  } else if (guild) {
    try {
      const voiceState = await guild.voiceStates.fetch(user);
      voiceChannel = voiceState.channel;
    } catch (e) {
      if (e instanceof DiscordAPIError) {
        // ignore
      } else {
        throw e;
      }
    }
  } else if (!guild) {
    const guilds = await client.guilds.fetch();

    const guildObjects = await Promise.allSettled(
      guilds.map(async (guild) => {
        return guild.fetch();
      })
    );
    await Promise.allSettled(
      guildObjects.map(async (result) => {
        if (result.status !== "fulfilled") {
          return;
        }
        try {
          const voiceState = await result.value.voiceStates.fetch(user);
          voiceChannel = voiceState.channel;
        } catch (e) {
          if (e instanceof DiscordAPIError) {
            // ignore
          } else {
            throw e;
          }
        }
      })
    );
  }

  assert(
    voiceChannel,
    "Must either specify a voice channel or be in a voice channel"
  );
  const youtubeMediaObjects = await getMediaObjectsFromYoutubeURL(url);
  console.log(youtubeMediaObjects);

  let queuedAnything = false;

  if (youtubeMediaObjects.length > 0) {
    for (const object of youtubeMediaObjects) {
      queuedAnything = true;
      addToEndOfQueue({
        ...object,
        server_id: voiceChannel.guildId,
        channel_id: voiceChannel.id,
      });
    }
    await reply(`Added ${youtubeMediaObjects.length} to the queue`);
  }

  if (!queuedAnything) {
    await reply("Couldn't find any media to queue");
    return;
  }
  checkPlaybackStatus();
}

export const playCommand = {
  slashCommand: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a youtube video or mp3 in the current channel")
    .addStringOption((option) =>
      option
        .setName("url")
        .setRequired(true)
        .setDescription("The URL to a video or mp3 file to play")
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("the channel to play in")
        .addChannelTypes(ChannelType.GuildVoice)
        .addChannelTypes(ChannelType.GuildStageVoice)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const url = interaction.options.getString("url");
    assert(url, "Must specify URL");
    const voiceChannelOption = interaction.options.getChannel(
      "channel",
      false,
      [ChannelType.GuildVoice, ChannelType.GuildStageVoice]
    );

    await executePlayCommand(
      interaction.guild,
      interaction.client,
      interaction.user,
      url,
      voiceChannelOption,
      async (msg: string) => interaction.reply(msg)
    );
  },
} as const;

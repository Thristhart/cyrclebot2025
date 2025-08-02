import { addToEndOfQueue } from "@cyrclebot/data";
import { getMediaObjectsFromYoutubeURL } from "@cyrclebot/youtube";
import {
  ChannelType,
  ChatInputCommandInteraction,
  DiscordAPIError,
  SlashCommandBuilder,
  VoiceBasedChannel,
} from "discord.js";
import assert from "node:assert";
import { checkPlaybackStatus } from "../playback";

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
    let channel = interaction.options.getChannel("channel");

    if (channel) {
      assert(
        ((c: typeof channel): c is VoiceBasedChannel =>
          c.type === ChannelType.GuildVoice ||
          c.type === ChannelType.GuildStageVoice)(channel),
        "Must specify valid voice channel"
      );
    } else if (interaction.guild) {
      try {
        const voiceState = await interaction.guild.voiceStates.fetch(
          interaction.user
        );
        channel = voiceState.channel;
      } catch (e) {
        if (e instanceof DiscordAPIError) {
          // ignore
        } else {
          throw e;
        }
      }
    } else if (!interaction.guild) {
      const guilds = await interaction.client.guilds.fetch();

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
            const voiceState = await result.value.voiceStates.fetch(
              interaction.user
            );
            channel = voiceState.channel;
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
      channel,
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
          server_id: channel.guildId,
          channel_id: channel.id,
        });
      }
      await interaction.reply(
        `Added ${youtubeMediaObjects.length} to the queue`
      );
    }

    if (!queuedAnything) {
      await interaction.reply("Couldn't find any media to queue");
      return;
    }
    checkPlaybackStatus();
  },
} as const;

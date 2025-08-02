import { addToEndOfQueue } from "@cyrclebot/data";
import {
  ChannelType,
  ChatInputCommandInteraction,
  DiscordAPIError,
  SlashCommandBuilder,
  VoiceBasedChannel,
} from "discord.js";
import assert from "node:assert";
import { checkPlaybackStatus } from "../playback";

assert(process.env.BANDLE_DATA_LOCATION, "Need BANDLE_DATA_LOCATION");

interface GlorpSong {
  day: string; //"2022-09-23",
  folder: string; // relative path
  song: string;
  songDisplay: string;
  instruments: string[];
  youtube: string;
  year: number;
  par: number;
  bpm: number;
  genre: string[];
  clue: {
    en: string;
  };
  wiki_en: string;
  sources: string[];
}
interface GlorpDataShape {
  packs: Array<GlorpSong[]>;
}
const glorpData = require(
  process.env.BANDLE_DATA_LOCATION + "raw.json"
) as GlorpDataShape;

const allSongs = new Map<string, GlorpSong>();

glorpData.packs.forEach((pack) => {
  pack.forEach((song) => {
    allSongs.set(song.folder, song);
  });
});

const songKeys = Array.from(allSongs.keys());

export const glorpCommand = {
  slashCommand: new SlashCommandBuilder()
    .setName("glorp")
    .setDescription("Play a random bandle song")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("the channel to play in")
        .addChannelTypes(ChannelType.GuildVoice)
        .addChannelTypes(ChannelType.GuildStageVoice)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    let channel = interaction.options.getChannel("channel");

    if (channel) {
      assert(
        ((c: typeof channel): c is VoiceBasedChannel =>
          c.type === ChannelType.GuildVoice ||
          c.type === ChannelType.GuildStageVoice)(channel),
        "Must specify valid voice channel"
      );
    } else if (
      interaction.guild &&
      interaction.member &&
      "_roles" in interaction.member
    ) {
      try {
        const voiceState = await interaction.guild.voiceStates.fetch(
          interaction.member
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

    const key = songKeys[Math.floor(Math.random() * songKeys.length)];
    const song = allSongs.get(key)!;
    addToEndOfQueue({
      server_id: channel.guildId,
      channel_id: channel.id,
      url: `file://${process.env.BANDLE_DATA_LOCATION}${song.folder}/5.mp3`,
      title: "bandle",
    });
    checkPlaybackStatus();
    interaction.reply(
      `added bandle to queue hint: ||${song.clue.en}|| name: ||${song.songDisplay || song.song}||`
    );
  },
};

import { getQueueForServer, removeObjectFromQueue } from "@cyrclebot/data";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import assert from "node:assert";
import { stopCurrent } from "../playback";

export const skipCommand = {
  slashCommand: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the currently playing sound"),
  async execute(interaction: ChatInputCommandInteraction) {
    assert(interaction.guild, "Must use in a discord server");
    const queue = getQueueForServer(interaction.guild.id);
    assert(queue.length, "There's nothing in the queue right now.");
    const current = queue[0];
    removeObjectFromQueue(current.id);
    stopCurrent(interaction.guild.id);
    interaction.reply(`Skipped ${current.title}`);
  },
};

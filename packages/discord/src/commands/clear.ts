import { clearQueueForServer, getQueueForServer } from "@cyrclebot/data";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import assert from "node:assert";
import { stopCurrent } from "../playback";

export const clearCommand = {
  slashCommand: new SlashCommandBuilder()
    .setName("clear")
    .setDescription(
      "Delete everything in the queue and stop anything currently playing"
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    assert(interaction.guild, "Must use in a discord server");
    const queue = getQueueForServer(interaction.guild.id);
    assert(queue.length, "There's nothing in the queue right now.");
    clearQueueForServer(interaction.guild.id);
    stopCurrent(interaction.guild.id);
    stopCurrent(interaction.guild.id);
    interaction.reply(`Cleared the queue.`);
  },
};

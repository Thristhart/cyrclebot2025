import { saveUserIfNotExist, setUserAvatar } from "@cyrclebot/data";
import { playCommand } from "./play";

import {
  ChatInputCommandInteraction,
  Client,
  Events,
  MessageFlags,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import { clearCommand } from "./clear";
import { skipCommand } from "./skip";

export interface Command {
  slashCommand: SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Map<string, Command>();

function registerCommand(command: Command) {
  commands.set(command.slashCommand.name, command);
}

export function setupCommands(client: Client) {
  registerCommand(playCommand);
  registerCommand(skipCommand);
  registerCommand(clearCommand);

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }
    saveUserIfNotExist(interaction.user.id, interaction.user.username);
    const avatar = interaction.user.avatarURL();
    if (avatar) {
      setUserAvatar(interaction.user.id, avatar);
    }
    const command = commands.get(interaction.commandName);
    console.log(
      `[${interaction.user.username}] /${interaction.commandName} ${JSON.stringify(interaction.options.data)}`
    );
    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      // possible we're in prod and the dev version registered a new command, so don't answer
      return;
    }
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      let message = "There was an error while executing this command!";
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        message = error.message;
      }
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: message,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: message,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  });
}

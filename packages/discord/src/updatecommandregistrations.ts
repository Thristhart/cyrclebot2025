import { REST, Routes } from "discord.js";
import assert from "node:assert";
import { commands } from "./commands";

const restClient = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);

export async function updateCommandRegistrations() {
  assert(process.env.DISCORD_CLIENT_ID, "Must specify DISCORD_CLIENT_ID");
  const body = [...commands.values()].map((c) => c.slashCommand.toJSON());

  try {
    console.log(
      `Started refreshing ${commands.size} application (/) commands.`
    );

    await restClient.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      {
        body,
      }
    );

    console.log(
      `Successfully reloaded ${commands.size} application (/) commands.`
    );
  } catch (error) {
    console.error(error);
  }
}

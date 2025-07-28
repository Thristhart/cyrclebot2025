import { REST, Routes } from "discord.js";
import assert from "node:assert";
import { commands } from "./commands";

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);

export async function updateCommandRegistrations(guilds: string[]) {
  assert(process.env.DISCORD_CLIENT_ID, "Must specify DISCORD_CLIENT_ID");
  const body = [...commands.values()].map((c) => c.slashCommand.toJSON());

  try {
    console.log(
      `Started refreshing ${commands.size} application (/) commands.`
    );

    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
      body: [],
    });

    await Promise.all(
      guilds.map(async (guildId) => {
        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(
          Routes.applicationGuildCommands(
            process.env.DISCORD_CLIENT_ID!,
            guildId
          ),
          { body }
        );
      })
    );

    console.log(
      `Successfully reloaded ${commands.size} application (/) commands.`
    );
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
}

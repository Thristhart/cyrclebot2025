import { Client, Events, GatewayIntentBits } from "discord.js";
import "dotenv/config";
import assert from "node:assert";
import { setupCommands } from "./commands";
import { checkPlaybackStatus } from "./playback";
import { minute } from "./time";
import { updateCommandRegistrations } from "./updatecommandregistrations";
import { updateUserList } from "./updateuserlist";

assert(process.env.DISCORD_BOT_TOKEN, "Must specify DISCORD_BOT_TOKEN");

const unreadyClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

unreadyClient.login(process.env.DISCORD_BOT_TOKEN);

setupCommands(unreadyClient);

await new Promise((resolve) => unreadyClient.once(Events.ClientReady, resolve));
export const client = unreadyClient as Client<true>;
console.log(`Ready! Logged in as ${client.user.tag}`);

const guildCollection = await client.guilds.fetch();
const guildIds = guildCollection.map((guild) => guild.id);

const startupTasks = [updateUserList(), updateCommandRegistrations(guildIds)];
await Promise.all(startupTasks);

setInterval(async () => {
  await updateUserList();
}, 5 * minute);

checkPlaybackStatus();

setInterval(async () => {
  checkPlaybackStatus();
}, minute);

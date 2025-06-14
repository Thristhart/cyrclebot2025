import { Client, Events, GatewayIntentBits } from "discord.js";
import "dotenv/config";
import assert from "node:assert";
import { minute } from "./time";
import { updateUserList } from "./updateuserlist";

assert(process.env.DISCORD_BOT_TOKEN, "Must specify DISCORD_BOT_TOKEN");

const unreadyClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
});

unreadyClient.login(process.env.DISCORD_BOT_TOKEN);

await new Promise((resolve) => unreadyClient.once(Events.ClientReady, resolve));
export const client = unreadyClient as Client<true>;
console.log(`Ready! Logged in as ${client.user.tag}`);

await updateUserList();

setInterval(async () => {
  await updateUserList();
}, 5 * minute);

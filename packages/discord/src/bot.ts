import { saveUserIfNotExist, setUserAvatar } from "@cyrclebot/data";
import { Client, Events, GatewayIntentBits } from "discord.js";
import "dotenv/config";
import assert from "node:assert";

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
const client = unreadyClient as Client<true>;
console.log(`Ready! Logged in as ${client.user.tag}`);

console.log("updating user list...");
const guildCollection = await client.guilds.fetch();
await Promise.all(
  guildCollection.map(async (oauthGuild) => {
    const guild = await oauthGuild.fetch();
    console.log(`fetching members for ${oauthGuild.name}...`);
    const members = await guild.members.fetch();
    for (const member of members.values()) {
      saveUserIfNotExist(member.user.id, member.user.username);
      const avatar = member.user.avatarURL();
      if (avatar) {
        setUserAvatar(member.user.id, avatar);
      }
    }
  })
);
console.log("updated user list.");

import { saveUserIfNotExist, setUserAvatar } from "@cyrclebot/data";
import { client } from "./bot";

export async function updateUserList() {
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
}

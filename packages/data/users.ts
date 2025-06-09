import { database } from "./database";
import { UserDBO, WriteUserDBO } from "./model";

export function getAllUsers() {
  const statement = database.prepare("SELECT * FROM users");
  return statement.all() as Array<UserDBO>;
}

export function doesUserWithDiscordIDExist(discord_id: string) {
  const statement = database
    .prepare("SELECT EXISTS(SELECT 1 FROM users WHERE discord_id = ?)")
    .pluck();
  return statement.get(discord_id) === 1;
}

export function saveUserIfNotExist(
  discord_id: string,
  discord_username: string
) {
  if (doesUserWithDiscordIDExist(discord_id)) {
    return;
  }
  saveUser(discord_id, discord_username);
}

export function saveUser(discord_id: string, discord_username: string) {
  const statement = database.prepare<WriteUserDBO>(
    "INSERT into users (discord_id, discord_username) VALUES (@discord_id, @discord_username)"
  );
  statement.run({
    discord_id,
    discord_username,
  });
}
export function setUserAvatar(discord_id: string, avatar: string) {
  const statement = database.prepare<WriteUserDBO>(
    "UPDATE users SET avatar=@avatar WHERE discord_id=@discord_id"
  );
  statement.run({
    discord_id,
    avatar,
  });
}

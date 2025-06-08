import Database from "better-sqlite3";
import "dotenv/config";

export const database = new Database(
  process.env.DATABASE_URL?.split("sqlite:")?.[1] ?? ":memory:"
);
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");

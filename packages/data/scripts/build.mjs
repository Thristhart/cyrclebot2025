import * as sqlts from "@rmp135/sql-ts";
import { execFileSync } from "child_process";
import * as dbmate from "dbmate";
import "dotenv/config";
import fs from "fs/promises";

if (process.env.DATABASE_URL) {
  console.log("dbmate up");
  execFileSync(dbmate.resolveBinary(), ["up"], { stdio: "inherit" });

  console.log("generating TS bindings for SQL...");
  const tsReadString = await sqlts.Client.fromConfig({
    client: "better-sqlite3",
    connection: {
      filename: process.env.DATABASE_URL.split("sqlite:")[1],
    },
    useNullAsDefault: true,
    interfaceNameFormat: "${table}DBO",
    tableNameCasing: "pascal",
    singularTableNames: true,
    globalOptionality: "required",
  }).fetchDatabase().toTypescript();
  const tsWriteString = await sqlts.Client.fromConfig({
    client: "better-sqlite3",
    connection: {
      filename: process.env.DATABASE_URL.split("sqlite:")[1],
    },
    useNullAsDefault: true,
    interfaceNameFormat: "Write${table}DBO",
    tableNameCasing: "pascal",
    singularTableNames: true,
    globalOptionality: "dynamic",
  }).fetchDatabase().toTypescript();
  const tsString = tsReadString + "\n" + tsWriteString;

  const modelPath = "./model.ts";

  const existingModel = await fs.readFile(modelPath, "utf8");
  if (existingModel !== tsString) {
    await fs.writeFile(modelPath, tsString);
  }
}

console.log("database interface built.");
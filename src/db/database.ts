import Database from "better-sqlite3";
import dotenv from "dotenv";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

dotenv.config({ quiet: true });

const isTest = process.env.NODE_ENV === "test";
const dbPath = isTest ? ":memory:" : process.env.DB_PATH || "./db/crypto.db";

if (dbPath !== ":memory:") {
  mkdirSync(dirname(dbPath), { recursive: true });
}

export const db = new Database(dbPath);

if (!isTest) {
  db.pragma("journal_mode = WAL");
}
db.pragma("foreign_keys = ON");

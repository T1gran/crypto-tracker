import Database from "better-sqlite3";
import dotenv from "dotenv";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

dotenv.config();

const dbPath = process.env.DB_PATH || "./db/crypto.db";

if (dbPath !== ":memory:") {
  mkdirSync(dirname(dbPath), { recursive: true });
}

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export const initDb = (): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS coins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin_symbol TEXT NOT NULL,
      price REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (coin_symbol) REFERENCES coins (symbol) ON DELETE CASCADE
    );
  `);

  console.log("Tables created");
};

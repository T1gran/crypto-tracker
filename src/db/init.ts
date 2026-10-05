import { db } from "./database";

export const initDb = (): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_value TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coin_symbol TEXT NOT NULL,
      price_usd REAL NOT NULL,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (coin_symbol) REFERENCES coins (symbol) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_price_history_symbol_time 
    ON price_history(coin_symbol, fetched_at DESC);
  `);

  const defaultKey = process.env.DEFAULT_API_KEY || "dev-secret-key";
  db.prepare(
    `
    INSERT OR IGNORE INTO api_keys (key_value, client_name) 
    VALUES (?, ?)
  `,
  ).run(defaultKey, "Development Client");

  console.log("Database initialized successfully.");
};

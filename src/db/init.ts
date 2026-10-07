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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_synced_at DATETIME
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

  const columns = db.prepare("PRAGMA table_info(coins)").all() as Array<{
    name: string;
  }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("updated_at")) {
    db.exec("ALTER TABLE coins ADD COLUMN updated_at DATETIME");
    db.exec(
      "UPDATE coins SET updated_at = created_at WHERE updated_at IS NULL",
    );
  }

  if (!columnNames.has("last_synced_at")) {
    db.exec("ALTER TABLE coins ADD COLUMN last_synced_at DATETIME");
  }

  console.log("Database initialized successfully.");
};

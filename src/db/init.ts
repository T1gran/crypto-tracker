import { db } from "./database";

export const initDb = (): void => {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_value TEXT NOT NULL UNIQUE,
        client_name TEXT NOT NULL,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE TABLE IF NOT EXISTS coins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_synced_at TEXT
      );

      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coin_symbol TEXT NOT NULL,
        price_usd REAL NOT NULL,
        fetched_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
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
      db.exec("ALTER TABLE coins ADD COLUMN updated_at TEXT");
      db.exec(
        "UPDATE coins SET updated_at = created_at WHERE updated_at IS NULL",
      );
    }

    if (!columnNames.has("last_synced_at")) {
      db.exec("ALTER TABLE coins ADD COLUMN last_synced_at TEXT");
    }

    if (db.pragma("user_version", { simple: true }) === 0) {
      const timestampColumns = [
        ["api_keys", "created_at"],
        ["coins", "created_at"],
        ["coins", "updated_at"],
        ["coins", "last_synced_at"],
        ["price_history", "fetched_at"],
      ] as const;

      for (const [table, column] of timestampColumns) {
        const normalized = `strftime('%Y-%m-%dT%H:%M:%fZ', ${column})`;
        const invalid = db
          .prepare(
            `SELECT 1 FROM ${table} WHERE ${column} IS NOT NULL AND ${normalized} IS NULL LIMIT 1`,
          )
          .get();
        if (invalid) {
          throw new Error(`Cannot normalize invalid timestamps in ${table}.${column}`);
        }
        db.exec(
          `UPDATE ${table} SET ${column} = ${normalized} WHERE ${column} IS NOT NULL AND ${column} != ${normalized}`,
        );
      }
      db.pragma("user_version = 1");
    }
  })();

  console.log("Database initialized successfully.");
};

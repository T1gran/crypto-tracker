import { PriceHistoryOptions, PriceHistoryRow } from "../../types/db.types";
import { db } from "../database";
import { normalizeHistoryRange } from "../../utils/date-time";

export class PriceRepository {
  static savePrice(symbol: string, priceUsd: number) {
    const formattedSymbol = symbol.toUpperCase().trim();
    const insertPrice = db.prepare(
      "INSERT INTO price_history (coin_symbol, price_usd, fetched_at) VALUES (?, ?, ?)",
    );
    const updateCoin = db.prepare(
      "UPDATE coins SET last_synced_at = ?, updated_at = ? WHERE symbol = ?",
    );

    db.transaction(() => {
      const timestamp = new Date().toISOString();
      insertPrice.run(formattedSymbol, priceUsd, timestamp);
      updateCoin.run(timestamp, timestamp, formattedSymbol);
    })();
  }

  static getHistoryBySymbol(
    symbol: string,
    options: PriceHistoryOptions = {},
  ): PriceHistoryRow[] {
    const formattedSymbol = symbol.toUpperCase().trim();
    const { limit = 100, offset = 0 } = options;
    const { from, to } = normalizeHistoryRange(options.from, options.to);

    let query = "SELECT * FROM price_history WHERE coin_symbol = ?";
    const params: (string | number)[] = [formattedSymbol];

    if (from) {
      query += " AND fetched_at >= ?";
      params.push(from);
    }

    if (to) {
      query += " AND fetched_at <= ?";
      params.push(to);
    }

    query += " ORDER BY fetched_at DESC, id DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const stmt = db.prepare<unknown[], PriceHistoryRow>(query);
    return stmt.all(...params);
  }

  static savePricesBatch(
    items: Array<{ symbol: string; price: number }>,
  ): void {
    if (items.length === 0) return;

    const stmt = db.prepare(
      "INSERT INTO price_history (coin_symbol, price_usd, fetched_at) VALUES (?, ?, ?)",
    );
    const updateCoin = db.prepare(
      "UPDATE coins SET last_synced_at = ?, updated_at = ? WHERE symbol = ?",
    );

    const insertMany = db.transaction((data: typeof items) => {
      const timestamp = new Date().toISOString();
      for (const item of data) {
        stmt.run(item.symbol, item.price, timestamp);
        updateCoin.run(timestamp, timestamp, item.symbol.toUpperCase().trim());
      }
    });

    insertMany(items);
  }
}

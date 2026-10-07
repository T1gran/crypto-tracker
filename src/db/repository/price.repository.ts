import { PriceHistoryOptions, PriceHistoryRow } from "../../types/db.types";
import { db } from "../database";

export class PriceRepository {
  static savePrice(symbol: string, priceUsd: number) {
    const formattedSymbol = symbol.toUpperCase().trim();
    const insertPrice = db.prepare(
      "INSERT INTO price_history (coin_symbol, price_usd) VALUES (?,?)",
    );
    const updateCoin = db.prepare(
      "UPDATE coins SET last_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE symbol = ?",
    );

    db.transaction(() => {
      insertPrice.run(formattedSymbol, priceUsd);
      updateCoin.run(formattedSymbol);
    })();
  }

  static getHistoryBySymbol(
    symbol: string,
    options: PriceHistoryOptions = {},
  ): PriceHistoryRow[] {
    const formattedSymbol = symbol.toUpperCase().trim();
    const { limit = 100, offset = 0, from, to } = options;

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

    query += " ORDER BY fetched_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const stmt = db.prepare<unknown[], PriceHistoryRow>(query);
    return stmt.all(...params);
  }

  static savePricesBatch(
    items: Array<{ symbol: string; price: number }>,
  ): void {
    if (items.length === 0) return;

    const stmt = db.prepare(
      "INSERT INTO price_history (coin_symbol, price_usd) VALUES (?, ?)",
    );
    const updateCoin = db.prepare(
      "UPDATE coins SET last_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE symbol = ?",
    );

    const insertMany = db.transaction((data: typeof items) => {
      for (const item of data) {
        stmt.run(item.symbol, item.price);
        updateCoin.run(item.symbol.toUpperCase().trim());
      }
    });

    insertMany(items);
  }
}

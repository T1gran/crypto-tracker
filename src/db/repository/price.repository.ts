import {
  CoinRow,
  PriceHistoryOptions,
  PriceHistoryRow,
} from "../../types/db.types";
import { db } from "../database";
import { normalizeHistoryRange } from "../../utils/date-time";
import { fetchedPrice } from "../../types/cmc.types";
import { CoinRepository } from "./coin.repository";

export class PriceRepository {
  static savePrice(coinId: number, priceUsd: number): CoinRow | null {
    const insertPrice = db.prepare(
      "INSERT INTO price_history (coin_symbol, price_usd, fetched_at) SELECT symbol, ?, ? FROM coins WHERE id = ?",
    );

    return db.transaction(() => {
      const timestamp = new Date().toISOString();
      const result = insertPrice.run(priceUsd, timestamp, coinId);
      if (result.changes === 0) {
        return null;
      } else {
        const updateCoin = db.prepare(
          "UPDATE coins SET last_synced_at = ?, updated_at = ? WHERE id = ?",
        );
        updateCoin.run(timestamp, timestamp, coinId);
        return CoinRepository.findById(coinId);
      }
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

  static savePricesBatch(items: Array<fetchedPrice>): void {
    if (items.length === 0) return;

    const stmt = db.prepare(
      "INSERT INTO price_history (coin_symbol, price_usd, fetched_at) SELECT symbol, ?, ? FROM coins WHERE id = ?",
    );
    const updateCoin = db.prepare(
      "UPDATE coins SET last_synced_at = ?, updated_at = ? WHERE id = ?",
    );

    const insertMany = db.transaction((data: typeof items) => {
      const timestamp = new Date().toISOString();
      for (const item of data) {
        stmt.run(item.price, timestamp, item.coinId);
        updateCoin.run(timestamp, timestamp, item.coinId);
      }
    });

    insertMany(items);
  }
}

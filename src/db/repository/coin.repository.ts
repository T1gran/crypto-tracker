import { CoinRow } from "../../types/db.types";
import { db } from "../database";

export class CoinRepository {
  static create(symbol: string, name: string) {
    const formattedSymbol = symbol.toUpperCase().trim();
    const stmt = db.prepare("INSERT INTO coins (symbol, name) VALUES (?, ?)");
    stmt.run(formattedSymbol, name);
    return this.findBySymbol(formattedSymbol)!;
  }

  static findBySymbol(symbol: string): CoinRow | null {
    const formattedSymbol = symbol.toUpperCase().trim();
    const stmt = db.prepare<[string], CoinRow>(
      "SELECT * FROM coins WHERE symbol = ?",
    );
    const coin = stmt.get(formattedSymbol);
    return coin ?? null;
  }

  static findAll() {
    const stmt = db.prepare<[], CoinRow>(
      "SELECT * FROM coins WHERE is_active = 1",
    );
    return stmt.all();
  }

  static deleteBySymbol(symbol: string) {
    const formattedSymbol = symbol.toUpperCase().trim();
    const stmt = db.prepare("DELETE FROM coins WHERE symbol = ?");
    const info = stmt.run(formattedSymbol);
    return info.changes > 0;
  }

  static updateCoinStatus(symbol: string, isActive: boolean) {
    const formattedSymbol = symbol.toUpperCase().trim();
    const stmt = db.prepare(
      "UPDATE coins SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE symbol = ?",
    );
    const info = stmt.run(isActive ? 1 : 0, formattedSymbol);
    return info.changes > 0;
  }
}

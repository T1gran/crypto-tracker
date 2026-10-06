import { CoinRow } from "../../types/db.types";
import { db } from "../database";

export class CoinRepository {
  static create(symbol: string, name: string) {
    const formattedSymbol = symbol.toUpperCase().trim();
    const stmt = db.prepare("INSERT INTO coins (symbol, name) VALUES (?, ?)");
    stmt.run(formattedSymbol, name);
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
}

import { ApiKeyRow } from "../../types/db.types";
import { db } from "../database";

export class ApiKeyRepository {
  static create(key: string, name: string) {
    const stmt = db.prepare(
      "INSERT INTO api_keys (key_value, client_name, created_at) VALUES (?, ?, ?)",
    );
    stmt.run(key, name, new Date().toISOString());
  }

  static findByKeyValue(keyValue: string): ApiKeyRow | null {
    const stmt = db.prepare<[string], ApiKeyRow>(
      "SELECT * FROM api_keys WHERE key_value = ?",
    );

    const key = stmt.get(keyValue);

    return key ?? null;
  }
}

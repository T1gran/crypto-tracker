import { ApiKeyRow } from "../../types/db.types";
import { db } from "../database";

export class ApiKeyRepository {
  static findByKeyValue(keyValue: string): ApiKeyRow | null {
    try {
      const stmt = db.prepare<[string], ApiKeyRow>(
        "SELECT * FROM api_keys WHERE key_value = ?",
      );

      const key = stmt.get(keyValue);

      return key ?? null;
    } catch (error) {
      console.error("Error fetching API key:", error);
      return null;
    }
  }
}

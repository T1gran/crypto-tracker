import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import supertest from "supertest";
import { app } from "../app";
import { db } from "../db/database";
import { initDb } from "../db/init";
import { ApiKeyRepository } from "../db/repository/api-key.repository";
import { CoinRepository } from "../db/repository/coin.repository";
import { PriceRepository } from "../db/repository/price.repository";

const request = supertest(app);
const token = "test_dates_token";
const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
afterAll(() => { db.close(); });
const dropSchema = () => db.exec(`
  DROP TABLE IF EXISTS price_history;
  DROP TABLE IF EXISTS coins;
  DROP TABLE IF EXISTS api_keys;
  PRAGMA user_version = 0;
`);
const insertPrice = (timestamp: string, price: number) => db.prepare(
  "INSERT INTO price_history (coin_symbol, price_usd, fetched_at) VALUES ('BTC', ?, ?)",
).run(price, timestamp);

async function history(query: Record<string, string> = {}) {
  return request.get("/coins/BTC/history")
    .set("Authorization", `Bearer ${token}`).query(query);
}

describe("UTC storage, API responses and history filters", () => {
  beforeEach(() => {
    dropSchema();
    initDb();
    ApiKeyRepository.create(token, "Dates Test");
    CoinRepository.create("BTC", "Bitcoin");
  });

  it("writes canonical UTC dates through every repository", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-08T17:00:00.123+07:00"));
    const expected = "2026-10-08T10:00:00.123Z";
    try {
      ApiKeyRepository.create("dated_key", "Dates");
      CoinRepository.create("ETH", "Ethereum");
      expect(ApiKeyRepository.findByKeyValue("dated_key")?.created_at).toBe(expected);
      expect(CoinRepository.findBySymbol("ETH")).toMatchObject({
        created_at: expected, updated_at: expected, last_synced_at: null,
      });
      CoinRepository.updateCoinStatus("ETH", false);
      expect(CoinRepository.findBySymbol("ETH")?.updated_at).toBe(expected);
      PriceRepository.savePrice("BTC", 100);
      PriceRepository.savePricesBatch([{ symbol: "ETH", price: 10 }]);
      for (const symbol of ["BTC", "ETH"]) {
        expect(PriceRepository.getHistoryBySymbol(symbol)[0]?.fetched_at).toBe(expected);
        expect(CoinRepository.findBySymbol(symbol)).toMatchObject({
          last_synced_at: expected, updated_at: expected,
        });
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it("uses canonical UTC timestamps for SQLite defaults too", () => {
    db.prepare("INSERT INTO coins (symbol, name) VALUES ('ETH', 'Ethereum')").run();
    db.prepare("INSERT INTO api_keys (key_value, client_name) VALUES ('default_key', 'Dates')").run();
    db.prepare("INSERT INTO price_history (coin_symbol, price_usd) VALUES ('ETH', 10)").run();
    const coin = CoinRepository.findBySymbol("ETH")!;
    expect(coin.created_at).toMatch(UTC_PATTERN);
    expect(coin.updated_at).toMatch(UTC_PATTERN);
    expect(ApiKeyRepository.findByKeyValue("default_key")?.created_at).toMatch(UTC_PATTERN);
    expect(PriceRepository.getHistoryBySymbol("ETH")[0]?.fetched_at).toMatch(UTC_PATTERN);
  });

  it("returns UTC ISO date-times for coin and history responses", async () => {
    PriceRepository.savePrice("BTC", 100);
    const coinResponse = await request.get("/coins/BTC").set("Authorization", `Bearer ${token}`);
    const listResponse = await request.get("/coins").set("Authorization", `Bearer ${token}`);
    const historyResponse = await history();
    expect(coinResponse.status).toBe(200);
    expect(listResponse.status).toBe(200);
    expect(historyResponse.status).toBe(200);
    for (const coin of [coinResponse.body.data, listResponse.body.data[0]]) {
      for (const field of ["created_at", "updated_at", "last_synced_at"]) {
        expect(coin[field]).toMatch(UTC_PATTERN);
      }
    }
    expect(historyResponse.body.data[0].fetched_at).toMatch(UTC_PATTERN);
  });

  it("includes both exact boundaries and excludes adjacent milliseconds", async () => {
    insertPrice("2026-10-08T10:00:00.122Z", 1);
    insertPrice("2026-10-08T10:00:00.123Z", 2);
    insertPrice("2026-10-08T10:00:00.124Z", 3);
    insertPrice("2026-10-08T10:00:00.125Z", 4);
    const response = await history({
      from: "2026-10-08T10:00:00.123Z", to: "2026-10-08T10:00:00.124Z",
    });
    expect(response.status).toBe(200);
    expect(response.body.data.map((row: { price_usd: number }) => row.price_usd)).toEqual([3, 2]);
  });

  it("treats equal bounds with different offsets as the same instant", async () => {
    insertPrice("2026-10-08T10:00:00.123Z", 100);
    const response = await history({
      from: "2026-10-08T17:00:00.123+07:00", to: "2026-10-08T06:00:00.123-04:00",
    });
    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.data[0].fetched_at).toBe("2026-10-08T10:00:00.123Z");
  });

  it("filters offsets correctly across UTC midnight", async () => {
    insertPrice("2026-10-07T23:59:59.999Z", 1);
    insertPrice("2026-10-08T00:00:00.000Z", 2);
    insertPrice("2026-10-08T00:00:00.001Z", 3);
    const response = await history({
      from: "2026-10-07T20:00:00-04:00", to: "2026-10-08T07:00:00+07:00",
    });
    expect(response.status).toBe(200);
    expect(response.body.data.map((row: { price_usd: number }) => row.price_usd)).toEqual([2]);
  });

  it("includes a complete date-only UTC day without adjacent days", async () => {
    insertPrice("2026-10-07T23:59:59.999Z", 1);
    insertPrice("2026-10-08T00:00:00.000Z", 2);
    insertPrice("2026-10-08T23:59:59.999Z", 3);
    insertPrice("2026-10-09T00:00:00.000Z", 4);
    const response = await history({ from: "2026-10-08", to: "2026-10-08" });
    expect(response.status).toBe(200);
    expect(response.body.data.map((row: { price_usd: number }) => row.price_usd)).toEqual([3, 2]);
  });

  it("applies individual lower and upper bounds chronologically", async () => {
    insertPrice("2026-10-08T08:00:00.000Z", 1);
    insertPrice("2026-10-08T10:00:00.000Z", 2);
    const lower = await history({ from: "2026-10-08T09:00:00Z" });
    const upper = await history({ to: "2026-10-08T09:00:00Z" });
    expect(lower.status).toBe(200);
    expect(upper.status).toBe(200);
    expect(lower.body.data.map((row: { price_usd: number }) => row.price_usd)).toEqual([2]);
    expect(upper.body.data.map((row: { price_usd: number }) => row.price_usd)).toEqual([1]);
  });

  it("orders equal timestamps by id for deterministic pagination", async () => {
    insertPrice("2026-10-08T10:00:00.123Z", 1);
    insertPrice("2026-10-08T10:00:00.123Z", 2);
    const first = await history({ limit: "1" });
    const second = await history({ limit: "1", offset: "1" });
    expect(first.body.data[0].price_usd).toBe(2);
    expect(second.body.data[0].price_usd).toBe(1);
  });

  it.each(["from", "to"])("rejects invalid calendar and timezone inputs in %s", async (bound) => {
    for (const date of ["2026-02-30", "2026-02-29", "2026-10-08T10:00:00", "2026-10-08T10:00:00+24:00"]) {
      const response = await history({ [bound]: date });
      expect(response.status).toBe(400);
      expect(response.body.message).toContain("valid dates");
    }
  });

  it("rejects reversed UTC ranges even when local clock times appear ordered", async () => {
    const response = await history({ from: "2026-10-08T10:00:00Z", to: "2026-10-08T16:00:00+07:00" });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("must not be later");
  });
});

describe("legacy timestamp migration", () => {
  beforeEach(() => {
    dropSchema();
    db.exec(`
      CREATE TABLE api_keys (id INTEGER PRIMARY KEY, key_value TEXT UNIQUE NOT NULL, client_name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE coins (id INTEGER PRIMARY KEY, symbol TEXT UNIQUE NOT NULL, name TEXT NOT NULL, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE price_history (id INTEGER PRIMARY KEY, coin_symbol TEXT NOT NULL, price_usd REAL NOT NULL, fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (coin_symbol) REFERENCES coins(symbol) ON DELETE CASCADE);
      INSERT INTO api_keys VALUES (1, '${token}', 'Legacy', '2026-10-08 10:00:00');
      INSERT INTO coins VALUES (1, 'BTC', 'Bitcoin', 1, '2026-10-08 10:00:00');
      INSERT INTO price_history VALUES (1, 'BTC', 100, '2026-10-08 10:00:00');
      INSERT INTO price_history VALUES (2, 'BTC', 200, '2026-10-08T17:00:00.123+07:00');
    `);
  });

  it("migrates SQLite UTC and offset timestamps without losing rows or relationships", async () => {
    initDb();
    expect(db.pragma("user_version", { simple: true })).toBe(1);
    expect(ApiKeyRepository.findByKeyValue(token)?.created_at).toBe("2026-10-08T10:00:00.000Z");
    expect(CoinRepository.findBySymbol("BTC")).toMatchObject({
      id: 1, created_at: "2026-10-08T10:00:00.000Z", updated_at: "2026-10-08T10:00:00.000Z", last_synced_at: null,
    });
    expect(PriceRepository.getHistoryBySymbol("BTC").map(row => row.fetched_at)).toEqual([
      "2026-10-08T10:00:00.123Z", "2026-10-08T10:00:00.000Z",
    ]);
    expect(db.pragma("foreign_key_check")).toEqual([]);
    const response = await history({ from: "2026-10-08T09:00:00Z", to: "2026-10-08T11:00:00Z" });
    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    const original = PriceRepository.getHistoryBySymbol("BTC");
    initDb();
    expect(PriceRepository.getHistoryBySymbol("BTC")).toEqual(original);
    CoinRepository.create("ETH", "Ethereum");
    PriceRepository.savePrice("BTC", 300);
    PriceRepository.savePricesBatch([{ symbol: "ETH", price: 10 }]);
    expect(CoinRepository.findBySymbol("ETH")?.created_at).toMatch(UTC_PATTERN);
    expect(PriceRepository.getHistoryBySymbol("BTC")[0]?.fetched_at).toMatch(UTC_PATTERN);
    expect(PriceRepository.getHistoryBySymbol("ETH")[0]?.fetched_at).toMatch(UTC_PATTERN);
  });

  it("normalizes existing updated and synced dates as well", () => {
    db.exec(`
      ALTER TABLE coins ADD COLUMN updated_at DATETIME;
      ALTER TABLE coins ADD COLUMN last_synced_at DATETIME;
      UPDATE coins SET updated_at = '2026-10-08T06:00:00.456-04:00', last_synced_at = '2026-10-08 10:00:00';
    `);
    initDb();
    expect(CoinRepository.findBySymbol("BTC")).toMatchObject({
      updated_at: "2026-10-08T10:00:00.456Z", last_synced_at: "2026-10-08T10:00:00.000Z",
    });
  });

  it("rolls back migration atomically when an existing timestamp cannot be parsed", () => {
    db.exec("UPDATE price_history SET fetched_at = 'not-a-date' WHERE id = 2");
    expect(() => initDb()).toThrow("Cannot normalize invalid timestamps");
    expect(db.pragma("user_version", { simple: true })).toBe(0);
    expect(ApiKeyRepository.findByKeyValue(token)?.created_at).toBe("2026-10-08 10:00:00");
    expect(db.prepare("SELECT fetched_at FROM price_history WHERE id = 2").get()).toEqual({ fetched_at: "not-a-date" });
  });
});

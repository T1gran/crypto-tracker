import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { AxiosAdapter, AxiosInstance } from "axios";
import supertest from "supertest";
import { app } from "../app";
import { db } from "../db/database";
import { initDb } from "../db/init";
import { ApiKeyRepository } from "../db/repository/api-key.repository";
import { CoinRepository } from "../db/repository/coin.repository";
import { PriceRepository } from "../db/repository/price.repository";
import { coinMarketCapService } from "../services/coinmarketcap.service";
import { PriceSyncService } from "../services/sync.service";
import { cmcSimplePriceFixture } from "./fixtures/cmc-simple-price";

// Replace only HTTP transport: controllers, CMC parsing, worker and SQLite stay real.
const client = (coinMarketCapService as unknown as { client: AxiosInstance }).client;
const originalAdapter = client.defaults.adapter;
const request = supertest(app);
const token = "test_cmc_integration_token";
let payload = structuredClone(cmcSimplePriceFixture);
const adapter = jest.fn<AxiosAdapter>();

describe("CMC response integration", () => {
  beforeAll(() => initDb());

  beforeEach(() => {
    db.exec("DELETE FROM price_history; DELETE FROM coins; DELETE FROM api_keys;");
    ApiKeyRepository.create(token, "CMC Integration Test");
    payload = structuredClone(cmcSimplePriceFixture);
    adapter.mockReset();
    adapter.mockImplementation(async (config) => ({
      data: structuredClone(payload),
      status: 200,
      statusText: "OK",
      headers: { "content-type": "application/json" },
      config,
    }));
    client.defaults.adapter = adapter;
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    client.defaults.adapter = originalAdapter;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    db.close();
  });

  it("creates a coin after validating the real string-zero CMC fixture", async () => {
    const response = await request
      .post("/coins")
      .set("Authorization", `Bearer ${token}`)
      .send({ symbol: "btc", name: "Bitcoin" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ symbol: "BTC", name: "Bitcoin" });
    expect(CoinRepository.findBySymbol("BTC")).toMatchObject({
      id: response.body.data.id,
      symbol: "BTC",
      name: "Bitcoin",
    });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0]![0]).toMatchObject({
      url: "/v2/simple/price",
      timeout: 5000,
      params: { symbol: "BTC", name: "Bitcoin", convert: "USD" },
    });
  });

  it("fetches and persists the current price from the string-zero CMC fixture", async () => {
    CoinRepository.create("BTC", "Bitcoin");

    const response = await request
      .get("/coins/BTC/price")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      symbol: "BTC",
      price_usd: 65000.5,
      last_synced_at: expect.any(String),
    });
    expect(PriceRepository.getHistoryBySymbol("BTC")).toEqual([
      expect.objectContaining({ coin_symbol: "BTC", price_usd: 65000.5 }),
    ]);
    expect(CoinRepository.findBySymbol("BTC")?.last_synced_at).toBe(
      response.body.data.last_synced_at,
    );
  });

  it("persists the fixture price on immediate and scheduled worker ticks", async () => {
    jest.useFakeTimers();
    CoinRepository.create("BTC", "Bitcoin");
    const worker = new PriceSyncService(30000);

    try {
      worker.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(PriceRepository.getHistoryBySymbol("BTC")).toEqual([
        expect.objectContaining({ coin_symbol: "BTC", price_usd: 65000.5 }),
      ]);
      expect(CoinRepository.findBySymbol("BTC")?.last_synced_at).toEqual(
        expect.any(String),
      );

      await jest.advanceTimersByTimeAsync(30000);
      expect(adapter).toHaveBeenCalledTimes(2);
      expect(PriceRepository.getHistoryBySymbol("BTC")).toHaveLength(2);
    } finally {
      worker.stop();
    }
  });

  it("rejects creation on a string non-zero code without inserting a coin", async () => {
    payload.status.error_code = "1006";

    const response = await request
      .post("/coins")
      .set("Authorization", `Bearer ${token}`)
      .send({ symbol: "BTC", name: "Bitcoin" });

    expect(response.status).toBe(502);
    expect(CoinRepository.findBySymbol("BTC")).toBeNull();
    expect(PriceRepository.getHistoryBySymbol("BTC")).toEqual([]);
  });

  it("does not persist a current price on a string non-zero code", async () => {
    CoinRepository.create("BTC", "Bitcoin");
    payload.status.error_code = "1006";

    const response = await request
      .get("/coins/BTC/price")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(502);
    expect(PriceRepository.getHistoryBySymbol("BTC")).toEqual([]);
    expect(CoinRepository.findBySymbol("BTC")?.last_synced_at).toBeNull();
  });

  it("keeps polling after rejecting a non-zero code and saves the next valid fixture", async () => {
    jest.useFakeTimers();
    CoinRepository.create("BTC", "Bitcoin");
    payload.status.error_code = "1006";
    const worker = new PriceSyncService(30000);

    try {
      worker.start();
      await jest.advanceTimersByTimeAsync(0);
      expect(adapter).toHaveBeenCalledTimes(1);
      expect(PriceRepository.getHistoryBySymbol("BTC")).toEqual([]);
      expect(CoinRepository.findBySymbol("BTC")?.last_synced_at).toBeNull();

      payload.status.error_code = "0";
      await jest.advanceTimersByTimeAsync(30000);
      expect(adapter).toHaveBeenCalledTimes(2);
      expect(PriceRepository.getHistoryBySymbol("BTC")).toEqual([
        expect.objectContaining({ coin_symbol: "BTC", price_usd: 65000.5 }),
      ]);
    } finally {
      worker.stop();
    }
  });
});

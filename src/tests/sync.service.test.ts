import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { deferred } from "./helpers/deferred";
import { initDb } from "../db/init";
import { db } from "../db/database";
import { CoinRepository } from "../db/repository/coin.repository";
import { PriceRepository } from "../db/repository/price.repository";
import { coinMarketCapService } from "../services/coinmarketcap.service";
import { PriceSyncService } from "../services/sync.service";

jest.mock("../services/coinmarketcap.service", () => ({
  coinMarketCapService: { getPrice: jest.fn() },
}));

const mockedCoinMarketCapService = jest.mocked(coinMarketCapService);

type SyncInternals = {
  syncAllPrices: () => Promise<void>;
};

const runSync = (service: PriceSyncService) =>
  (service as unknown as SyncInternals).syncAllPrices();

describe("PriceSyncService", () => {
  beforeAll(() => {
    initDb();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    db.exec("DELETE FROM price_history; DELETE FROM coins;");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    db.close();
  });

  it("stores prices for all tracked coins during a background sync", async () => {
    CoinRepository.create("BTCUSDT", "Bitcoin");
    CoinRepository.create("ETHUSDT", "Ethereum");
    mockedCoinMarketCapService.getPrice
      .mockResolvedValueOnce(65000.5)
      .mockResolvedValueOnce(3200.25);

    await runSync(new PriceSyncService());

    expect(PriceRepository.getHistoryBySymbol("BTCUSDT")).toHaveLength(1);
    expect(PriceRepository.getHistoryBySymbol("BTCUSDT")[0].price_usd).toBe(65000.5);
    expect(PriceRepository.getHistoryBySymbol("ETHUSDT")[0].price_usd).toBe(3200.25);
    expect(CoinRepository.findBySymbol("BTCUSDT")).toMatchObject({
      last_synced_at: expect.any(String),
      updated_at: expect.any(String),
    });
  });

  it("continues syncing other coins when the external API fails for one", async () => {
    CoinRepository.create("BTCUSDT", "Bitcoin");
    CoinRepository.create("ETHUSDT", "Ethereum");
    const failure = new Error("CoinMarketCap unavailable");
    mockedCoinMarketCapService.getPrice
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(3200.25);
    const logError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await runSync(new PriceSyncService());

    expect(PriceRepository.getHistoryBySymbol("BTCUSDT")).toHaveLength(0);
    expect(PriceRepository.getHistoryBySymbol("ETHUSDT")).toHaveLength(1);
    expect(logError).toHaveBeenCalledWith(
      "[PriceSyncService] Failed to fetch price for 'BTCUSDT':",
      failure,
    );
  });

  it.each([false, true])(
    "keeps other prices when a coin is removed during fetching (recreated: %s)",
    async (recreate) => {
      const original = CoinRepository.create("BTC", "Bitcoin");
      const eth = CoinRepository.create("ETH", "Ethereum");
      const btcPrice = deferred<number>();
      const ethPrice = deferred<number>();
      mockedCoinMarketCapService.getPrice.mockImplementation((symbol) => {
        if (symbol === "BTC") return btcPrice.promise;
        if (symbol === "ETH") return ethPrice.promise;
        throw new Error(`Unexpected symbol: ${symbol}`);
      });

      const sync = runSync(new PriceSyncService());
      try {
        expect(mockedCoinMarketCapService.getPrice).toHaveBeenCalledTimes(2);
        CoinRepository.deleteBySymbol("BTC");
        if (recreate) {
          const replacement = CoinRepository.create("BTC", "Bitcoin");
          expect(replacement.id).not.toBe(original.id);
        }
      } finally {
        btcPrice.resolve(65000.5);
        ethPrice.resolve(3200.25);
        await sync;
      }

      expect(PriceRepository.getHistoryBySymbol("BTC")).toEqual([]);
      expect(PriceRepository.getHistoryBySymbol("ETH")).toEqual([
        expect.objectContaining({ coin_symbol: "ETH", price_usd: 3200.25 }),
      ]);
      expect(CoinRepository.findById(eth.id)?.last_synced_at).toBe(
        PriceRepository.getHistoryBySymbol("ETH")[0].fetched_at,
      );
      expect(CoinRepository.findById(original.id)).toBeNull();
      if (recreate) {
        expect(CoinRepository.findBySymbol("BTC")?.last_synced_at).toBeNull();
      }
    },
  );

  it("starts immediately, schedules the next tick, and stops polling", async () => {
    jest.useFakeTimers();
    const service = new PriceSyncService(100);
    const syncAllPrices = jest
      .spyOn(service as unknown as SyncInternals, "syncAllPrices")
      .mockResolvedValue();
    jest.spyOn(console, "log").mockImplementation(() => undefined);

    service.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(syncAllPrices).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(100);
    expect(syncAllPrices).toHaveBeenCalledTimes(2);

    service.stop();
    await jest.advanceTimersByTimeAsync(200);
    expect(syncAllPrices).toHaveBeenCalledTimes(2);
  });
});

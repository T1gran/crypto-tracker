import { CoinRepository } from "../db/repository/coin.repository";
import { PriceRepository } from "../db/repository/price.repository";
import { coinMarketCapService } from "./coinmarketcap.service";

type SyncState = "running" | "stopping" | "stopped";

export class PriceSyncService {
  private syncStatus: SyncState = "stopped";
  private timerId: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private activeTick: Promise<void> | null = null;
  private stopPromise: Promise<void> | null = null;

  constructor(intervalMs: number = 30000) {
    this.intervalMs = intervalMs;
  }

  public start(): void {
    if (this.syncStatus !== "stopped") return;
    this.syncStatus = "running";
    console.log("[PriceSyncService] Started background price polling.");

    this.launchTick();
  }

  public stop(): Promise<void> {
    if (this.stopPromise) {
      return this.stopPromise;
    }

    if (this.syncStatus === "stopped") {
      return Promise.resolve();
    }

    this.syncStatus = "stopping";

    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    this.stopPromise = (async () => {
      if (this.activeTick) {
        await this.activeTick;
        console.log("[PriceSyncService] Stopped.");
      }
    })().finally(() => {
      this.syncStatus = "stopped";
      this.stopPromise = null;
    });
    return this.stopPromise;
  }

  private async tick(): Promise<void> {
    if (this.syncStatus !== "running") return;

    try {
      await this.syncAllPrices();
    } catch (error) {
      console.error(
        "[PriceSyncService] Unexpected error during sync tick:",
        error,
      );
    }
  }

  private launchTick() {
    if (this.syncStatus !== "running" || this.activeTick) return;
    this.activeTick = this.tick().then((result) => {
      this.activeTick = null;
      if (this.syncStatus === "running") {
        this.timerId = setTimeout(() => this.launchTick(), this.intervalMs);
      }
    });
  }

  private async syncAllPrices(): Promise<void> {
    const coins = CoinRepository.findAll();
    if (coins.length === 0) return;

    const fetchedPrices: Array<{ symbol: string; price: number }> = [];

    await Promise.allSettled(
      coins.map(async (coin) => {
        try {
          const price = await coinMarketCapService.getPrice(
            coin.symbol,
            coin.name,
          );
          fetchedPrices.push({ symbol: coin.symbol, price });
        } catch (error) {
          console.error(
            `[PriceSyncService] Failed to fetch price for '${coin.symbol}':`,
            error,
          );
        }
      }),
    );
    if (fetchedPrices.length > 0) {
      PriceRepository.savePricesBatch(fetchedPrices);
    }
  }
}

export const priceSyncService = new PriceSyncService(30000);

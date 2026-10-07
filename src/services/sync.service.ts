import { CoinRepository } from "../db/repository/coin.repository";
import { PriceRepository } from "../db/repository/price.repository";
import { coinMarketCapService } from "./coinmarketcap.service";

export class PriceSyncService {
  private isRunning: boolean = false;
  private timerId: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;

  constructor(intervalMs: number = 30000) {
    this.intervalMs = intervalMs;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[PriceSyncService] Started background price polling.");

    this.tick();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    console.log("[PriceSyncService] Stopped background price polling.");
  }

  private async tick(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.syncAllPrices();
    } catch (error) {
      console.error(
        "[PriceSyncService] Unexpected error during sync tick:",
        error,
      );
    } finally {
      if (this.isRunning) {
        this.timerId = setTimeout(() => this.tick(), this.intervalMs);
      }
    }
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
          if (price !== null) {
            fetchedPrices.push({ symbol: coin.symbol, price });
          }
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

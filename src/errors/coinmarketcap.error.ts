import { AppError } from "./app-error";

export class CoinMarketCapNotFoundError extends AppError {
  constructor(symbol: string) {
    super(`Coin '${symbol.toUpperCase()}' not found on CoinMarketCap`, 404);
  }
}

export class CoinMarketCapUpstreamError extends AppError {
  constructor() {
    super("CoinMarketCap is temporarily unavailable", 502);
  }
}

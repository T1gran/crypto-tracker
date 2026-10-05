import axios, { AxiosInstance } from "axios";
import { BinanceTickerResponse } from "../types/binance.types";

export class BinanceService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: "https://api.binance.com",
      timeout: 5000,
    });
  }

  async getPrice(symbol: string): Promise<number | null> {
    try {
      const formattedSymbol = symbol.toUpperCase().trim();

      const response = await this.client.get<BinanceTickerResponse>(
        "/api/v3/ticker/price",
        {
          params: { symbol: formattedSymbol },
        },
      );

      return parseFloat(response.data.price);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          `Binance API error for ${symbol}:`,
          error.response?.data || error.message,
        );
      } else {
        console.error(`Unexpected error fetching price for ${symbol}:`, error);
      }
      return null;
    }
  }

  async validateSymbol(symbol: string): Promise<boolean> {
    const price = await this.getPrice(symbol);
    return price !== null;
  }
}

export const binanceService = new BinanceService();

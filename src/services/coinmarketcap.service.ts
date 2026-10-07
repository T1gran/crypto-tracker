import axios, { AxiosInstance } from "axios";
import { CmcSimplePriceResponse } from "../types/cmc.types";

const CMC_API_KEY = process.env.CMC_API_KEY;
const CMC_API_URL = process.env.CMC_API_URL;

if (!CMC_API_KEY) {
  console.error("Error: CMC_API_KEY not found in .env");
  process.exit(1);
}

if (!CMC_API_URL) {
  console.error("Error: CMC_API_URL not found in .env");
  process.exit(1);
}

export class CoinMarketCapService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: CMC_API_URL,
      timeout: 5000,
    });
  }

  async getPrice(
    symbol: string,
    name: string,
    convert = "USD",
  ): Promise<number | null> {
    try {
      const formattedSymbol = symbol.toUpperCase().trim();

      const response = await this.client.get<CmcSimplePriceResponse>(
        "/v2/simple/price",
        {
          headers: {
            "X-CMC_PRO_API_KEY": CMC_API_KEY,
            Accept: "application/json",
          },
          params: { symbol: formattedSymbol, name, convert },
        },
      );

      const coins = response.data?.data;
      if (!coins || coins.length === 0) {
        console.warn(`Token ${formattedSymbol} not found`);
        return null;
      }

      const targetCoin = coins[0];

      const targetQuote = targetCoin.quotes.find(
        (q) => q.symbol.toUpperCase() === convert,
      );

      if (!targetQuote) {
        console.warn(`Currency ${convert} did not found in quotes`);
        return null;
      }
      return targetQuote.price;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          `CoinMarketCap API error for ${symbol}:`,
          error.response?.data || error.message,
        );
      } else {
        console.error(`Unexpected error fetching price for ${symbol}:`, error);
      }
      return null;
    }
  }

  async validateSymbol(symbol: string, name: string): Promise<boolean> {
    const formattedSymbol = symbol.toUpperCase().trim();
    const price = await this.getPrice(formattedSymbol, name);
    return price !== null;
  }
}

export const coinMarketCapService = new CoinMarketCapService();

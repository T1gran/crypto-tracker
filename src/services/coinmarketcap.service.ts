import axios, { AxiosInstance } from "axios";
import { CmcSimplePriceResponse } from "../types/cmc.types";
import {
  CoinMarketCapNotFoundError,
  CoinMarketCapUpstreamError,
} from "../errors/coinmarketcap.error";

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
  ): Promise<number> {
    const formattedSymbol = symbol.toUpperCase().trim();

    try {
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

      if (response.data?.status?.error_code !== 0) {
        console.error(
          `CoinMarketCap returned an error for ${formattedSymbol}:`,
          response.data?.status,
        );
        throw new CoinMarketCapUpstreamError();
      }

      const coins = response.data?.data;
      if (Array.isArray(coins) && coins.length === 0) {
        throw new CoinMarketCapNotFoundError(formattedSymbol);
      }

      if (!Array.isArray(coins)) {
        console.error(
          `CoinMarketCap returned an invalid price response for ${formattedSymbol}`,
        );
        throw new CoinMarketCapUpstreamError();
      }

      const targetCoin = coins[0];

      if (
        typeof targetCoin?.symbol !== "string" ||
        targetCoin.symbol.toUpperCase().trim() !== formattedSymbol ||
        typeof targetCoin.name !== "string" ||
        targetCoin.name.toUpperCase().trim() !== name.toUpperCase().trim()
      ) {
        console.error(
          `CoinMarketCap returned a different asset for ${formattedSymbol}`,
        );
        throw new CoinMarketCapUpstreamError();
      }

      const targetQuote = targetCoin.quotes.find(
        (q) =>
          typeof q.symbol === "string" &&
          q.symbol.toUpperCase() === convert.toUpperCase(),
      );

      if (
        !targetQuote ||
        typeof targetQuote.price !== "number" ||
        !Number.isFinite(targetQuote.price) ||
        targetQuote.price <= 0
      ) {
        console.error(
          `CoinMarketCap returned an invalid ${convert} quote for ${formattedSymbol}`,
        );
        throw new CoinMarketCapUpstreamError();
      }
      return targetQuote.price;
    } catch (error) {
      if (error instanceof CoinMarketCapNotFoundError) {
        throw error;
      }

      if (error instanceof CoinMarketCapUpstreamError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        console.error(
          `CoinMarketCap API error for ${symbol}:`,
          error.response?.data || error.message,
        );
      } else {
        console.error(`Unexpected error fetching price for ${symbol}:`, error);
      }
      throw new CoinMarketCapUpstreamError();
    }
  }

  async validateSymbol(symbol: string, name: string): Promise<boolean> {
    const formattedSymbol = symbol.toUpperCase().trim();
    try {
      await this.getPrice(formattedSymbol, name);
      return true;
    } catch (error) {
      if (error instanceof CoinMarketCapNotFoundError) {
        return false;
      }
      throw error;
    }
  }
}

export const coinMarketCapService = new CoinMarketCapService();

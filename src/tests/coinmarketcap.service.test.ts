import { afterEach, describe, expect, it, jest } from "@jest/globals";
import axios, { AxiosError } from "axios";
import { CoinMarketCapService } from "../services/coinmarketcap.service";

type Client = {
  get: jest.Mock<(url: string, options?: unknown) => Promise<unknown>>;
};

const setClient = (service: CoinMarketCapService, client: Client) => {
  (service as unknown as { client: Client }).client = client;
};

describe("CoinMarketCapService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses the configured CoinMarketCap base URL", () => {
    const service = new CoinMarketCapService();
    const client = (
      service as unknown as { client: { defaults: { baseURL?: string } } }
    ).client;

    expect(client.defaults.baseURL).toBe("https://pro-api.coinmarketcap.test");
  });

  it("returns a USD price from the CoinMarketCap response", async () => {
    const service = new CoinMarketCapService();
    const client: Client = { get: jest.fn() };
    client.get.mockResolvedValue({
      data: {
        data: [
          {
            quotes: [
              { symbol: "BTC", price: 123.45 },
              { symbol: "USD", price: 65000.5 },
            ],
          },
        ],
      },
    });
    setClient(service, client);

    await expect(service.getPrice(" btc ", "Bitcoin")).resolves.toBe(65000.5);
    expect(client.get).toHaveBeenCalledWith("/v2/simple/price", {
      headers: {
        "X-CMC_PRO_API_KEY": "test-cmc-api-key",
        Accept: "application/json",
      },
      params: { symbol: "BTC", name: "Bitcoin", convert: "USD" },
    });
  });

  it("returns null and logs a response error from CoinMarketCap", async () => {
    const service = new CoinMarketCapService();
    const error = new AxiosError("Request failed with status code 429");
    error.response = { data: { code: -1003, msg: "Too many requests" } } as never;
    const client: Client = { get: jest.fn() };
    client.get.mockRejectedValue(error);
    setClient(service, client);
    const logError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.getPrice("BTC", "Bitcoin")).resolves.toBeNull();
    expect(logError).toHaveBeenCalledWith("CoinMarketCap API error for BTC:", {
      code: -1003,
      msg: "Too many requests",
    });
  });

  it("returns null and logs an unexpected network failure", async () => {
    const service = new CoinMarketCapService();
    const networkError = new Error("socket disconnected");
    const client: Client = { get: jest.fn() };
    client.get.mockRejectedValue(networkError);
    setClient(service, client);
    const logError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.getPrice("ETH", "Ethereum")).resolves.toBeNull();
    expect(logError).toHaveBeenCalledWith(
      "Unexpected error fetching price for ETH:",
      networkError,
    );
  });

  it("marks a symbol invalid when CoinMarketCap returns no matching asset", async () => {
    const service = new CoinMarketCapService();
    const client: Client = { get: jest.fn() };
    client.get.mockResolvedValue({ data: { data: [] } });
    setClient(service, client);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(service.validateSymbol("BTC", "Bitcoin")).resolves.toBe(false);
  });
});

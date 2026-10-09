import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { AxiosError } from "axios";
import {
  CoinMarketCapNotFoundError,
  CoinMarketCapUpstreamError,
} from "../errors/coinmarketcap.error";
import { CoinMarketCapService } from "../services/coinmarketcap.service";
import { cmcSimplePriceFixture } from "./fixtures/cmc-simple-price";

type Client = {
  get: jest.Mock<(url: string, options?: unknown) => Promise<unknown>>;
};

const setClient = (service: CoinMarketCapService, client: Client) => {
  (service as unknown as { client: Client }).client = client;
};

const successfulStatus = cmcSimplePriceFixture.status;

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
        status: successfulStatus,
        data: [
          {
            symbol: "BTC",
            name: "Bitcoin",
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

  it("throws an upstream error when CoinMarketCap rejects the request", async () => {
    const service = new CoinMarketCapService();
    const error = new AxiosError("Request failed with status code 429");
    error.response = { data: { code: -1003, msg: "Too many requests" } } as never;
    const client: Client = { get: jest.fn() };
    client.get.mockRejectedValue(error);
    setClient(service, client);
    const logError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.getPrice("BTC", "Bitcoin")).rejects.toBeInstanceOf(
      CoinMarketCapUpstreamError,
    );
    expect(logError).toHaveBeenCalledWith("CoinMarketCap API error for BTC:", {
      code: -1003,
      msg: "Too many requests",
    });
  });

  it("throws an upstream error for an unexpected network failure", async () => {
    const service = new CoinMarketCapService();
    const networkError = new Error("socket disconnected");
    const client: Client = { get: jest.fn() };
    client.get.mockRejectedValue(networkError);
    setClient(service, client);
    const logError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.getPrice("ETH", "Ethereum")).rejects.toBeInstanceOf(
      CoinMarketCapUpstreamError,
    );
    expect(logError).toHaveBeenCalledWith(
      "Unexpected error fetching price for ETH:",
      networkError,
    );
  });

  it("marks a symbol invalid when CoinMarketCap returns no matching asset", async () => {
    const service = new CoinMarketCapService();
    const client: Client = { get: jest.fn() };
    client.get.mockResolvedValue({
      data: { status: successfulStatus, data: [] },
    });
    setClient(service, client);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(service.validateSymbol("BTC", "Bitcoin")).resolves.toBe(false);
  });

  it("throws a not-found error when requesting a missing coin price", async () => {
    const service = new CoinMarketCapService();
    const client: Client = { get: jest.fn() };
    client.get.mockResolvedValue({
      data: { status: successfulStatus, data: [] },
    });
    setClient(service, client);

    await expect(service.getPrice("UNKNOWN", "Unknown")).rejects.toBeInstanceOf(
      CoinMarketCapNotFoundError,
    );
  });

  it("treats a malformed CoinMarketCap response as an upstream failure", async () => {
    const service = new CoinMarketCapService();
    const client: Client = { get: jest.fn() };
    client.get.mockResolvedValue({
      data: { status: successfulStatus, data: undefined },
    });
    setClient(service, client);
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.getPrice("BTC", "Bitcoin")).rejects.toBeInstanceOf(
      CoinMarketCapUpstreamError,
    );
  });

  it.each(["65000.5", undefined, Number.NaN, 0, -1])(
    "rejects an invalid price returned by CoinMarketCap: %p",
    async (price) => {
      const service = new CoinMarketCapService();
      const client: Client = { get: jest.fn() };
      client.get.mockResolvedValue({
        data: {
          status: successfulStatus,
          data: [
            {
              symbol: "BTC",
              name: "Bitcoin",
              quotes: [{ symbol: "USD", price }],
            },
          ],
        },
      });
      setClient(service, client);
      jest.spyOn(console, "error").mockImplementation(() => undefined);

      await expect(service.getPrice("BTC", "Bitcoin")).rejects.toBeInstanceOf(
        CoinMarketCapUpstreamError,
      );
    },
  );

  it("rejects a response for a different asset", async () => {
    const service = new CoinMarketCapService();
    const client: Client = { get: jest.fn() };
    client.get.mockResolvedValue({
      data: {
        status: successfulStatus,
        data: [
          {
            symbol: "ETH",
            name: "Ethereum",
            quotes: [{ symbol: "USD", price: 3200 }],
          },
        ],
      },
    });
    setClient(service, client);
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.getPrice("BTC", "Bitcoin")).rejects.toBeInstanceOf(
      CoinMarketCapUpstreamError,
    );
  });

  it("also accepts a numeric zero success code", async () => {
    const service = new CoinMarketCapService();
    const client: Client = { get: jest.fn() };
    client.get.mockResolvedValue({
      data: {
        ...cmcSimplePriceFixture,
        status: { ...successfulStatus, error_code: 0 },
      },
    });
    setClient(service, client);

    await expect(service.getPrice("BTC", "Bitcoin")).resolves.toBe(65000.5);
  });

  it.each(
    [1006, "1006", undefined, null, "", false, true, "00", " 0 ", "0.0", [], {}].map(
      (errorCode) => [errorCode],
    ),
  )(
    "rejects a non-zero or malformed CoinMarketCap status error code: %p",
    async (errorCode) => {
      const service = new CoinMarketCapService();
      const client: Client = { get: jest.fn() };
      client.get.mockResolvedValue({
        data: {
          ...cmcSimplePriceFixture,
          status: { ...successfulStatus, error_code: errorCode },
        },
      });
      setClient(service, client);
      jest.spyOn(console, "error").mockImplementation(() => undefined);

      await expect(service.getPrice("BTC", "Bitcoin")).rejects.toBeInstanceOf(
        CoinMarketCapUpstreamError,
      );
    },
  );
});

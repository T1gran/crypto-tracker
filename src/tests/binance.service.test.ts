import { afterEach, describe, expect, it, jest } from "@jest/globals";
import axios, { AxiosError } from "axios";
import { BinanceService } from "../services/binance.service";

type Client = {
  get: jest.Mock<(url: string, options?: unknown) => Promise<unknown>>;
};

const setClient = (service: BinanceService, client: Client) => {
  (service as unknown as { client: Client }).client = client;
};

describe("BinanceService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the price using a normalized symbol", async () => {
    const service = new BinanceService();
    const client: Client = { get: jest.fn() };
    client.get.mockResolvedValue({ data: { price: "123.45" } });
    setClient(service, client);

    await expect(service.getPrice(" btcusdt ")).resolves.toBe(123.45);
    expect(client.get).toHaveBeenCalledWith("/api/v3/ticker/price", {
      params: { symbol: "BTCUSDT" },
    });
  });

  it("returns null and logs a response error from Binance", async () => {
    const service = new BinanceService();
    const error = new AxiosError("Request failed with status code 429");
    error.response = { data: { code: -1003, msg: "Too many requests" } } as never;
    const client: Client = { get: jest.fn() };
    client.get.mockRejectedValue(error);
    setClient(service, client);
    const logError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.getPrice("BTCUSDT")).resolves.toBeNull();
    expect(logError).toHaveBeenCalledWith("Binance API error for BTCUSDT:", {
      code: -1003,
      msg: "Too many requests",
    });
  });

  it("returns null and logs an unexpected network failure", async () => {
    const service = new BinanceService();
    const networkError = new Error("socket disconnected");
    const client: Client = { get: jest.fn() };
    client.get.mockRejectedValue(networkError);
    setClient(service, client);
    const logError = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.getPrice("ETHUSDT")).resolves.toBeNull();
    expect(logError).toHaveBeenCalledWith(
      "Unexpected error fetching price for ETHUSDT:",
      networkError,
    );
  });

  it("marks a symbol invalid when the external API cannot provide a price", async () => {
    const service = new BinanceService();
    const client: Client = { get: jest.fn() };
    client.get.mockRejectedValue(new Error("unavailable"));
    setClient(service, client);
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(service.validateSymbol("BTCUSDT")).resolves.toBe(false);
  });
});

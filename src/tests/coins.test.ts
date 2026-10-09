import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  expect,
  jest,
} from "@jest/globals";
import supertest from "supertest";
import { expectResponse, expectSchema } from "./helpers/openapi-contract";
import { openApiSpec } from "../openapi";
import { deferred } from "./helpers/deferred";
import { app } from "../app";
import { initDb } from "../db/init";
import { db } from "../db/database";
import { ApiKeyRepository } from "../db/repository/api-key.repository";
import { CoinRepository } from "../db/repository/coin.repository";
import { coinMarketCapService } from "../services/coinmarketcap.service";
import { PriceRepository } from "../db/repository/price.repository";
import { CoinMarketCapUpstreamError } from "../errors/coinmarketcap.error";

jest.mock("../services/coinmarketcap.service", () => ({
  coinMarketCapService: {
    validateSymbol: jest.fn(),
    getPrice: jest.fn(),
  },
}));

const mockedCoinMarketCapService = jest.mocked(coinMarketCapService);

const request = supertest(app);

describe("Coins API (/coins)", () => {
  const validToken = "test_coins_token";

  beforeAll(async () => {
    await initDb();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    db.exec(
      "DELETE FROM price_history; DELETE FROM coins; DELETE FROM api_keys;",
    );
    ApiKeyRepository.create(validToken, "Test Coins Client");
  });

  describe("POST /coins", () => {
    it("rejects unsupported query parameters before fetching or inserting a coin", async () => {
      const response = await request
        .post("/coins?unexpected=1")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "BTC", name: "Bitcoin" });

      expect(response.status).toBe(400);
      expectResponse("/coins", "post", response);
      expect(response.type).toBe("application/json");
      expect(response.body.message).toContain("does not accept query parameters");
      expect(mockedCoinMarketCapService.validateSymbol).not.toHaveBeenCalled();
      expect(CoinRepository.findAll()).toEqual([]);
    });

    it("rejects malformed JSON without exposing parser details or creating a coin", async () => {
      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .set("Content-Type", "application/json")
        .send('{"symbol":"BTC",');

      expect(response.status).toBe(400);
      expectResponse("/coins", "post", response);
      expect(response.type).toBe("application/json");
      expect(response.body).toEqual({
        status: "fail",
        message: "Invalid JSON format in request body",
      });
      expect(mockedCoinMarketCapService.validateSymbol).not.toHaveBeenCalled();
      expect(CoinRepository.findAll()).toEqual([]);
    });

    it("returns 413 for an oversized JSON body without fetching or inserting a coin", async () => {
      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "BTC", name: "x".repeat(110_000) });

      expect(response.status).toBe(413);
      expectResponse("/coins", "post", response);
      expect(response.type).toBe("application/json");
      expect(response.body).toEqual({
        status: "fail",
        message: "Request body is too large",
      });
      expect(mockedCoinMarketCapService.validateSymbol).not.toHaveBeenCalled();
      expect(CoinRepository.findAll()).toEqual([]);
    });

    it("should return 400 if request body is invalid", async () => {
      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "" });

      expect(response.status).toBe(400);
      expectResponse("/coins", "post", response);
    });

    it("should reject unsupported fields and invalid field types", async () => {
      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: 123, name: "Bitcoin", isActive: true });

      expect(response.status).toBe(400);
      expectResponse("/coins", "post", response);
      expect(response.body.message).toContain("unsupported fields");
      expect(mockedCoinMarketCapService.validateSymbol).not.toHaveBeenCalled();
    });

    it("should return 404 if symbol is not found on CoinMarketCap", async () => {
      mockedCoinMarketCapService.validateSymbol.mockResolvedValue(false);

      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "UNKNOWNCOIN", name: "Unknown Token" });

      expect(response.status).toBe(404);
      expectResponse("/coins", "post", response);
      expect(response.body.message).toContain("not found");
    });

    it("should return 502 when CoinMarketCap is unavailable", async () => {
      mockedCoinMarketCapService.validateSymbol.mockRejectedValue(
        new CoinMarketCapUpstreamError(),
      );

      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "BTC", name: "Bitcoin" });

      expect(response.status).toBe(502);
      expectResponse("/coins", "post", response);
      expect(response.body.message).toContain("CoinMarketCap");
    });

    it("should return 201 and create coin successfully", async () => {
      mockedCoinMarketCapService.validateSymbol.mockResolvedValue(true);
      const body = { symbol: " btc ", name: " Bitcoin " };
      expectSchema(body, openApiSpec.components.schemas.CreateCoinRequest);

      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send(body);

      expect(response.status).toBe(201);
      expectResponse("/coins", "post", response);
      expect(response.body.data).toMatchObject({
        symbol: "BTC",
        name: " Bitcoin ",
      });
    });

    it("should return 409 if coin is already tracked", async () => {
      mockedCoinMarketCapService.validateSymbol.mockResolvedValue(true);

      await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "BTC", name: "Bitcoin" });

      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "BTC", name: "Bitcoin" });

      expect(response.status).toBe(409);
      expectResponse("/coins", "post", response);
      expect(response.body.message).toContain("already being tracked");
    });
  });

  describe("GET /coins", () => {
    it("should return list containing the created coin", async () => {
      mockedCoinMarketCapService.validateSymbol.mockResolvedValue(true);

      await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "ETH", name: "Ethereum" });

      const response = await request
        .get("/coins")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expectResponse("/coins", "get", response);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it("should reject query parameters that this endpoint does not accept", async () => {
      const response = await request
        .get("/coins?limit=1")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expectResponse("/coins", "get", response);
    });
  });

  describe("GET /coins/:symbol", () => {
    it("returns a safe 400 when Express cannot decode a path parameter", async () => {
      const response = await request
        .get("/coins/%E0%A4%A")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expectResponse("/coins/{symbol}", "get", response);
      expect(response.type).toBe("application/json");
      expect(response.body).toEqual({
        status: "fail",
        message: "Invalid URL encoding",
      });
    });

    it("should return a tracked coin", async () => {
      mockedCoinMarketCapService.validateSymbol.mockResolvedValue(true);
      await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "SOL", name: "Solana" });

      const response = await request
        .get("/coins/sol")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expectResponse("/coins/{symbol}", "get", response);
      expect(response.body.data).toMatchObject({
        symbol: "SOL",
        name: "Solana",
      });
    });

    it("should return 404 for an untracked coin", async () => {
      const response = await request
        .get("/coins/UNKNOWN")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(404);
      expectResponse("/coins/{symbol}", "get", response);
      expect(response.body.message).toContain("not found");
    });

    it("should reject an invalid symbol path parameter", async () => {
      const response = await request
        .get("/coins/%40")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expectResponse("/coins/{symbol}", "get", response);
    });
  });

  describe("GET /coins/:symbol/price", () => {
    it.each([false, true])(
      "returns 404 if the original coin is removed during fetching (recreated: %s)",
      async (recreate) => {
        const original = CoinRepository.create("BTC", "Bitcoin");
        const price = deferred<number>();
        const started = deferred<void>();
        mockedCoinMarketCapService.getPrice.mockImplementationOnce(() => {
          started.resolve();
          return price.promise;
        });

        const responsePromise = request
          .get("/coins/BTC/price")
          .set("Authorization", `Bearer ${validToken}`)
          .then((response) => response);

        await started.promise;
        try {
          CoinRepository.deleteBySymbol("BTC");
          if (recreate) {
            const replacement = CoinRepository.create("BTC", "Bitcoin");
            expect(replacement.id).not.toBe(original.id);
          }
        } finally {
          price.resolve(65000.5);
        }

        const response = await responsePromise;
        expect(response.status).toBe(404);
        expectResponse("/coins/{symbol}/price", "get", response);
        expect(response.body).toMatchObject({
          status: "fail",
          message: "Coin was removed while fetching its price",
        });
        expect(response.body.data).toBeUndefined();
        expect(PriceRepository.getHistoryBySymbol("BTC")).toEqual([]);
        expect(CoinRepository.findById(original.id)).toBeNull();
        if (recreate) {
          expect(CoinRepository.findBySymbol("BTC")?.last_synced_at).toBeNull();
        }
      },
    );

    it("should fetch, persist, and return the current USD price", async () => {
      CoinRepository.create("BTC", "Bitcoin");
      mockedCoinMarketCapService.getPrice.mockResolvedValue(65000.5);

      const response = await request
        .get("/coins/btc/price")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expectResponse("/coins/{symbol}/price", "get", response);
      expect(response.body.data).toMatchObject({
        symbol: "BTC",
        price_usd: 65000.5,
      });
      expect(response.body.data.last_synced_at).toEqual(expect.any(String));
      expect(PriceRepository.getHistoryBySymbol("BTC")[0]).toMatchObject({
        price_usd: 65000.5,
      });
      expect(CoinRepository.findBySymbol("BTC")).toMatchObject({
        last_synced_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it("should return 502 and not create history when CoinMarketCap is unavailable", async () => {
      CoinRepository.create("BTC", "Bitcoin");
      mockedCoinMarketCapService.getPrice.mockRejectedValue(
        new CoinMarketCapUpstreamError(),
      );

      const response = await request
        .get("/coins/BTC/price")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(502);
      expectResponse("/coins/{symbol}/price", "get", response);
      expect(response.body.message).toContain("CoinMarketCap");
      expect(PriceRepository.getHistoryBySymbol("BTC")).toEqual([]);
    });

    it("should return 404 for an untracked coin", async () => {
      const response = await request
        .get("/coins/UNKNOWN/price")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(404);
      expectResponse("/coins/{symbol}/price", "get", response);
    });
  });

  describe("DELETE /coins/:symbol", () => {
    it("should delete a tracked coin", async () => {
      mockedCoinMarketCapService.validateSymbol.mockResolvedValue(true);
      await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "ADA", name: "Cardano" });

      const response = await request
        .delete("/coins/ada")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expectResponse("/coins/{symbol}", "delete", response);
      expect(response.body.message).toContain("ADA");
      expect(CoinRepository.findBySymbol("ADA")).toBeNull();
    });

    it("should return 404 when deleting an untracked coin", async () => {
      const response = await request
        .delete("/coins/UNKNOWN")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(404);
      expectResponse("/coins/{symbol}", "delete", response);
    });
  });

  describe("PATCH /coins/:symbol", () => {
    it("should deactivate and reactivate a tracked coin", async () => {
      CoinRepository.create("BTC", "Bitcoin");

      const deactivateResponse = await request
        .patch("/coins/btc")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ isActive: false });

      expect(deactivateResponse.status).toBe(200);
      expectResponse("/coins/{symbol}", "patch", deactivateResponse);
      expect(CoinRepository.findBySymbol("BTC")).toMatchObject({
        is_active: 0,
      });
      const inactiveCoins = await request
        .get("/coins")
        .set("Authorization", `Bearer ${validToken}`);
      expect(inactiveCoins.body.data).toEqual([]);

      const activateResponse = await request
        .patch("/coins/BTC")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ isActive: true });

      expect(activateResponse.status).toBe(200);
      expectResponse("/coins/{symbol}", "patch", activateResponse);
      expect(CoinRepository.findBySymbol("BTC")).toMatchObject({
        is_active: 1,
      });
    });

    it("should return 404 when updating an untracked coin", async () => {
      const response = await request
        .patch("/coins/UNKNOWN")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ isActive: false });

      expect(response.status).toBe(404);
      expectResponse("/coins/{symbol}", "patch", response);
    });

    it("should reject a missing, non-boolean, or extra status field", async () => {
      const missing = await request
        .patch("/coins/BTC")
        .set("Authorization", `Bearer ${validToken}`)
        .send({});
      const nonBoolean = await request
        .patch("/coins/BTC")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ isActive: "false" });
      const extraField = await request
        .patch("/coins/BTC")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ isActive: "false", name: "Bitcoin" });

      expect(missing.status).toBe(400);
      expectResponse("/coins/{symbol}", "patch", missing);
      expect(nonBoolean.status).toBe(400);
      expectResponse("/coins/{symbol}", "patch", nonBoolean);
      expect(extraField.status).toBe(400);
      expectResponse("/coins/{symbol}", "patch", extraField);
      expect(extraField.body.message).toContain("only 'isActive'");
    });
  });

  describe("GET /coins/:symbol/history", () => {
    it("should return saved price history for a tracked coin", async () => {
      mockedCoinMarketCapService.validateSymbol.mockResolvedValue(true);
      await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "XRP", name: "XRP" });
      PriceRepository.savePrice(CoinRepository.findBySymbol("XRP")!.id, 2.5);

      const response = await request
        .get("/coins/%20xrp%20/history?limit=10")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expectResponse("/coins/{symbol}/history", "get", response);
      expect(response.body).toMatchObject({ symbol: "XRP", count: 1 });
      expect(response.body.data[0]).toMatchObject({
        coin_symbol: "XRP",
        price_usd: 2.5,
      });
    });

    it("should return 404 for history of an untracked coin", async () => {
      const response = await request
        .get("/coins/UNKNOWN/history")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(404);
      expectResponse("/coins/{symbol}/history", "get", response);
    });

    it("should reject invalid pagination and date query parameters", async () => {
      CoinRepository.create("XRP", "XRP");

      const response = await request
        .get("/coins/XRP/history?limit=-1&from=not-a-date")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expectResponse("/coins/{symbol}/history", "get", response);
    });

    it("should reject unsupported history query parameters", async () => {
      CoinRepository.create("XRP", "XRP");

      const response = await request
        .get("/coins/XRP/history?sort=asc")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(400);
      expectResponse("/coins/{symbol}/history", "get", response);
    });
  });
});

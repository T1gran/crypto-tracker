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
import { app } from "../app";
import { initDb } from "../db/init";
import { db } from "../db/database";
import { ApiKeyRepository } from "../db/repository/api-key.repository";
import { CoinRepository } from "../db/repository/coin.repository";
import { coinMarketCapService } from "../services/coinmarketcap.service";
import { PriceRepository } from "../db/repository/price.repository";

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
    jest.clearAllMocks();
    db.exec(
      "DELETE FROM price_history; DELETE FROM coins; DELETE FROM api_keys;",
    );
    ApiKeyRepository.create(validToken, "Test Coins Client");
  });

  describe("POST /coins", () => {
    it("should return 400 if request body is invalid", async () => {
      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "" });

      expect(response.status).toBe(400);
    });

    it("should reject unsupported fields and invalid field types", async () => {
      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: 123, name: "Bitcoin", isActive: true });

      expect(response.status).toBe(400);
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
      expect(response.body.message).toContain("not found");
    });

    it("should return 201 and create coin successfully", async () => {
      mockedCoinMarketCapService.validateSymbol.mockResolvedValue(true);

      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "BTC", name: "Bitcoin" });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        symbol: "BTC",
        name: "Bitcoin",
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
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it("should return 401 without a valid API key", async () => {
      const response = await request.get("/coins");

      expect(response.status).toBe(401);
    });

    it("should reject query parameters that this endpoint does not accept", async () => {
      const response = await request
        .get("/coins?limit=1")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /coins/:symbol", () => {
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
      expect(response.body.message).toContain("not found");
    });

    it("should reject an invalid symbol path parameter", async () => {
      const response = await request
        .get("/coins/%40")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /coins/:symbol/price", () => {
    it("should fetch, persist, and return the current USD price", async () => {
      CoinRepository.create("BTC", "Bitcoin");
      mockedCoinMarketCapService.getPrice.mockResolvedValue(65000.5);

      const response = await request
        .get("/coins/btc/price")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
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

    it("should return 503 and not create history when the price is unavailable", async () => {
      CoinRepository.create("BTC", "Bitcoin");
      mockedCoinMarketCapService.getPrice.mockResolvedValue(null);

      const response = await request
        .get("/coins/BTC/price")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(503);
      expect(response.body.message).toContain("temporarily unavailable");
      expect(PriceRepository.getHistoryBySymbol("BTC")).toEqual([]);
    });

    it("should return 404 for an untracked coin", async () => {
      const response = await request
        .get("/coins/UNKNOWN/price")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(404);
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
      expect(response.body.message).toContain("ADA");
      expect(CoinRepository.findBySymbol("ADA")).toBeNull();
    });

    it("should return 404 when deleting an untracked coin", async () => {
      const response = await request
        .delete("/coins/UNKNOWN")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(404);
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
      expect(nonBoolean.status).toBe(400);
      expect(extraField.status).toBe(400);
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
      PriceRepository.savePrice("XRP", 2.5);

      const response = await request
        .get("/coins/xrp/history?limit=10")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
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
    });

    it("should reject invalid pagination and date query parameters", async () => {
      CoinRepository.create("XRP", "XRP");

      const response = await request
        .get("/coins/XRP/history?limit=-1&from=not-a-date")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(400);
    });

    it("should reject unsupported history query parameters", async () => {
      CoinRepository.create("XRP", "XRP");

      const response = await request
        .get("/coins/XRP/history?sort=asc")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(400);
    });
  });
});

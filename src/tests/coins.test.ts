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
import { binanceService } from "../services/binance.service";
import { PriceRepository } from "../db/repository/price.repository";

jest.mock("../services/binance.service", () => ({
  binanceService: {
    validateSymbol: jest.fn(),
    getPrice: jest.fn(),
  },
}));

const mockedBinanceService = jest.mocked(binanceService);

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
    db.exec("DELETE FROM price_history; DELETE FROM coins; DELETE FROM api_keys;");
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
      expect(mockedBinanceService.validateSymbol).not.toHaveBeenCalled();
    });

    it("should return 404 if symbol is not found on Binance", async () => {
      mockedBinanceService.validateSymbol.mockResolvedValue(false);

      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "UNKNOWNCOIN", name: "Unknown Token" });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain("not found");
    });

    it("should return 201 and create coin successfully", async () => {
      mockedBinanceService.validateSymbol.mockResolvedValue(true);

      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "BTCUSDT", name: "Bitcoin" });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        symbol: "BTCUSDT",
        name: "Bitcoin",
      });
    });

    it("should return 409 if coin is already tracked", async () => {
      mockedBinanceService.validateSymbol.mockResolvedValue(true);

      await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "BTCUSDT", name: "Bitcoin" });

      const response = await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "BTCUSDT", name: "Bitcoin" });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain("already being tracked");
    });
  });

  describe("GET /coins", () => {
    it("should return list containing the created coin", async () => {
      mockedBinanceService.validateSymbol.mockResolvedValue(true);

      await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "ETHUSDT", name: "Ethereum" });

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
      mockedBinanceService.validateSymbol.mockResolvedValue(true);
      await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "SOLUSDT", name: "Solana" });

      const response = await request
        .get("/coins/solusdt")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        symbol: "SOLUSDT",
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

  describe("DELETE /coins/:symbol", () => {
    it("should delete a tracked coin", async () => {
      mockedBinanceService.validateSymbol.mockResolvedValue(true);
      await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "ADAUSDT", name: "Cardano" });

      const response = await request
        .delete("/coins/adausdt")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("ADAUSDT");
      expect(
        CoinRepository.findBySymbol("ADAUSDT"),
      ).toBeNull();
    });

    it("should return 404 when deleting an untracked coin", async () => {
      const response = await request
        .delete("/coins/UNKNOWN")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("GET /coins/:symbol/history", () => {
    it("should return saved price history for a tracked coin", async () => {
      mockedBinanceService.validateSymbol.mockResolvedValue(true);
      await request
        .post("/coins")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ symbol: "XRPUSDT", name: "XRP" });
      PriceRepository.savePrice("XRPUSDT", 2.5);

      const response = await request
        .get("/coins/xrpusdt/history?limit=10")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ symbol: "XRPUSDT", count: 1 });
      expect(response.body.data[0]).toMatchObject({
        coin_symbol: "XRPUSDT",
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
      CoinRepository.create("XRPUSDT", "XRP");

      const response = await request
        .get("/coins/XRPUSDT/history?limit=-1&from=not-a-date")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(400);
    });

    it("should reject unsupported history query parameters", async () => {
      CoinRepository.create("XRPUSDT", "XRP");

      const response = await request
        .get("/coins/XRPUSDT/history?sort=asc")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(400);
    });
  });
});

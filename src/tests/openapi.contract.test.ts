import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, jest } from "@jest/globals";
import supertest from "supertest";
import { app } from "../app";
import { db } from "../db/database";
import { initDb } from "../db/init";
import { ApiKeyRepository } from "../db/repository/api-key.repository";
import { CoinRepository } from "../db/repository/coin.repository";
import { coinMarketCapService } from "../services/coinmarketcap.service";
import { CoinMarketCapUpstreamError } from "../errors/coinmarketcap.error";
import { openApiSpec } from "../openapi";
import { expectResponse, expectSchema, paths, resolveRef } from "./helpers/openapi-contract";

jest.mock("../services/coinmarketcap.service", () => ({
  coinMarketCapService: { validateSymbol: jest.fn(), getPrice: jest.fn() },
}));
const cmc = jest.mocked(coinMarketCapService);
const request = supertest(app);
const token = "contract-token";
const auth = (req: ReturnType<typeof request.get>) => req.set("Authorization", `Bearer ${token}`);
const business = [
  ["get", "/coins", "/coins"],
  ["post", "/coins", "/coins"],
  ["get", "/coins/{symbol}", "/coins/BTC"],
  ["patch", "/coins/{symbol}", "/coins/BTC"],
  ["delete", "/coins/{symbol}", "/coins/BTC"],
  ["get", "/coins/{symbol}/price", "/coins/BTC/price"],
  ["get", "/coins/{symbol}/history", "/coins/BTC/history"],
] as const;

describe("OpenAPI response contracts", () => {
  beforeAll(() => initDb());
  beforeEach(() => {
    jest.resetAllMocks();
    db.exec("DELETE FROM coins; DELETE FROM api_keys;");
    ApiKeyRepository.create(token, "Contract test");
    cmc.validateSymbol.mockResolvedValue(true);
    cmc.getPrice.mockResolvedValue(65000.5);
  });
  afterEach(() => { jest.restoreAllMocks(); });
  afterAll(() => { db.close(); });

  it("resolves every local reference in the served document", async () => {
    const response = await request.get("/api-docs/openapi.json");
    expect(response.body).toEqual(openApiSpec);
    function visit(value: unknown): void {
      if (!value || typeof value !== "object") return;
      if ("$ref" in value) resolveRef(value as { $ref: string });
      for (const child of Object.values(value)) visit(child);
    }
    visit(response.body);
  });

  it("matches all successful coin responses and the normalized history symbol", async () => {
    const body = { symbol: " btc ", name: " Bitcoin " };
    expectSchema(body, openApiSpec.components.schemas.CreateCoinRequest);
    const created = await auth(request.post("/coins")).send(body);
    expect(created.status).toBe(201);
    expectResponse("/coins", "post", created);
    for (const [path, url] of [["/coins", "/coins"], ["/coins/{symbol}", "/coins/BTC"], ["/coins/{symbol}/price", "/coins/BTC/price"], ["/coins/{symbol}/history", "/coins/%20btc%20/history"]]) {
      const response = await auth(request.get(url));
      expect(response.status).toBe(200);
      expectResponse(path, "get", response);
      if (path.endsWith("/history")) {
        expect(response.body.symbol).toBe("BTC");
        expect(response.body.count).toBe(1);
      }
    }
    const patched = await auth(request.patch("/coins/BTC")).send({ isActive: false });
    expect(patched.status).toBe(200);
    expectResponse("/coins/{symbol}", "patch", patched);
    const deleted = await auth(request.delete("/coins/BTC"));
    expect(deleted.status).toBe(200);
    expectResponse("/coins/{symbol}", "delete", deleted);
  });

  it.each(business)("documents and enforces auth for %s %s", async (method, path, url) => {
    expect(paths[path][method].security).toEqual([{ bearerAuth: [] }]);
    const response = await request[method](url);
    expect(response.status).toBe(401);
    expectResponse(path, method, response);
  });

  it.each(business)("uses the error schema for invalid query on %s %s", async (method, path, url) => {
    const response = await auth(request[method](url + "?unexpected=1"));
    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
    expectResponse(path, method, response);
  });

  it("matches body validation, conflict, not-found, upstream and database error responses", async () => {
    let response = await auth(request.post("/coins")).send({ symbol: "" });
    expect(response.status).toBe(400);
    expectResponse("/coins", "post", response);
    CoinRepository.create("BTC", "Bitcoin");
    response = await auth(request.post("/coins")).send({ symbol: "BTC", name: "Bitcoin" });
    expect(response.status).toBe(409);
    expectResponse("/coins", "post", response);
    response = await auth(request.get("/coins/UNKNOWN"));
    expect(response.status).toBe(404);
    expectResponse("/coins/{symbol}", "get", response);
    cmc.getPrice.mockRejectedValueOnce(new CoinMarketCapUpstreamError());
    response = await auth(request.get("/coins/BTC/price"));
    expect(response.status).toBe(502);
    expectResponse("/coins/{symbol}/price", "get", response);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(CoinRepository, "findAll").mockImplementationOnce(() => { throw new Error("internal database details"); });
    response = await auth(request.get("/coins"));
    expect(response.status).toBe(500);
    expectResponse("/coins", "get", response);
    expect(response.body).toEqual({ status: "error", message: "Internal server error" });
  });

  it.each(["post", "patch"] as const)("documents oversized bodies for %s", async (method) => {
    const path = method === "post" ? "/coins" : "/coins/{symbol}";
    const response = await auth(request[method]("/coins" + (method === "patch" ? "/BTC" : ""))).send({ name: "x".repeat(110000) });
    expect(response.status).toBe(413);
    expectResponse(path, method, response);
  });

  it.each(["/", "/api-docs/", "/api-docs/openapi.json"])("documents the public response for %s", async (path) => {
    const response = await request.get(path);
    expect(response.status).toBe(200);
    expectResponse(path, "get", response);
  });

  it("documents the Swagger redirect", async () => {
    const response = await request.get("/api-docs");
    expect(response.status).toBe(301);
    expect(paths["/api-docs"].get.responses["301"]).toBeDefined();
    expect(response.headers.location).toBe("/api-docs/");
  });

  it.each(["/api-docs/", "/api-docs/openapi.json"])("documents parser errors even on public %s", async (path) => {
    const response = await request.get(path).set("Content-Type", "application/json").send("{");
    expect(response.status).toBe(400);
    expectResponse(path, "get", response);
  });

  it.each(["2026-10-08", "2026-10-08T17:00:00.123+07:00", "2026-10-08T10:00:00Z"])("accepts the documented history date %s", async (from) => {
    expectSchema(from, openApiSpec.components.schemas.HistoryBound);
    CoinRepository.create("BTC", "Bitcoin");
    const response = await auth(request.get("/coins/BTC/history")).query({ from });
    expect(response.status).toBe(200);
    expectResponse("/coins/{symbol}/history", "get", response);
  });

  it.each([
    { symbol: " btc ", name: " Bitcoin ", valid: true },
    { symbol: "AB", name: "x".repeat(100), valid: true },
    { symbol: "A".repeat(20), name: "x", valid: true },
    { symbol: "A", name: "Bitcoin", valid: false },
    { symbol: "A".repeat(21), name: "Bitcoin", valid: false },
    { symbol: "BTC", name: "x".repeat(101), valid: false },
    { symbol: "BTC", name: " \t ", valid: false },
  ])("agrees with request schema at symbol/name boundaries: %p", async ({ valid, ...body }) => {
    const check = () => expectSchema(body, openApiSpec.components.schemas.CreateCoinRequest);
    if (valid) check();
    else expect(check).toThrow();
    const response = await auth(request.post("/coins")).send(body);
    expect(response.status).toBe(valid ? 201 : 400);
    expectResponse("/coins", "post", response);
    if (!valid) expect(cmc.validateSymbol).not.toHaveBeenCalled();
  });

  it.each(["2026-10-08T10:00:00", "2026-10-08T10:00:00.1234Z", "2026-10-08T10:00:00+24:00"])(
    "rejects the same timestamp syntax in schema and API: %s",
    async (from) => {
      expect(() => expectSchema(from, openApiSpec.components.schemas.HistoryBound)).toThrow();
      const response = await auth(request.get("/coins/BTC/history")).query({ from });
      expect(response.status).toBe(400);
      expectResponse("/coins/{symbol}/history", "get", response);
    },
  );
});

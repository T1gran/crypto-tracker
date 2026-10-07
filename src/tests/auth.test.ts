import { describe, it, beforeAll, expect } from "@jest/globals";
import supertest from "supertest";
import { app } from "../app";
import { initDb } from "../db/init";
import { ApiKeyRepository } from "../db/repository/api-key.repository";
import { db } from "../db/database";

const request = supertest(app);

describe("Auth Middleware", () => {
  const validToken = "test_bearer_token";

  beforeAll(() => {
    initDb();
    ApiKeyRepository.create(validToken, "Test Client");
  });

  afterAll(() => {
    db.close();
  });

  it("should return 401, if header Authorization is missing", async () => {
    const response = await request.get("/coins");
    expect(response.status).toBe(401);
    expect(response.body.message).toContain("Authorization header missing");
  });

  it("should return 401, if header format is not Bearer", async () => {
    const response = await request
      .get("/coins")
      .set("Authorization", `Basic ${validToken}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("invalid format");
  });

  it("should return 401, if token is not found in database", async () => {
    const response = await request
      .get("/coins")
      .set("Authorization", "Bearer non_existent_token_123");

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("Invalid API key");
  });

  it("should pass request (200), if token is valid and exists in DB", async () => {
    const response = await request
      .get("/coins")
      .set("Authorization", `Bearer ${validToken}`);

    expect(response.status).toBe(200);
  });
});

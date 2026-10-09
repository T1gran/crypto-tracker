import { describe, it, beforeAll, afterAll, expect, jest } from "@jest/globals";
import supertest from "supertest";
import { app } from "../app";
import { initDb } from "../db/init";
import { ApiKeyRepository } from "../db/repository/api-key.repository";
import { db } from "../db/database";

const request = supertest(app);

describe("Auth Middleware", () => {
  const validToken = "test_bearer_token";

  beforeAll(async () => {
    await initDb();
    await ApiKeyRepository.create(validToken, "Test Client");
  });

  afterAll(async () => {
    await db.close();
  });

  it.each(["development", "production", undefined])(
    "returns a safe 500 for a real database failure with NODE_ENV=%s",
    async (nodeEnv) => {
      const previousNodeEnv = process.env.NODE_ENV;
      const logError = jest.spyOn(console, "error").mockImplementation(() => undefined);
      let renamed = false;

      try {
        // The isolated in-memory DB is already open; changing NODE_ENV only
        // exercises response handling and never opens a production database.
        if (nodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = nodeEnv;

        db.exec("ALTER TABLE api_keys RENAME TO api_keys_unavailable");
        renamed = true;

        const response = await request
          .get("/coins")
          .set("Authorization", `Bearer ${validToken}`);

        expect(response.status).toBe(500);
        expect(response.type).toBe("application/json");
        expect(response.body).toEqual({
          status: "error",
          message: "Internal server error",
        });
        expect(logError).toHaveBeenCalled();
      } finally {
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
        logError.mockRestore();
        if (renamed) {
          db.exec("ALTER TABLE api_keys_unavailable RENAME TO api_keys");
        }
      }

      // A database failure must neither revoke the key nor break later requests.
      const recovered = await request
        .get("/coins")
        .set("Authorization", `Bearer ${validToken}`);
      expect(recovered.status).toBe(200);
    },
  );

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

  it("should return 401 if the Authorization header contains multiple tokens", async () => {
    const response = await request
      .get("/coins")
      .set("Authorization", `Bearer ${validToken} extra`);

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

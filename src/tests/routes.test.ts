import { describe, expect, it } from "@jest/globals";
import supertest from "supertest";
import { expectResponse } from "./helpers/openapi-contract";
import { app } from "../app";

const request = supertest(app);

describe("Application routes", () => {
  it("serves the Swagger UI without requiring an API key", async () => {
    const response = await request.get("/api-docs/");

    expect(response.status).toBe(200);
    expectResponse("/api-docs/", "get", response);
    expect(response.type).toBe("text/html");
    expect(response.text).toContain("Crypto Price Tracker API Docs");
  });

  it("serves the OpenAPI document as JSON", async () => {
    const response = await request.get("/api-docs/openapi.json");

    expect(response.status).toBe(200);
    expectResponse("/api-docs/openapi.json", "get", response);
    expect(response.body).toMatchObject({
      openapi: "3.0.3",
      info: { title: "Crypto Price Tracker API" },
    });
  });

  it("returns the health status from GET /", async () => {
    const response = await request.get("/");

    expect(response.status).toBe(200);
    expectResponse("/", "get", response);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns 404 for an unsupported route and method", async () => {
    const response = await request.post("/");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Route not found");
  });

  it("rejects query parameters on the health endpoint", async () => {
    const response = await request.get("/?verbose=true");

    expect(response.status).toBe(400);
    expectResponse("/", "get", response);
  });
});

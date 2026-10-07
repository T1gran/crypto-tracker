import { describe, expect, it } from "@jest/globals";
import supertest from "supertest";
import { app } from "../app";

const request = supertest(app);

describe("Application routes", () => {
  it("returns the health status from GET /", async () => {
    const response = await request.get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns 404 for an unsupported route and method", async () => {
    const response = await request.post("/");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Route not found");
  });
});

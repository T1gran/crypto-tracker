import type { Config } from "jest";

process.env.NODE_ENV = "test";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
  forceExit: true,
};

export default config;

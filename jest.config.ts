import type { Config } from "jest";

process.env.NODE_ENV = "test";
process.env.CMC_API_KEY = "test-cmc-api-key";
process.env.CMC_API_URL = "https://pro-api.coinmarketcap.test";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
  forceExit: true,
};

export default config;

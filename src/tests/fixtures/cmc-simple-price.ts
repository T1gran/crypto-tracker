import type { CmcSimplePriceResponse } from "../../types/cmc.types";

// Simple Price v2 returns a string success code in real CMC responses.
export const cmcSimplePriceFixture: CmcSimplePriceResponse = {
  data: [
    {
      id: 1,
      name: "Bitcoin",
      symbol: "BTC",
      slug: "bitcoin",
      quotes: [{ symbol: "USD", price: 65000.5 }],
    },
  ],
  status: {
    timestamp: "2026-10-08T10:00:00.000Z",
    error_code: "0",
    error_message: "",
    elapsed: 10,
    credit_count: 1,
  },
};

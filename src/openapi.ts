// express.json runs before every route, including public documentation.
const commonErrors = {
  "400": { $ref: "#/components/responses/BadRequest" },
  "413": { $ref: "#/components/responses/PayloadTooLarge" },
  "500": { $ref: "#/components/responses/InternalServerError" },
};
const symbolInput = {
  type: "string",
  pattern: "^\\s*[A-Za-z0-9]{2,20}\\s*$",
  description: "Surrounding whitespace is trimmed; 2–20 ASCII letters/digits remain. Symbols are matched case-insensitively and stored uppercase.",
  example: "BTC",
};
const historyBound = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}(?:T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d{1,3})?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d))?$",
  description: "A valid calendar date YYYY-MM-DD, or a timestamp with uppercase T, seconds, optional 1–3 fractional digits and uppercase Z or an explicit offset. Converted to UTC; the resulting year must have four digits. Encode + as %2B in URLs. Repeated parameters are rejected.",
  example: "2026-10-08T17:00:00.123+07:00",
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Crypto Price Tracker API",
    version: "1.0.0",
    description: "API for tracking cryptocurrency prices in USD. JSON bodies are limited to 100 KiB (102400 bytes); malformed JSON returns 400 and oversized JSON returns 413 before authentication. All errors use {status, message}; unexpected errors return a generic 500. Unknown routes/methods return 404. Health and coin operations reject undeclared query parameters; documentation endpoints ignore query parameters. Bearer scheme must be spelled Bearer, followed by one token.",
  },
  servers: [{ url: "/" }],
  tags: [{ name: "Health" }, { name: "Coins" }, { name: "Documentation" }],
  paths: {
    "/api-docs": {
      get: {
        tags: ["Documentation"],
        summary: "Redirect to Swagger UI",
        security: [],
        responses: {
          ...commonErrors,
          "301": { description: "Redirect to /api-docs/", headers: { Location: { schema: { type: "string" }, example: "/api-docs/" } } },
        },
      },
    },
    "/api-docs/": {
      get: {
        tags: ["Documentation"],
        summary: "Public Swagger UI",
        security: [],
        responses: {
          ...commonErrors,
          "200": { description: "Swagger HTML page", content: { "text/html": { schema: { type: "string" } } } },
        },
      },
    },
    "/api-docs/openapi.json": {
      get: {
        tags: ["Documentation"],
        summary: "Public OpenAPI 3.0.3 document",
        security: [],
        responses: {
          ...commonErrors,
          "200": { description: "OpenAPI document", content: { "application/json": { schema: { type: "object", required: ["openapi", "info", "paths", "components"], properties: { openapi: { type: "string", enum: ["3.0.3"] }, info: { type: "object" }, paths: { type: "object" }, components: { type: "object" } } } } } },
        },
      },
    },
    "/": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          ...commonErrors,
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Health" },
              },
            },
          },
        },
      },
    },
    "/coins": {
      get: {
        tags: ["Coins"],
        summary: "List active tracked coins",
        security: [{ bearerAuth: [] }],
        responses: {
          ...commonErrors,
          "200": {
            description: "Active tracked coins",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Coin" },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Coins"],
        summary: "Start tracking a coin",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateCoinRequest" },
            },
          },
        },
        responses: {
          ...commonErrors,
          "201": {
            description: "Coin added",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message", "data"],
                  properties: {
                    message: { type: "string", example: "Coin added successfully" },
                    data: { $ref: "#/components/schemas/Coin" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { $ref: "#/components/responses/Conflict" },
          "502": { $ref: "#/components/responses/CoinMarketCapUnavailable" },
        },
      },
    },
    "/coins/{symbol}": {
      parameters: [{ $ref: "#/components/parameters/Symbol" }],
      get: {
        tags: ["Coins"],
        summary: "Get a tracked coin",
        security: [{ bearerAuth: [] }],
        responses: {
          ...commonErrors,
          "200": {
            description: "Tracked coin",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: { data: { $ref: "#/components/schemas/Coin" } },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Coins"],
        summary: "Stop tracking a coin",
        description: "Deletes the coin and all its price history.",
        security: [{ bearerAuth: [] }],
        responses: {
          ...commonErrors,
          "200": {
            description: "Coin deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Message" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Coins"],
        summary: "Activate or deactivate a coin",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateCoinStatusRequest" },
            },
          },
        },
        responses: {
          ...commonErrors,
          "200": {
            description: "Coin status updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Message" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/coins/{symbol}/price": {
      parameters: [{ $ref: "#/components/parameters/Symbol" }],
      get: {
        tags: ["Coins"],
        summary: "Fetch and persist the current USD price",
        description: "Calls CMC and writes history on every successful request, including for inactive coins. Returns 404 if the original coin is deleted while fetching, even if its symbol is recreated.",
        security: [{ bearerAuth: [] }],
        responses: {
          ...commonErrors,
          "200": {
            description: "Current price",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: { $ref: "#/components/schemas/CurrentPrice" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
          "502": { $ref: "#/components/responses/CoinMarketCapUnavailable" },
        },
      },
    },
    "/coins/{symbol}/history": {
      parameters: [{ $ref: "#/components/parameters/Symbol" }],
      get: {
        tags: ["Coins"],
        summary: "Get price history",
        description: "Reads SQLite without calling CMC. Ordered by fetched_at descending, then id descending. Only limit, offset, from and to are allowed; each must occur at most once. from must not exceed to after UTC normalization.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            description: "Decimal digits only; signs, fractions and repeated values are rejected.",
            schema: { type: "integer", minimum: 1, maximum: 1000, default: 100 },
          },
          {
            name: "offset",
            in: "query",
            description: "Decimal digits only; signs, fractions and repeated values are rejected.",
            schema: { type: "integer", minimum: 0, maximum: 1000000, default: 0 },
          },
          {
            name: "from",
            in: "query",
            description: "Inclusive lower bound. Date-times require Z or a timezone offset; a date means 00:00:00.000 UTC.",
            schema: { $ref: "#/components/schemas/HistoryBound" },
          },
          {
            name: "to",
            in: "query",
            description: "Inclusive upper bound. Date-times require Z or a timezone offset; a date means 23:59:59.999 UTC. Must not precede from.",
            schema: { $ref: "#/components/schemas/HistoryBound" },
          },
        ],
        responses: {
          ...commonErrors,
          "200": {
            description: "Price history",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["symbol", "count", "data"],
                  properties: {
                    symbol: { type: "string", example: "BTC" },
                    count: { type: "integer", minimum: 0, description: "Number of rows in this page, not the total history size.", example: 1 },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/PriceHistory" },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API key",
        description: "API key generated by the seed script.",
      },
    },
    parameters: {
      Symbol: {
        name: "symbol",
        in: "path",
        required: true,
        schema: symbolInput,
        example: "BTC",
      },
    },
    schemas: {
      HistoryBound: historyBound,
      Health: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", example: "ok" } },
      },
      Coin: {
        type: "object",
        required: ["id", "symbol", "name", "is_active", "created_at", "updated_at", "last_synced_at"],
        properties: {
          id: { type: "integer", example: 1 },
          symbol: { type: "string", example: "BTC" },
          name: { type: "string", example: "Bitcoin" },
          is_active: { type: "integer", enum: [0, 1], example: 1 },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
          last_synced_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      CreateCoinRequest: {
        type: "object",
        required: ["symbol", "name"],
        additionalProperties: false,
        properties: {
          symbol: symbolInput,
          name: { type: "string", pattern: "^\\s*\\S(?:[\\s\\S]{0,98}\\S)?\\s*$", description: "After trimming, 1–100 characters; whitespace-only names are rejected. The original name is stored, including surrounding whitespace. Must match the CMC asset name ignoring case and surrounding whitespace.", example: "Bitcoin" },
        },
      },
      UpdateCoinStatusRequest: {
        type: "object",
        required: ["isActive"],
        additionalProperties: false,
        properties: { isActive: { type: "boolean", example: false } },
      },
      CurrentPrice: {
        type: "object",
        required: ["symbol", "price_usd", "last_synced_at"],
        properties: {
          symbol: { type: "string", example: "BTC" },
          price_usd: { type: "number", format: "double", example: 65000.5 },
          last_synced_at: { type: "string", format: "date-time" },
        },
      },
      PriceHistory: {
        type: "object",
        required: ["id", "coin_symbol", "price_usd", "fetched_at"],
        properties: {
          id: { type: "integer", example: 1 },
          coin_symbol: { type: "string", example: "BTC" },
          price_usd: { type: "number", format: "double", example: 65000.5 },
          fetched_at: { type: "string", format: "date-time" },
        },
      },
      Message: {
        type: "object",
        required: ["message"],
        properties: { message: { type: "string" } },
      },
      Error: {
        type: "object",
        required: ["status", "message"],
        additionalProperties: false,
        properties: {
          status: { type: "string", enum: ["fail", "error"], description: "fail for controlled errors (including upstream 502); error for unexpected 500 errors.", example: "fail" },
          message: { type: "string" },
        },
      },
    },
    responses: {
      PayloadTooLarge: {
        description: "JSON request body exceeds 100 KiB",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: "fail", message: "Request body is too large" } } },
      },
      InternalServerError: {
        description: "Unexpected server or database error; no internal details are exposed",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" }, example: { status: "error", message: "Internal server error" } } },
      },
      BadRequest: {
        description: "Invalid request",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Unauthorized: {
        description: "Missing or invalid API key",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      NotFound: {
        description: "Resource or CoinMarketCap asset not found",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      Conflict: {
        description: "Coin is already tracked",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      CoinMarketCapUnavailable: {
        description: "CoinMarketCap returned an invalid response or is unavailable",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
  },
};

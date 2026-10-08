export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Crypto Price Tracker API",
    version: "1.0.0",
    description: "API for tracking cryptocurrency prices from CoinMarketCap.",
  },
  servers: [{ url: "/" }],
  tags: [{ name: "Health" }, { name: "Coins" }],
  paths: {
    "/": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Health" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/coins": {
      get: {
        tags: ["Coins"],
        summary: "List active tracked coins",
        security: [{ bearerAuth: [] }],
        responses: {
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
          "400": { $ref: "#/components/responses/BadRequest" },
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
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Coins"],
        summary: "Stop tracking a coin",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Coin deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Message" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
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
          "200": {
            description: "Coin status updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Message" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
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
        security: [{ bearerAuth: [] }],
        responses: {
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
          "400": { $ref: "#/components/responses/BadRequest" },
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
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 1000, default: 100 },
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", minimum: 0, maximum: 1000000, default: 0 },
          },
          {
            name: "from",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
        ],
        responses: {
          "200": {
            description: "Price history",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["symbol", "count", "data"],
                  properties: {
                    symbol: { type: "string", example: "BTC" },
                    count: { type: "integer", example: 1 },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/PriceHistory" },
                    },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
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
        schema: { type: "string", pattern: "^[A-Za-z0-9]{2,20}$" },
        example: "BTC",
      },
    },
    schemas: {
      Health: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", example: "ok" } },
      },
      Coin: {
        type: "object",
        required: ["id", "symbol", "name", "is_active", "created_at", "updated_at"],
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
          symbol: { type: "string", pattern: "^[A-Za-z0-9]{2,20}$", example: "BTC" },
          name: { type: "string", minLength: 1, maxLength: 100, example: "Bitcoin" },
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
        properties: {
          status: { type: "string", example: "fail" },
          message: { type: "string" },
        },
      },
    },
    responses: {
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

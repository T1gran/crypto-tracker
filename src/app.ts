import express from "express";
import swaggerUi from "swagger-ui-express";
import { routes } from "./routes";
import { coinRouter } from "./routes/coins.routes";
import { errorMiddleware } from "./middleware/error.middleware";
import { AppError } from "./errors/app-error";
import { openApiSpec } from "./openapi";

export const app = express();

app.use(express.json());
app.get("/api-docs/openapi.json", (_req, res) => res.json(openApiSpec));
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, { customSiteTitle: "Crypto Price Tracker API Docs" }),
);
app.use("/coins", coinRouter);
app.use(routes);

app.use((_req, res) => {
  throw new AppError(`Route not found`, 404);
});

app.use(errorMiddleware);

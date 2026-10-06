import express from "express";
import { routes } from "./routes";
import { coinRouter } from "./routes/coins.routes";
import { errorMiddleware } from "./middleware/error.middleware";
import { AppError } from "./errors/app-error";

export const app = express();

app.use(express.json());
app.use("/coins", coinRouter);
app.use(routes);

app.use((_req, res) => {
  throw new AppError(`Route not found`, 404);
});

app.use(errorMiddleware);

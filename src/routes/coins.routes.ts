import express from "express";
import {
  createCoin,
  deleteCoinBySymbol,
  getCoinBySymbol,
  getCoinHistory,
  getCoins,
} from "../controllers/coins.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { validateMiddleware } from "../middleware/validate.middleware";

export const coinRouter = express.Router();

coinRouter.use(authMiddleware);

coinRouter.get("/", getCoins);
coinRouter.post("/", validateMiddleware, createCoin);
coinRouter.get("/:symbol", getCoinBySymbol);
coinRouter.delete("/:symbol", deleteCoinBySymbol);
coinRouter.get("/:symbol/history", getCoinHistory);

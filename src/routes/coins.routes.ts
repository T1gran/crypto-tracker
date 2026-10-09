import express from "express";
import {
  createCoin,
  deleteCoinBySymbol,
  getCoinBySymbol,
  getCoinHistory,
  getCurrentCoinPrice,
  getCoins,
  updateCoinStatus,
} from "../controllers/coins.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  validateHistoryQuery,
  validateMiddleware,
  validateNoQuery,
  validateStatusUpdate,
  validateSymbolParam,
} from "../middleware/validate.middleware";

export const coinRouter = express.Router();

coinRouter.use(authMiddleware);

coinRouter.get("/", validateNoQuery, getCoins);
coinRouter.post("/", validateNoQuery, validateMiddleware, createCoin);
coinRouter.get(
  "/:symbol/price",
  validateSymbolParam,
  validateNoQuery,
  getCurrentCoinPrice,
);
coinRouter.get(
  "/:symbol",
  validateSymbolParam,
  validateNoQuery,
  getCoinBySymbol,
);
coinRouter.delete(
  "/:symbol",
  validateSymbolParam,
  validateNoQuery,
  deleteCoinBySymbol,
);
coinRouter.get(
  "/:symbol/history",
  validateSymbolParam,
  validateHistoryQuery,
  getCoinHistory,
);
coinRouter.patch(
  "/:symbol",
  validateSymbolParam,
  validateNoQuery,
  validateStatusUpdate,
  updateCoinStatus,
);

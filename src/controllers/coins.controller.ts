import { Request, Response, NextFunction } from "express";
import { CoinRepository } from "../db/repository/coin.repository";
import { binanceService } from "../services/binance.service";

export const createCoin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { symbol, name } = req.body ?? {};

    const isTickerOnBinance = await binanceService.validateSymbol(symbol);
    if (!isTickerOnBinance) {
      return res.status(404).json({
        message: `Ticker '${symbol}' not found on Binance`,
      });
    }

    const existingCoin = CoinRepository.findBySymbol(symbol);
    if (existingCoin) {
      return res.status(409).json({
        message: `Coin with symbol '${symbol}' is already being tracked`,
      });
    }

    const newCoin = CoinRepository.create(symbol, name);
    return res.status(201).json({
      message: "Coin added successfully",
      data: newCoin,
    });
  } catch (error) {
    next(error);
  }
};

import { Request, Response, NextFunction } from "express";
import { CoinRepository } from "../db/repository/coin.repository";
import { binanceService } from "../services/binance.service";
import { PriceRepository } from "../db/repository/price.repository";

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

export const getCoins = (req: Request, res: Response, next: NextFunction) => {
  try {
    const coins = CoinRepository.findAll();
    return res.status(200).json({
      data: coins,
    });
  } catch (error) {
    next(error);
  }
};

export const getCoinBySymbol = (
  req: Request<{ symbol: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { symbol } = req.params;

    const coin = CoinRepository.findBySymbol(symbol);
    if (!coin) {
      return res.status(404).json({ message: "Coin not found" });
    }

    return res.status(200).json({
      data: coin,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCoinBySymbol = (
  req: Request<{ symbol: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { symbol } = req.params;
    const isDeleted = CoinRepository.deleteBySymbol(symbol);

    if (!isDeleted) {
      return res.status(404).json({ message: "Coin not found" });
    }

    return res.status(200).json({
      message: `Coin '${symbol.toUpperCase()}' successfully deleted`,
    });
  } catch (error) {
    next(error);
  }
};

export const getCoinHistory = (
  req: Request<{ symbol: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { symbol } = req.params;

    const coin = CoinRepository.findBySymbol(symbol);
    if (!coin) {
      return res.status(404).json({ message: "Coin not found" });
    }

    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const history = PriceRepository.getHistoryBySymbol(symbol, {
      limit,
      offset,
      from,
      to,
    });

    return res.status(200).json({
      symbol: symbol.toUpperCase(),
      count: history.length,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

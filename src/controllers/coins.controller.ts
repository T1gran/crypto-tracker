import { Request, Response, NextFunction } from "express";
import { CoinRepository } from "../db/repository/coin.repository";
import { coinMarketCapService } from "../services/coinmarketcap.service";
import { PriceRepository } from "../db/repository/price.repository";
import { AppError } from "../errors/app-error";

export const createCoin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { symbol, name } = req.body ?? {};

    const isTickerOnCmc = await coinMarketCapService.validateSymbol(
      symbol,
      name,
    );
    if (!isTickerOnCmc) {
      throw new AppError(`Coin '${symbol}' not found`, 404);
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
      throw new AppError(`Coin '${symbol}' not found`, 404);
    }

    return res.status(200).json({
      data: coin,
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentCoinPrice = async (
  req: Request<{ symbol: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { symbol } = req.params;
    const coin = CoinRepository.findBySymbol(symbol);
    if (!coin) {
      throw new AppError(`Coin '${symbol}' not found`, 404);
    }

    const price = await coinMarketCapService.getPrice(coin.symbol, coin.name);
    PriceRepository.savePrice(coin.symbol, price);
    const updatedCoin = CoinRepository.findBySymbol(coin.symbol)!;

    return res.status(200).json({
      data: {
        symbol: updatedCoin.symbol,
        price_usd: price,
        last_synced_at: updatedCoin.last_synced_at,
      },
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
      throw new AppError(`Coin '${symbol}' not found`, 404);
    }

    return res.status(200).json({
      message: `Coin '${symbol.toUpperCase()}' successfully deleted`,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCoinStatus = (
  req: Request<{ symbol: string }, unknown, { isActive: boolean }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { symbol } = req.params;
    const { isActive } = req.body;
    const isUpdated = CoinRepository.updateCoinStatus(symbol, isActive);

    if (!isUpdated) {
      throw new AppError(`Coin '${symbol}' not found`, 404);
    }

    return res.status(200).json({
      message: `Coin '${symbol.toUpperCase()}' successfully updated`,
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
      throw new AppError(`Coin '${symbol}' not found`, 404);
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

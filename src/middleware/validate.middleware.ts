import { Request, Response, NextFunction } from "express";

export const validateMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.body) {
    return res.status(400).json("Bad request");
  }
  const { symbol, name } = req.body ?? {};

  if (typeof symbol !== "string" || symbol.trim().length === 0) {
    return res.status(400).json({
      message:
        "Bad request: 'symbol' is required and must be a non-empty string",
    });
  }

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({
      message: "Bad request: 'name' is required and must be a non-empty string",
    });
  }
  next();
};

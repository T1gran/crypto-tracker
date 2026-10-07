import { NextFunction, Request, Response } from "express";

const SYMBOL_PATTERN = /^[A-Za-z0-9]{2,20}$/;
const MAX_COIN_NAME_LENGTH = 100;
const HISTORY_QUERY_KEYS = new Set(["limit", "offset", "from", "to"]);

const badRequest = (res: Response, message: string) =>
  res.status(400).json({ message: `Bad request: ${message}` });

const isValidDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(
    value,
  ) && !Number.isNaN(Date.parse(value));

export const validateMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return badRequest(res, "request body must be an object");
  }

  const keys = Object.keys(req.body);
  if (keys.some((key) => key !== "symbol" && key !== "name")) {
    return badRequest(res, "request body contains unsupported fields");
  }

  const { symbol, name } = req.body;
  if (typeof symbol !== "string" || !SYMBOL_PATTERN.test(symbol.trim())) {
    return badRequest(
      res,
      "'symbol' is required and must contain 2 to 20 letters or digits",
    );
  }

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.trim().length > MAX_COIN_NAME_LENGTH
  ) {
    return badRequest(
      res,
      "'name' is required and must be a non-empty string of at most 100 characters",
    );
  }
  next();
};

export const validateSymbolParam = (
  req: Request<{ symbol: string }>,
  res: Response,
  next: NextFunction,
) => {
  if (!SYMBOL_PATTERN.test(req.params.symbol.trim())) {
    return badRequest(res, "'symbol' must contain 2 to 20 letters or digits");
  }

  next();
};

export const validateHistoryQuery = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const queryKeys = Object.keys(req.query);
  if (queryKeys.some((key) => !HISTORY_QUERY_KEYS.has(key))) {
    return badRequest(res, "query contains unsupported parameters");
  }

  const { limit, offset, from, to } = req.query;
  if (
    (limit !== undefined &&
      (typeof limit !== "string" ||
        !/^\d+$/.test(limit) ||
        Number(limit) < 1 ||
        Number(limit) > 1000)) ||
    (offset !== undefined &&
      (typeof offset !== "string" ||
        !/^\d+$/.test(offset) ||
        Number(offset) > 1_000_000))
  ) {
    return badRequest(
      res,
      "'limit' must be an integer from 1 to 1000 and 'offset' an integer from 0 to 1000000",
    );
  }

  if (
    (from !== undefined && (typeof from !== "string" || !isValidDate(from))) ||
    (to !== undefined && (typeof to !== "string" || !isValidDate(to)))
  ) {
    return badRequest(res, "'from' and 'to' must be valid ISO-8601 dates");
  }

  if (
    typeof from === "string" &&
    typeof to === "string" &&
    new Date(from) > new Date(to)
  ) {
    return badRequest(res, "'from' must not be later than 'to'");
  }

  next();
};

export const validateNoQuery = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (Object.keys(req.query).length > 0) {
    return badRequest(res, "this endpoint does not accept query parameters");
  }

  next();
};

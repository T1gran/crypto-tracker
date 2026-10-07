import { NextFunction, Request, Response } from "express";
import { ApiKeyRepository } from "../db/repository/api-key.repository";
import { AppError } from "../errors/app-error";
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !/^Bearer\s+[^\s]+$/.test(authHeader)) {
    throw new AppError(
      "Unauthorized: Authorization header missing or invalid format",
      401,
    );
  }

  const authToken = authHeader.slice("Bearer".length).trim();

  const apiKey = ApiKeyRepository.findByKeyValue(authToken);

  if (!apiKey) {
    throw new AppError("Unauthorized: Invalid API key", 401);
  }

  next();
};

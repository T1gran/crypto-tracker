import { NextFunction, Request, Response } from "express";
import { ApiKeyRepository } from "../db/repository/api-key.repository";
import { AppError } from "../errors/app-error";
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError(
      "Unauthorized: Authorization header missing or invalid format",
      401,
    );
  }

  const authToken = authHeader.split(" ")[1]?.trim();

  if (!authToken) {
    throw new AppError("Unauthorized: Token is missing", 401);
  }

  const apiKey = ApiKeyRepository.findByKeyValue(authToken);

  if (!apiKey) {
    throw new AppError("Unauthorized: Invalid API key", 401);
  }

  next();
};

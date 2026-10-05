import { NextFunction, Request, Response } from "express";
import { ApiKeyRepository } from "../db/repository/api-key.repository";
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Unauthorized: Authorization header missing or invalid format",
    });
  }

  const authToken = authHeader.split(" ")[1]?.trim();

  if (!authToken) {
    return res.status(401).json({
      message: "Unauthorized: Token is missing",
    });
  }

  const apiKey = ApiKeyRepository.findByKeyValue(authToken);

  if (!apiKey) {
    return res.status(401).json({
      message: "Unauthorized: Invalid API key",
    });
  }

  next();
};

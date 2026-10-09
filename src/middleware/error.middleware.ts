import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error";

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: "fail",
      message: err.message,
    });
  }

  if ("type" in err && err.type === "entity.parse.failed") {
    return res.status(400).json({
      status: "fail",
      message: "Invalid JSON format in request body",
    });
  }

  if (err instanceof URIError && hasHttpStatus(err, 400)) {
    return res.status(400).json({
      status: "fail",
      message: "Invalid URL encoding",
    });
  }

  if (
    "type" in err &&
    err.type === "entity.too.large" &&
    hasHttpStatus(err, 413)
  ) {
    return res.status(413).json({
      status: "fail",
      message: "Request body is too large",
    });
  }

  console.error("[Unhandled Error]:", err);

  const isProduction = process.env.NODE_ENV === "production";

  return res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
};

function hasHttpStatus(error: Error, expected: number): boolean {
  return (
    ("status" in error && error.status === expected) ||
    ("statusCode" in error && error.statusCode === expected)
  );
}

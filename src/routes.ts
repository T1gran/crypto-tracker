import { Router } from "express";

export const routes = Router();

routes.get("/", (req, res, next) => {
  res.json({ status: "ok" });
});

import { Router } from "express";
import { validateNoQuery } from "./middleware/validate.middleware";

export const routes = Router();

routes.get("/", validateNoQuery, (req, res, next) => {
  res.json({ status: "ok" });
});

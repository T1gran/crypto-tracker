import express from "express";
import { routes } from "./routes";
import { coinRouter } from "./routes/coins.routes";

export const app = express();

app.use(express.json());
app.use("/coins", coinRouter);
app.use(routes);

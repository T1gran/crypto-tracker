import { app } from "./app";
import { initDb } from "./db/database";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;

function startServer() {
  try {
    initDb();

    app.listen(PORT, () => {
      console.log(`Server started at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

startServer();

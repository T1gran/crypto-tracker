import { app } from "./app";
import { initDb } from "./db/init";
import dotenv from "dotenv";
import { priceSyncService } from "./services/sync.service";
import { db } from "./db/database";

dotenv.config();

const PORT = process.env.PORT || 3000;

function startServer() {
  try {
    initDb();

    const server = app.listen(PORT, () => {
      console.log(`Server started at http://localhost:${PORT}`);
      priceSyncService.start();
    });

    const shutdown = () => {
      console.log("\nShutting down gracefully...");

      priceSyncService.stop();

      server.close(() => {
        console.log("HTTP server closed.");
        try {
          db.close();
          console.log("Database connection closed.");
        } catch (err) {
          console.error("Error closing database connection:", err);
        }
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

startServer();

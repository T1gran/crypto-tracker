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

    let isShuttingDown = false;

    const shutdown = async () => {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;

      const shutdownTimeout = setTimeout(() => {
        console.error("Shutdown timed out after 10 seconds");
        process.exit(1);
      }, 10_000);

      shutdownTimeout.unref();

      console.log("\nShutting down gracefully...");

      const stopPromise = priceSyncService.stop();

      server.close(async (error) => {
        console.log("HTTP server closed.");
        try {
          if (error) throw error;
          await stopPromise;
          db.close();
          console.log("Database connection closed.");
          clearTimeout(shutdownTimeout);
          process.exitCode = 0;
        } catch (err) {
          console.error("Error closing database connection:", err);
          process.exitCode = 1;
        }
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

import * as dotenv from "dotenv";
import app from "./app";
import { connectDatabase, pool } from "./config/db";

dotenv.config();

const PORT = parseInt(process.env.PORT ?? "3001", 10);

async function bootstrap(): Promise<void> {
  try {
    // Verify DB connection before accepting traffic
    await connectDatabase();

    const server = app.listen(PORT, () => {
      console.log(
        `🚀  Buddy Script API running on http://localhost:${PORT} [${process.env.NODE_ENV ?? "development"}]`,
      );
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received — shutting down gracefully...`);
      server.close(async () => {
        await pool.end();
        console.log("✅  Server and DB pool closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    console.error("❌  Failed to start server:", err);
    process.exit(1);
  }
}

bootstrap();

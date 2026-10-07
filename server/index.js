import "dotenv/config";
import { createApp } from "./app.js";
import { pool } from "./db.js";
import { refreshPopularProducts } from "./external-data.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const app = createApp(pool);

if (process.env.REAL_DATA_SYNC_ENABLED !== "false") {
  const syncPopularProducts = async () => {
    try {
      await refreshPopularProducts(pool);
    } catch (error) {
      console.warn("Popular product sync skipped:", error.message);
    }
  };

  void syncPopularProducts();
  setInterval(() => {
    void syncPopularProducts();
  }, 1000 * 60 * 60 * 3);
}

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Pricewise API listening on port ${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Copy .env.example and configure PostgreSQL.");
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: Number.parseInt(process.env.DB_POOL_MAX ?? "10", 10),
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});
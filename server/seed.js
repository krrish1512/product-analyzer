import "dotenv/config";
import { pool } from "./db.js";
import { demoProducts } from "./seed-data.js";
import { seedCatalog } from "./seed-catalog.js";
const client = await pool.connect();

try {
  await seedCatalog(client);
  console.log(`Seeded ${demoProducts.length} demo products (existing rows were preserved).`);
} catch (error) {
  console.error("Database seed failed:", error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
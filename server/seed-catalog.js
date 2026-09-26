import { demoProducts } from "./seed-data.js";

const historyMultipliers = [1.12, 1.08, 1.03, 1.06, 1.01, 1.04, 1];

export async function seedCatalog(client) {
  await client.query("BEGIN");
  try {
    for (const product of demoProducts) {
      await client.query(
        "INSERT INTO products (id, name, category, image_url) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
        [product.id, product.name, product.category, product.image],
      );

      for (const offer of product.offers) {
        await client.query(
          `INSERT INTO offers (product_id, store, price, original_price, store_url)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (product_id, store) DO NOTHING`,
          [product.id, offer.store, offer.price, offer.originalPrice, offer.storeUrl],
        );
      }

      for (const [index, multiplier] of historyMultipliers.entries()) {
        const observedOn = new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10);
        await client.query(
          `INSERT INTO price_history (product_id, price, observed_on)
           VALUES ($1, $2, $3::date)
           ON CONFLICT (product_id, observed_on, source) DO NOTHING`,
          [product.id, Math.round(product.offers[0].price * multiplier), observedOn],
        );
      }
    }
    await client.query("SELECT setval(pg_get_serial_sequence('offers', 'id'), COALESCE((SELECT MAX(id) FROM offers), 1))");
    await client.query("SELECT setval(pg_get_serial_sequence('price_history', 'id'), COALESCE((SELECT MAX(id) FROM price_history), 1))");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
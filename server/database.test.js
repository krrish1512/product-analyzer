import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "./app.js";
import { applyMigrations } from "./migration-runner.js";
import { seedCatalog } from "./seed-catalog.js";

let database;
let server;
let baseUrl;

before(async () => {
  database = new PGlite();
  assert.deepEqual(await applyMigrations(database), ["001_initial.sql", "002_external_product_cache.sql"]);
  assert.deepEqual(await applyMigrations(database), []);
  await seedCatalog(database);
  await seedCatalog(database);
  server = createApp(database).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await database.close();
});

test("PostgreSQL migration supports product listing and price aggregation", async () => {
  const response = await fetch(`${baseUrl}/api/products?category=Audio&sort=price-low`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 2);
  assert.equal(body.items[0].name, "JBL Flip 6 Portable Speaker");
  assert.equal(body.items[0].price, 9999);
  assert.equal(body.items[0].platform, "Amazon");
  assert.equal(body.items[0].prices.length, 2);
  const seededCount = await database.query("SELECT count(*)::integer AS count FROM products");
  assert.equal(seededCount.rows[0].count, 6);
});

test("product detail includes chronologically ordered stored history", async () => {
  const response = await fetch(`${baseUrl}/api/products/3`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.history.length, 7);
  assert.deepEqual(body.history.map((point) => point.price), [27999, 26999, 25749, 26499, 25249, 25999, 24999]);
});

test("search terms are parameterized rather than interpreted as SQL", async () => {
  const response = await fetch(`${baseUrl}/api/products?q=${encodeURIComponent("' OR TRUE --")}`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).total, 0);
});
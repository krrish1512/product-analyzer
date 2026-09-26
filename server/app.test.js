import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "./app.js";

const product = {
  id: 3,
  name: "Sony WH-1000XM5 Headphones",
  category: "Audio",
  price: 24999,
  total_count: 1,
};
let server;
let baseUrl;
let filters;

before(async () => {
  const fakePool = {
    async query(sql, values = []) {
      if (sql.trim() === "SELECT 1") return { rows: [{ "?column?": 1 }], rowCount: 1 };
      if (sql.includes("WHERE p.id = $1")) return { rows: values[0] === 3 ? [{ ...product }] : [], rowCount: values[0] === 3 ? 1 : 0 };
      filters = values;
      return { rows: [{ ...product }], rowCount: 1 };
    },
  };
  server = createApp(fakePool).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("health endpoint verifies the database connection", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", database: "connected" });
});

test("product listing applies validated search, category, sort, and pagination", async () => {
  const response = await fetch(`${baseUrl}/api/products?q=sony&category=Audio&sort=price-low&limit=10&offset=5`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.items[0].id, 3);
  assert.equal(body.total, 1);
  assert.deepEqual(filters, ["sony", "Audio", "price-low", 10, 5]);
});

test("product detail distinguishes invalid, missing, and found ids", async () => {
  assert.equal((await fetch(`${baseUrl}/api/products/nope`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/products/99`)).status, 404);
  const response = await fetch(`${baseUrl}/api/products/3`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).name, product.name);
});

test("unsupported sort values are rejected", async () => {
  const response = await fetch(`${baseUrl}/api/products?sort=arbitrary`);
  assert.equal(response.status, 400);
});
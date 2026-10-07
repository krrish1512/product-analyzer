import assert from "node:assert/strict";
import { test } from "node:test";
import { refreshExternalProductCache } from "./external-data.js";

test("SerpAPI refresh stores direct merchant product links and all available store offers", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.SERPAPI_API_KEY;
  process.env.SERPAPI_API_KEY = "test-key";
  const requests = [];
  const savedOffers = [];
  const database = {
    async query(sql, values = []) {
      if (sql.includes("SELECT payload, expires_at")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT id FROM products")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT COALESCE(MAX(id)")) return { rows: [{ next_id: 9 }], rowCount: 1 };
      if (sql.includes("INSERT INTO offers")) savedOffers.push(values);
      return { rows: [], rowCount: 1 };
    },
  };

  globalThis.fetch = async (input) => {
    const url = new URL(input);
    requests.push(url);

    if (url.searchParams.get("engine") === "google_shopping") {
      return new Response(JSON.stringify({
        shopping_results: [{
          title: "Sony WH-CH720N Wireless Headphones",
          source: "Google Shopping",
          price: "₹9,990",
          thumbnail: "https://images.example.test/sony.jpg",
          serpapi_immersive_product_api: "https://serpapi.com/search.json?engine=google_immersive_product&page_token=product",
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      product_results: {
        stores: [
          { name: "Retailer A", price: "₹10,490", extracted_price: 10490, link: "https://shop-a.example.test/products/sony-headphones" },
          { name: "Retailer B", price: "₹9,990", extracted_price: 9990, link: "https://shop-b.example.test/sony-wh-ch720n" },
          { name: "Broken retailer", price: "₹8,990", extracted_price: 8990, link: "javascript:alert(1)" },
        ],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await refreshExternalProductCache(database, {
      query: "Sony headphones",
      provider: "serpapi",
      forceRefresh: true,
    });

    assert.equal(requests.length, 2);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].url, "https://shop-b.example.test/sony-wh-ch720n");
    assert.equal(result.items[0].retailer, "Retailer B");
    assert.deepEqual(result.items[0].offers.map((offer) => offer.retailer), ["Retailer B", "Retailer A"]);
    assert.deepEqual(savedOffers.map((offer) => offer[4]), [
      "https://shop-b.example.test/sony-wh-ch720n",
      "https://shop-a.example.test/products/sony-headphones",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.SERPAPI_API_KEY;
    else process.env.SERPAPI_API_KEY = originalApiKey;
  }
});

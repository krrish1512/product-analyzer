const DEFAULT_POPULAR_SEARCHES = [
  "wireless headphones",
  "air fryer",
  "gaming laptop",
  "smartwatch",
  "wireless earbuds",
  "4k tv",
  "fitness tracker",
  "bluetooth speaker",
];

export const SUPPORTED_REAL_DATA_PROVIDERS = Object.freeze(["ebay", "serpapi", "openwebninja"]);

function normalizeQuery(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSeconds(minutes) {
  return Math.max(30, Number.parseInt(minutes ?? "180", 10)) * 60;
}

function dedupeProducts(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.source}|${item.name}|${item.url}|${item.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parsePrice(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function getHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function readJsonResponse(response) {
  const raw = await response.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function getEbayAccessToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const response = await fetchWithTimeout("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope/buy.item.feed https://api.ebay.com/oauth/api_scope/buy.item.search",
  });

  if (!response.ok) return null;
  const payload = await readJsonResponse(response);
  return payload.access_token ?? null;
}

function mapEbayProduct(item) {
  const price = parsePrice(item.price?.value ?? item.price?.amount ?? item.price ?? item.priceInfo?.currentPrice?.value);
  const original = parsePrice(item.priceInfo?.originalPrice?.value ?? item.priceInfo?.currentPrice?.value);
  return {
    source: "ebay",
    name: item.title ?? "Unknown product",
    category: item.categoryPath ?? "General",
    image: item.image?.imageUrl ?? item.image?.imageUrl ?? "",
    price,
    originalPrice: original ?? price,
    url: item.itemWebUrl ?? item.itemWebUrl ?? "",
    retailer: item.seller ?? "eBay",
    cachedAt: new Date().toISOString(),
  };
}

async function fetchEbayListings(query, limit = 10) {
  const token = await getEbayAccessToken();
  if (!token) {
    return { provider: "ebay", items: [], reason: "Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET" };
  }

  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.min(limit, 25)));
  url.searchParams.set("sort", "best_match");

  const response = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const payload = await readJsonResponse(response);
    return { provider: "ebay", items: [], reason: payload?.error ?? "eBay request failed" };
  }

  const payload = await readJsonResponse(response);
  const items = Array.isArray(payload.itemSummaries) ? payload.itemSummaries.slice(0, limit).map(mapEbayProduct) : [];
  return { provider: "ebay", items, reason: null };
}

function mapShoppingProduct(item, provider) {
  const price = parsePrice(item.price ?? item.price_raw ?? item.lowest_price ?? item.offer_price ?? item.offer?.price ?? item.shopping_price);
  return {
    source: provider,
    name: item.title ?? item.name ?? item.product ?? "Unknown product",
    category: item.category ?? item.department ?? "General",
    image: item.thumbnail ?? item.image ?? item.image_url ?? "",
    price,
    originalPrice: parsePrice(item.original_price ?? item.originalPrice ?? item.price) ?? price,
    url: getHttpUrl(item.link ?? item.url ?? item.product_url),
    retailer: item.source ?? item.seller ?? provider,
    cachedAt: new Date().toISOString(),
  };
}

async function fetchSerpApiStoreOffers(item, apiKey) {
  const endpoint = item.serpapi_immersive_product_api ?? item.serpapi_product_api;
  if (!endpoint) return [];

  const url = new URL(endpoint);
  if (url.hostname !== "serpapi.com") {
    throw new Error("SerpAPI returned an unexpected product-details host.");
  }
  url.searchParams.set("api_key", apiKey);

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    const payload = await readJsonResponse(response);
    throw new Error(payload?.error ?? "SerpApi product details request failed");
  }

  const payload = await readJsonResponse(response);
  const stores = payload.product_results?.stores;
  if (!Array.isArray(stores)) return [];

  return stores.map((store) => ({
    retailer: store.name ?? "Marketplace",
    price: parsePrice(store.extracted_price ?? store.price),
    originalPrice: parsePrice(store.extracted_original_price ?? store.original_price ?? store.extracted_price ?? store.price),
    url: getHttpUrl(store.link),
  })).filter((offer) => offer.price && offer.url);
}

async function fetchSerpApiListings(query, limit = 10) {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return { provider: "serpapi", items: [], reason: "Missing SERPAPI_API_KEY" };
  }

  const params = new URLSearchParams({
    q: `${query} shopping`,
    engine: "google_shopping",
    api_key: apiKey,
    location: "India",
    gl: "in",
    hl: "en",
  });

  const response = await fetchWithTimeout(`https://serpapi.com/search.json?${params.toString()}`);
  if (!response.ok) {
    const payload = await readJsonResponse(response);
    return { provider: "serpapi", items: [], reason: payload?.error ?? "SerpApi request failed" };
  }

  const payload = await readJsonResponse(response);
  const listings = Array.isArray(payload.shopping_results) ? payload.shopping_results.slice(0, limit) : [];
  const items = await Promise.all(listings.map(async (listing) => {
    const product = mapShoppingProduct(listing, "serpapi");
    let offers = [];

    try {
      offers = await fetchSerpApiStoreOffers(listing, apiKey);
    } catch (error) {
      console.warn(`SerpApi merchant-link lookup failed for "${product.name}":`, error.message);
    }

    if (!offers.length && product.url && product.price) {
      offers = [{
        retailer: product.retailer,
        price: product.price,
        originalPrice: product.originalPrice,
        url: product.url,
      }];
    }

    if (!offers.length) {
      console.warn(`SerpApi returned no direct merchant link for "${product.name}".`);
      return { ...product, url: null, offers: [] };
    }

    offers.sort((left, right) => left.price - right.price);
    return {
      ...product,
      price: offers[0].price,
      originalPrice: offers[0].originalPrice ?? offers[0].price,
      retailer: offers[0].retailer,
      url: offers[0].url,
      offers,
    };
  }));
  return { provider: "serpapi", items, reason: null };
}

async function fetchOpenWebNinjaListings(query, limit = 10) {
  const apiKey = process.env.OPENWEBNINJA_API_KEY;
  if (!apiKey) {
    return { provider: "openwebninja", items: [], reason: "Missing OPENWEBNINJA_API_KEY" };
  }

  const baseUrl = process.env.OPENWEBNINJA_BASE_URL ?? "https://api.openwebninja.com";
  const params = new URLSearchParams({
    q: query,
    engine: "google_shopping",
    api_key: apiKey,
    num: String(limit),
  });

  const response = await fetchWithTimeout(`${baseUrl}/search?${params.toString()}`);
  if (!response.ok) {
    const payload = await readJsonResponse(response);
    return { provider: "openwebninja", items: [], reason: payload?.error ?? "OpenWeb Ninja request failed" };
  }

  const payload = await readJsonResponse(response);
  const results = Array.isArray(payload.results) ? payload.results : Array.isArray(payload.organic_results) ? payload.organic_results : [];
  const items = results.slice(0, limit).map((item) => mapShoppingProduct(item, "openwebninja"));
  return { provider: "openwebninja", items, reason: null };
}

async function saveCacheEntry(database, provider, normalizedQuery, responseStatus, payload, ttlMinutes, sourceUrl) {
  if (!database?.query) return null;

  const preparedPayload = JSON.stringify({ items: dedupeProducts(payload.items ?? []) });
  const expiresAtSeconds = toSeconds(ttlMinutes);

  await database.query(
    `
      INSERT INTO external_product_cache (
        provider, normalized_query, request_query, response_status, payload, fetched_at, expires_at, source_url
      ) VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW() + ($6 * interval '1 second'), $7)
      ON CONFLICT (provider, normalized_query)
      DO UPDATE SET
        request_query = EXCLUDED.request_query,
        response_status = EXCLUDED.response_status,
        payload = EXCLUDED.payload,
        fetched_at = NOW(),
        expires_at = NOW() + ($6 * interval '1 second'),
        source_url = EXCLUDED.source_url
    `,
    [provider, normalizedQuery, normalizedQuery, responseStatus, preparedPayload, expiresAtSeconds, sourceUrl],
  );

  return true;
}

async function getCachedResults(database, provider, normalizedQuery, ttlMinutes) {
  if (!database?.query) return null;

  const cached = await database.query(
    `
      SELECT payload, expires_at
      FROM external_product_cache
      WHERE provider = $1 AND normalized_query = $2 AND expires_at > NOW()
      ORDER BY fetched_at DESC
      LIMIT 1
    `,
    [provider, normalizedQuery],
  );

  if (!cached.rowCount) return null;
  const payload = cached.rows[0]?.payload ?? { items: [] };
  const items = Array.isArray(payload.items) ? payload.items.filter((item) => (
    getHttpUrl(item.url) || item.offers?.some((offer) => getHttpUrl(offer.url))
  )) : [];
  if (!items.length) return null;
  const stale = new Date(cached.rows[0].expires_at).getTime() - Date.now();
  if (stale < toSeconds(ttlMinutes) * 1000 * 0.5) {
    return { items, fromCache: true };
  }
  return { items, fromCache: true };
}

function ensureValidProductEntry(item) {
  if (!item || !item.name) return null;
  if (!item.price) return null;
  return item;
}

async function upsertExternalProducts(database, items) {
  if (!database?.query || !Array.isArray(items) || items.length === 0) return 0;

  let inserted = 0;

  for (const item of dedupeProducts(items.filter(ensureValidProductEntry))) {
    const productName = item.name.trim();
    const category = item.category || "General";
    const imageUrl = item.image || "";
    const price = Number(item.price);
    const offers = (Array.isArray(item.offers) && item.offers.length ? item.offers : [item])
      .map((offer) => ({
        retailer: String(offer.retailer || item.retailer || item.source || "external").trim(),
        price: Number(offer.price),
        originalPrice: Number(offer.originalPrice ?? offer.price),
        url: getHttpUrl(offer.url),
      }))
      .filter((offer) => offer.retailer && Number.isFinite(offer.price) && offer.price > 0 && offer.url);
    if (!offers.length) continue;

    const existingProduct = await database.query(
      `SELECT id FROM products WHERE lower(name) = lower($1) AND lower(category) = lower($2) ORDER BY id LIMIT 1`,
      [productName, category],
    );
    let productId = Number(existingProduct.rows[0]?.id);

    if (!productId) {
      const nextProduct = await database.query(
        `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM products`,
      );
      productId = Number(nextProduct.rows[0].next_id ?? 1);

      await database.query(
        `
          INSERT INTO products (id, name, category, image_url)
          VALUES ($1, $2, $3, $4)
        `,
        [productId, productName, category, imageUrl],
      );
    } else {
      await database.query(
        `UPDATE products SET image_url = $2 WHERE id = $1`,
        [productId, imageUrl],
      );
    }

    for (const offer of offers) {
      await database.query(
        `
          INSERT INTO offers (product_id, store, price, original_price, store_url, checked_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (product_id, store) DO UPDATE SET
            price = EXCLUDED.price,
            original_price = EXCLUDED.original_price,
            store_url = EXCLUDED.store_url,
            checked_at = NOW()
        `,
        [productId, offer.retailer, offer.price, offer.originalPrice, offer.url],
      );
    }

    await database.query(
      `
        INSERT INTO price_history (product_id, price, observed_on, source)
        VALUES ($1, $2, CURRENT_DATE, $3)
        ON CONFLICT (product_id, observed_on, source) DO UPDATE SET
          price = EXCLUDED.price
      `,
      [productId, price, `external:${item.source ?? "marketplace"}`],
    );

    inserted += 1;
  }

  return inserted;
}

export async function refreshExternalProductCache(database, { query, category = "", limit = 10, forceRefresh = false, provider = "auto" } = {}) {
  const normalizedQuery = normalizeQuery(query || category || "electronics");
  if (!normalizedQuery) return { items: [], cached: false, total: 0 };

  const ttlMinutes = Number.parseInt(process.env.PRODUCT_CACHE_TTL_MINUTES ?? "180", 10);
  const requestedProvider = String(provider ?? "auto").trim().toLowerCase();
  const configuredProviders = getConfiguredRealDataProviders().providers;
  const providers = requestedProvider !== "auto"
    ? [requestedProvider]
    : SUPPORTED_REAL_DATA_PROVIDERS.filter((candidate) => configuredProviders[candidate]);

  if (!providers.length) {
    return {
      items: [],
      cached: false,
      total: 0,
      query: normalizedQuery,
      reason: "No real data providers are configured. Add a SERPAPI_API_KEY or OPENWEBNINJA_API_KEY.",
    };
  }

  const results = [];

  for (const currentProvider of providers) {
    const cached = !forceRefresh ? await getCachedResults(database, currentProvider, normalizedQuery, ttlMinutes) : null;
    if (cached?.items?.length) {
      results.push(...cached.items.map((entry) => ({ ...entry, source: currentProvider })));
      continue;
    }

    let providerResult = { items: [], reason: "No provider configured" };

    if (currentProvider === "ebay") {
      providerResult = await fetchEbayListings(normalizedQuery, limit);
    } else if (currentProvider === "serpapi") {
      providerResult = await fetchSerpApiListings(normalizedQuery, limit);
    } else if (currentProvider === "openwebninja") {
      providerResult = await fetchOpenWebNinjaListings(normalizedQuery, limit);
    }

    const linkedItems = (providerResult.items ?? []).filter((item) => (
      getHttpUrl(item.url) || item.offers?.some((offer) => getHttpUrl(offer.url))
    ));
    if (linkedItems.length) {
      await saveCacheEntry(database, currentProvider, normalizedQuery, 200, { items: linkedItems }, ttlMinutes, "marketplace-search");
      results.push(...linkedItems.map((entry) => ({ ...entry, source: currentProvider })));
    } else {
      await saveCacheEntry(database, currentProvider, normalizedQuery, providerResult.reason ? 503 : 204, { items: [] }, ttlMinutes, "marketplace-search");
    }
  }

  const uniqueItems = dedupeProducts(results).slice(0, limit);
  await upsertExternalProducts(database, uniqueItems);

  return {
    items: uniqueItems,
    cached: results.length > 0,
    total: uniqueItems.length,
    query: normalizedQuery,
  };
}

export async function refreshPopularProducts(database, searchQueries = DEFAULT_POPULAR_SEARCHES) {
  const items = [];

  for (const query of searchQueries) {
    const result = await refreshExternalProductCache(database, { query, limit: 5, forceRefresh: false });
    items.push(...result.items);
  }

  return dedupeProducts(items);
}

export function getConfiguredRealDataProviders() {
  const providers = {
    ebay: Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET),
    serpapi: Boolean(process.env.SERPAPI_API_KEY),
    openwebninja: Boolean(process.env.OPENWEBNINJA_API_KEY),
  };

  return {
    supportedProviders: [...SUPPORTED_REAL_DATA_PROVIDERS],
    enabledProviders: SUPPORTED_REAL_DATA_PROVIDERS.filter((provider) => providers[provider]),
    providers,
  };
}

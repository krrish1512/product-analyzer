import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { fileURLToPath } from "node:url";
import { productSelect } from "./product-query.js";
import { getConfiguredRealDataProviders, refreshExternalProductCache } from "./external-data.js";

const SORTS = new Set(["featured", "price-low", "price-high", "discount"]);
const VALID_REAL_DATA_PROVIDERS = new Set(["auto", "ebay", "serpapi", "openwebninja"]);

function readBoundedString(value, name, maxLength) {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length > maxLength) {
    const error = new Error(`${name} must be ${maxLength} characters or fewer.`);
    error.status = 400;
    throw error;
  }
  return result;
}

function readInteger(value, fallback, minimum, maximum) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

export function createApp(pool) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : false);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'"],
      },
    },
  }));
  app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Try again later." },
  }));
  app.use(express.json({ limit: "16kb", strict: true }));

  app.get("/api/health", async (_request, response, next) => {
    try {
      await pool.query("SELECT 1");
      response.json({ status: "ok", database: "connected" });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/data-sources", async (_request, response) => {
    response.json({
      ...getConfiguredRealDataProviders(),
      cacheTtlMinutes: Number.parseInt(process.env.PRODUCT_CACHE_TTL_MINUTES ?? "180", 10),
    });
  });

  app.post("/api/catalog/refresh", async (request, response, next) => {
    try {
      const query = readBoundedString(request.body?.q ?? request.body?.query ?? "", "q", 100);
      const category = readBoundedString(request.body?.category ?? "", "category", 60);
      const limit = readInteger(request.body?.limit ?? 12, 12, 1, 25);
      const forceRefresh = Boolean(request.body?.forceRefresh);
      const provider = readBoundedString(request.body?.provider ?? request.query?.provider ?? "auto", "provider", 20).toLowerCase();

      if (limit === null) {
        return response.status(400).json({ error: "Invalid pagination values." });
      }
      if (!VALID_REAL_DATA_PROVIDERS.has(provider)) {
        return response.status(400).json({ error: "Unsupported data provider. Use auto, ebay, serpapi, or openwebninja." });
      }

      const result = await refreshExternalProductCache(pool, { query, category, limit, forceRefresh, provider });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/products", async (request, response, next) => {
    try {
      const query = readBoundedString(request.query.q, "q", 100);
      const category = readBoundedString(request.query.category, "category", 60);
      const sort = readBoundedString(request.query.sort ?? "featured", "sort", 20);
      const limit = readInteger(request.query.limit, 50, 1, 100);
      const offset = readInteger(request.query.offset, 0, 0, 10000);

      if (!SORTS.has(sort)) return response.status(400).json({ error: "Unsupported sort option." });
      if (limit === null || offset === null) return response.status(400).json({ error: "Invalid pagination values." });

      const result = await pool.query(
        `${productSelect}
          WHERE ($1 = '' OR concat_ws(' ', p.name, p.category, best.store) ILIKE '%' || $1 || '%')
            AND ($2 = '' OR lower(p.category) = lower($2))
          ORDER BY
            CASE WHEN $3 = 'price-low' THEN best.price END ASC,
            CASE WHEN $3 = 'price-high' THEN best.price END DESC,
            CASE WHEN $3 = 'discount' THEN
              CASE WHEN best.original_price > best.price
                THEN (best.original_price - best.price)::numeric / best.original_price
                ELSE 0 END
            END DESC,
            p.id ASC
          LIMIT $4 OFFSET $5`,
        [query, category, sort, limit, offset],
      );

      response.json({
        items: result.rows.map((row) => {
          const product = { ...row };
          delete product.total_count;
          return product;
        }),
        total: Number(result.rows[0]?.total_count ?? 0),
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/products/:id", async (request, response, next) => {
    const id = readInteger(request.params.id, null, 1, 2147483647);
    if (id === null) return response.status(400).json({ error: "Product id must be a positive integer." });

    try {
      const result = await pool.query(`${productSelect} WHERE p.id = $1`, [id]);
      if (!result.rowCount) return response.status(404).json({ error: "Product not found." });
      const product = { ...result.rows[0] };
      delete product.total_count;
      response.json(product);
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", (_request, response) => response.status(404).json({ error: "API route not found." }));

  if (process.env.NODE_ENV === "production") {
    const distDirectory = fileURLToPath(new URL("../dist/", import.meta.url));
    const indexFile = fileURLToPath(new URL("../dist/index.html", import.meta.url));
    app.use(express.static(distDirectory, { index: false, maxAge: "1y", immutable: true }));
    app.use((request, response, next) => {
      if (request.method !== "GET" || !request.accepts("html")) return next();
      response.setHeader("Cache-Control", "no-cache");
      response.sendFile(indexFile, (error) => error && next(error));
    });
  }

  app.use((error, _request, response, next) => {
    if (response.headersSent) return next(error);
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error("Request failed:", error.message);
    response.status(status).json({ error: status < 500 ? error.message : "Internal server error." });
  });

  return app;
}
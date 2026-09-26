# Pricewise Product Analyzer

Pricewise is a React product-price interface backed by an Express API and PostgreSQL. It supports catalog search, category filtering, store comparisons, stored price observations, and a browser-local watchlist.

For step-by-step setup, database, Docker, and deployment instructions, see the [development guide](development.md).

## Requirements

- Node.js 22.12 or newer
- npm
- Docker Desktop is optional for the default local workflow

## Local Development

Install dependencies from the lockfile:

```sh
npm ci
```

Run the API and frontend in separate terminals:

```sh
npm run dev:api
npm run dev
```

The development API creates an in-memory PostgreSQL database and seeds the demo catalog automatically. It does not need Docker or an environment file; its demo data resets when the API restarts. Open the Vite URL printed by `npm run dev` (usually `http://localhost:5173`).

To use a local PostgreSQL container instead, copy `.env.example` to `.env`, start the database, and initialize it:

```sh
cp .env.example .env
docker compose up -d db
npm run db:setup
```

Then run `npm run dev:api` and `npm run dev` in separate terminals. Vite proxies `/api` requests to Express on port `3000`.

On PowerShell, use `Copy-Item .env.example .env` in place of `cp`.

## Commands

| Command              | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| `npm run dev`        | Start the Vite frontend                                      |
| `npm run dev:api`    | Start the API with Node watch mode                           |
| `npm run db:migrate` | Apply unapplied SQL migrations                               |
| `npm run db:seed`    | Insert sample catalog rows without overwriting existing rows |
| `npm run db:setup`   | Run migrations and seed the sample catalog                   |
| `npm test`           | Run API HTTP tests using Node's test runner                  |
| `npm run lint`       | Run ESLint                                                   |
| `npm run build`      | Build the production frontend in `dist/`                     |
| `npm start`          | Serve the production frontend and API on `PORT`              |

## API

- `GET /api/health` checks API and database availability.
- `GET /api/products?q=sony&category=Audio&sort=price-low&limit=50&offset=0` lists and filters products.
- `GET /api/products/:id` returns product offers and stored price history.

Search, category, sort, pagination, and product IDs are validated by the API. Database values use parameterized queries. The API is read-only; catalog writes and retailer ingestion are not included.

## Docker

Run the complete production-shaped stack locally:

```sh
docker compose up --build
```

Open `http://localhost:3000`. The app container runs migrations and seeds missing sample rows before starting. PostgreSQL data is kept in the `pricewise_data` named volume. To stop the stack, run `docker compose down`. **Do not run `docker compose down -v` unless you intend to delete that local database volume.** The credentials in `compose.yaml` are for local development only; never reuse or expose them in a public deployment.

## Render Deployment

The included `render.yaml` is a Render Blueprint for a Node web service and managed PostgreSQL database.

1. Push this project to a Git repository and connect it to Render.
2. Create a new Blueprint deployment from the repository and review the service/database plans and current pricing before applying it.
3. Render builds the Vite app, provisions `DATABASE_URL`, applies migrations, seeds any missing demo rows, and starts the Express server.
4. Wait for `/api/health` to report healthy, then open the service URL.

The blueprint uses a paid, persistent database plan; select a plan appropriate for expected traffic and configure database backups/retention in Render. For another host, build with `npm ci && npm run build`, provide a PostgreSQL `DATABASE_URL`, run `npm run db:setup` once as a deployment/release step, and run `npm start`. Set `NODE_ENV=production`; if the service is behind exactly one trusted reverse proxy, set `TRUST_PROXY=1` so rate limiting uses the client address correctly. Keep `DATABASE_URL` in the host's secret environment settings, not in source control.

Migrations are versioned in `server/migrations/` and guarded by a PostgreSQL advisory lock. For multi-instance deployments, run migrations as a single release step rather than concurrently from every instance. The default API rate limiter uses in-memory storage; configure a shared rate-limit store before running multiple app instances.

## Routes

| Route                    | View                                    |
| ------------------------ | --------------------------------------- |
| `/`                      | Overview and featured products          |
| `/search`                | Search, filter, and sort the catalog    |
| `/search?q=iphone`       | Search with a prefilled query           |
| `/search?category=Audio` | Category-filtered results               |
| `/product/:id`           | Product offers and stored price history |
| `/watchlist`             | Products saved in this browser          |

## Data and Production Scope

The initial catalog and seven daily observations per product are demo data seeded from `server/seed-data.js`. They are not current retailer prices. Store links go to retailer homepages; no scraping, retailer APIs, price-alert delivery, admin catalog editor, or user accounts are configured. Watchlists remain in the browser's `localStorage`. Connect an authorized retailer/feed provider and implement authentication before presenting prices as live or storing user-specific data centrally.

The Express app applies Helmet security headers, a restrictive content security policy for the current image/font hosts, JSON request-size limits, API rate limiting, parameterized SQL, and JSON error responses. Product images and Google Fonts require an internet connection.

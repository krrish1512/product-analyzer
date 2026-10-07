# Pricewise Development and Deployment Guide

This guide takes a new checkout from local setup through a production deployment. Pricewise consists of a React/Vite frontend, an Express API, and PostgreSQL. The frontend calls the API on the same origin in production; Vite proxies `/api` to Express during development.

## 1. Requirements

- Node.js 22.12 or newer and npm
- Git
- Docker Desktop with the Linux container engine running only if you choose the Docker/PostgreSQL option
- A Render account for the deployment steps below

Check the installed tools in PowerShell:

```powershell
node --version
npm --version
docker version
```

Docker is optional for the default local workflow. If you choose Docker, `docker version` should show both Client and Server details. If it only shows a pipe/daemon connection error, start Docker Desktop and wait for its engine to become ready.

## 2. Get the Project Ready

Open PowerShell and change to the project directory. For a fresh clone:

```powershell
git clone <your-repository-url>
Set-Location <repository-folder>
```

Install the locked dependencies:

```powershell
npm ci
```

The default development API uses in-memory PostgreSQL and does not need an environment file or a Docker installation. Seeded demo catalog data is recreated whenever the API restarts. Never put a production database URL in frontend code or a `VITE_` variable.

Make sure `package.json` and `package-lock.json` are both committed; deployment uses `npm ci` and requires the lock file.

## 3. Start the Local App and Database

Use two PowerShell terminals, both at the repository root. In Terminal 1, start the API and its embedded PostgreSQL database:

```powershell
npm run dev:api
```

On start, the API creates the local database, applies the schema, and inserts sample products automatically. This database is in memory and resets/reseeds when the API restarts; it is for development only. The browser-local watchlist persists separately in `localStorage`.

In Terminal 2, start the React/Vite frontend:

```powershell
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. The frontend proxies `/api` to the API at `http://localhost:3000`.

Verify the API:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod "http://localhost:3000/api/products?q=sony&category=Audio&sort=price-low"
```

The health response should show `status: ok` and `database: connected`. The product query should return Sony headphone listings. Stop the API and frontend with `Ctrl+C` in their terminals.

### Optional: Use a Docker PostgreSQL database

Use this path if you specifically need to develop against the same PostgreSQL server engine used in deployment. Create `.env` from the local-only template and start the database:

```powershell
Copy-Item .env.example .env
docker compose up -d db
npm run db:setup
```

Then run `npm run dev:api` and `npm run dev` in separate terminals as above. When `DATABASE_URL` is set in `.env`, the development API uses PostgreSQL instead of embedded PostgreSQL. Compose reads `.env` automatically; the template's password is for local use only.

The app supports optional live marketplace providers. Add one or more of the following keys to your local `.env` file to enable them:

```env
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
SERPAPI_API_KEY=
OPENWEBNINJA_API_KEY=
OPENWEBNINJA_BASE_URL=https://api.openwebninja.com
```

The backend chooses only the configured providers, skips unavailable integrations cleanly, and falls back to the demo catalog when no real-data keys are present.

The migration command records applied versions in `schema_migrations`. Seeding is idempotent and preserves existing product and offer rows.

## 5. Make and Verify Changes

Run all checks before pushing:

```powershell
npm test
npm run lint
npm run build
```

The tests include HTTP checks and PostgreSQL-engine integration tests for the schema, migration runner, seed routine, filtering, price aggregation, and stored history. They run without Docker. The default local API uses PGlite, an embedded PostgreSQL engine; production uses the standard PostgreSQL service and `pg` driver.

### Database changes

1. Add a new, numbered SQL file in `server/migrations/`, for example `002_add_something.sql`.
2. Do not edit a migration that has already been applied to a shared or deployed database.
3. Run `npm run db:migrate` locally and verify the affected API behavior.
4. If adding initial catalog rows, update `server/seed-data.js` and the idempotent `server/seed-catalog.js` logic.
5. Back up production data before any destructive schema change. Migrations currently have no automatic down/rollback scripts.

Useful API routes:

| Request                                                  | Purpose                           |
| -------------------------------------------------------- | --------------------------------- |
| `GET /api/health`                                        | API and database readiness        |
| `GET /api/products`                                      | List products                     |
| `GET /api/products?q=sony&category=Audio&sort=price-low` | Search and filter products        |
| `GET /api/products/:id`                                  | Product offers and stored history |

Supported sort values are `featured`, `price-low`, `price-high`, and `discount`. Pagination uses `limit` (1-100) and `offset` query parameters.

## 6. Run the Complete Stack with Docker

To build and run the frontend, API, and database together:

```powershell
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://localhost:3000/api/health
```

Open `http://localhost:3000`. Follow application logs with:

```powershell
docker compose logs -f app
```

Stop the containers without deleting the database volume:

```powershell
docker compose down
```

The `pricewise_data` volume keeps local database contents between runs. **`docker compose down -v` permanently deletes that local database volume.** Only use it when you intentionally want to reset disposable local data; never use it to troubleshoot a production database.

If you change `POSTGRES_PASSWORD` after the database volume has already been initialized, PostgreSQL does not automatically change the stored database user's password. Update the database user's password or, for disposable local data only, recreate the local volume and database.

## 7. Deploy to Render

`render.yaml` defines a Node web service and a managed PostgreSQL database. Review plan availability and current pricing before creating resources; the blueprint uses paid plans for an always-on service and persistent database.

1. Push the project to a Git provider supported by Render. Include `package-lock.json` and the deployment files; do not include `.env`.
2. In Render, choose **New** then **Blueprint**, and connect the repository containing `render.yaml`.
3. Review the proposed web-service and database plans, region, and estimated cost. Apply the Blueprint to create them.
4. Render installs dependencies and runs `npm run build`. At startup it runs `npm run db:setup` and then `npm start`.
5. Open the web service's Events and Logs. Wait for the `/api/health` check to pass.
6. Open the service URL provided by Render. Search for a product and open its detail page to verify the frontend/API/database connection.
7. Configure database backups and retention in Render. Add a custom domain there if needed; keep HTTPS enabled.

The Blueprint supplies `DATABASE_URL` from the managed database and sets `NODE_ENV=production` and `TRUST_PROXY=1`. Keep database credentials in the host's secret environment settings. Do not paste them into `development.md`, the README, client-side variables, or source control.

The default Render start command runs migrations and seed checks before every app start. Keep one application instance with this setup. Before scaling to multiple instances, move migrations to a single release/deploy step and change the service start command to `npm start`. The API's rate limiter is in-memory; configure a shared rate-limit store before running multiple instances. The database migration runner uses an advisory lock, but deployment migrations should still be run once per release.

## 8. Deploy the Docker Image Elsewhere

Build the production image:

```powershell
docker build -t pricewise:latest .
```

In the hosting provider, create or select a PostgreSQL database and provide `DATABASE_URL` as a protected server-side secret. Set `NODE_ENV=production`, `PORT=3000`, and `TRUST_PROXY=1` only when traffic comes through exactly one trusted reverse proxy. Expose the host's assigned port and run the image. The image applies migrations and missing seed rows before starting Express.

For a multi-instance deployment, use the same single-release migration and shared rate-limit-store guidance as the Render section. Ensure the host provides persistent managed PostgreSQL and automated backups; the container filesystem is not a database backup.

## 9. Troubleshooting

| Symptom                                       | Check                                                                                                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker pipe or daemon error                   | Docker is not required for the default local workflow. Start Docker Desktop only if you are using the optional Docker/PostgreSQL or complete-stack path.                     |
| `npm run db:setup` cannot connect             | Ensure the `db` service is healthy, `.env` exists, and `DATABASE_URL` matches `POSTGRES_PASSWORD`; or remove `DATABASE_URL` to use the embedded local database.              |
| API cannot load `express` or another package  | Run `npm ci`. If Windows reports a file-lock/`EPERM` error, stop project Node/Vite processes and rerun `npm ci`.                                                             |
| Frontend says products cannot load            | Confirm `npm run dev:api` is running on port `3000`; Vite proxies `/api` there.                                                                                              |
| Port `3000` or `5432` is occupied             | Stop the process using it, or change the relevant service port and Vite proxy consistently.                                                                                  |
| API health returns an error                   | Inspect API logs, check `DATABASE_URL`, and verify migrations completed.                                                                                                     |
| Render health check fails                     | Review startup logs for database connection/migration errors and confirm the service and database can communicate.                                                           |
| A seed edit does not change an existing price | Seed inserts intentionally preserve existing rows. Update disposable local records explicitly; use a planned migration or authorized data-import workflow for deployed data. |

## 10. Current Product Boundaries

The seeded catalog and seven historical observations per product are illustrative, not live retailer data. Store links go to retailer homepages. There is no retailer scraping/API integration, price-alert delivery, catalog write/admin API, account system, or server-side watchlist. Watchlists use this browser's `localStorage`. Integrate authorized retailer feeds and authentication before presenting prices as live or persisting personal data centrally.

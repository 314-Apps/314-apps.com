# [314-apps.com](http://314-apps.com)

Static marketing site and the **Big Bass Bash weigh-in helper** (`/fish/`) — a Node/Express API that scrapes (or mocks) A Leaderboard widgets, caches snapshots in DynamoDB, and serves the fish helper UI from the same process.

## How often does the live server scrape the leaderboard?

Scraping is **not** on a fixed background timer. It happens when:

1. **Live scraping is enabled** (runtime toggle, Advanced options, or `DEFAULT_LIVE_SCRAPE_ENABLED=true`), and
2. A request needs data **after** the in-memory cache has expired.

The server caches each successful fetch for `**CACHE_TTL_SECONDS`** (default **45** seconds). While the cache is valid, **no new HTTP request is made** to A Leaderboard — the API returns the cached snapshot from DynamoDB.

So the **maximum** scrape rate is about **once per `CACHE_TTL_SECONDS`** per running server instance, assuming traffic keeps hitting the API after the TTL. With the default **45s** TTL, that is roughly **up to ~1.3 scrapes per minute** under steady load. If nobody calls the API, nothing is scraped until the next request.

The **browser** on `/fish/` auto-refreshes the leaderboard every **15 seconds** in live mode (every **2 seconds** in mock mode). Those polls call `/api/leaderboard`; the server only scrapes when the cache is expired, so the effective scrape cadence is still governed by `**CACHE_TTL_SECONDS`**, not the 15s poll interval.

Manual **Refresh** triggers `/api/leaderboard/refresh`, which fetches immediately if live scraping is enabled (subject to the same rules).

**Summary**


| Setting               | Default | Role                                                        |
| --------------------- | ------- | ----------------------------------------------------------- |
| `CACHE_TTL_SECONDS`   | `45`    | Minimum time between live scrapes (per cache cycle)         |
| Fish page poll (live) | `15s`   | How often the UI asks the API for data (may hit cache only) |
| Fish page poll (mock) | `2s`    | Faster polling against synthetic data                       |


Tune `CACHE_TTL_SECONDS` in `.env` if you need fewer scrapes (higher value) or fresher data (lower value).

---

## Prerequisites

- **Node.js** (LTS) and **npm**
- **Docker** (for local DynamoDB — live mode with `npm run fish:dev`)

---

## Database (DynamoDB Local)

Live mode expects a table (see `TABLE_NAME` in `.env`). For local development:

```bash
docker compose up -d
```

This starts DynamoDB Local on **port 8000** (see `docker-compose.yml`).

Create the table once:

```bash
npm run ddb:create-table
```

Configure `DYNAMODB_ENDPOINT`, `TABLE_NAME`, and `AWS_REGION` in `.env` (copy from `.env.example`).

---

## Live server (API + static site + `/fish/`)

The same process serves the homepage, `/fish/`, and `/api/*`.

**Development (watch mode)** — after DB is up and `.env` exists:

```bash
npm run dev
```

**Production-style start** (no watch):

```bash
npm start
```

**One-command bootstrap** — starts Docker, copies `.env` if missing, installs deps, creates the table, smoke-tests, then runs `tsx watch` on port **8787** (override with `FISH_DEV_PORT`):

```bash
npm run fish:dev
# or, e.g.:
# FISH_DEV_PORT=8080 npm run fish:dev
```

This script sets `**DEFAULT_LIVE_SCRAPE_ENABLED=true**` for that process (unless you already set `DEFAULT_LIVE_SCRAPE_ENABLED=false` in `.env`), so the live leaderboard is scraped when the cache expires. Plain `npm run dev` / `npm start` still default to opt-in scraping via `.env` or the `/fish/` Advanced toggles.

### `npm run fish:dev` — common mistakes

1. **Wrong URL / port** — The script binds **`http://127.0.0.1:8787`** by default (not `3000` from `.env`). Open **`http://127.0.0.1:8787/fish/`** (or the port shown in the terminal). Use **`http://127.0.0.1`**, not `https://`, unless you terminate TLS elsewhere.
2. **Opening the HTML file directly** — Don’t use `file:///.../fish/index.html`. The app must load from the **same origin** as the API so `/api/health` works. Always use the URL the server prints.
3. **API base field** — In Advanced options, leave **API base URL** **empty** unless the API really runs on another host/port. A wrong value here breaks health, leaderboard, and recommendations.
4. **Docker** — `fish:dev` starts DynamoDB via Compose. If Docker isn’t running, the script fails before the dev server starts.
5. **Stale browser cache** — After pulling changes, hard-refresh the fish page (or disable cache) so `app.js` and `index.html` update.
6. **Mock vs live** — `fish:dev` runs the **live** stack unless `USE_MOCK_LEADERBOARD=1` is set in `.env`. Mock mode uses `npm run fish:mock` / `dev:mock` instead.

The fish page logs a short line to the **browser console** on load (API base + origin) to help verify you’re on the right URL.

### Cloudflare Tunnel (or any public HTTPS URL)

The UI loads **`../style.css`** and **`app.js`** relative to `/fish/`. Through a tunnel that maps **the whole origin** to your Node port (e.g. `cloudflared tunnel --url http://127.0.0.1:8787`), open **`https://<your-host>/fish/`** and leave **API base** empty so `/api/*` hits the same host.

If styles/scripts still 404 or the page looks unstyled, set in `.env`:

`FISH_PUBLIC_BASE_URL=https://<your-public-host>/fish`

(replace with the exact URL you use in the browser, without a trailing slash or with one — both work). Restart the server so `fish/index.html` is served with a matching `<base href>`. Clear the **API base URL** field (Advanced) if you previously saved `http://localhost:...` — that forces API calls to localhost and breaks the tunnel.

The fish page uses **root-relative** assets (`/style.css`, `/fish/app.js`) so a URL **with or without** a trailing slash (`/fish` vs `/fish/`) still loads the same files. A small **inline script** updates the clock even if the module bundle is blocked; the bundle clears that fallback when it loads.

---

## Mock server (no DynamoDB, no live scrape)

Uses synthetic leaderboards and simulated time. No `TABLE_NAME` required.

**Watch mode:**

```bash
npm run dev:mock
```

**Plain start:**

```bash
npm run start:mock
```

**Script with smoke test** (installs, brief health check, then watch server on port **8787**):

```bash
npm run fish:mock
```

Set `USE_MOCK_LEADERBOARD=1` in `.env` or use the scripts above (they set it for you).

---

## Frontend

There is no separate frontend build step. The fish UI is static HTML/JS/CSS under `fish/` and repo-root `style.css`, served by Express.

Open `**http://localhost:<PORT>/fish/**` where `<PORT>` is your `PORT` or `FISH_DEV_PORT` (e.g. `8787`, `8080`, or `3000`).

---

## Historical training data (offline)

To refresh `server/data/historical-payout-stats.json` from archived A Leaderboard URLs:

```bash
npm run train:historical
```

---

## Scripts reference


| Script                     | Purpose                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev`              | Live API + static, **watch** mode (`tsx watch`)                                                   |
| `npm start`                | Live API + static, **no** watch                                                                   |
| `npm run fish:dev`         | Docker DynamoDB → create table → smoke test → `npm run dev` on `FISH_DEV_PORT` (default **8787**) |
| `npm run dev:mock`         | Mock leaderboard, watch mode                                                                      |
| `npm run start:mock`       | Mock leaderboard, no watch                                                                        |
| `npm run fish:mock`        | Smoke test mock server → `dev:mock` on **8787**                                                   |
| `npm run ddb:create-table` | Create DynamoDB table (local or AWS per `.env`)                                                   |
| `npm run train:historical` | Scrape historical widgets → update payout stats JSON                                              |


---

## Environment

Copy `**.env.example`** to `**.env`** and adjust. Important variables:

- `**PORT`** — HTTP port for the combined server  
- `**TABLE_NAME`**, `**DYNAMODB_ENDPOINT`** — required for live mode (omit endpoint for real AWS)  
- `**ALEADERBOARD_WIDGET_URL**` — widget URL for live scrape  
- `**CACHE_TTL_SECONDS**` — cache / scrape cadence (see above)  
- `**USE_MOCK_LEADERBOARD**` — set to `1` for mock mode  
- `**DEFAULT_LIVE_SCRAPE_ENABLED**` / `**DEFAULT_TRAINING_CAPTURE**` — defaults for live scrape and training JSONL capture

Runtime toggles are persisted in **`server/data/runtime-settings.json`** (gitignored). The server creates this file on startup if it is missing, using the effective defaults (env + any prior file). Use the `/fish/` Advanced section (POST `/api/settings`) to change values; toggling updates the same file.

---

## License / site

See repository files for marketing pages (`index.html`, policies, etc.) and the fish helper under `fish/`.
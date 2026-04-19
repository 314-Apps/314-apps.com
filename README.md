# [314-apps.comp](http://314-apps.com)

Static marketing site and the **Big Bass Bash weigh-in helper** (`/fish/`) — a Node/Express API that scrapes (or mocks) A Leaderboard widgets, caches snapshots in DynamoDB, and serves the fish helper UI from the same process.

## How often does the live server scrape the leaderboard?

With **live scraping** enabled, a new fetch from A Leaderboard runs when the **cached snapshot has expired** (or when something calls `/api/leaderboard/refresh`).

The server caches each successful fetch for `**CACHE_TTL_SECONDS`** (default **300** seconds = 5 minutes). While the cache is valid, **no new HTTP request is made** to A Leaderboard — the API returns the cached snapshot from DynamoDB.

Additionally, the server runs a **background timer** (same interval as `CACHE_TTL_SECONDS` by default; see `AUTO_SCRAPE_INTERVAL_MS` / `AUTO_SCRAPE_ENABLED` in `.env.example`) so a scrape can occur **without** a browser open, as long as live scraping is on.

The **browser** on `/fish/` auto-refreshes the leaderboard every **5 minutes** in live mode (every **2 seconds** in mock mode). Those polls call `/api/leaderboard`; the server only scrapes when the cache is expired, so the effective scrape cadence is still governed by `**CACHE_TTL_SECONDS`**, not the UI poll interval alone.

Manual **Refresh** triggers `/api/leaderboard/refresh`, which fetches immediately if live scraping is enabled (subject to the same rules).

**Summary**


| Setting               | Default | Role                                                          |
| --------------------- | ------- | ------------------------------------------------------------- |
| `CACHE_TTL_SECONDS`   | `300`   | Cache lifetime + default background scrape interval (seconds) |
| Fish page poll (live) | `5 min` | How often the UI asks the API for data (may hit cache only)   |
| Fish page poll (mock) | `2s`    | Faster polling against synthetic data                         |


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

1. **Wrong URL / port** — The script binds `**http://127.0.0.1:8787`** by default (not `3000` from `.env`). Open `**http://127.0.0.1:8787/fish/`** (or the port shown in the terminal). Use `**http://127.0.0.1`**, not `https://`, unless you terminate TLS elsewhere.
2. **Opening the HTML file directly** — Don’t use `file:///.../fish/index.html`. The app must load from the **same origin** as the API so `/api/health` works. Always use the URL the server prints.
3. **API base field** — In Advanced options, leave **API base URL** **empty** unless the API really runs on another host/port. A wrong value here breaks health, leaderboard, and recommendations.
4. **Docker** — `fish:dev` starts DynamoDB via Compose. If Docker isn’t running, the script fails before the dev server starts.
5. **Stale browser cache** — After pulling changes, hard-refresh the fish page (or disable cache) so `app.js` and `index.html` update.
6. **Mock vs live** — `fish:dev` runs the **live** stack unless `USE_MOCK_LEADERBOARD=1` is set in `.env`. Mock mode uses `npm run fish:mock` / `dev:mock` instead.

The fish page logs a short line to the **browser console** on load (API base + origin) to help verify you’re on the right URL.

### Cloudflare Tunnel (or any public HTTPS URL)

The UI loads `**../style.css`** and `**app.js`** relative to `/fish/`. Through a tunnel that maps **the whole origin** to your Node port (e.g. `cloudflared tunnel --url http://127.0.0.1:8787`), open `**https://<your-host>/fish/`** and leave **API base** empty so `/api/`* hits the same host.

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

## Live training logs & recommendation analysis

While the API is running, you can capture **live leaderboard JSONL** (`server/data/live-training/`) and **recommendation-query JSONL** (`server/data/recommendation-queries/`) via the `/fish/` Advanced toggles (see `.env.example` for defaults).

### Prediction sweep (automated weight grid)

Run in a **second terminal** while the server is up. It repeatedly `POST`s `/api/recommendation` for a range of fish weights (default **2–6 lb**, step **0.25**, every **60s**). Successful calls are logged like manual “Get recommendation” requests when training capture is enabled.

Default API URL is `**http://127.0.0.1:8787`** (same as `npm run fish:dev`). If your server uses another port, set `PREDICTION_SWEEP_API_BASE` or `PREDICTION_SWEEP_PORT` (see `.env.example`).

```bash
npm run sweep:predictions
# examples:
# PREDICTION_SWEEP_PORT=3000 npm run sweep:predictions
# PREDICTION_SWEEP_API_BASE=http://127.0.0.1:8787 npm run sweep:predictions
```

### Compare predictions to final boards

Compares **recommendation-queries** (predicted rank / weight) to **live-training** snapshots for each **complete** pay period (board has at least `PAYOUT_PLACES_HEURISTIC` fish, default 46). Requires JSONL for the same calendar day in both folders.

```bash
npm run compare:reco-to-final -- --date=2026-04-18
# optional: --places=46  --period=Saturday-W1
```

**Ground truth and rank.** Offline scripts (`compare:reco-to-final`, `evaluate:predictions`, `fit:cutoff-constants`) need a **complete** pay period: at least `PAYOUT_PLACES_HEURISTIC` fish (default 46) so the cutoff weight is defined. For each period, the evaluator builds a sorted list of fish weights:

- **Merged (preferred):** all snapshots in that day’s `live-training` JSONL are scanned; each **fish** is keyed by angler identity + weight (same idea as `fishEntryKey` in training capture), so **one angler can have multiple fish**. If the same fish row appears again in a later snapshot, the **newer** scrape wins for that key. That multiset is the reconstruction used for cutoff and rank.
- **Single snapshot (fallback):** if any row with a valid weight lacks angler identity, that period falls back to one **richest** scrape (most rows), tie-break by latest `fetchedAtMs` — the historical behavior.

**Rank** is computed as one plus the count of listed weights **strictly greater** than the query weight (`rankForWeight` in `server/scripts/evalShared.ts`). That ordinal is the fish’s true place **relative to that multiset**. It can differ from published standings if the capture is incomplete or if many fish tie at a weight (official tie rules may differ). **Cutoff** uses the same sorted list (Nth-largest weight).

```bash
npm run evaluate:predictions -- --date=2026-04-18
# Re-run pay-band metrics with the **current** pay model (σ mult, etc.), not frozen JSONL percents:
# npm run evaluate:predictions -- --date=2026-04-18 --recompute
```

Pay-band output includes **Mean pred** (average modeled probability in each 10% band) and two **ECE** summaries: vs band midpoint (coarse) and vs mean predicted (better when queries pile up in a few bands).

### Shadow algorithms (beta) & per-elapsed calibration

Each `POST /api/recommendation` runs several **pay-chance models** in parallel. The **primary** model (`normalBlend`, same as before) still drives the summary text and weigh-in advice. Others are for comparison:

- **`normalBlendElapsedWide`** — same projected μ/σ as primary, but widens σ for the pay CDF early in the window (`PAYOUT_EARLY_SIGMA_WIDEN_K`, default **0.6**) and applies **per elapsed-bucket** calibration knots when `server/data/payout-calibration.json` is **v2** (see below).
- **`historicalEmpirical`** — fraction of past-year final cutoffs this weight beats.
- **`liveEmpirical`** — maps blended expected final rank to a pay chance (`≈ 1 − E[rank]/places`).

The `/fish/` result includes a **Shadow algorithms (beta)** table. When training capture is on, `recommendation-queries` JSONL is **schema v4** and logs `algorithmPredictions[]` plus `projectedRankExpected` for offline evaluation.

**Calibration file v2.** `payout-calibration.json` may use:

```json
{ "version": 2, "default": { "knots": [[0,0],[100,100]] }, "byElapsedBucket": { "0-25": { "knots": [] }, ... } }
```

v1 files with top-level `knots` still load. Regenerate v2 (pooled default + per 0–25% / 25–50% / 50–75% / 75–100% window fraction) with:

```bash
npm run fit:payout-calibration -- --date=2026-04-18
# optional: --min-samples=50  --min-per-bucket=8  --out=server/data/payout-calibration.json
```

### Data collection (arrivals + weather + water temp)

Three foundation datasets feed the next iteration of the pay-chance model. **Nothing consumes them yet** — they are collection-only.

- **Fish arrivals** — `server/data/fish-arrivals/{date}.jsonl`. Derived from existing `live-training/*.jsonl` snapshots with no new scraping. Each row records when a unique `fishEntryKey` first appeared, the previous snapshot's `fetchedAtMs` (an upper bound is the current snap, a lower bound is the previous — so arrivals are bracketed), and `fractionElapsedAtFirstSeen` within that payout window. A cull (same angler, different weight) emits two arrivals.
- **Per-station weather** — `server/data/weather/{date}.json`. Once-per-hour pull from Open-Meteo (forecast for near-realtime, archive for historical) for every weigh station in `server/data/weigh-station-locations.json`. One file per date with a `stations[<canonical-key>].hourly[]` map; join to arrivals via the same canonical `weighStation` key. Units: °F, mph, hPa, mm, %.
- **Lake surface water temperature** — `server/data/water-temp/{date}.json`. Once-per-day scrape of Ameren's Lake Level Reports page (single lake-wide value, measured near Bagnell Dam). Historical backfill walks the Wayback Machine's availability API.

```bash
# Rebuild arrivals from JSONL (idempotent per date):
npm run extract:arrivals -- --all
npm run extract:arrivals -- --date=2026-04-18

# Backfill historical tournament weekends (edit server/data/historical-tournament-dates.json first):
npm run backfill:weather                # every year × Saturday + Sunday
npm run backfill:weather -- --year=2024 # one year only
npm run backfill:water-temp             # Wayback-archived Ameren snapshots (±3d drift tolerance)
npm run backfill:water-temp -- --max-drift-days=5
```

Relevant env vars (see `.env.example`): `WEATHER_COLLECT_ENABLED`, `WEATHER_HOURLY_INTERVAL_MS`, `WATER_TEMP_COLLECT_ENABLED`. Live collection runs in-process alongside the leaderboard auto-scraper when the server starts (skipped in mock mode). Wayback's Ameren snapshot density is thin prior to late 2025; older years may write `surfaceTempF: null` with an `unavailableReason` when no snapshot is within drift.

---

## Scripts reference


| Script                          | Purpose                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev`                   | Live API + static, **watch** mode (`tsx watch`)                                                   |
| `npm start`                     | Live API + static, **no** watch                                                                   |
| `npm run fish:dev`              | Docker DynamoDB → create table → smoke test → `npm run dev` on `FISH_DEV_PORT` (default **8787**) |
| `npm run dev:mock`              | Mock leaderboard, watch mode                                                                      |
| `npm run start:mock`            | Mock leaderboard, no watch                                                                        |
| `npm run fish:mock`             | Smoke test mock server → `dev:mock` on **8787**                                                   |
| `npm run ddb:create-table`      | Create DynamoDB table (local or AWS per `.env`)                                                   |
| `npm run train:historical`      | Scrape historical widgets → update payout stats JSON                                              |
| `npm run sweep:predictions`     | Loop: grid-call `/api/recommendation` on an interval (second terminal; see section above)         |
| `npm run compare:reco-to-final` | Offline: compare reco JSONL to live-training JSONL for a given `--date`                           |
| `npm run evaluate:predictions`  | Offline: per-algorithm pay calibration + cutoff MAE, elapsed-bucket ECE winner table, rank MAE      |
| `npm run fit:payout-calibration` | Fit v2 `payout-calibration.json` (default + by elapsed bucket) from recommendation-queries + ground truth |
| `npm run fit:cutoff-constants`  | Grid-search bubble blend vs true cutoffs from live-training (merged when possible)                |
| `npm run extract:arrivals`      | Derive `server/data/fish-arrivals/{date}.jsonl` (first-seen per fish) from live-training snapshots  |
| `npm run backfill:weather`      | Fetch Open-Meteo archive hourly observations for every weigh station × historical tournament date  |
| `npm run backfill:water-temp`   | Recover historical Ameren surface water temp via Wayback Machine                                  |


---

## Environment

Copy `**.env.example`** to `**.env`** and adjust. Important variables:

- `**PORT`** — HTTP port for the combined server  
- `**TABLE_NAME`**, `**DYNAMODB_ENDPOINT`** — required for live mode (omit endpoint for real AWS)  
- `**ALEADERBOARD_WIDGET_URL**` — widget URL for live scrape  
- `**CACHE_TTL_SECONDS**` — cache / scrape cadence (see above); optional `AUTO_SCRAPE_*` for background scrapes  
- `**PREDICTION_SWEEP_***` — sweep client URL/port/interval when using `npm run sweep:predictions`  
- `**USE_MOCK_LEADERBOARD**` — set to `1` for mock mode  
- `**DEFAULT_LIVE_SCRAPE_ENABLED**` / `**DEFAULT_TRAINING_CAPTURE**` — defaults for live scrape and training JSONL capture  
- `**PAYOUT_LIKELIHOOD_SIGMA_MULT**` — optional multiplier (default **1.28**) on σ **only** for pay‑chance Φ(z); widens tail probabilities toward 50% so modeled % better matches offline ECE. Tune after `npm run evaluate:predictions`.
- `**PAYOUT_EARLY_SIGMA_WIDEN_K**` — optional (default **0.6**). Extra early-window σ scaling for the shadow algorithm `normalBlendElapsedWide` only (`σ_pay *= 1 + K(1−f)²` where `f` is fraction of window elapsed).
- `**WEATHER_COLLECT_ENABLED**` / `**WEATHER_HOURLY_INTERVAL_MS**` — optional (defaults **true** / **3600000**). In-process hourly Open-Meteo pull for every weigh station in `server/data/weigh-station-locations.json`.
- `**WATER_TEMP_COLLECT_ENABLED**` — optional (default **true**). Once-per-day Ameren surface water temp scrape.

Runtime toggles are persisted in `**server/data/runtime-settings.json`** (gitignored). The server creates this file on startup if it is missing, using the effective defaults (env + any prior file). Use the `/fish/` Advanced section (POST `/api/settings`) to change values; toggling updates the same file.

---

## License / site

See repository files for marketing pages (`index.html`, policies, etc.) and the fish helper under `fish/`.
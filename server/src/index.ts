import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import type { Request } from "express";
import {
  createDdbClient,
  ensureTableExists,
  getSnapshot,
  putSnapshot,
} from "./lib/dynamo.js";
import { buildMockLeaderboard, isMockLeaderboardEnabled } from "./lib/mockLeaderboard.js";
import { getMockSimulatedDate, getSimulationMeta } from "./lib/mockTime.js";
import { fetchAndParseLeaderboard, resolveWidgetUrl } from "./lib/scrape.js";
import {
  ensureRuntimeSettingsFile,
  getRuntimeSettings,
  saveRuntimeSettings,
} from "./lib/runtimeSettings.js";
import { maybeAppendTrainingSnapshot, trainingDataDirectory } from "./lib/trainingCapture.js";
import { searchAnglers } from "./lib/anglerSearch.js";
import {
  appendRecommendationQueryLog,
  recommendationQueriesDirectory,
} from "./lib/recommendationQueryLog.js";
import type { SnapshotPayload } from "./lib/types.js";
import { getActiveWindow, tournamentDayKind } from "./lib/payoutWindows.js";
import {
  computePayoutConsiderFloor,
  recommendWeighIn,
  type RecommendationInput,
} from "./lib/recommendation.js";
import {
  buildTrainingDayLeaderboards,
  loadJsonl,
  type PeriodKey,
  type TrainingSnap,
} from "../scripts/evalShared.js";
import {
  attachLocationsToStations,
  computeWeighStationStats,
  loadWeighStationLocations,
} from "./lib/weighStationStats.js";
import { startWeatherCollector } from "./lib/weatherCollector.js";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const CACHE_TTL_SECONDS = Number.parseInt(process.env.CACHE_TTL_SECONDS || "300", 10);
const MOCK_CACHE_MS = Number.parseInt(process.env.MOCK_CACHE_MS || "1500", 10);

/** Background scrape interval (defaults to same ms as CACHE_TTL_SECONDS). Set AUTO_SCRAPE_ENABLED=false to disable. */
const AUTO_SCRAPE_ENABLED = process.env.AUTO_SCRAPE_ENABLED?.trim().toLowerCase() !== "false";
const AUTO_SCRAPE_INTERVAL_MS = (() => {
  const ttlSec = Number.isFinite(CACHE_TTL_SECONDS) && CACHE_TTL_SECONDS > 0 ? CACHE_TTL_SECONDS : 300;
  const def = ttlSec * 1000;
  const raw = Number.parseInt(process.env.AUTO_SCRAPE_INTERVAL_MS || String(def), 10);
  if (!Number.isFinite(raw)) return def;
  return Math.max(10_000, raw);
})();

const mockMode = isMockLeaderboardEnabled();
const tableNameEnv = process.env.TABLE_NAME?.trim();
if (!mockMode && !tableNameEnv) {
  console.error("Missing TABLE_NAME (omit only when USE_MOCK_LEADERBOARD=1)");
  process.exit(1);
}
const TABLE_NAME: string = tableNameEnv ?? "bbb_fish_leaderboard_mock_unused";

const doc = createDdbClient();

let mockSnapshotCache: SnapshotPayload | null = null;

/** Deduplicate concurrent live fetches (HTTP + scheduled tick). */
let liveFetchInFlight: Promise<SnapshotPayload> | null = null;

async function maybeEnsureTable(): Promise<void> {
  if (!mockMode) {
    await ensureTableExists(TABLE_NAME);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirnamePath = path.dirname(__filename);
const repoRoot = path.resolve(__dirnamePath, "..", "..");

async function refreshMockSnapshot(): Promise<SnapshotPayload> {
  const now = Date.now();
  const sim = getMockSimulatedDate();
  const leaderboard = buildMockLeaderboard(sim);
  const mockTtl = Number.isFinite(MOCK_CACHE_MS) && MOCK_CACHE_MS > 0 ? MOCK_CACHE_MS : 1500;
  const payload: SnapshotPayload = {
    leaderboard,
    fetchedAt: now,
    expiresAt: now + mockTtl,
  };
  mockSnapshotCache = payload;
  return payload;
}

async function executeFetchLiveSnapshotAndCache(): Promise<SnapshotPayload> {
  const settings = getRuntimeSettings();
  if (!settings.liveScrapeEnabled) {
    throw new Error("Live scraping is disabled. Turn it on under Advanced options or set runtime settings.");
  }

  const now = Date.now();
  const ttlMs = (Number.isFinite(CACHE_TTL_SECONDS) ? CACHE_TTL_SECONDS : 300) * 1000;
  const widgetUrl = await resolveWidgetUrl(
    process.env.ALEADERBOARD_WIDGET_URL,
    process.env.MIDWEST_LIVE_PAGE_URL,
  );
  const leaderboard = await fetchAndParseLeaderboard(widgetUrl);
  const payload: SnapshotPayload = {
    leaderboard,
    fetchedAt: now,
    expiresAt: now + ttlMs,
  };
  await putSnapshot(doc, TABLE_NAME, payload);

  if (settings.trainingCaptureEnabled) {
    const realNow = new Date();
    const td = tournamentDayKind(realNow);
    const active = getActiveWindow(realNow);
    maybeAppendTrainingSnapshot(leaderboard, {
      fetchedAtMs: now,
      tournamentDay: td,
      activeWindow: active && active.day
        ? {
            day: active.day,
            windowId: active.window.id,
            label: active.window.label,
          }
        : null,
    });
  }

  return payload;
}

async function fetchLiveSnapshotAndCache(): Promise<SnapshotPayload> {
  if (liveFetchInFlight) return liveFetchInFlight;
  liveFetchInFlight = executeFetchLiveSnapshotAndCache();
  try {
    return await liveFetchInFlight;
  } finally {
    liveFetchInFlight = null;
  }
}

/** Mock refresh, or live fetch when scraping is enabled. */
async function refreshSnapshot(): Promise<SnapshotPayload> {
  if (mockMode) {
    return refreshMockSnapshot();
  }
  return fetchLiveSnapshotAndCache();
}

async function getFreshSnapshot(): Promise<{ payload: SnapshotPayload; stale: boolean }> {
  if (mockMode) {
    const existing = mockSnapshotCache;
    if (existing && existing.expiresAt > Date.now()) {
      return { payload: existing, stale: false };
    }
    const payload = await refreshMockSnapshot();
    return { payload, stale: false };
  }

  const settings = getRuntimeSettings();
  const existing = await getSnapshot(doc, TABLE_NAME);

  if (settings.liveScrapeEnabled) {
    if (existing && existing.expiresAt > Date.now()) {
      return { payload: existing, stale: false };
    }
    const payload = await fetchLiveSnapshotAndCache();
    return { payload, stale: false };
  }

  // Live scrape off: serve last cached snapshot even if TTL expired.
  if (existing) {
    const stale = existing.expiresAt <= Date.now();
    return { payload: existing, stale };
  }

  throw new Error(
    "No leaderboard cached yet. Enable live scraping once to fetch data, or check DynamoDB / TABLE_NAME.",
  );
}

function payoutConsiderFloorForRequest(
  req: Request,
  leaderboard: SnapshotPayload["leaderboard"],
  snapshotStale?: boolean,
) {
  const q = req.query;
  const shirtPurchased =
    q.shirtPurchased === "true" || q.shirtPurchased === "1" || q.shirt === "1";
  let manualMinutesLeft: number | undefined;
  if (q.manualMinutesLeft != null && String(q.manualMinutesLeft).trim() !== "") {
    const n = Number(q.manualMinutesLeft);
    if (Number.isFinite(n)) manualMinutesLeft = n;
  }
  const now = mockMode ? getMockSimulatedDate() : new Date();
  return computePayoutConsiderFloor(leaderboard, {
    shirtPurchased,
    manualMinutesLeft,
    now,
    snapshotStale: snapshotStale === true,
  });
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  const payoutPlaces = Number.parseInt(process.env.PAYOUT_PLACES_HEURISTIC || "45", 10);
  const rs = getRuntimeSettings();
  const body: Record<string, unknown> = {
    ok: true,
    time: new Date().toISOString(),
    mockLeaderboard: mockMode,
    payoutPlacesHeuristic: Number.isFinite(payoutPlaces) && payoutPlaces > 0 ? payoutPlaces : 45,
    liveScrapeEnabled: mockMode ? false : rs.liveScrapeEnabled,
    trainingCaptureEnabled: mockMode ? false : rs.trainingCaptureEnabled,
    trainingDataPath: mockMode ? null : trainingDataDirectory(),
    recommendationQueriesPath: mockMode ? null : recommendationQueriesDirectory(),
  };
  if (mockMode) {
    body.simulation = getSimulationMeta();
  }
  res.json(body);
});

app.get("/api/settings", (_req, res) => {
  const rs = getRuntimeSettings();
  res.json({
    mockLeaderboard: mockMode,
    liveScrapeEnabled: mockMode ? false : rs.liveScrapeEnabled,
    trainingCaptureEnabled: mockMode ? false : rs.trainingCaptureEnabled,
    trainingDataPath: mockMode ? null : trainingDataDirectory(),
    recommendationQueriesPath: mockMode ? null : recommendationQueriesDirectory(),
    defaults: {
      liveScrapeEnabled:
        process.env.DEFAULT_LIVE_SCRAPE_ENABLED?.trim().toLowerCase() === "true",
      trainingCaptureEnabled:
        process.env.DEFAULT_TRAINING_CAPTURE?.trim().toLowerCase() === "true",
    },
  });
});

app.post("/api/settings", (req, res) => {
  if (mockMode) {
    res.status(400).json({
      error: "Settings apply only when not in mock mode (unset USE_MOCK_LEADERBOARD).",
    });
    return;
  }
  const body = req.body ?? {};
  const next = saveRuntimeSettings({
    liveScrapeEnabled:
      typeof body.liveScrapeEnabled === "boolean" ? body.liveScrapeEnabled : undefined,
    trainingCaptureEnabled:
      typeof body.trainingCaptureEnabled === "boolean" ? body.trainingCaptureEnabled : undefined,
  });
  res.json({
    liveScrapeEnabled: next.liveScrapeEnabled,
    trainingCaptureEnabled: next.trainingCaptureEnabled,
    trainingDataPath: trainingDataDirectory(),
    recommendationQueriesPath: recommendationQueriesDirectory(),
  });
});

/**
 * Reconstructed leaderboards from `server/data/live-training/{date}.jsonl` (merged by angler + fish weight when possible).
 * Query: `?date=YYYY-MM-DD`
 */
app.get("/api/training-leaderboards", (req, res) => {
  const date = String(req.query.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Query parameter date=YYYY-MM-DD is required." });
    return;
  }
  const dir = trainingDataDirectory();
  const file = path.join(dir, `${date}.jsonl`);
  if (!existsSync(file)) {
    res.status(404).json({
      error: `No live-training file for ${date}.`,
      path: file,
      hint:
        "Enable training capture during scrapes, or place a capture JSONL under server/data/live-training/.",
    });
    return;
  }
  const placesPaid = Number.parseInt(process.env.PAYOUT_PLACES_HEURISTIC || "46", 10);
  const places = Number.isFinite(placesPaid) && placesPaid > 0 ? placesPaid : 46;
  const snaps = loadJsonl(file) as TrainingSnap[];
  const periods = buildTrainingDayLeaderboards(snaps, places);
  res.json({
    date,
    placesPaidHeuristic: places,
    trainingFile: file,
    periods,
  });
});

/**
 * Aggregates merged leaderboard rows by weigh-in station (live-training JSONL).
 * Query: `date=YYYY-MM-DD`, optional `minLb`, `maxLb`, `period=Saturday-W2`.
 */
app.get("/api/weigh-station-stats", (req, res) => {
  const date = String(req.query.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Query parameter date=YYYY-MM-DD is required." });
    return;
  }
  const minQ = req.query.minLb;
  const maxQ = req.query.maxLb;
  const minLb =
    minQ != null && String(minQ).trim() !== "" ? Number(minQ) : 0;
  const maxLb =
    maxQ != null && String(maxQ).trim() !== "" ? Number(maxQ) : 10;
  const periodRaw = String(req.query.period ?? "").trim();
  let periodFilter: PeriodKey | null = null;
  if (periodRaw) {
    if (!/^(Saturday|Sunday)-W[1-4]$/.test(periodRaw)) {
      res.status(400).json({
        error: "Optional period must match Saturday-W1 … Sunday-W4 (e.g. Saturday-W2).",
      });
      return;
    }
    periodFilter = periodRaw as PeriodKey;
  }
  const placesPaid = Number.parseInt(process.env.PAYOUT_PLACES_HEURISTIC || "46", 10);
  const places = Number.isFinite(placesPaid) && placesPaid > 0 ? placesPaid : 46;

  const file = path.join(trainingDataDirectory(), `${date}.jsonl`);
  if (!existsSync(file)) {
    res.status(404).json({
      error: `No live-training file for ${date}.`,
      path: file,
      hint:
        "Enable training capture during scrapes, or place JSONL under server/data/live-training/.",
    });
    return;
  }

  const snaps = loadJsonl(file) as TrainingSnap[];
  const stats = computeWeighStationStats(snaps, {
    minLb: Number.isFinite(minLb) ? minLb : 0,
    maxLb: Number.isFinite(maxLb) ? maxLb : 10,
    placesPaidHeuristic: places,
    periodFilter,
  });
  const loc = loadWeighStationLocations();
  const stationsWithGeo = attachLocationsToStations(stats.stations, loc);
  const metric = String(req.query.metric ?? "count") === "totalLb" ? "totalLb" : "count";

  res.json({
    date,
    metric,
    trainingFile: file,
    locationsLoaded: Object.keys(loc).length,
    ...stats,
    stations: stationsWithGeo,
  });
});

/**
 * Case-insensitive substring search for anglers across all captured training snapshots.
 * Query: `?q=<text>&limit=<n>` (limit default 25). Returns each matching angler with every unique
 * fish they have weighed in (earliest snapshot wins) plus the payout window label and first-seen time.
 */
app.get("/api/anglers/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length === 0) {
    res.status(400).json({ error: "Query parameter q is required." });
    return;
  }
  const limitRaw = req.query.limit;
  let limit: number | undefined;
  if (limitRaw != null && String(limitRaw).trim() !== "") {
    const n = Number(limitRaw);
    if (!Number.isFinite(n) || n <= 0) {
      res.status(400).json({ error: "Optional limit must be a positive number." });
      return;
    }
    limit = Math.floor(n);
  }
  const results = searchAnglers({ q, limit });
  res.json({ query: q, count: results.length, results });
});

app.get("/api/payout-status", (_req, res) => {
  const now = mockMode ? getMockSimulatedDate() : new Date();
  const active = getActiveWindow(now);
  res.json({
    tournamentDay: tournamentDayKind(now),
    activeWindow: active
      ? {
          window: active.window,
          periodEnd: active.periodEnd.toISO(),
          minutesLeftInPeriod: active.minutesLeftInPeriod,
          day: active.day,
        }
      : null,
    timezone: "America/Chicago",
  });
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    await maybeEnsureTable();
    const { payload, stale } = await getFreshSnapshot();
    res.json({
      fetchedAt: new Date(payload.fetchedAt).toISOString(),
      expiresAt: new Date(payload.expiresAt).toISOString(),
      stale,
      sourceUrl: payload.leaderboard.sourceUrl,
      leaderboard: payload.leaderboard,
      payoutConsiderFloor: payoutConsiderFloorForRequest(req, payload.leaderboard, stale),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg });
  }
});

app.post("/api/leaderboard/refresh", async (req, res) => {
  try {
    await maybeEnsureTable();
    if (!mockMode && !getRuntimeSettings().liveScrapeEnabled) {
      res.status(400).json({
        error:
          "Live scraping is disabled. Enable it in /api/settings or Advanced options before refreshing.",
      });
      return;
    }
    const snap = await refreshSnapshot();
    res.json({
      fetchedAt: new Date(snap.fetchedAt).toISOString(),
      expiresAt: new Date(snap.expiresAt).toISOString(),
      stale: false,
      sourceUrl: snap.leaderboard.sourceUrl,
      leaderboard: snap.leaderboard,
      payoutConsiderFloor: payoutConsiderFloorForRequest(req, snap.leaderboard),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg });
  }
});

app.post("/api/recommendation", async (req, res) => {
  try {
    await maybeEnsureTable();
    const { payload: snap, stale: snapshotStale } = await getFreshSnapshot();
    const body = req.body ?? {};
    const fishWeightLb = Number(body.fishWeightLb);
    const travelMinutes = Number(body.travelMinutes ?? 0);
    const livewellCount = Number(body.livewellCount ?? 1) === 2 ? 2 : 1;
    const secondFishWeightLb =
      body.secondFishWeightLb != null ? Number(body.secondFishWeightLb) : undefined;
    const manualMinutesLeft =
      body.manualMinutesLeft != null ? Number(body.manualMinutesLeft) : undefined;
    const shirtPurchased = body.shirtPurchased === true || body.shirtPurchased === "true";

    if (!Number.isFinite(fishWeightLb)) {
      res.status(400).json({ error: "fishWeightLb is required and must be a number." });
      return;
    }

    const recoInput: RecommendationInput = {
      fishWeightLb,
      travelMinutes: Number.isFinite(travelMinutes) ? travelMinutes : 0,
      livewellCount: livewellCount === 2 ? 2 : 1,
      secondFishWeightLb:
        secondFishWeightLb != null && Number.isFinite(secondFishWeightLb)
          ? secondFishWeightLb
          : undefined,
      manualMinutesLeft:
        manualMinutesLeft != null && Number.isFinite(manualMinutesLeft)
          ? manualMinutesLeft
          : undefined,
      shirtPurchased,
      snapshotStale,
      now: body.now
        ? new Date(String(body.now))
        : mockMode
          ? getMockSimulatedDate()
          : new Date(),
    };

    const result = recommendWeighIn(snap.leaderboard, recoInput);

    if (getRuntimeSettings().trainingCaptureEnabled) {
      appendRecommendationQueryLog(
        recoInput,
        result,
        {
          leaderboardFetchedAt: new Date(snap.fetchedAt).toISOString(),
          snapshotStale,
          sourceUrl: snap.leaderboard.sourceUrl,
        },
        mockMode,
      );
    }

    res.json({
      recommendation: result,
      leaderboardFetchedAt: new Date(snap.fetchedAt).toISOString(),
      snapshotStale,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg });
  }
});

const FISH_PUBLIC_BASE_URL = process.env.FISH_PUBLIC_BASE_URL?.trim();

/**
 * When the app is reached through a reverse proxy / tunnel, relative assets (`style.css`, `app.js`)
 * resolve against `<base href>` when set. CSS is also served at `/fish/style.css` for tunnel paths.
 * Set FISH_PUBLIC_BASE_URL to the **public** URL of the `/fish/` folder, e.g.
 * `https://abc123.trycloudflare.com/fish` (no trailing slash required).
 */
app.get(["/fish", "/fish/", "/fish/index.html"], (req, res, next) => {
  if (!FISH_PUBLIC_BASE_URL) {
    return next();
  }
  try {
    const htmlPath = path.join(repoRoot, "fish", "index.html");
    let html = readFileSync(htmlPath, "utf8");
    if (!/<base\s[\s\S]*?>/i.test(html)) {
      const baseHref = FISH_PUBLIC_BASE_URL.endsWith("/")
        ? FISH_PUBLIC_BASE_URL
        : `${FISH_PUBLIC_BASE_URL}/`;
      html = html.replace("<head>", `<head>\n    <base href="${baseHref.replace(/"/g, "&quot;")}">`);
    }
    res.type("html").send(html);
  } catch {
    next();
  }
});

/**
 * Fish HTML uses `href="style.css"` so CSS loads from `/fish/style.css`. Tunnels (Cloudflare,
 * Twin Gate, etc.) often only expose `/fish/*`; a root `/style.css` request never reaches the app
 * and the page loads unstyled — including the weigh-in floor scale.
 */
app.get("/fish/style.css", (_req, res, next) => {
  res.type("text/css");
  res.sendFile(path.join(repoRoot, "style.css"), (err) => {
    if (err) next(err);
  });
});

// Serve /fish/* from ./fish (HTML, app.js) without conflicting with repo-root static below.
app.use(
  "/fish",
  express.static(path.join(repoRoot, "fish"), {
    index: "index.html",
    fallthrough: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache, private");
      }
    },
  }),
);

app.use(
  express.static(repoRoot, {
    extensions: ["html"],
    index: ["index.html"],
  }),
);

if (!mockMode) {
  await ensureTableExists(TABLE_NAME);
}

ensureRuntimeSettingsFile();

function startAutoScrapeScheduler(): void {
  if (mockMode || !AUTO_SCRAPE_ENABLED) return;

  const tick = () => {
    void (async () => {
      try {
        await maybeEnsureTable();
        if (!getRuntimeSettings().liveScrapeEnabled) return;
        await fetchLiveSnapshotAndCache();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[leaderboard] auto-scrape: ${msg}`);
      }
    })();
  };

  setInterval(tick, AUTO_SCRAPE_INTERVAL_MS);
  setTimeout(tick, 5000);
}

app.listen(PORT, () => {
  const mode = mockMode ? "MOCK leaderboard (no DynamoDB / no live scrape)" : "live leaderboard";
  console.log(`Fish helper: API + static site at http://localhost:${PORT}/ (try /fish/) — ${mode}`);
  if (!mockMode && AUTO_SCRAPE_ENABLED) {
    startAutoScrapeScheduler();
    console.log(
      `[leaderboard] auto-scrape every ${AUTO_SCRAPE_INTERVAL_MS}ms (set AUTO_SCRAPE_ENABLED=false to disable)`,
    );
  }
  if (!mockMode) {
    startWeatherCollector();
  }
});

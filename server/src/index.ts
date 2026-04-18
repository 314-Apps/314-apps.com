import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import {
  createDdbClient,
  ensureTableExists,
  getSnapshot,
  putSnapshot,
} from "./lib/dynamo.js";
import { buildMockLeaderboard, isMockLeaderboardEnabled } from "./lib/mockLeaderboard.js";
import { getMockSimulatedDate, getSimulationMeta } from "./lib/mockTime.js";
import { fetchAndParseLeaderboard, resolveWidgetUrl } from "./lib/scrape.js";
import type { SnapshotPayload } from "./lib/types.js";
import { getActiveWindow, tournamentDayKind } from "./lib/payoutWindows.js";
import { recommendWeighIn } from "./lib/recommendation.js";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const CACHE_TTL_SECONDS = Number.parseInt(process.env.CACHE_TTL_SECONDS || "45", 10);
const MOCK_CACHE_MS = Number.parseInt(process.env.MOCK_CACHE_MS || "1500", 10);

const mockMode = isMockLeaderboardEnabled();
const tableNameEnv = process.env.TABLE_NAME?.trim();
if (!mockMode && !tableNameEnv) {
  console.error("Missing TABLE_NAME (omit only when USE_MOCK_LEADERBOARD=1)");
  process.exit(1);
}
const TABLE_NAME: string = tableNameEnv ?? "bbb_fish_leaderboard_mock_unused";

const doc = createDdbClient();

let mockSnapshotCache: SnapshotPayload | null = null;

async function maybeEnsureTable(): Promise<void> {
  if (!mockMode) {
    await ensureTableExists(TABLE_NAME);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirnamePath = path.dirname(__filename);
const repoRoot = path.resolve(__dirnamePath, "..", "..");

async function refreshSnapshot(): Promise<SnapshotPayload> {
  const now = Date.now();
  const ttlMs = (Number.isFinite(CACHE_TTL_SECONDS) ? CACHE_TTL_SECONDS : 45) * 1000;

  if (mockMode) {
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
  return payload;
}

async function getFreshSnapshot(): Promise<SnapshotPayload> {
  if (mockMode) {
    const existing = mockSnapshotCache;
    if (existing && existing.expiresAt > Date.now()) {
      return existing;
    }
    return refreshSnapshot();
  }

  const existing = await getSnapshot(doc, TABLE_NAME);
  if (existing && existing.expiresAt > Date.now()) {
    return existing;
  }
  return refreshSnapshot();
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  const payoutPlaces = Number.parseInt(process.env.PAYOUT_PLACES_HEURISTIC || "45", 10);
  const body: Record<string, unknown> = {
    ok: true,
    time: new Date().toISOString(),
    mockLeaderboard: mockMode,
    payoutPlacesHeuristic: Number.isFinite(payoutPlaces) && payoutPlaces > 0 ? payoutPlaces : 45,
  };
  if (mockMode) {
    body.simulation = getSimulationMeta();
  }
  res.json(body);
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

app.get("/api/leaderboard", async (_req, res) => {
  try {
    await maybeEnsureTable();
    const snap = await getFreshSnapshot();
    res.json({
      fetchedAt: new Date(snap.fetchedAt).toISOString(),
      expiresAt: new Date(snap.expiresAt).toISOString(),
      sourceUrl: snap.leaderboard.sourceUrl,
      leaderboard: snap.leaderboard,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg });
  }
});

app.post("/api/leaderboard/refresh", async (_req, res) => {
  try {
    await maybeEnsureTable();
    const snap = await refreshSnapshot();
    res.json({
      fetchedAt: new Date(snap.fetchedAt).toISOString(),
      expiresAt: new Date(snap.expiresAt).toISOString(),
      sourceUrl: snap.leaderboard.sourceUrl,
      leaderboard: snap.leaderboard,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg });
  }
});

app.post("/api/recommendation", async (req, res) => {
  try {
    await maybeEnsureTable();
    const snap = await getFreshSnapshot();
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

    const result = recommendWeighIn(snap.leaderboard, {
      fishWeightLb,
      travelMinutes: Number.isFinite(travelMinutes) ? travelMinutes : 0,
      livewellCount,
      secondFishWeightLb:
        secondFishWeightLb != null && Number.isFinite(secondFishWeightLb)
          ? secondFishWeightLb
          : undefined,
      manualMinutesLeft:
        manualMinutesLeft != null && Number.isFinite(manualMinutesLeft)
          ? manualMinutesLeft
          : undefined,
      shirtPurchased,
      now: body.now
        ? new Date(String(body.now))
        : mockMode
          ? getMockSimulatedDate()
          : new Date(),
    });

    res.json({
      recommendation: result,
      leaderboardFetchedAt: new Date(snap.fetchedAt).toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: msg });
  }
});

// Serve /fish/* from ./fish (HTML, app.js) without conflicting with repo-root static below.
app.use(
  "/fish",
  express.static(path.join(repoRoot, "fish"), {
    index: "index.html",
    fallthrough: true,
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

app.listen(PORT, () => {
  const mode = mockMode ? "MOCK leaderboard (no DynamoDB / no live scrape)" : "live leaderboard";
  console.log(`Fish helper: API + static site at http://localhost:${PORT}/ (try /fish/) — ${mode}`);
});

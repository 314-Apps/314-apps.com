import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LeaderboardRow, ParsedLeaderboard, PeriodSection } from "./types.js";
import type { TournamentDayKind } from "./payoutWindows.js";
import { computePayoutConsiderFloor, type PayoutConsiderFloorSnapshot } from "./recommendation.js";
import { normalizeFishWeightForEntryKey } from "./fishEntryKeyUtils.js";

const __dirnamePath = path.dirname(fileURLToPath(import.meta.url));
const TRAINING_DIR = path.resolve(__dirnamePath, "..", "..", "data", "live-training");

/** v2: adds `payoutConsiderFloor` for offline evaluation vs final cutoffs. */
const SCHEMA_VERSION = 2 as const;

function minIntervalMs(): number {
  const n = Number.parseInt(process.env.TRAINING_CAPTURE_MIN_INTERVAL_MS || "0", 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Stable within a weekend for same angler + station (weight can change = cull). */
export function anglerKey(name: string, weighStation: string): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  const s = weighStation.trim().toLowerCase().replace(/\s+/g, " ");
  return `${n}|${s}`;
}

function fishEntryKey(row: LeaderboardRow): string {
  const w =
    row.weightLb != null && Number.isFinite(row.weightLb)
      ? normalizeFishWeightForEntryKey(row.weightLb)
      : "?";
  return `${anglerKey(row.name, row.weighStation)}|${w}`;
}

function enrichPeriod(p: PeriodSection): PeriodSection & {
  rows: (LeaderboardRow & { anglerKey: string; fishEntryKey: string })[];
} {
  return {
    ...p,
    rows: p.rows.map((r) => ({
      ...r,
      anglerKey: anglerKey(r.name, r.weighStation),
      fishEntryKey: fishEntryKey(r),
    })),
  };
}

export interface TrainingSnapshotMeta {
  fetchedAtMs: number;
  tournamentDay: TournamentDayKind | null;
  activeWindow: { day: string; windowId: number; label: string } | null;
}

export interface TrainingSnapshotRecord {
  schemaVersion: typeof SCHEMA_VERSION;
  capturedAt: string;
  fetchedAtMs: number;
  sourceUrl: string;
  tournamentDay: string | null;
  activeWindow: TrainingSnapshotMeta["activeWindow"];
  periods: ReturnType<typeof enrichPeriod>[];
  /**
   * Modeled “bother weighing in” floor at snapshot time (same model as UI; μ/σ from current board).
   * Uses base paid depth only (no shirt bump), so it matches default `PAYOUT_PLACES_HEURISTIC`.
   */
  payoutConsiderFloor: PayoutConsiderFloorSnapshot;
}

const lastAppendByWindow = new Map<string, number>();

function windowThrottleKey(meta: TrainingSnapshotMeta): string {
  if (meta.activeWindow) {
    return `${meta.activeWindow.day}-W${meta.activeWindow.windowId}`;
  }
  return meta.tournamentDay ?? "no-day";
}

export function maybeAppendTrainingSnapshot(
  leaderboard: ParsedLeaderboard,
  meta: TrainingSnapshotMeta,
): { appended: boolean; reason?: string } {
  const key = windowThrottleKey(meta);
  const now = Date.now();
  const last = lastAppendByWindow.get(key) ?? 0;
  const gap = minIntervalMs();
  if (gap > 0 && now - last < gap) {
    return { appended: false, reason: `throttled (${gap}ms per window)` };
  }

  try {
    mkdirSync(TRAINING_DIR, { recursive: true });
  } catch {
    return { appended: false, reason: "could not create training directory" };
  }

  const isoDay = new Date(meta.fetchedAtMs).toISOString().slice(0, 10);
  const file = path.join(TRAINING_DIR, `${isoDay}.jsonl`);

  const floor = computePayoutConsiderFloor(leaderboard, {
    shirtPurchased: false,
    now: new Date(meta.fetchedAtMs),
  });

  const record: TrainingSnapshotRecord = {
    schemaVersion: SCHEMA_VERSION,
    capturedAt: new Date(meta.fetchedAtMs).toISOString(),
    fetchedAtMs: meta.fetchedAtMs,
    sourceUrl: leaderboard.sourceUrl,
    tournamentDay: meta.tournamentDay,
    activeWindow: meta.activeWindow,
    periods: leaderboard.periods.map((p) => enrichPeriod(p)),
    payoutConsiderFloor: floor,
  };

  appendFileSync(file, `${JSON.stringify(record)}\n`, "utf8");
  lastAppendByWindow.set(key, now);
  return { appended: true };
}

export function trainingDataDirectory(): string {
  return TRAINING_DIR;
}

/**
 * Shared helpers for comparing recommendation-query JSONL to live-training ground truth.
 * Used by compare-reco-to-final.ts and evaluate-predictions.ts.
 *
 * Ground truth weights per pay period:
 * - **Merged (preferred):** union of all fish across snapshots, deduped by **angler + fish weight**
 *   (same idea as `fishEntryKey` in `trainingCapture.ts`: one row per distinct weighed fish).
 *   Anglers may have **multiple** fish; only duplicate rows (same angler+weight seen again) collapse to the
 *   newer snapshot. Produces a sorted multiset for `rankForWeight` / cutoff when every row has angler identity.
 * - **Single snapshot (fallback):** richest single scrape (≥ `places` rows), tie-break by
 *   latest `fetchedAtMs` — used when any row lacks angler identity.
 *
 * `rankForWeight` is 1 + count(weights strictly > w). That is the true ordinal for `w` iff
 * the weight multiset is complete for the period; tie-breaking may differ from published
 * standings when many fish share a weight.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalFishWeightLb,
  normalizeFishWeightForEntryKey,
} from "../src/lib/fishEntryKeyUtils.js";
import { displayWeighStationFromRaw } from "../src/lib/weighStationNormalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const EVAL_DATA_DIR = path.join(__dirname, "..", "data");

export type DayKind = "Saturday" | "Sunday";
export type PeriodKey = `${DayKind}-W${1 | 2 | 3 | 4}`;

export type JsonlRow = Record<string, unknown>;

/** Matches enriched rows from live-training JSONL (`trainingCapture` adds `anglerKey`). */
export interface TrainingRow {
  weightLb?: number | null;
  name?: string;
  weighStation?: string;
  anglerKey?: string;
  fishEntryKey?: string;
}

export interface TrainingPeriod {
  day?: string;
  label?: string;
  rows?: TrainingRow[];
}

export interface TrainingSnap {
  fetchedAtMs?: number;
  capturedAt?: string;
  activeWindow?: { day?: string; windowId?: number } | null;
  periods?: TrainingPeriod[];
}

export interface RecoQuery {
  kind?: string;
  capturedAt?: string;
  input?: { fishWeightLb?: number };
  prediction?: {
    activeDay?: string | null;
    windowLabel?: string | null;
    projectedRank?: number | null;
    currentRank?: number | null;
    comparedToPlace?: number;
    bestWindowKey?: string | null;
    payoutLikelihoodPercent?: number | null;
    payoutLikelihoodPercentRaw?: number | null;
    projectedFinalBubbleLb?: number | null;
    projectedFinalBubbleSigmaLb?: number | null;
    payoutConsiderFloorLb?: number | null;
    payoutConsiderFloorThresholdPercent?: number;
    fractionWindowElapsed?: number;
  };
}

export function parseEvalArgs(): { date: string; places: number; periodFilters: PeriodKey[] } {
  const raw = process.argv.slice(2);
  let date = "";
  let places = Number.parseInt(process.env.PAYOUT_PLACES_HEURISTIC || "46", 10);
  const periodFilters: PeriodKey[] = [];

  for (const a of raw) {
    if (a.startsWith("--date=")) date = a.slice("--date=".length).trim();
    else if (a.startsWith("--places=")) {
      const n = Number.parseInt(a.slice("--places=".length), 10);
      if (Number.isFinite(n) && n > 0) places = n;
    } else if (a.startsWith("--period=")) {
      const p = a.slice("--period=".length).trim() as PeriodKey;
      if (/^(Saturday|Sunday)-W[1-4]$/.test(p)) periodFilters.push(p);
    }
  }

  if (!date) {
    console.error("Usage: --date=YYYY-MM-DD [--places=46] [--period=Saturday-W1] ...");
    process.exit(1);
  }

  return { date, places, periodFilters };
}

/** Match scraped period labels to a payout window (1–4). */
export function periodMatchesWindow(period: TrainingPeriod, day: string, windowId: number): boolean {
  if (period.day !== day) return false;
  const L = (period.label ?? "").toLowerCase();
  switch (windowId) {
    case 1:
      return L.includes("6:30") && L.includes("9");
    case 2:
      return L.includes("9:01") && L.includes("11");
    case 3:
      return L.includes("11:01") && (L.includes("1pm") || L.includes("1:00") || L.includes("1 pm"));
    case 4:
      return L.includes("1:01") && L.includes("3");
    default:
      return false;
  }
}

/** Same normalization as `anglerKey` in `server/src/lib/trainingCapture.ts`. */
export function normalizeAnglerKey(name: unknown, weighStation: unknown): string | null {
  const n = typeof name === "string" ? name.trim().toLowerCase().replace(/\s+/g, " ") : "";
  const s =
    typeof weighStation === "string" ? weighStation.trim().toLowerCase().replace(/\s+/g, " ") : "";
  if (n === "" && s === "") return null;
  return `${n}|${s}`;
}

export function periodForWindow(
  snap: TrainingSnap,
  day: DayKind,
  windowId: number,
): TrainingPeriod | undefined {
  const periods = snap.periods ?? [];
  return periods.find((x) => periodMatchesWindow(x, day, windowId));
}

export function weightsForPeriod(snap: TrainingSnap, day: DayKind, windowId: number): number[] {
  const p = periodForWindow(snap, day, windowId);
  if (!p?.rows) return [];
  const ws = p.rows
    .map((r) => r.weightLb)
    .filter((w): w is number => w != null && Number.isFinite(w));
  return ws.sort((a, b) => b - a);
}

function snapFetchedMs(snap: TrainingSnap): number {
  if (typeof snap.fetchedAtMs === "number" && Number.isFinite(snap.fetchedAtMs)) {
    return snap.fetchedAtMs;
  }
  if (snap.capturedAt) {
    const t = Date.parse(snap.capturedAt);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

function rowAnglerIdentity(row: TrainingRow): string | null {
  const raw = typeof row.anglerKey === "string" ? row.anglerKey.trim() : "";
  if (raw !== "") return raw;
  return normalizeAnglerKey(row.name, row.weighStation);
}

/** Stable key for one weighed fish: angler identity + rounded weight (matches `fishEntryKey` in `trainingCapture.ts`). */
function fishMergeKey(row: TrainingRow): string | null {
  const w = row.weightLb;
  if (w == null || !Number.isFinite(w)) return null;
  const id = rowAnglerIdentity(row);
  if (id == null) return null;
  return `${id}|${normalizeFishWeightForEntryKey(w)}`;
}

/** Same as `fishMergeKey`, but for single-snapshot fallback rows without identity use a per-row synthetic key so we do not drop them. */
function fishMergeKeySingleSnapshot(row: TrainingRow, rowIndex: number): string | null {
  const w = row.weightLb;
  if (w == null || !Number.isFinite(w)) return null;
  const id = rowAnglerIdentity(row);
  const wk = normalizeFishWeightForEntryKey(w);
  if (id != null) return `${id}|${wk}`;
  return `__noangler__|${rowIndex}|${wk}`;
}

/**
 * Union of all fish across snapshots for this window, one row per distinct fish (angler+weight).
 * Multiple fish per angler are kept; when the same key appears in a later snapshot, that row wins.
 * Returns `null` if any row with a valid weight lacks angler identity, or if unique fish entries < `places`.
 */
export function mergedWeightsForPeriod(
  snaps: TrainingSnap[],
  day: DayKind,
  windowId: number,
  places: number,
): { weights: number[]; rowCount: number; fetchedAtMs: number } | null {
  const ordered = [...snaps].sort((a, b) => snapFetchedMs(a) - snapFetchedMs(b));
  const byFish = new Map<string, { weightLb: number; fetchedAtMs: number }>();

  for (const snap of ordered) {
    const p = periodForWindow(snap, day, windowId);
    if (!p?.rows?.length) continue;
    const ms = snapFetchedMs(snap);
    for (const row of p.rows) {
      const w = row.weightLb;
      if (w == null || !Number.isFinite(w)) continue;
      const fk = fishMergeKey(row);
      if (fk == null) return null;
      byFish.set(fk, { weightLb: canonicalFishWeightLb(w), fetchedAtMs: ms });
    }
  }

  if (byFish.size < places) return null;
  const weights = Array.from(byFish.values())
    .map((x) => x.weightLb)
    .sort((a, b) => b - a);
  const fetchedAtMs = Math.max(0, ...snaps.map(snapFetchedMs));
  return { weights, rowCount: weights.length, fetchedAtMs };
}

export function parsePeriodKey(key: PeriodKey): { day: DayKind; windowId: 1 | 2 | 3 | 4 } | null {
  const m = key.match(/^(Saturday|Sunday)-W([1-4])$/);
  if (!m) return null;
  return { day: m[1] as DayKind, windowId: Number(m[2]) as 1 | 2 | 3 | 4 };
}

/** 1-based rank: 1 + count of weights strictly greater than w. */
export function rankForWeight(sortedDesc: number[], w: number): number {
  return sortedDesc.filter((x) => x > w).length + 1;
}

export function loadJsonl(file: string): JsonlRow[] {
  if (!existsSync(file)) return [];
  const text = readFileSync(file, "utf8");
  const out: JsonlRow[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t) as JsonlRow);
    } catch {
      /* skip */
    }
  }
  return out;
}

export function maxRowsSeenPerPeriod(snaps: TrainingSnap[]): Map<PeriodKey, number> {
  const maxRows = new Map<PeriodKey, number>();
  const days: DayKind[] = ["Saturday", "Sunday"];
  const windows = [1, 2, 3, 4] as const;
  for (const day of days) {
    for (const wid of windows) {
      const key = `${day}-W${wid}` as PeriodKey;
      let m = 0;
      for (const snap of snaps) {
        const weights = weightsForPeriod(snap, day, wid);
        if (weights.length > m) m = weights.length;
      }
      maxRows.set(key, m);
    }
  }
  return maxRows;
}

export type GroundTruthMode = "merged" | "single_snapshot";

export type CompletePeriodGroundTruth = {
  weights: number[];
  fetchedAtMs: number;
  rowCount: number;
  groundTruth: GroundTruthMode;
};

function discoverCompletePeriodSingleSnapshot(
  snaps: TrainingSnap[],
  day: DayKind,
  wid: number,
  places: number,
): { weights: number[]; fetchedAtMs: number; rowCount: number } | null {
  let best: { weights: number[]; fetchedAtMs: number; rowCount: number } | null = null;

  for (const snap of snaps) {
    const weights = weightsForPeriod(snap, day, wid);
    if (weights.length < places) continue;
    const ms = snapFetchedMs(snap);
    if (
      !best ||
      weights.length > best.rowCount ||
      (weights.length === best.rowCount && ms > best.fetchedAtMs)
    ) {
      best = { weights, fetchedAtMs: ms, rowCount: weights.length };
    }
  }

  return best;
}

/**
 * For each pay period: **merged** ground truth (all snapshots, dedupe by angler + fish weight) when possible;
 * else **single_snapshot** (richest scrape, same as historical behavior).
 */
export function discoverCompletePeriods(
  snaps: TrainingSnap[],
  places: number,
  onlyKeys: PeriodKey[] | null,
): Map<PeriodKey, CompletePeriodGroundTruth> {
  const out = new Map<PeriodKey, CompletePeriodGroundTruth>();
  const days: DayKind[] = ["Saturday", "Sunday"];
  const windows = [1, 2, 3, 4] as const;

  for (const day of days) {
    for (const wid of windows) {
      const key = `${day}-W${wid}` as PeriodKey;
      if (onlyKeys && onlyKeys.length > 0 && !onlyKeys.includes(key)) continue;

      const merged = mergedWeightsForPeriod(snaps, day, wid, places);
      if (merged) {
        out.set(key, { ...merged, groundTruth: "merged" });
        continue;
      }

      const single = discoverCompletePeriodSingleSnapshot(snaps, day, wid, places);
      if (single) {
        out.set(key, { ...single, groundTruth: "single_snapshot" });
      }
    }
  }

  return out;
}

/** Labels for payout windows 1–4 (Central / tournament schedule). */
const PERIOD_WINDOW_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "6:30am–9:00am",
  2: "9:01am–11:00am",
  3: "11:01am–1:00pm",
  4: "1:01pm–3:00pm",
};

/** One row for UI / API (reconstructed live-training leaderboard). */
export type LeaderboardDisplayEntry = {
  rank: number;
  weightLb: number;
  name: string;
  weighStation: string;
  anglerKey: string;
};

export type PeriodLeaderboardPayload = {
  key: PeriodKey;
  day: DayKind;
  windowId: 1 | 2 | 3 | 4;
  windowLabel: string;
  /** `null` when there are no captures for this window. */
  groundTruth: GroundTruthMode | null;
  fetchedAtMs: number;
  meetsEvalCompleteThreshold: boolean;
  entryCount: number;
  entries: LeaderboardDisplayEntry[];
};

function finalizeDisplayEntries(
  raw: Array<{ weightLb: number; name: string; weighStation: string; anglerKey: string }>,
): LeaderboardDisplayEntry[] {
  const weights = raw.map((r) => r.weightLb).sort((a, b) => b - a);
  const sorted = [...raw].sort(
    (a, b) =>
      b.weightLb - a.weightLb ||
      a.name.localeCompare(b.name) ||
      a.anglerKey.localeCompare(b.anglerKey),
  );
  return sorted.map((e) => ({
    ...e,
    rank: rankForWeight(weights, e.weightLb),
  }));
}

/**
 * Merge all snapshots by angler + fish weight; fails if any weighted row lacks identity (same rules as eval merge).
 */
function tryMergedLeaderboardEntries(
  snaps: TrainingSnap[],
  day: DayKind,
  windowId: number,
): { entries: LeaderboardDisplayEntry[]; failedIdentity: boolean } {
  const ordered = [...snaps].sort((a, b) => snapFetchedMs(a) - snapFetchedMs(b));
  const byFish = new Map<
    string,
    { weightLb: number; name: string; weighStation: string; anglerKey: string }
  >();

  for (const snap of ordered) {
    const p = periodForWindow(snap, day, windowId);
    if (!p?.rows?.length) continue;
    for (const row of p.rows) {
      const w = row.weightLb;
      if (w == null || !Number.isFinite(w)) continue;
      const fk = fishMergeKey(row);
      if (fk == null) return { entries: [], failedIdentity: true };
      const name = typeof row.name === "string" ? row.name : "";
      const stationRaw = typeof row.weighStation === "string" ? row.weighStation : "";
      const ak =
        typeof row.anglerKey === "string" && row.anglerKey.trim() !== ""
          ? row.anglerKey.trim()
          : rowAnglerIdentity(row) ?? fk;
      byFish.set(fk, {
        weightLb: canonicalFishWeightLb(w),
        name,
        weighStation: displayWeighStationFromRaw(stationRaw),
        anglerKey: ak,
      });
    }
  }

  if (byFish.size === 0) return { entries: [], failedIdentity: false };
  return { entries: finalizeDisplayEntries(Array.from(byFish.values())), failedIdentity: false };
}

function singleSnapshotLeaderboardEntries(
  snaps: TrainingSnap[],
  day: DayKind,
  windowId: number,
): { entries: LeaderboardDisplayEntry[]; fetchedAtMs: number } | null {
  let best: { period: TrainingPeriod; snap: TrainingSnap } | null = null;
  let bestCount = 0;

  for (const snap of snaps) {
    const p = periodForWindow(snap, day, windowId);
    if (!p?.rows?.length) continue;
    const n = p.rows.filter((r) => r.weightLb != null && Number.isFinite(r.weightLb)).length;
    if (n === 0) continue;
    const ms = snapFetchedMs(snap);
    if (!best || n > bestCount || (n === bestCount && ms > snapFetchedMs(best.snap))) {
      best = { period: p, snap };
      bestCount = n;
    }
  }

  if (!best) return null;

  const byFish: Map<
    string,
    { weightLb: number; name: string; weighStation: string; anglerKey: string }
  > = new Map();
  best.period.rows!.forEach((row, i) => {
    const w = row.weightLb;
    if (w == null || !Number.isFinite(w)) return;
    const fk = fishMergeKeySingleSnapshot(row, i);
    if (fk == null) return;
    if (byFish.has(fk)) return;
    const name = typeof row.name === "string" ? row.name : "—";
    const stationRaw = typeof row.weighStation === "string" ? row.weighStation : "";
    const ak =
      typeof row.anglerKey === "string" && row.anglerKey.trim() !== ""
        ? row.anglerKey.trim()
        : rowAnglerIdentity(row) ?? `row-${i}`;
    byFish.set(fk, {
      weightLb: canonicalFishWeightLb(w),
      name,
      weighStation: displayWeighStationFromRaw(stationRaw),
      anglerKey: ak,
    });
  });

  return {
    entries: finalizeDisplayEntries(Array.from(byFish.values())),
    fetchedAtMs: snapFetchedMs(best.snap),
  };
}

/**
 * Reconstructed leaderboard for one pay window (for UI). Prefers merged-by-angler+weight data; else richest snapshot.
 * Always returns a payload; empty `entries` means no training captures for that window.
 */
export function periodLeaderboardForDisplay(
  snaps: TrainingSnap[],
  day: DayKind,
  windowId: 1 | 2 | 3 | 4,
  placesPaidHeuristic: number,
): PeriodLeaderboardPayload {
  const key = `${day}-W${windowId}` as PeriodKey;
  const windowLabel = PERIOD_WINDOW_LABELS[windowId];

  const merged = tryMergedLeaderboardEntries(snaps, day, windowId);
  if (!merged.failedIdentity && merged.entries.length > 0) {
    const fetchedAtMs = Math.max(0, ...snaps.map(snapFetchedMs));
    return {
      key,
      day,
      windowId,
      windowLabel,
      groundTruth: "merged",
      fetchedAtMs,
      meetsEvalCompleteThreshold: merged.entries.length >= placesPaidHeuristic,
      entryCount: merged.entries.length,
      entries: merged.entries,
    };
  }

  const single = singleSnapshotLeaderboardEntries(snaps, day, windowId);
  if (single && single.entries.length > 0) {
    return {
      key,
      day,
      windowId,
      windowLabel,
      groundTruth: "single_snapshot",
      fetchedAtMs: single.fetchedAtMs,
      meetsEvalCompleteThreshold: single.entries.length >= placesPaidHeuristic,
      entryCount: single.entries.length,
      entries: single.entries,
    };
  }

  return {
    key,
    day,
    windowId,
    windowLabel,
    groundTruth: null,
    fetchedAtMs: 0,
    meetsEvalCompleteThreshold: false,
    entryCount: 0,
    entries: [],
  };
}

/** All 8 period slots (Sat/Sun × W1–W4) for a training day file. */
export function buildTrainingDayLeaderboards(
  snaps: TrainingSnap[],
  placesPaidHeuristic: number,
): PeriodLeaderboardPayload[] {
  const out: PeriodLeaderboardPayload[] = [];
  const days: DayKind[] = ["Saturday", "Sunday"];
  const windows = [1, 2, 3, 4] as const;
  for (const day of days) {
    for (const wid of windows) {
      out.push(periodLeaderboardForDisplay(snaps, day, wid, placesPaidHeuristic));
    }
  }
  return out;
}

export function recoMatchesPeriod(q: RecoQuery, key: PeriodKey): boolean {
  if (q.kind != null && q.kind !== "recommendation_query") return false;
  const pred = q.prediction;
  if (!pred) return false;
  const bk = pred.bestWindowKey?.trim();
  if (bk === key) return true;

  const parsed = parsePeriodKey(key);
  if (!parsed) return false;
  const { day, windowId } = parsed;
  if (pred.activeDay && pred.activeDay !== day) return false;
  const label = pred.windowLabel ?? "";
  if (windowId === 1 && label.includes("6:30")) return true;
  if (windowId === 2 && label.includes("9:01")) return true;
  if (windowId === 3 && label.includes("11:01")) return true;
  if (windowId === 4 && label.includes("1:01") && label.includes("3")) return true;
  return false;
}

/** True Nth-place cutoff weight (descending order: index places-1). */
export function trueCutoffLb(finalWeightsDesc: number[], places: number): number | null {
  if (finalWeightsDesc.length === 0) return null;
  if (finalWeightsDesc.length >= places) return finalWeightsDesc[places - 1]!;
  return finalWeightsDesc[finalWeightsDesc.length - 1] ?? null;
}

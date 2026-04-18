/**
 * Compare recommendation-query predictions to final standings from live-training JSONL.
 *
 * A pay period is **complete** only when the scraped board has at least `places` fish
 * (default: PAYOUT_PLACES_HEURISTIC or 46), so the payout-depth cutoff is observable.
 *
 * Every complete period on the day is evaluated separately (e.g. Saturday W1, Saturday W2, …).
 * Ground truth for a period = snapshot with the **most rows** for that period, breaking ties
 * by **latest** `fetchedAtMs` (fullest, then most recent complete capture).
 *
 * Usage:
 *   npx tsx server/scripts/compare-reco-to-final.ts --date=2026-04-18
 *   npx tsx server/scripts/compare-reco-to-final.ts --date=2026-04-18 --period=Saturday-W1
 *
 * Options:
 *   --date=YYYY-MM-DD     (required)
 *   --places=N            Override paid places / completeness threshold (default: env or 46)
 *   --period=Saturday-W1  Limit to one or more periods (repeat flag). Omit = all complete periods.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "..", "data");

type DayKind = "Saturday" | "Sunday";
type PeriodKey = `${DayKind}-W${1 | 2 | 3 | 4}`;

type JsonlRow = Record<string, unknown>;

interface TrainingPeriod {
  day?: string;
  label?: string;
  rows?: Array<{ weightLb?: number | null }>;
}

interface TrainingSnap {
  fetchedAtMs?: number;
  capturedAt?: string;
  activeWindow?: { day?: string; windowId?: number } | null;
  periods?: TrainingPeriod[];
}

interface RecoQuery {
  capturedAt?: string;
  input?: { fishWeightLb?: number };
  prediction?: {
    activeDay?: string | null;
    windowLabel?: string | null;
    projectedRank?: number | null;
    currentRank?: number | null;
    comparedToPlace?: number;
    bestWindowKey?: string | null;
    /** Modeled weigh-in floor (lb); compare to final cutoff when evaluating the floor heuristic. */
    payoutConsiderFloorLb?: number | null;
    payoutConsiderFloorThresholdPercent?: number;
  };
}

function parseArgs(): { date: string; places: number; periodFilters: PeriodKey[] } {
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
    console.error(
      "Usage: npx tsx server/scripts/compare-reco-to-final.ts --date=YYYY-MM-DD [--places=46] [--period=Saturday-W1] ...",
    );
    process.exit(1);
  }

  return { date, places, periodFilters };
}

/** Match scraped period labels to a payout window (1–4). */
function periodMatchesWindow(period: TrainingPeriod, day: string, windowId: number): boolean {
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

function weightsForPeriod(snap: TrainingSnap, day: DayKind, windowId: number): number[] {
  const periods = snap.periods ?? [];
  const p = periods.find((x) => periodMatchesWindow(x, day, windowId));
  if (!p?.rows) return [];
  const ws = p.rows
    .map((r) => r.weightLb)
    .filter((w): w is number => w != null && Number.isFinite(w));
  return ws.sort((a, b) => b - a);
}

const WINDOW_LABELS: Record<number, string> = {
  1: "6:30am–9:00am",
  2: "9:01am–11:00am",
  3: "11:01am–1:00pm",
  4: "1:01pm–3:00pm",
};

function parsePeriodKey(key: PeriodKey): { day: DayKind; windowId: 1 | 2 | 3 | 4 } | null {
  const m = key.match(/^(Saturday|Sunday)-W([1-4])$/);
  if (!m) return null;
  return { day: m[1] as DayKind, windowId: Number(m[2]) as 1 | 2 | 3 | 4 };
}

/** 1-based rank: 1 + count of weights strictly greater than w. */
function rankForWeight(sortedDesc: number[], w: number): number {
  return sortedDesc.filter((x) => x > w).length + 1;
}

function loadJsonl(file: string): JsonlRow[] {
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

/**
 * For each (day, window), find the best snapshot where the board is **complete** (>= places fish).
 * Among complete snapshots, prefer **most rows**, then **latest** fetchedAtMs.
 */
/** Max fish seen in training data per period (for reporting incomplete windows). */
function maxRowsSeenPerPeriod(snaps: TrainingSnap[]): Map<PeriodKey, number> {
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

function discoverCompletePeriods(
  snaps: TrainingSnap[],
  places: number,
  onlyKeys: PeriodKey[] | null,
): Map<PeriodKey, { weights: number[]; fetchedAtMs: number; rowCount: number }> {
  const out = new Map<PeriodKey, { weights: number[]; fetchedAtMs: number; rowCount: number }>();
  const days: DayKind[] = ["Saturday", "Sunday"];
  const windows = [1, 2, 3, 4] as const;

  for (const day of days) {
    for (const wid of windows) {
      const key = `${day}-W${wid}` as PeriodKey;
      if (onlyKeys && onlyKeys.length > 0 && !onlyKeys.includes(key)) continue;

      let best: { weights: number[]; fetchedAtMs: number; rowCount: number } | null = null;

      for (const snap of snaps) {
        const weights = weightsForPeriod(snap, day, wid);
        if (weights.length < places) continue;
        const ms = typeof snap.fetchedAtMs === "number" ? snap.fetchedAtMs : 0;
        if (
          !best ||
          weights.length > best.rowCount ||
          (weights.length === best.rowCount && ms > best.fetchedAtMs)
        ) {
          best = { weights, fetchedAtMs: ms, rowCount: weights.length };
        }
      }

      if (best) {
        out.set(key, best);
      }
    }
  }

  return out;
}

function recoMatchesPeriod(q: RecoQuery, key: PeriodKey): boolean {
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

function printPeriodTable(
  key: PeriodKey,
  finalWeights: number[],
  fetchedAtMs: number,
  rowCount: number,
  places: number,
  queries: RecoQuery[],
): { sumAbsErr: number; n: number; pairCount: number } {
  const label = parsePeriodKey(key);
  const wlabel = label ? WINDOW_LABELS[label.windowId] ?? `W${label.windowId}` : key;

  const bubbleActual =
    finalWeights.length >= places ? finalWeights[places - 1]! : finalWeights[finalWeights.length - 1]!;

  console.log(`=== ${key} (${wlabel}) — complete board: ${rowCount} fish (≥${places}), fetchedAtMs=${fetchedAtMs} ===`);
  console.log(`Actual ~${places}th-place (bubble) weight: ${bubbleActual?.toFixed(2) ?? "n/a"} lb`);
  console.log("");

  const matching = queries.filter((q) => recoMatchesPeriod(q, key));
  if (matching.length === 0) {
    console.log(`(No recommendation queries for this period.)`);
    console.log("");
    return { sumAbsErr: 0, n: 0, pairCount: 0 };
  }

  const byWeight = new Map<number, RecoQuery>();
  for (const q of matching.sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)))) {
    const w = q.input?.fishWeightLb;
    if (w == null || !Number.isFinite(w)) continue;
    byWeight.set(w, q);
  }

  console.log(
    `${"weight_lb".padEnd(10)} ${"pred_rank".padStart(10)} ${"actual_rank".padStart(12)} ${"err".padStart(6)}  current_rank@query`,
  );
  console.log("-".repeat(62));

  let sumAbsErr = 0;
  let n = 0;
  for (const w of Array.from(byWeight.keys()).sort((a, b) => a - b)) {
    const q = byWeight.get(w)!;
    const pred = q.prediction?.projectedRank;
    const actual = rankForWeight(finalWeights, w);
    const err = pred != null ? actual - pred : NaN;
    if (Number.isFinite(err)) {
      sumAbsErr += Math.abs(err);
      n += 1;
    }
    const cur = q.prediction?.currentRank ?? "—";
    console.log(
      `${w.toFixed(2).padEnd(10)} ${String(pred ?? "—").padStart(10)} ${String(actual).padStart(12)} ${Number.isFinite(err) ? String(err).padStart(6) : "   —".padStart(6)}  ${cur}`,
    );
  }

  console.log("-".repeat(62));
  if (n > 0) {
    console.log(`Mean absolute rank error (this period): ${(sumAbsErr / n).toFixed(2)} (n=${n})`);
  }
  console.log("");
  return { sumAbsErr, n, pairCount: n };
}

function main(): void {
  const { date, places, periodFilters } = parseArgs();
  const trainFile = path.join(DATA, "live-training", `${date}.jsonl`);
  const recoFile = path.join(DATA, "recommendation-queries", `${date}.jsonl`);

  const trainSnaps = loadJsonl(trainFile) as TrainingSnap[];
  const recoRows = loadJsonl(recoFile) as RecoQuery[];

  if (trainSnaps.length === 0) {
    console.error(`No training snapshots: ${trainFile}`);
    process.exit(1);
  }

  const onlyKeys = periodFilters.length > 0 ? periodFilters : null;
  const maxSeen = maxRowsSeenPerPeriod(trainSnaps);
  const complete = discoverCompletePeriods(trainSnaps, places, onlyKeys);

  if (complete.size === 0) {
    console.error(
      `No complete pay periods (need ≥${places} fish in a period) in ${trainFile}${onlyKeys ? " for selected --period filter(s)" : ""}.`,
    );
    process.exit(1);
  }

  const skipped: string[] = [];
  for (const [key, n] of maxSeen) {
    if (onlyKeys && onlyKeys.length > 0 && !onlyKeys.includes(key)) continue;
    if (!complete.has(key) && n > 0) {
      skipped.push(`${key} (max ${n} fish)`);
    }
    if (!complete.has(key) && n === 0) {
      skipped.push(`${key} (no rows)`);
    }
  }

  console.log(
    `Date ${date}: completeness threshold = ${places} fish per period. Evaluating ${complete.size} complete period(s).`,
  );
  if (skipped.length > 0) {
    console.log(`Skipped (incomplete): ${skipped.join("; ")}`);
  }
  console.log("");

  let totalAbs = 0;
  let totalN = 0;

  const keys = Array.from(complete.keys()).sort();
  for (const key of keys) {
    const { weights, fetchedAtMs, rowCount } = complete.get(key)!;
    const { sumAbsErr, n } = printPeriodTable(key, weights, fetchedAtMs, rowCount, places, recoRows);
    totalAbs += sumAbsErr;
    totalN += n;
  }

  if (keys.length > 1 && totalN > 0) {
    console.log("--- Across all complete periods with at least one query ---");
    console.log(`Mean absolute rank error: ${(totalAbs / totalN).toFixed(2)} (n=${totalN})`);
  }
}

main();

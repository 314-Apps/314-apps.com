/**
 * Grid-search blend constants in `estimatePayoutLikelihood` against final cutoffs from
 * live-training JSONL (minimize mean squared error of μ vs true Nth-place weight).
 * True cutoffs use `discoverCompletePeriods` (merged across snapshots when angler identity exists).
 *
 * Requires `data/live-training/{date}.jsonl` with `fetchedAtMs` on each snapshot.
 *
 * Usage:
 *   npx tsx server/scripts/fit-cutoff-constants.ts --date=2026-04-18
 *   BBB_SATURDAY_DATE=2026-04-18 BBB_SUNDAY_DATE=2026-04-19 npx tsx server/scripts/fit-cutoff-constants.ts --date=2026-04-18
 */
import path from "node:path";
import { DateTime } from "luxon";
import {
  EVAL_DATA_DIR,
  parseEvalArgs,
  loadJsonl,
  discoverCompletePeriods,
  weightsForPeriod,
  trueCutoffLb,
  type TrainingSnap,
  type PeriodKey,
} from "./evalShared.js";
import { PAYOUT_WINDOWS } from "../src/lib/payoutWindows.js";
import {
  DEFAULT_BUBBLE_BLEND,
  estimatePayoutLikelihood,
  mergeBubbleBlend,
  type BubbleBlendParams,
} from "../src/lib/payoutProbability.js";

const TZ = "America/Chicago";

function eventDates(dateArg: string): { sat: string; sun: string } {
  const sat = process.env.BBB_SATURDAY_DATE?.trim() || dateArg;
  const sun =
    process.env.BBB_SUNDAY_DATE?.trim() ||
    DateTime.fromISO(dateArg, { zone: TZ }).plus({ days: 1 }).toISODate()!;
  return { sat, sun };
}

function findSnapWindow(
  snapMs: number,
  satISO: string,
  sunISO: string,
): { day: "Saturday" | "Sunday"; windowId: number; elapsedMin: number; totalMin: number } | null {
  const dt = DateTime.fromMillis(snapMs, { zone: TZ });
  const iso = dt.toISODate();
  let day: "Saturday" | "Sunday" | null = null;
  if (iso === satISO) day = "Saturday";
  else if (iso === sunISO) day = "Sunday";
  else return null;

  const dayStart = dt.startOf("day");
  for (const w of PAYOUT_WINDOWS) {
    const start = dayStart.plus({ minutes: w.startMinutes });
    const end = dayStart.plus({ minutes: w.endMinutes });
    if (dt >= start && dt <= end) {
      const elapsed = (dt.toMillis() - start.toMillis()) / 60000;
      const total = (end.toMillis() - start.toMillis()) / 60000;
      return {
        day,
        windowId: w.id,
        elapsedMin: Math.max(0, elapsed),
        totalMin: Math.max(1, total),
      };
    }
  }
  return null;
}

function bubbleFor(sortedDesc: number[], places: number): number | null {
  if (sortedDesc.length === 0) return null;
  if (sortedDesc.length < places) return sortedDesc[sortedDesc.length - 1] ?? null;
  return sortedDesc[places - 1] ?? null;
}

type Sample = {
  day: "Saturday" | "Sunday";
  windowId: number;
  cutoff: number;
  snap: TrainingSnap;
  elapsedMin: number;
  totalMin: number;
};

function collectSamples(
  snaps: TrainingSnap[],
  complete: Map<PeriodKey, { weights: number[] }>,
  places: number,
  sat: string,
  sun: string,
): Sample[] {
  const out: Sample[] = [];
  for (const snap of snaps) {
    const ms =
      typeof snap.fetchedAtMs === "number"
        ? snap.fetchedAtMs
        : snap.capturedAt
          ? Date.parse(snap.capturedAt)
          : NaN;
    if (!Number.isFinite(ms)) continue;
    const win = findSnapWindow(ms, sat, sun);
    if (!win) continue;
    const key = `${win.day}-W${win.windowId}` as PeriodKey;
    const fin = complete.get(key);
    if (!fin) continue;
    const cutoff = trueCutoffLb(fin.weights, places);
    if (cutoff == null) continue;
    const weights = weightsForPeriod(snap, win.day, win.windowId);
    if (weights.length < places) continue;

    out.push({
      day: win.day,
      windowId: win.windowId,
      cutoff,
      snap,
      elapsedMin: win.elapsedMin,
      totalMin: win.totalMin,
    });
  }
  return out;
}

function mseForBlend(samples: Sample[], places: number, blend: Partial<BubbleBlendParams>): number {
  let s = 0;
  let n = 0;
  for (const x of samples) {
    const weights = weightsForPeriod(x.snap, x.day, x.windowId);
    const bubble = bubbleFor(weights, places);
    const mu = estimatePayoutLikelihood(
      {
        fishWeightLb: x.cutoff,
        day: x.day,
        windowId: x.windowId,
        currentBubbleLb: bubble,
        rowCount: weights.length,
        currentWeightsLb: weights,
        minutesElapsedInWindow: x.elapsedMin,
        windowTotalMinutes: x.totalMin,
        placesPaidOverride: places,
      },
      { blend },
    ).projectedFinalBubbleLb;
    if (mu == null || !Number.isFinite(mu)) continue;
    s += (mu - x.cutoff) ** 2;
    n += 1;
  }
  return n > 0 ? s / n : Infinity;
}

function main(): void {
  const { date, places, periodFilters } = parseEvalArgs();
  const trainFile = path.join(EVAL_DATA_DIR, "live-training", `${date}.jsonl`);
  const snaps = loadJsonl(trainFile) as TrainingSnap[];
  if (snaps.length === 0) {
    console.error(`No training snapshots: ${trainFile}`);
    process.exit(1);
  }

  const onlyKeys = periodFilters.length > 0 ? periodFilters : null;
  const complete = discoverCompletePeriods(snaps, places, onlyKeys);
  if (complete.size === 0) {
    console.error(`No complete periods in ${trainFile}`);
    process.exit(1);
  }

  const { sat, sun } = eventDates(date);
  const samples = collectSamples(snaps, complete, places, sat, sun);
  if (samples.length === 0) {
    console.error(
      "No usable samples (need snapshots with fetchedAtMs/capturedAt during a window, board ≥ places).",
    );
    process.exit(1);
  }

  const base = DEFAULT_BUBBLE_BLEND;
  const baseline = mseForBlend(samples, places, {});
  console.log(`=== Cutoff blend fit (${date}) places=${places} n=${samples.length} ===\n`);
  console.log(`Baseline MSE (DEFAULT_BUBBLE_BLEND): ${baseline.toFixed(5)}\n`);

  const intercepts = [0.2, 0.25, 0.3];
  const slopes = [0.65, 0.75, 0.85];
  const muAdds = [0.52, 0.55, 0.58];
  let best: { mse: number; blend: Partial<BubbleBlendParams> } = {
    mse: baseline,
    blend: {},
  };

  for (const fullHistWLiveIntercept of intercepts) {
    for (const fullHistWLiveSlope of slopes) {
      for (const fullHistMuAddW of muAdds) {
        const blend: Partial<BubbleBlendParams> = {
          fullHistWLiveIntercept,
          fullHistWLiveSlope,
          fullHistMuAddW,
          fullHistMuMulW: 1 - fullHistMuAddW,
        };
        const mse = mseForBlend(samples, places, blend);
        if (mse < best.mse) best = { mse, blend };
      }
    }
  }

  console.log(`Best MSE: ${best.mse.toFixed(5)}`);
  console.log("Suggested partial BubbleBlendParams (merge into DEFAULT_BUBBLE_BLEND):");
  console.log(JSON.stringify(mergeBubbleBlend(best.blend), null, 2));
  console.log("\nDiff from defaults (only overridden keys):");
  console.log(JSON.stringify(best.blend, null, 2));
}

main();

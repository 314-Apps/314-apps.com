/**
 * Compare recommendation-query predictions to final standings from live-training JSONL.
 *
 * A pay period is **complete** only when the scraped board has at least `places` fish
 * (default: PAYOUT_PLACES_HEURISTIC or 46), so the payout-depth cutoff is observable.
 *
 * Every complete period on the day is evaluated separately (e.g. Saturday W1, Saturday W2, …).
 * Ground truth for a period = **merged** across all snapshots when each row has angler identity
 * (`anglerKey` or name + weigh station): one row per distinct fish (angler + weight); same angler can have
 * multiple fish. If the same fish key repeats across snapshots, the newer snapshot wins. Otherwise
 * **single snapshot**: richest scrape for that period (≥ `places` fish), tie-break by latest
 * `fetchedAtMs` (same as historical behavior).
 *
 * **Every** recommendation-query JSONL line that matches the period is evaluated (no dedupe by
 * weight): sweeps and repeat queries at the same weight show how predictions evolved over time.
 *
 * Usage:
 *   npx tsx server/scripts/compare-reco-to-final.ts --date=2026-04-18
 *   npx tsx server/scripts/compare-reco-to-final.ts --date=2026-04-18 --period=Saturday-W1
 *
 * Options:
 *   --date=YYYY-MM-DD     (required)
 *   --places=N            Override paid places / completeness threshold (default: env or 46)
 *   --period=Saturday-W1  Limit to one or more periods (repeat flag). Omit = all complete periods.
 *
 * See also: evaluate-predictions.ts (cutoff MAE, calibration, stratified rank MAE).
 */
import path from "node:path";
import {
  EVAL_DATA_DIR,
  parseEvalArgs,
  loadJsonl,
  discoverCompletePeriods,
  recoMatchesPeriod,
  rankForWeight,
  maxRowsSeenPerPeriod,
  parsePeriodKey,
  type TrainingSnap,
  type RecoQuery,
  type PeriodKey,
} from "./evalShared.js";

const WINDOW_LABELS: Record<number, string> = {
  1: "6:30am–9:00am",
  2: "9:01am–11:00am",
  3: "11:01am–1:00pm",
  4: "1:01pm–3:00pm",
};

function printPerWeightRollup(
  rows: RecoQuery[],
  finalWeights: number[],
  places: number,
): void {
  type Agg = { n: number; errN: number; sumAbs: number; minPred: number; maxPred: number };
  const byW = new Map<number, Agg>();
  for (const q of rows) {
    const w = q.input?.fishWeightLb;
    if (w == null || !Number.isFinite(w)) continue;
    const pred = q.prediction?.projectedRank;
    const actual = rankForWeight(finalWeights, w);
    const err = pred != null ? actual - pred : NaN;
    let a = byW.get(w);
    if (!a) {
      a = { n: 0, errN: 0, sumAbs: 0, minPred: Infinity, maxPred: -Infinity };
      byW.set(w, a);
    }
    a.n += 1;
    if (Number.isFinite(err)) {
      a.errN += 1;
      a.sumAbs += Math.abs(err);
    }
    if (pred != null && Number.isFinite(pred)) {
      a.minPred = Math.min(a.minPred, pred);
      a.maxPred = Math.max(a.maxPred, pred);
    }
  }
  if (byW.size === 0) return;

  console.log(
    `--- Per fish weight (${places}-place bubble vs final board): n queries, mean |err|, min–max pred_rank ---`,
  );
  const sortedW = Array.from(byW.keys()).sort((a, b) => a - b);
  for (const w of sortedW) {
    const a = byW.get(w)!;
    const meanAbs = a.errN > 0 ? a.sumAbs / a.errN : 0;
    const predRange =
      a.minPred === Infinity
        ? "—"
        : a.minPred === a.maxPred
          ? String(a.minPred)
          : `${a.minPred}–${a.maxPred}`;
    console.log(
      `  ${w.toFixed(2).padEnd(6)} lb   n=${String(a.n).padStart(4)}   mean|err|=${meanAbs.toFixed(2).padStart(6)}   pred_rank ${predRange}   (actual_rank=${rankForWeight(finalWeights, w)})`,
    );
  }
  console.log("");
}

function printPeriodTable(
  key: PeriodKey,
  finalWeights: number[],
  fetchedAtMs: number,
  rowCount: number,
  places: number,
  queries: RecoQuery[],
  groundTruth: "merged" | "single_snapshot",
): { sumAbsErr: number; n: number; pairCount: number } {
  const label = parsePeriodKey(key);
  const wlabel = label ? WINDOW_LABELS[label.windowId] ?? `W${label.windowId}` : key;

  const bubbleActual =
    finalWeights.length >= places ? finalWeights[places - 1]! : finalWeights[finalWeights.length - 1]!;

  const gt =
    groundTruth === "merged"
      ? "merged snapshots (deduped by angler + weight)"
      : "single snapshot (richest scrape)";
  console.log(
    `=== ${key} (${wlabel}) — complete board: ${rowCount} fish (≥${places}), groundTruth=${gt}, fetchedAtMs=${fetchedAtMs} ===`,
  );
  console.log(`Actual ~${places}th-place (bubble) weight: ${bubbleActual?.toFixed(2) ?? "n/a"} lb`);
  console.log("");

  const matching = queries.filter((q) => recoMatchesPeriod(q, key));
  const rows = matching
    .filter((q) => {
      const w = q.input?.fishWeightLb;
      return w != null && Number.isFinite(w);
    })
    .sort((a, b) => String(a.capturedAt ?? "").localeCompare(String(b.capturedAt ?? "")));

  if (rows.length === 0) {
    console.log(`(No recommendation queries for this period.)`);
    console.log("");
    return { sumAbsErr: 0, n: 0, pairCount: 0 };
  }

  console.log(
    `All ${rows.length} query row(s), chronological (same weight may appear many times as the window evolves).`,
  );
  console.log("");

  const capW = 28;
  const head =
    `${"captured_at".padEnd(capW)} ${"lb".padEnd(7)} ${"pred_r".padStart(7)} ${"act_r".padStart(7)} ${"err".padStart(6)} ${"cur".padStart(5)} ${"pay%".padStart(5)} ${"floor".padStart(7)} ${"proj_μ".padStart(7)}`;
  console.log(head);
  console.log("-".repeat(head.length));

  let sumAbsErr = 0;
  let n = 0;
  for (const q of rows) {
    const w = q.input!.fishWeightLb!;
    const pred = q.prediction?.projectedRank;
    const actual = rankForWeight(finalWeights, w);
    const err = pred != null ? actual - pred : NaN;
    if (Number.isFinite(err)) {
      sumAbsErr += Math.abs(err);
      n += 1;
    }
    const cur = q.prediction?.currentRank ?? "—";
    const pay = q.prediction?.payoutLikelihoodPercent;
    const payS = pay != null && Number.isFinite(pay) ? String(Math.round(pay)) : "—";
    const floor = q.prediction?.payoutConsiderFloorLb;
    const floorS = floor != null && Number.isFinite(floor) ? floor.toFixed(2) : "—";
    const mu = q.prediction?.projectedFinalBubbleLb;
    const muS = mu != null && Number.isFinite(mu) ? mu.toFixed(2) : "—";
    const cap = (q.capturedAt ?? "—").slice(0, capW).padEnd(capW);
    const errS = Number.isFinite(err) ? String(err).padStart(6) : "    —";
    console.log(
      `${cap} ${w.toFixed(2).padEnd(7)} ${String(pred ?? "—").padStart(7)} ${String(actual).padStart(7)} ${errS} ${String(cur).padStart(5)} ${payS.padStart(5)} ${floorS.padStart(7)} ${muS.padStart(7)}`,
    );
  }

  console.log("-".repeat(head.length));
  if (n > 0) {
    console.log(
      `Mean absolute rank error (this period, all rows): ${(sumAbsErr / n).toFixed(2)} (n=${n} finite-error rows of ${rows.length} total)`,
    );
  }
  console.log("");

  printPerWeightRollup(rows, finalWeights, places);

  return { sumAbsErr, n, pairCount: rows.length };
}

function main(): void {
  const { date, places, periodFilters } = parseEvalArgs();
  const trainFile = path.join(EVAL_DATA_DIR, "live-training", `${date}.jsonl`);
  const recoFile = path.join(EVAL_DATA_DIR, "recommendation-queries", `${date}.jsonl`);

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
    const { weights, fetchedAtMs, rowCount, groundTruth } = complete.get(key)!;
    const { sumAbsErr, n } = printPeriodTable(
      key,
      weights,
      fetchedAtMs,
      rowCount,
      places,
      recoRows,
      groundTruth,
    );
    totalAbs += sumAbsErr;
    totalN += n;
  }

  if (totalN > 0) {
    console.log("--- Across all complete period(s) ---");
    console.log(`Mean absolute rank error (every query row): ${(totalAbs / totalN).toFixed(2)} (n=${totalN})`);
  }
}

main();

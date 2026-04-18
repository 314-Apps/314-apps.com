/**
 * Offline metrics: cutoff error vs projected μ, probability calibration buckets, stratified rank MAE.
 *
 * Ground-truth boards come from `discoverCompletePeriods` in evalShared (merged snapshots when
 * angler identity is present; else richest single snapshot). See README “Live training logs”.
 *
 * Usage:
 *   npx tsx server/scripts/evaluate-predictions.ts --date=2026-04-18
 *   npx tsx server/scripts/evaluate-predictions.ts --date=2026-04-18 --period=Saturday-W2
 */
import path from "node:path";
import {
  EVAL_DATA_DIR,
  parseEvalArgs,
  loadJsonl,
  discoverCompletePeriods,
  recoMatchesPeriod,
  rankForWeight,
  trueCutoffLb,
  type TrainingSnap,
  type RecoQuery,
} from "./evalShared.js";

function weightBucket(w: number): string {
  if (w < 3) return "<3";
  if (w < 3.5) return "3–3.5";
  if (w < 4) return "3.5–4";
  if (w < 4.5) return "4–4.5";
  return "≥4.5";
}

function elapsedBucket(f: number | undefined): string {
  if (f == null || !Number.isFinite(f)) return "unknown";
  if (f < 0.25) return "0–25%";
  if (f < 0.5) return "25–50%";
  if (f < 0.75) return "50–75%";
  return "75–100%";
}

/** 10% bands for modeled pay %; top band is 90–100 (not 100–110). */
function payPercentBucket(pct: number): string {
  const p = Math.max(0, Math.min(100, pct));
  if (p >= 90) return "90–100";
  const b = Math.floor(p / 10) * 10;
  return `${b}–${b + 10}`;
}

/** Midpoint of band as a fraction in [0,1], e.g. 0–10 → 0.05, 90–100 → 0.95 */
function bucketMidpointFraction(bucket: string): number {
  const parts = bucket.split(/[–-]/u);
  if (parts.length < 2) return 0.5;
  const lo = Number.parseInt(parts[0]!.trim(), 10);
  const hi = Number.parseInt(parts[1]!.trim(), 10);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 0.5;
  return (lo + hi) / 2 / 100;
}

function bucketSortKey(bucket: string): number {
  const m = bucket.match(/^(\d+)/u);
  return m ? Number.parseInt(m[1]!, 10) : 999;
}

function printSection(title: string, lines: string[]): void {
  console.log(title);
  for (const line of lines) console.log(line);
  console.log("");
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
  const complete = discoverCompletePeriods(trainSnaps, places, onlyKeys);

  if (complete.size === 0) {
    console.error(`No complete periods in ${trainFile}`);
    process.exit(1);
  }

  let nMerged = 0;
  let nSingle = 0;
  for (const v of complete.values()) {
    if (v.groundTruth === "merged") nMerged += 1;
    else nSingle += 1;
  }

  const cutoffAbsErrs: number[] = [];
  const calibBuckets = new Map<string, { n: number; sumPaid: number }>();
  const rankByWeight = new Map<string, { sumAbs: number; n: number }>();
  const rankByElapsed = new Map<string, { sumAbs: number; n: number }>();

  const keys = Array.from(complete.keys()).sort();
  for (const key of keys) {
    const { weights: finalWeights } = complete.get(key)!;
    const cutoff = trueCutoffLb(finalWeights, places);
    if (cutoff == null) continue;

    const matching = recoRows.filter((q) => recoMatchesPeriod(q, key));
    const rows = matching.filter(
      (q) => q.input?.fishWeightLb != null && Number.isFinite(q.input.fishWeightLb),
    );

    for (const q of rows) {
      const w = q.input!.fishWeightLb!;
      const mu = q.prediction?.projectedFinalBubbleLb;
      if (mu != null && Number.isFinite(mu)) {
        cutoffAbsErrs.push(Math.abs(mu - cutoff));
      }

      const pred = q.prediction?.projectedRank;
      const actual = rankForWeight(finalWeights, w);
      const err = pred != null ? actual - pred : NaN;
      if (Number.isFinite(err)) {
        const absE = Math.abs(err);
        const wb = weightBucket(w);
        const rw = rankByWeight.get(wb) ?? { sumAbs: 0, n: 0 };
        rw.sumAbs += absE;
        rw.n += 1;
        rankByWeight.set(wb, rw);

        const eb = elapsedBucket(q.prediction?.fractionWindowElapsed);
        const re = rankByElapsed.get(eb) ?? { sumAbs: 0, n: 0 };
        re.sumAbs += absE;
        re.n += 1;
        rankByElapsed.set(eb, re);
      }

      const payPct = q.prediction?.payoutLikelihoodPercent;
      if (payPct != null && Number.isFinite(payPct)) {
        const bucket = payPercentBucket(payPct);
        const paidActually = rankForWeight(finalWeights, w) <= places ? 1 : 0;
        const c = calibBuckets.get(bucket) ?? { n: 0, sumPaid: 0 };
        c.n += 1;
        c.sumPaid += paidActually;
        calibBuckets.set(bucket, c);
      }
    }
  }

  console.log(`=== Evaluation ${date} (places=${places}) ===`);
  printSection("What this is:", [
    `  • live-training/${date}.jsonl  → final leaderboards (ground truth).`,
    `  • recommendation-queries/${date}.jsonl  → each “Get recommendation” query and what the model logged.`,
    `  • “Complete” periods only: at least ${places} fish so the true ${places}th-place cutoff is known.`,
    "  • Ground truth per period: merged across all snapshots (one weight per angler, latest wins) when",
    "    rows have angler identity; otherwise one richest snapshot. See README for rank semantics.",
    `  • This run: ${nMerged} period(s) merged, ${nSingle} period(s) single-snapshot fallback.`,
    "  • Larger n = more query rows matched to those periods (sweeps count as many rows).",
  ]);

  if (cutoffAbsErrs.length > 0) {
    const mean = cutoffAbsErrs.reduce((a, b) => a + b, 0) / cutoffAbsErrs.length;
    const sorted = [...cutoffAbsErrs].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
    printSection("Cutoff accuracy (logged μ vs true bubble weight)", [
      "  For each row we compare projectedFinalBubbleLb (μ) to the true Nth-place weight on the final board.",
      "  Lower mean / p50 / p90 = closer cutoff estimates (all in lb).",
      "",
      `  Rows: ${cutoffAbsErrs.length}`,
      `  mean |μ − true cutoff|: ${mean.toFixed(3)} lb`,
      `  p50:                  ${p50.toFixed(3)} lb`,
      `  p90:                  ${p90.toFixed(3)} lb`,
    ]);
  } else {
    printSection("Cutoff accuracy", [
      "  No rows with projectedFinalBubbleLb — nothing to report here.",
    ]);
  }

  const calibOrder = Array.from(calibBuckets.keys()).sort((a, b) => bucketSortKey(a) - bucketSortKey(b));

  const calibLines: string[] = [
    "  Each row: queries whose modeled pay % (rounded into a 10% band) fell in that band.",
    '  “Paid” = that fish’s true final rank was within the paid places (rank ≤ places).',
    "  Rough ideal: fraction paid ≈ midpoint of the band (e.g. 30–40% band → ~35% paid). Sweeps and",
    "  which weights people ask about can skew buckets — use this for before/after comparisons.",
    "",
    `  ${"Band".padEnd(10)} ${"n".padStart(6)}  ${"Frac paid".padStart(10)}  ${"Target ~".padStart(10)}`,
  ];

  for (const b of calibOrder) {
    const { n, sumPaid } = calibBuckets.get(b)!;
    const frac = n > 0 ? sumPaid / n : 0;
    const mid = bucketMidpointFraction(b);
    calibLines.push(
      `  ${b.padEnd(10)} ${String(n).padStart(6)}  ${frac.toFixed(3).padStart(10)}  ${mid.toFixed(3).padStart(10)}`,
    );
  }

  let ece = 0;
  let eceN = 0;
  for (const b of calibOrder) {
    const { n, sumPaid } = calibBuckets.get(b)!;
    if (n === 0) continue;
    const mid = bucketMidpointFraction(b);
    const frac = sumPaid / n;
    ece += n * Math.abs(frac - mid);
    eceN += n;
  }
  if (eceN > 0) {
    const eceVal = ece / eceN;
    calibLines.push("");
    calibLines.push(
      `  Approximate ECE: ${eceVal.toFixed(4)}  (weighted mean |fraction paid − band midpoint|; lower = better calibration).`,
    );
  }

  printSection("Pay % calibration (outcomes vs predicted band)", calibLines);

  const rankWeightLines: string[] = [
    "  Compares logged projectedRank to the true rank from the final board for the same fish weight.",
    "  Mean |error| = average number of rank slots wrong. Lower is better.",
    "  Ranks are often noisiest in the ~3.5–4.5 lb “bubble” range.",
    "",
  ];
  for (const wb of ["<3", "3–3.5", "3.5–4", "4–4.5", "≥4.5"]) {
    const r = rankByWeight.get(wb);
    if (r && r.n > 0) {
      rankWeightLines.push(
        `  Fish ${wb.padEnd(8)}  n=${String(r.n).padStart(5)}   mean |rank error| = ${(r.sumAbs / r.n).toFixed(2)}`,
      );
    }
  }
  printSection("Rank error by fish weight (lb)", rankWeightLines);

  const rankElapsedLines: string[] = [
    "  fractionWindowElapsed = how far through the payout window the query was (0 = start, 1 = end).",
    "  Early in the window, rank estimates are usually noisier than late.",
    "",
  ];
  for (const eb of ["0–25%", "25–50%", "50–75%", "75–100%", "unknown"]) {
    const r = rankByElapsed.get(eb);
    if (r && r.n > 0) {
      rankElapsedLines.push(
        `  Window ${eb.padEnd(10)}  n=${String(r.n).padStart(5)}   mean |rank error| = ${(r.sumAbs / r.n).toFixed(2)}`,
      );
    }
  }
  printSection("Rank error by time in window", rankElapsedLines);

  console.log(
    "Tip: Re-run with the same --date after model changes; lower cutoff error and ECE usually mean better pay/cutoff behavior.",
  );
}

main();

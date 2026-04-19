/**
 * Offline metrics: cutoff error vs projected μ, probability calibration buckets, stratified rank MAE.
 *
 * Ground-truth boards come from `discoverCompletePeriods` in evalShared (merged snapshots by fish =
 * angler + weight when identity is present; else richest single snapshot). See README “Live training logs”.
 *
 * Usage:
 *   npx tsx server/scripts/evaluate-predictions.ts --date=2026-04-18
 *   npx tsx server/scripts/evaluate-predictions.ts --date=2026-04-18 --period=Saturday-W2
 *
 * Schema v4 logs `algorithmPredictions[]` — this script reports **per algorithm** display/raw calibration,
 * cutoff MAE using each algo’s logged μ when present, and ECE stratified by elapsed-window bucket.
 *
 * `--recompute` — recompute `normalBlend` and `normalBlendElapsedWide` from logged μ/σ, weight, and
 * current Φ + calibration. `historicalEmpirical` / `liveEmpirical` use logged % or `historicalOnlyPercent` /
 * `projectedRankExpected` when available.
 */
import path from "node:path";
import { ALGORITHMS } from "../src/lib/algorithms/index.js";
import {
  recomputeNormalBlendElapsedWidePercents,
  recomputeNormalBlendPercents,
} from "../src/lib/algorithms/recompute.js";
import {
  EVAL_DATA_DIR,
  parseEvalArgs,
  loadJsonl,
  discoverCompletePeriods,
  recoMatchesPeriod,
  rankForWeight,
  trueCutoffLb,
  type RecoAlgorithmPredictionRow,
  type TrainingSnap,
  type RecoQuery,
} from "./evalShared.js";

const STRAT_SEP = "###";

const ALGO_IDS = ALGORITHMS.map((a) => a.id) as string[];
const ALGO_LABEL_BY_ID = Object.fromEntries(ALGORITHMS.map((a) => [a.id, a.label])) as Record<
  string,
  string
>;

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

type PayCalibBucket = { n: number; sumPaid: number; sumPredFrac: number };

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

function emptyAgg(): {
  calibBuckets: Map<string, PayCalibBucket>;
  rawCalibBuckets: Map<string, PayCalibBucket>;
  stratifiedDisplay: Map<string, PayCalibBucket>;
  cutoffAbsErrs: number[];
} {
  return {
    calibBuckets: new Map(),
    rawCalibBuckets: new Map(),
    stratifiedDisplay: new Map(),
    cutoffAbsErrs: [],
  };
}

function getAlgoRow(q: RecoQuery, algoId: string): RecoAlgorithmPredictionRow | undefined {
  return q.algorithmPredictions?.find((a) => a.id === algoId);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Resolve display/raw pay % and μ used for cutoff error for one algorithm row.
 */
function resolvePayForAlgo(
  q: RecoQuery,
  algoId: string,
  recompute: boolean,
  w: number,
  places: number,
): { display: number | null; raw: number | null; muForCutoff: number | null } {
  const pred = q.prediction;
  const row = getAlgoRow(q, algoId);
  const mu = pred?.projectedFinalBubbleLb;
  const sig = pred?.projectedFinalBubbleSigmaLb;
  const f = pred?.fractionWindowElapsed ?? 0;

  if (recompute && mu != null && sig != null && Number.isFinite(mu) && Number.isFinite(sig) && sig > 0) {
    if (algoId === "normalBlend") {
      const r = recomputeNormalBlendPercents(w, mu, sig);
      return { display: r.display, raw: r.raw, muForCutoff: mu };
    }
    if (algoId === "normalBlendElapsedWide") {
      const r = recomputeNormalBlendElapsedWidePercents(w, mu, sig, Number.isFinite(f) ? f : 0);
      return { display: r.display, raw: r.raw, muForCutoff: mu };
    }
    if (algoId === "historicalEmpirical") {
      const hist = pred?.historicalOnlyPercent;
      const raw = row?.rawPercent ?? (hist != null && Number.isFinite(hist) ? hist : null);
      const disp = row?.displayPercent ?? raw;
      const muH = row?.projectedFinalBubbleLb ?? pred?.projectedFinalBubbleLb ?? null;
      return { display: disp, raw, muForCutoff: muH };
    }
    if (algoId === "liveEmpirical") {
      const rExp = pred?.projectedRankExpected;
      if (rExp != null && Number.isFinite(rExp) && places > 0) {
        const p = clamp(1 - rExp / places, 0, 1);
        const pct = Math.round(p * 100);
        return { display: pct, raw: pct, muForCutoff: mu };
      }
      const raw = row?.rawPercent ?? null;
      const disp = row?.displayPercent ?? raw;
      return { display: disp, raw, muForCutoff: row?.projectedFinalBubbleLb ?? mu ?? null };
    }
  }

  if (row?.displayPercent != null || row?.rawPercent != null) {
    const raw = row.rawPercent ?? null;
    const disp = row.displayPercent ?? raw;
    const muR = row.projectedFinalBubbleLb ?? pred?.projectedFinalBubbleLb ?? null;
    return { display: disp, raw, muForCutoff: muR };
  }

  if (algoId === "normalBlend") {
    const raw = pred?.payoutLikelihoodPercentRaw ?? pred?.payoutLikelihoodPercent ?? null;
    const disp = pred?.payoutLikelihoodPercent ?? null;
    return { display: disp, raw, muForCutoff: pred?.projectedFinalBubbleLb ?? null };
  }

  return { display: null, raw: null, muForCutoff: null };
}

function bumpBucket(
  map: Map<string, PayCalibBucket>,
  bucket: string,
  paidActually: number,
  predFrac: number,
): void {
  const c = map.get(bucket) ?? { n: 0, sumPaid: 0, sumPredFrac: 0 };
  c.n += 1;
  c.sumPaid += paidActually;
  c.sumPredFrac += predFrac;
  map.set(bucket, c);
}

function eceFromCalibBuckets(map: Map<string, PayCalibBucket>): { eceMid: number; ecePred: number; n: number } {
  let eceMid = 0;
  let ecePred = 0;
  let totalN = 0;
  for (const [b, { n, sumPaid, sumPredFrac }] of map) {
    if (n === 0) continue;
    const mid = bucketMidpointFraction(b);
    const frac = sumPaid / n;
    const meanPred = sumPredFrac / n;
    eceMid += n * Math.abs(frac - mid);
    ecePred += n * Math.abs(frac - meanPred);
    totalN += n;
  }
  return { eceMid, ecePred, n: totalN };
}

function eceFromStratifiedForElapsed(
  stratified: Map<string, PayCalibBucket>,
  elapsedPrefix: string,
): { ecePred: number; n: number } {
  let ecePred = 0;
  let totalN = 0;
  const p = `${elapsedPrefix}${STRAT_SEP}`;
  for (const [k, { n, sumPaid, sumPredFrac }] of stratified) {
    if (!k.startsWith(p) || n === 0) continue;
    const frac = sumPaid / n;
    const meanPred = sumPredFrac / n;
    ecePred += n * Math.abs(frac - meanPred);
    totalN += n;
  }
  return { ecePred, n: totalN };
}

function printCalibBlock(
  title: string,
  calibBuckets: Map<string, PayCalibBucket>,
  recompute: boolean,
  isRaw: boolean,
): void {
  const calibOrder = Array.from(calibBuckets.keys()).sort((a, b) => bucketSortKey(a) - bucketSortKey(b));
  if (calibOrder.length === 0) {
    printSection(title, ["  (no rows in any band)"]);
    return;
  }
  const lines: string[] = [
    isRaw
      ? recompute
        ? "  Buckets use **recomputed** raw Φ pay % (before calibration)."
        : "  Buckets use **logged** raw model pay %."
      : recompute
        ? "  Buckets use **recomputed** display pay % (after calibration)."
        : "  Buckets use **logged** display pay %.",
    '  “Paid” = true final rank ≤ paid places.',
    "",
    `  ${"Band".padEnd(10)} ${"n".padStart(6)}  ${"Frac paid".padStart(10)}  ${"Mean pred".padStart(10)}  ${"Target ~".padStart(10)}`,
  ];
  for (const b of calibOrder) {
    const { n, sumPaid, sumPredFrac } = calibBuckets.get(b)!;
    const frac = n > 0 ? sumPaid / n : 0;
    const meanPred = n > 0 ? sumPredFrac / n : 0;
    const mid = bucketMidpointFraction(b);
    lines.push(
      `  ${b.padEnd(10)} ${String(n).padStart(6)}  ${frac.toFixed(3).padStart(10)}  ${meanPred.toFixed(3).padStart(10)}  ${mid.toFixed(3).padStart(10)}`,
    );
  }
  const { eceMid, ecePred, n: eceN } = eceFromCalibBuckets(calibBuckets);
  if (eceN > 0) {
    lines.push("");
    lines.push(`  ECE vs band midpoint:   ${(eceMid / eceN).toFixed(4)}`);
    lines.push(`  ECE vs mean predicted: ${(ecePred / eceN).toFixed(4)}`);
  }
  printSection(title, lines);
}

function main(): void {
  const recompute = process.argv.includes("--recompute");
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

  const byAlgo = new Map<string, ReturnType<typeof emptyAgg>>();
  for (const id of ALGO_IDS) byAlgo.set(id, emptyAgg());

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

        const ebRank = elapsedBucket(q.prediction?.fractionWindowElapsed);
        const re = rankByElapsed.get(ebRank) ?? { sumAbs: 0, n: 0 };
        re.sumAbs += absE;
        re.n += 1;
        rankByElapsed.set(ebRank, re);
      }

      const paidActually = rankForWeight(finalWeights, w) <= places ? 1 : 0;
      const eb = elapsedBucket(q.prediction?.fractionWindowElapsed);

      for (const algoId of ALGO_IDS) {
        const agg = byAlgo.get(algoId)!;
        const { display, raw, muForCutoff } = resolvePayForAlgo(q, algoId, recompute, w, places);

        if (muForCutoff != null && Number.isFinite(muForCutoff)) {
          agg.cutoffAbsErrs.push(Math.abs(muForCutoff - cutoff));
        }

        if (display != null && Number.isFinite(display)) {
          const bucket = payPercentBucket(display);
          bumpBucket(agg.calibBuckets, bucket, paidActually, display / 100);
          const sk = `${eb}${STRAT_SEP}${bucket}`;
          bumpBucket(agg.stratifiedDisplay, sk, paidActually, display / 100);
        }

        if (raw != null && Number.isFinite(raw)) {
          const rawBucket = payPercentBucket(raw);
          bumpBucket(agg.rawCalibBuckets, rawBucket, paidActually, raw / 100);
        }
      }
    }
  }

  console.log(`=== Evaluation ${date} (places=${places}) ===`);
  printSection("What this is:", [
    `  • live-training/${date}.jsonl  → final leaderboards (ground truth).`,
    `  • recommendation-queries/${date}.jsonl  → each “Get recommendation” query and what the model logged.`,
    `  • “Complete” periods only: at least ${places} fish so the true ${places}th-place cutoff is known.`,
    "  • Ground truth per period: merged across snapshots (one row per fish = angler + weight; duplicate keys use newest scrape) when",
    "    rows have angler identity; otherwise one richest snapshot. See README for rank semantics.",
    `  • This run: ${nMerged} period(s) merged, ${nSingle} period(s) single-snapshot fallback.`,
    `  • Algorithms: ${ALGO_IDS.join(", ")} (see schema v4 \`algorithmPredictions\`; v3 logs fall back for normalBlend only).`,
    recompute
      ? "  • --recompute: normalBlend + normalBlendElapsedWide Φ from logged μ, σ; historical/live use logged fields where needed."
      : "  • Pay % tables use **logged** values per algorithm row when present.",
  ]);

  for (const algoId of ALGO_IDS) {
    const label = ALGO_LABEL_BY_ID[algoId] ?? algoId;
    const agg = byAlgo.get(algoId)!;

    if (agg.cutoffAbsErrs.length > 0) {
      const mean = agg.cutoffAbsErrs.reduce((a, b) => a + b, 0) / agg.cutoffAbsErrs.length;
      const sorted = [...agg.cutoffAbsErrs].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
      const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
      printSection(`Cutoff accuracy — ${algoId} (${label})`, [
        "  |μ − true cutoff| using this algorithm’s logged μ (projectedFinalBubbleLb on its row, else primary).",
        "",
        `  Rows: ${agg.cutoffAbsErrs.length}`,
        `  mean: ${mean.toFixed(3)} lb   p50: ${p50.toFixed(3)} lb   p90: ${p90.toFixed(3)} lb`,
      ]);
    } else {
      printSection(`Cutoff accuracy — ${algoId} (${label})`, ["  No μ rows for this algorithm."]);
    }

    printCalibBlock(
      `Pay % calibration (display) — ${algoId}`,
      agg.calibBuckets,
      recompute,
      false,
    );
    printCalibBlock(`Pay % calibration (raw) — ${algoId}`, agg.rawCalibBuckets, recompute, true);
  }

  const elapsedOrder = ["0–25%", "25–50%", "50–75%", "75–100%", "unknown"];
  const winnerLines: string[] = [
    "  For each elapsed-window bucket, ECE vs **mean predicted** in that bucket (display %), lower is better.",
    "  Only algorithms with n > 0 in that bucket are compared.",
    "",
  ];
  for (const eb of elapsedOrder) {
    let bestId: string | null = null;
    let bestEce = Number.POSITIVE_INFINITY;
    let bestN = 0;
    const parts: string[] = [];
    for (const algoId of ALGO_IDS) {
      const strat = byAlgo.get(algoId)!.stratifiedDisplay;
      const { ecePred, n } = eceFromStratifiedForElapsed(strat, eb);
      if (n <= 0) continue;
      const ece = ecePred / n;
      parts.push(`${algoId}=${ece.toFixed(4)} (n=${n})`);
      if (ece < bestEce) {
        bestEce = ece;
        bestId = algoId;
        bestN = n;
      }
    }
    if (parts.length === 0) {
      winnerLines.push(`  ${eb.padEnd(12)}  (no display-bucket data)`);
    } else {
      winnerLines.push(
        `  ${eb.padEnd(12)}  best: ${bestId ?? "?"}  ECE=${(bestEce === Number.POSITIVE_INFINITY ? 0 : bestEce).toFixed(4)} (n=${bestN})   [${parts.join("  ")}]`,
      );
    }
  }
  printSection("Winner by elapsed bucket (lowest ECE vs mean pred, display %)", winnerLines);

  const rankWeightLines: string[] = [
    "  Compares logged projectedRank to the true rank from the final board for the same fish weight.",
    "  Mean |error| = average number of rank slots wrong. Lower is better.",
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
    "",
  ];
  for (const eb of elapsedOrder) {
    const r = rankByElapsed.get(eb);
    if (r && r.n > 0) {
      rankElapsedLines.push(
        `  Window ${eb.padEnd(10)}  n=${String(r.n).padStart(5)}   mean |rank error| = ${(r.sumAbs / r.n).toFixed(2)}`,
      );
    }
  }
  printSection("Rank error by time in window", rankElapsedLines);

  console.log(
    "Tip: Use --recompute to refresh normalBlend / normalBlendElapsedWide from logged μ, σ without re-capturing JSONL.",
  );
}

main();

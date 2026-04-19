/**
 * Fit `server/data/payout-calibration.json` from live-training ground truth + recommendation-queries.
 * Bins **raw** model pay % (payoutLikelihoodPercentRaw when logged; else payoutLikelihoodPercent),
 * applies isotonic regression (PAV) on empirical pay rates, writes piecewise-linear knots.
 *
 * Usage:
 *   npx tsx server/scripts/fit-payout-calibration.ts --date=2026-04-18
 *   npx tsx server/scripts/fit-payout-calibration.ts --date=2026-04-18 --out=server/data/payout-calibration.json
 *   npx tsx server/scripts/fit-payout-calibration.ts --date=2026-04-18 --min-samples=50
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  EVAL_DATA_DIR,
  parseEvalArgs,
  loadJsonl,
  discoverCompletePeriods,
  recoMatchesPeriod,
  rankForWeight,
  type TrainingSnap,
  type RecoQuery,
} from "./evalShared.js";
import {
  buildCalibrationKnotsFromSamples,
  binCenterForIndex,
  type PayCalibrationSample,
} from "../src/lib/payoutCalibrationFit.js";

function parseOutPath(): string {
  const raw = process.argv.slice(2);
  for (const a of raw) {
    if (a.startsWith("--out=")) return path.resolve(a.slice("--out=".length).trim());
  }
  return path.resolve(process.cwd(), "server/data/payout-calibration.json");
}

function parseMinSamples(): number {
  const raw = process.argv.slice(2);
  for (const a of raw) {
    if (a.startsWith("--min-samples=")) {
      const n = Number.parseInt(a.slice("--min-samples=".length), 10);
      if (Number.isFinite(n) && n >= 1) return n;
    }
  }
  return 30;
}

function main(): void {
  const { date, places, periodFilters } = parseEvalArgs();
  const outPath = parseOutPath();
  const minSamples = parseMinSamples();

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

  const samples: PayCalibrationSample[] = [];
  let nUsedRaw = 0;
  let nFallbackDisplay = 0;

  const keys = Array.from(complete.keys()).sort();
  for (const key of keys) {
    const { weights: finalWeights } = complete.get(key)!;
    const matching = recoRows.filter((q) => recoMatchesPeriod(q, key));
    const rows = matching.filter(
      (q) => q.input?.fishWeightLb != null && Number.isFinite(q.input.fishWeightLb),
    );

    for (const q of rows) {
      const w = q.input!.fishWeightLb!;
      const rawField = q.prediction?.payoutLikelihoodPercentRaw;
      const displayField = q.prediction?.payoutLikelihoodPercent;
      let rawPercent: number | null = null;
      if (rawField != null && Number.isFinite(rawField)) {
        rawPercent = rawField;
        nUsedRaw += 1;
      } else if (displayField != null && Number.isFinite(displayField)) {
        rawPercent = displayField;
        nFallbackDisplay += 1;
      }
      if (rawPercent == null) continue;

      const paid = rankForWeight(finalWeights, w) <= places;
      samples.push({ rawPercent, paid });
    }
  }

  const { file, binCounts, binRatesRaw, binRatesIso } = buildCalibrationKnotsFromSamples(samples, {
    minSamplesTotal: minSamples,
  });

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");

  console.log(`=== Fit payout calibration (${date}, places=${places}) ===`);
  console.log("");
  console.log(`  Samples: ${samples.length}  (raw field: ${nUsedRaw}, fallback display: ${nFallbackDisplay})`);
  console.log(`  Min samples threshold: ${minSamples}  →  ${file.knots.length} knots`);
  console.log(`  Wrote: ${outPath}`);
  console.log("");
  console.log("  Bin (center)   n    raw rate   iso rate");
  for (let i = 0; i < binCounts.length; i++) {
    const c = binCenterForIndex(i);
    const n = binCounts[i]!;
    const yr = binRatesRaw[i]!;
    const yi = binRatesIso[i]!;
    console.log(
      `    ${String(c).padStart(4)}%      ${String(n).padStart(5)}  ${yr.toFixed(3).padStart(8)}  ${yi.toFixed(3).padStart(8)}`,
    );
  }
  console.log("");
  console.log(
    "Restart the server (or rely on process reload) so payout calibration JSON is re-read from disk.",
  );
}

main();

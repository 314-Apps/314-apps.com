import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  estimatePayoutLikelihood,
  mergeBubbleBlend,
  DEFAULT_BUBBLE_BLEND,
  payPercentFromPosterior,
  weightAtPayoutLikelihoodPercent,
} from "./payoutProbability.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "payout-likelihood-snapshot.json");

test("DEFAULT_BUBBLE_BLEND matches merge of empty partial", () => {
  assert.deepEqual(mergeBubbleBlend({}), DEFAULT_BUBBLE_BLEND);
});

test("estimatePayoutLikelihood snapshot: μ, σ, and percent in expected ranges", () => {
  const raw = readFileSync(FIXTURE, "utf8");
  const snap = JSON.parse(raw) as {
    input: Parameters<typeof estimatePayoutLikelihood>[0];
    expected: { muMin: number; muMax: number; sigmaMin: number; sigmaMax: number; pctMin: number; pctMax: number };
  };

  const r = estimatePayoutLikelihood(snap.input);
  assert.ok(r.projectedFinalBubbleLb != null && r.projectedFinalBubbleSigmaLb != null);
  assert.ok(r.percent != null);
  const mu = r.projectedFinalBubbleLb!;
  const sig = r.projectedFinalBubbleSigmaLb!;
  const { muMin, muMax, sigmaMin, sigmaMax, pctMin, pctMax } = snap.expected;
  assert.ok(mu >= muMin && mu <= muMax, `mu=${mu} not in [${muMin},${muMax}]`);
  assert.ok(sig >= sigmaMin && sig <= sigmaMax, `sigma=${sig} not in [${sigmaMin},${sigmaMax}]`);
  assert.ok(r.percent! >= pctMin && r.percent! <= pctMax, `percent=${r.percent} not in [${pctMin},${pctMax}]`);
});

test("payProbabilitySigmaMult pulls pay % toward 50% (less tail overconfidence)", () => {
  const input = {
    fishWeightLb: 4.5,
    day: "Saturday" as const,
    windowId: 2,
    currentBubbleLb: 3.05,
    rowCount: 50,
    currentWeightsLb: [] as number[],
    minutesElapsedInWindow: 55,
    windowTotalMinutes: 119,
    placesPaidOverride: 45,
  };
  const tight = estimatePayoutLikelihood(input, { payProbabilitySigmaMult: 1 });
  const wide = estimatePayoutLikelihood(input, { payProbabilitySigmaMult: 1.8 });
  assert.ok(tight.percent != null && wide.percent != null);
  assert.notEqual(wide.percent, tight.percent);
  assert.ok(
    Math.abs(wide.percent! - 50) <= Math.abs(tight.percent! - 50),
    `wider σ_pay should move rounded % toward 50; got ${tight.percent} vs ${wide.percent}`,
  );
});

test("weightAtPayoutLikelihoodPercent with lowerBoundLb never returns below the bound", () => {
  const mu = 3.5;
  const sigma = 0.15;
  const lb = 3.5;
  for (const pct of [10, 25, 50, 75, 99]) {
    const w = weightAtPayoutLikelihoodPercent(mu, sigma, pct, 1, lb);
    assert.ok(w != null && w >= lb - 1e-9, `pct=${pct} got ${w}, expected ≥ ${lb}`);
  }
});

test("weightAtPayoutLikelihoodPercent without lowerBoundLb can dip below μ (untruncated)", () => {
  const w = weightAtPayoutLikelihoodPercent(3.5, 0.15, 10, 1);
  assert.ok(w != null && w < 3.5, `untruncated 10% weight should sit below μ; got ${w}`);
});

test("payPercentFromPosterior with lowerBoundLb: fish below bound → 0", () => {
  const pct = payPercentFromPosterior(3.32, 3.5, 0.15, { lowerBoundLb: 3.5 });
  assert.equal(pct, 0);
});

test("payPercentFromPosterior: fish ≫ bound ≈ untruncated value (no-op)", () => {
  const untruncated = payPercentFromPosterior(4.5, 3.5, 0.15);
  const truncated = payPercentFromPosterior(4.5, 3.5, 0.15, { lowerBoundLb: 2.5 });
  assert.ok(
    Math.abs(untruncated - truncated) <= 1,
    `expected near-equal pct when lb is far below μ; got ${untruncated} vs ${truncated}`,
  );
});

test("estimatePayoutLikelihood: end of window with bubble 3.50 → sub-bubble fish reads 0% and lowerBound=cb", () => {
  const input = {
    fishWeightLb: 3.32,
    day: "Sunday" as const,
    windowId: 4,
    currentBubbleLb: 3.5,
    rowCount: 60,
    currentWeightsLb: [] as number[],
    minutesElapsedInWindow: 116,
    windowTotalMinutes: 119,
    placesPaidOverride: 46,
  };
  const r = estimatePayoutLikelihood(input);
  assert.equal(r.projectedFinalBubbleLowerBoundLb, 3.5);
  assert.equal(r.percent, 0, `3.32 lb fish below 3.50 bubble should be 0%, got ${r.percent}`);
});

test("estimatePayoutLikelihood: tail σ contracts as minutes-left approaches 0", () => {
  const base = {
    fishWeightLb: 3.6,
    day: "Sunday" as const,
    windowId: 4,
    currentBubbleLb: 3.5,
    rowCount: 60,
    currentWeightsLb: [] as number[],
    windowTotalMinutes: 119,
    placesPaidOverride: 46,
  };
  const early = estimatePayoutLikelihood({ ...base, minutesElapsedInWindow: 99 }); // ~20 min left
  const late = estimatePayoutLikelihood({ ...base, minutesElapsedInWindow: 117 }); // ~2 min left
  assert.ok(early.projectedFinalBubbleSigmaLb != null && late.projectedFinalBubbleSigmaLb != null);
  assert.ok(
    late.projectedFinalBubbleSigmaLb! < early.projectedFinalBubbleSigmaLb!,
    `σ should shrink near close; early=${early.projectedFinalBubbleSigmaLb}, late=${late.projectedFinalBubbleSigmaLb}`,
  );
});

test("snapshotStale inflates σ vs identical input without stale", () => {
  const input = {
    fishWeightLb: 3.4,
    day: "Saturday" as const,
    windowId: 2,
    currentBubbleLb: 3.1,
    rowCount: 48,
    currentWeightsLb: [] as number[],
    minutesElapsedInWindow: 45,
    windowTotalMinutes: 119,
    placesPaidOverride: 45,
  };
  const a = estimatePayoutLikelihood(input);
  const b = estimatePayoutLikelihood({ ...input, snapshotStale: true });
  assert.ok(
    (b.projectedFinalBubbleSigmaLb ?? 0) > (a.projectedFinalBubbleSigmaLb ?? 0),
    "stale should widen σ",
  );
});

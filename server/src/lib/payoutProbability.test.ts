import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  estimatePayoutLikelihood,
  mergeBubbleBlend,
  DEFAULT_BUBBLE_BLEND,
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

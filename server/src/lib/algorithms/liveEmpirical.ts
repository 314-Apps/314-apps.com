import type { AlgorithmContext, PayChanceAlgorithm } from "./types.js";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Map blended expected final rank to pay chance: P ≈ clamp(1 − E[rank] / places, 0, 1).
 * Uses the same expected-rank blend as the primary model (fractional, pre-round).
 */
export const liveEmpiricalAlgorithm: PayChanceAlgorithm = {
  id: "liveEmpirical",
  label: "Rank → pay (empirical)",
  primary: false,
  predict(ctx: AlgorithmContext) {
    const { baseLikelihood, placesPaid } = ctx;
    const r = baseLikelihood.projectedRankExpected;
    if (r == null || !Number.isFinite(r) || placesPaid <= 0) {
      return {
        id: liveEmpiricalAlgorithm.id,
        label: liveEmpiricalAlgorithm.label,
        rawPercent: null,
        displayPercent: null,
        projectedFinalBubbleLb: baseLikelihood.projectedFinalBubbleLb,
        projectedFinalBubbleSigmaLb: baseLikelihood.projectedFinalBubbleSigmaLb,
        projectedRank: baseLikelihood.projectedRank,
        detail: "Expected final rank unavailable for rank→pay mapping.",
      };
    }

    const p = clamp(1 - r / placesPaid, 0, 1);
    const pct = Math.round(p * 100);
    return {
      id: liveEmpiricalAlgorithm.id,
      label: liveEmpiricalAlgorithm.label,
      rawPercent: pct,
      displayPercent: pct,
      projectedFinalBubbleLb: baseLikelihood.projectedFinalBubbleLb,
      projectedFinalBubbleSigmaLb: baseLikelihood.projectedFinalBubbleSigmaLb,
      projectedRank: baseLikelihood.projectedRank,
      detail: `E[rank]≈${r.toFixed(2)} → P≈1−rank/${placesPaid}.`,
    };
  },
};

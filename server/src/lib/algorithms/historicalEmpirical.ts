import type { AlgorithmContext, PayChanceAlgorithm } from "./types.js";

/** Past-year Nth-place cutoff samples only (no live board, no Φ). */
export const historicalEmpiricalAlgorithm: PayChanceAlgorithm = {
  id: "historicalEmpirical",
  label: "Historical empirical %",
  primary: false,
  predict(ctx: AlgorithmContext) {
    const { baseLikelihood } = ctx;
    const raw = baseLikelihood.historicalOnlyPercent;
    return {
      id: historicalEmpiricalAlgorithm.id,
      label: historicalEmpiricalAlgorithm.label,
      rawPercent: raw,
      displayPercent: raw,
      projectedFinalBubbleLb: baseLikelihood.historicalMeanLb,
      projectedFinalBubbleSigmaLb: baseLikelihood.historicalStdLb,
      projectedRank: baseLikelihood.historicalOnlyRank,
      detail: "Fraction of historical final cutoffs this weight beats (ties split).",
    };
  },
};

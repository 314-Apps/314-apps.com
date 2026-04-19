import { calibratePayoutPercent } from "../payoutCalibration.js";
import type { AlgorithmContext, PayChanceAlgorithm } from "./types.js";

/** Current production model: normal posterior on cutoff → raw % → global default calibration. */
export const normalBlendAlgorithm: PayChanceAlgorithm = {
  id: "normalBlend",
  label: "Normal blend (primary)",
  primary: true,
  predict(ctx: AlgorithmContext) {
    const { baseLikelihood } = ctx;
    const raw = baseLikelihood.percent;
    const display =
      raw != null && Number.isFinite(raw) ? calibratePayoutPercent(raw) : null;
    return {
      id: normalBlendAlgorithm.id,
      label: normalBlendAlgorithm.label,
      rawPercent: raw,
      displayPercent: display,
      projectedFinalBubbleLb: baseLikelihood.projectedFinalBubbleLb,
      projectedFinalBubbleSigmaLb: baseLikelihood.projectedFinalBubbleSigmaLb,
      projectedRank: baseLikelihood.projectedRank,
      detail: "Φ(z) on projected cutoff; display % uses default calibration knots.",
    };
  },
};

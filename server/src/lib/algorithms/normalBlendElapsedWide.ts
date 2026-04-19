import { calibratePayoutPercent } from "../payoutCalibration.js";
import { payPercentFromPosterior } from "../payoutProbability.js";
import type { AlgorithmContext, PayChanceAlgorithm } from "./types.js";

function earlySigmaWidenKFromEnv(): number {
  const raw = process.env.PAYOUT_EARLY_SIGMA_WIDEN_K;
  if (raw === undefined || raw === "") return 0.6;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0.6;
}

/**
 * Same μ/σ as the primary blend, but widens σ for the pay CDF early in the window:
 * σ_pay = σ * (1 + k * (1 − f)²). Display % uses per-elapsed-bucket calibration when configured.
 */
export const normalBlendElapsedWideAlgorithm: PayChanceAlgorithm = {
  id: "normalBlendElapsedWide",
  label: "Normal blend + early σ wide",
  primary: false,
  predict(ctx: AlgorithmContext) {
    const { baseLikelihood, fishWeightLb } = ctx;
    const mu = baseLikelihood.projectedFinalBubbleLb;
    const sigma = baseLikelihood.projectedFinalBubbleSigmaLb;
    const f = baseLikelihood.fractionElapsed;

    if (
      mu == null ||
      sigma == null ||
      !Number.isFinite(mu) ||
      !Number.isFinite(sigma) ||
      sigma <= 0
    ) {
      return {
        id: normalBlendElapsedWideAlgorithm.id,
        label: normalBlendElapsedWideAlgorithm.label,
        rawPercent: null,
        displayPercent: null,
        projectedFinalBubbleLb: mu,
        projectedFinalBubbleSigmaLb: sigma,
        projectedRank: baseLikelihood.projectedRank,
        detail: "Missing μ/σ for widened pay CDF.",
      };
    }

    const k = earlySigmaWidenKFromEnv();
    const widen = 1 + k * (1 - f) ** 2;
    const sigmaForPay = sigma * widen;
    const rawPercent = payPercentFromPosterior(fishWeightLb, mu, sigmaForPay);
    const displayPercent = calibratePayoutPercent(rawPercent, {
      useElapsedBucket: true,
      fractionElapsed: f,
    });

    return {
      id: normalBlendElapsedWideAlgorithm.id,
      label: normalBlendElapsedWideAlgorithm.label,
      rawPercent,
      displayPercent,
      projectedFinalBubbleLb: mu,
      projectedFinalBubbleSigmaLb: sigma,
      projectedRank: baseLikelihood.projectedRank,
      detail: `σ for Φ scaled ×${widen.toFixed(3)} (k=${k}); calib uses elapsed bucket when v2 file has it.`,
    };
  },
};

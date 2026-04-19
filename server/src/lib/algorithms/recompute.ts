import { calibratePayoutPercent } from "../payoutCalibration.js";
import { payPercentFromPosterior } from "../payoutProbability.js";

function earlySigmaWidenKFromEnv(): number {
  const raw = process.env.PAYOUT_EARLY_SIGMA_WIDEN_K;
  if (raw === undefined || raw === "") return 0.6;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0.6;
}

/**
 * Recompute normal-blend pay % from logged μ, σ, weight (for offline `--recompute`).
 * `historicalEmpirical` / `liveEmpirical` need extra state — keep their logged values when present.
 */
export function recomputeNormalBlendPercents(
  fishWeightLb: number,
  mu: number,
  sigma: number,
): { raw: number; display: number | null } {
  const raw = payPercentFromPosterior(fishWeightLb, mu, sigma);
  const display = calibratePayoutPercent(raw);
  return { raw, display: display ?? raw };
}

export function recomputeNormalBlendElapsedWidePercents(
  fishWeightLb: number,
  mu: number,
  sigma: number,
  fractionElapsed: number,
): { raw: number; display: number | null } {
  const k = earlySigmaWidenKFromEnv();
  const f = Math.max(0, Math.min(1, fractionElapsed));
  const widen = 1 + k * (1 - f) ** 2;
  const raw = payPercentFromPosterior(fishWeightLb, mu, sigma * widen);
  const display = calibratePayoutPercent(raw, {
    useElapsedBucket: true,
    fractionElapsed: f,
  });
  return { raw, display: display ?? raw };
}

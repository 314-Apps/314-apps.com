import { historicalEmpiricalAlgorithm } from "./historicalEmpirical.js";
import { liveEmpiricalAlgorithm } from "./liveEmpirical.js";
import { normalBlendAlgorithm } from "./normalBlend.js";
import { normalBlendElapsedWideAlgorithm } from "./normalBlendElapsedWide.js";
import type { AlgorithmContext, AlgorithmPrediction, PayChanceAlgorithm } from "./types.js";

export type { AlgorithmContext, AlgorithmPrediction, PayChanceAlgorithm } from "./types.js";

export const PRIMARY_ALGORITHM_ID = "normalBlend" as const;

/** Order: primary first, then shadow candidates. */
export const ALGORITHMS: readonly PayChanceAlgorithm[] = [
  normalBlendAlgorithm,
  normalBlendElapsedWideAlgorithm,
  historicalEmpiricalAlgorithm,
  liveEmpiricalAlgorithm,
] as const;

export function runAllAlgorithmPredictions(ctx: AlgorithmContext): AlgorithmPrediction[] {
  return ALGORITHMS.map((algo) => {
    const p = algo.predict(ctx);
    return {
      ...p,
      primary: algo.primary === true,
    };
  });
}

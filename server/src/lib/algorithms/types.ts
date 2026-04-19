import type { SmartLikelihoodInput, SmartLikelihoodResult } from "../payoutProbability.js";

/** One row in the shadow-algorithms table / JSONL. */
export interface AlgorithmPrediction {
  id: string;
  label: string;
  /** True for the algorithm that drives UI copy and decisions. */
  primary: boolean;
  rawPercent: number | null;
  displayPercent: number | null;
  projectedFinalBubbleLb: number | null;
  projectedFinalBubbleSigmaLb: number | null;
  projectedRank: number | null;
  /** Short human-readable note (optional). */
  detail?: string;
}

/** Inputs shared by all pay-chance algorithms for one recommendation. */
export interface AlgorithmContext {
  likelihoodInput: SmartLikelihoodInput;
  /** Single `estimatePayoutLikelihood` result (primary / shared μ, σ, ranks). */
  baseLikelihood: SmartLikelihoodResult;
  fishWeightLb: number;
  placesPaid: number;
}

export interface PayChanceAlgorithm {
  id: string;
  label: string;
  /** When true, this algo’s display % drives `decide()` and primary fields. */
  primary: boolean;
  predict(ctx: AlgorithmContext): Omit<AlgorithmPrediction, "primary">;
}

import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RecommendationInput, RecommendationResult } from "./recommendation.js";

const __dirnamePath = path.dirname(fileURLToPath(import.meta.url));
const QUERIES_DIR = path.resolve(__dirnamePath, "..", "..", "data", "recommendation-queries");

/** v2: adds `payoutConsiderFloorLb` / `payoutConsiderFloorThresholdPercent` on `prediction` for floor calibration. */
const SCHEMA_VERSION = 2 as const;

export interface RecommendationQueryRecord {
  schemaVersion: typeof SCHEMA_VERSION;
  /**
   * Hypothetical weigh-in decision: user entered a weight for advice only.
   * Not a leaderboard row and not an actual check-in.
   */
  kind: "recommendation_query";
  scenario: "hypothetical_weigh_in_decision";
  capturedAt: string;
  mockLeaderboard: boolean;
  input: {
    fishWeightLb: number;
    travelMinutes: number;
    livewellCount: 1 | 2;
    secondFishWeightLb?: number;
    manualMinutesLeft?: number;
    shirtPurchased?: boolean;
  };
  snapshot: {
    leaderboardFetchedAt: string;
    snapshotStale: boolean;
    sourceUrl: string;
  };
  prediction: {
    action: RecommendationResult["action"];
    activeDay: RecommendationResult["activeDay"];
    windowLabel: RecommendationResult["windowLabel"];
    comparedToPlace: number;
    payoutLikelihoodPercent: number | null;
    historicalOnlyPercent: number | null;
    projectedRank: number | null;
    projectedRankLow: number | null;
    projectedRankHigh: number | null;
    currentRank: number | null;
    historicalOnlyRank: number | null;
    avgFinalRowCount: number | null;
    bubbleWeightLb: number | null;
    projectedFinalBubbleLb: number | null;
    projectedFinalBubbleSigmaLb: number | null;
    /** Weight (lb) at ~threshold% modeled pay chance; same μ/σ as payout %. For training floor accuracy. */
    payoutConsiderFloorLb: number | null;
    /** Env `PAYOUT_CONSIDER_FLOOR_PERCENT` (default 10). */
    payoutConsiderFloorThresholdPercent: number;
    effectiveMinutesLeft: number;
    minutesLeftInPeriod: number;
    fractionWindowElapsed: number;
    canMakeThisPeriod: boolean;
    bestWindowKey: string | null;
    waitCandidate: RecommendationResult["waitCandidate"];
    trendFactor: number;
    trendConfidence: number;
  };
  windowForecastsSlim: {
    key: string;
    label: string;
    status: string;
    payoutLikelihoodPercent: number | null;
    projectedRank: number | null;
    projectedFinalBubbleLb: number | null;
  }[];
}

function buildRecord(
  input: RecommendationInput,
  result: RecommendationResult,
  snapshot: { leaderboardFetchedAt: string; snapshotStale: boolean; sourceUrl: string },
  mockLeaderboard: boolean,
): RecommendationQueryRecord {
  const now = new Date();
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: "recommendation_query",
    scenario: "hypothetical_weigh_in_decision",
    capturedAt: now.toISOString(),
    mockLeaderboard,
    input: {
      fishWeightLb: input.fishWeightLb,
      travelMinutes: input.travelMinutes,
      livewellCount: input.livewellCount,
      secondFishWeightLb: input.secondFishWeightLb,
      manualMinutesLeft: input.manualMinutesLeft,
      shirtPurchased: input.shirtPurchased,
    },
    snapshot,
    prediction: {
      action: result.action,
      activeDay: result.activeDay,
      windowLabel: result.windowLabel,
      comparedToPlace: result.comparedToPlace,
      payoutLikelihoodPercent: result.payoutLikelihoodPercent,
      historicalOnlyPercent: result.historicalOnlyPercent,
      projectedRank: result.projectedRank,
      projectedRankLow: result.projectedRankLow,
      projectedRankHigh: result.projectedRankHigh,
      currentRank: result.currentRank,
      historicalOnlyRank: result.historicalOnlyRank,
      avgFinalRowCount: result.avgFinalRowCount,
      bubbleWeightLb: result.bubbleWeightLb,
      projectedFinalBubbleLb: result.projectedFinalBubbleLb,
      projectedFinalBubbleSigmaLb: result.projectedFinalBubbleSigmaLb,
      payoutConsiderFloorLb: result.payoutConsiderFloorLb,
      payoutConsiderFloorThresholdPercent: result.payoutConsiderFloorThresholdPercent,
      effectiveMinutesLeft: result.effectiveMinutesLeft,
      minutesLeftInPeriod: result.minutesLeftInPeriod,
      fractionWindowElapsed: result.fractionWindowElapsed,
      canMakeThisPeriod: result.canMakeThisPeriod,
      bestWindowKey: result.bestWindowKey,
      waitCandidate: result.waitCandidate,
      trendFactor: result.trend.factor,
      trendConfidence: result.trend.confidence,
    },
    windowForecastsSlim: result.windowForecasts.map((w) => ({
      key: w.key,
      label: w.label,
      status: w.status,
      payoutLikelihoodPercent: w.payoutLikelihoodPercent,
      projectedRank: w.projectedRank,
      projectedFinalBubbleLb: w.projectedFinalBubbleLb,
    })),
  };
}

/**
 * Append one JSONL line: a hypothetical fish weight + model outputs for later comparison
 * to final leaderboards (does not affect scraped leaderboard data).
 */
export function appendRecommendationQueryLog(
  input: RecommendationInput,
  result: RecommendationResult,
  snapshot: { leaderboardFetchedAt: string; snapshotStale: boolean; sourceUrl: string },
  mockLeaderboard: boolean,
): { ok: boolean; reason?: string } {
  try {
    mkdirSync(QUERIES_DIR, { recursive: true });
  } catch {
    return { ok: false, reason: "could not create recommendation-queries directory" };
  }

  const isoDay = new Date().toISOString().slice(0, 10);
  const file = path.join(QUERIES_DIR, `${isoDay}.jsonl`);
  const record = buildRecord(input, result, snapshot, mockLeaderboard);

  try {
    appendFileSync(file, `${JSON.stringify(record)}\n`, "utf8");
  } catch {
    return { ok: false, reason: "append failed" };
  }
  return { ok: true };
}

export function recommendationQueriesDirectory(): string {
  return QUERIES_DIR;
}

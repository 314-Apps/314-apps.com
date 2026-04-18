import type { ParsedLeaderboard, PeriodSection } from "./types.js";
import {
  getActiveWindow,
  periodMatchesWindow,
  effectiveMinutesLeft,
  type TournamentDayKind,
} from "./payoutWindows.js";
import { estimatePayoutLikelihood, weightAtPayoutLikelihoodPercent } from "./payoutProbability.js";
import {
  forecastAllWindows,
  type DailyTrend,
  type WindowForecast,
} from "./windowForecast.js";

export interface RecommendationInput {
  fishWeightLb: number;
  travelMinutes: number;
  livewellCount: 1 | 2;
  secondFishWeightLb?: number;
  manualMinutesLeft?: number;
  /** Whether the angler bought a tournament shirt (bumps paid spots from 45 → 46). */
  shirtPurchased?: boolean;
  now?: Date;
}

export type RecommendationAction =
  | "weigh-now"
  | "weigh-before-end"
  | "wait"
  | "wait-for-next-window"
  | "cannot-make";

export interface RecommendationResult {
  summary: string;
  detail: string;
  action: RecommendationAction;
  canMakeThisPeriod: boolean;
  effectiveMinutesLeft: number;
  minutesLeftInPeriod: number;
  fractionWindowElapsed: number;
  activeDay: TournamentDayKind;
  windowLabel: string | null;
  bubbleWeightLb: number | null;
  projectedFinalBubbleLb: number | null;
  projectedFinalBubbleSigmaLb: number | null;
  comparedToPlace: number;
  /** 0–100: blended likelihood your fish is still paid at window end. */
  payoutLikelihoodPercent: number | null;
  /**
   * Approx. minimum fish weight (lb) where modeled pay chance reaches `payoutConsiderFloorThresholdPercent`
   * (same μ/σ as payout %). Below this, weighing in is usually not worth the trip; above, run the full prediction.
   */
  payoutConsiderFloorLb: number | null;
  /** Threshold used for `payoutConsiderFloorLb` (default 10). From `PAYOUT_CONSIDER_FLOOR_PERCENT`. */
  payoutConsiderFloorThresholdPercent: number;
  /** 0–100: pure historical comparison for context. */
  historicalOnlyPercent: number | null;
  /** Projected final rank at window close (1-based). */
  projectedRank: number | null;
  projectedRankLow: number | null;
  projectedRankHigh: number | null;
  /** Rank the fish would have if added to the board right now. */
  currentRank: number | null;
  /** Average rank in archived years' final leaderboards. */
  historicalOnlyRank: number | null;
  /** Typical total fish on the final board for this window (historical). */
  avgFinalRowCount: number | null;
  payoutLikelihoodDetail: string;
  /** Full weekend window forecast (past/current/future) for the given fish. */
  windowForecasts: WindowForecast[];
  /** Derived: best window to target given current info (usually current, sometimes a later one). */
  bestWindowKey: string | null;
  /** Set when bestWindowKey differs from the current window. */
  waitCandidate: {
    key: string;
    label: string;
    likelihoodPercent: number | null;
    advantagePoints: number;
    minutesUntilStart: number;
  } | null;
  trend: DailyTrend;
  disclaimer: string;
}

const SHIRT_BONUS_PLACES = 1;

function basePlaces(): number {
  const n = Number.parseInt(process.env.PAYOUT_PLACES_HEURISTIC || "45", 10);
  return Number.isFinite(n) && n > 0 ? n : 45;
}

function effectivePlaces(shirtPurchased: boolean): number {
  return basePlaces() + (shirtPurchased ? SHIRT_BONUS_PLACES : 0);
}

function payoutConsiderFloorThresholdPercent(): number {
  const n = Number.parseInt(process.env.PAYOUT_CONSIDER_FLOOR_PERCENT || "10", 10);
  if (!Number.isFinite(n) || n <= 0 || n >= 100) return 10;
  return n;
}

function weightsForPeriod(
  leaderboard: ParsedLeaderboard,
  period: PeriodSection | undefined,
): number[] {
  if (!period) return [];
  const ws = period.rows
    .map((r) => r.weightLb)
    .filter((w): w is number => w != null && Number.isFinite(w));
  return ws.sort((a, b) => b - a);
}

function bubbleWeight(sortedWeights: number[], placeN: number): number | null {
  if (sortedWeights.length === 0) return null;
  if (sortedWeights.length < placeN) return sortedWeights[sortedWeights.length - 1];
  return sortedWeights[placeN - 1];
}

interface DecisionContext {
  likelihoodPercent: number | null;
  projectedBubble: number | null;
  sigma: number | null;
  fishWeight: number;
  currentBubble: number | null;
  effectiveMinutesLeft: number;
  minutesLeftInPeriod: number;
  travelMinutes: number;
  livewellCount: 1 | 2;
  secondFishWeightLb?: number;
  places: number;
}

interface Decision {
  action: RecommendationAction;
  summary: string;
  detail: string;
}

/**
 * Smart decision logic. Prefer historical+live blended likelihood; fall back to
 * a simple bubble comparison if we have no probability (e.g. no stats loaded).
 */
function decide(ctx: DecisionContext): Decision {
  const {
    likelihoodPercent: lp,
    projectedBubble,
    fishWeight,
    currentBubble,
    effectiveMinutesLeft: eff,
    minutesLeftInPeriod: remaining,
    travelMinutes: travel,
    livewellCount,
    secondFishWeightLb,
    places,
    sigma,
  } = ctx;

  if (eff <= 0) {
    return {
      action: "cannot-make",
      summary: "Too late — you can't make it to weigh-in before this window closes.",
      detail: `With ${remaining.toFixed(1)} min left and ~${travel} min travel, effective time is ${eff.toFixed(1)} min. If rules allow, hold the fish for the next window; otherwise it won't count this period.`,
    };
  }

  // Livewell flavor text we reuse.
  const livewellNote =
    livewellCount >= 2
      ? ` Two fish in the livewell — if you keep fishing you'll need to cull the smaller one (${(secondFishWeightLb != null ? Math.min(fishWeight, secondFishWeightLb) : fishWeight).toFixed(2)} lb); check tournament cull rules.`
      : " Livewell has room for one more if you want to gamble for a bigger bite.";

  const mustCommitSoon = eff <= travel + 5 || remaining <= travel + 5;
  const bubbleBit =
    projectedBubble != null && sigma != null
      ? `projected final ~${places}th-place cutoff ≈ ${projectedBubble.toFixed(2)} ± ${sigma.toFixed(2)} lb`
      : currentBubble != null
        ? `current ~${places}th-place bubble ≈ ${currentBubble.toFixed(2)} lb`
        : `no live cutoff yet`;

  if (lp == null) {
    // Fallback: no probability available, use current bubble if we have it.
    if (currentBubble == null) {
      return {
        action: "weigh-before-end",
        summary: "No leaderboard data yet — if you think it's a contender, weigh it.",
        detail: `Window has ${remaining.toFixed(1)} min left. When the board is empty early in a window, any posted score typically holds the spot. ${bubbleBit}.${livewellNote}`,
      };
    }
    if (fishWeight > currentBubble + 0.1) {
      return {
        action: mustCommitSoon ? "weigh-now" : "weigh-before-end",
        summary: mustCommitSoon
          ? "Head to weigh-in now — secure the payout."
          : "You're above the current bubble; plan to weigh before the window ends.",
        detail: `Your ${fishWeight.toFixed(2)} lb is above the ${bubbleBit}.${livewellNote}`,
      };
    }
    return {
      action: "wait",
      summary: "Lean toward holding — you're at or below the live bubble.",
      detail: `Your ${fishWeight.toFixed(2)} lb vs ${bubbleBit}.${livewellNote}`,
    };
  }

  // Probability-driven branches.
  if (lp >= 80) {
    if (mustCommitSoon) {
      return {
        action: "weigh-now",
        summary: `Lock it in — ~${lp}% chance this fish still pays at window close.`,
        detail: `Time is short (eff ${eff.toFixed(1)} min after ${travel} min travel, ${remaining.toFixed(1)} min left). ${bubbleBit}.`,
      };
    }
    return {
      action: "weigh-before-end",
      summary: `Strong shot — ~${lp}% chance to still be paid at close.`,
      detail: `Plenty of time (${remaining.toFixed(1)} min, eff ${eff.toFixed(1)} min). Keep fishing if you want, but don't miss the cutoff. ${bubbleBit}.${livewellNote}`,
    };
  }

  if (lp >= 55) {
    return {
      action: mustCommitSoon ? "weigh-now" : "weigh-before-end",
      summary: mustCommitSoon
        ? `Go weigh — ~${lp}% chance it holds; don't cut it close.`
        : `Live shot (~${lp}%) — plan to weigh before window end.`,
      detail: `Your ${fishWeight.toFixed(2)} lb vs ${bubbleBit}. ${remaining.toFixed(1)} min left in window.${livewellNote}`,
    };
  }

  if (lp >= 25) {
    // Marginal. If livewell is full or time is short, better to weigh than walk with nothing.
    if (livewellCount >= 2 && mustCommitSoon) {
      return {
        action: "weigh-now",
        summary: `Marginal (~${lp}%) — livewell full and time short, take the slot.`,
        detail: `Better to bank a fish than risk none. ${bubbleBit}.`,
      };
    }
    return {
      action: "wait",
      summary: `Borderline (~${lp}%) — keep fishing for a bigger bite if you can.`,
      detail: `${bubbleBit}. ${remaining.toFixed(1)} min left (eff ${eff.toFixed(1)} min).${livewellNote}`,
    };
  }

  // Low probability.
  if (livewellCount >= 2 && mustCommitSoon) {
    return {
      action: "weigh-now",
      summary: `Long shot (~${lp}%), but livewell full + no time — weigh to clear a slot.`,
      detail: `A small scored fish beats none if you can't cull. ${bubbleBit}.`,
    };
  }
  return {
    action: "wait",
    summary: `Unlikely to cash (~${lp}%) — keep fishing for something bigger.`,
    detail: `Your ${fishWeight.toFixed(2)} lb is well below the ${bubbleBit}. ${remaining.toFixed(1)} min remain in the window.${livewellNote}`,
  };
}

export function recommendWeighIn(
  leaderboard: ParsedLeaderboard,
  input: RecommendationInput,
): RecommendationResult {
  const now = input.now ?? new Date();
  const active = getActiveWindow(now);
  const shirt = input.shirtPurchased === true;
  const places = effectivePlaces(shirt);
  const disclaimer =
    "Unofficial heuristic only. Payout depth and rules are set by the tournament; confirm on-site.";

  // Pre-compute the weekend-wide forecast (we want it even when there's no active window).
  const { windows: windowForecasts, trend } = forecastAllWindows(leaderboard, {
    fishWeightLb: input.fishWeightLb,
    placesPaid: places,
    now,
  });

  const floorTh = payoutConsiderFloorThresholdPercent();

  if (!active) {
    return {
      summary: "No active payout window (or not a tournament day).",
      detail:
        "Check the schedule: windows run 6:30–9, 9:01–11, 11:01–1, 1:01–3 (Central) on tournament Saturday and Sunday.",
      action: "cannot-make",
      canMakeThisPeriod: false,
      effectiveMinutesLeft: 0,
      minutesLeftInPeriod: 0,
      fractionWindowElapsed: 0,
      activeDay: null,
      windowLabel: null,
      bubbleWeightLb: null,
      projectedFinalBubbleLb: null,
      projectedFinalBubbleSigmaLb: null,
      comparedToPlace: places,
      payoutLikelihoodPercent: null,
      payoutConsiderFloorLb: null,
      payoutConsiderFloorThresholdPercent: floorTh,
      historicalOnlyPercent: null,
      projectedRank: null,
      projectedRankLow: null,
      projectedRankHigh: null,
      currentRank: null,
      historicalOnlyRank: null,
      avgFinalRowCount: null,
      payoutLikelihoodDetail: "",
      windowForecasts,
      bestWindowKey: findBestWindowKey(windowForecasts),
      waitCandidate: null,
      trend,
      disclaimer,
    };
  }

  const period = leaderboard.periods.find((p) =>
    periodMatchesWindow(p, active.window, active.day),
  );

  const sorted = weightsForPeriod(leaderboard, period);
  const bubble = bubbleWeight(sorted, places);

  const minutesLeft =
    input.manualMinutesLeft != null && Number.isFinite(input.manualMinutesLeft)
      ? Math.max(0, input.manualMinutesLeft)
      : active.minutesLeftInPeriod;

  const eff = effectiveMinutesLeft(minutesLeft, input.travelMinutes);
  const canMake = eff > 0;

  const windowTotalMinutes = Math.max(1, active.window.endMinutes - active.window.startMinutes);
  const minutesElapsed = Math.max(0, windowTotalMinutes - minutesLeft);

  const likelihood = estimatePayoutLikelihood({
    fishWeightLb: input.fishWeightLb,
    day: active.day,
    windowId: active.window.id,
    currentBubbleLb: bubble,
    rowCount: sorted.length,
    currentWeightsLb: sorted,
    minutesElapsedInWindow: minutesElapsed,
    windowTotalMinutes,
    placesPaidOverride: places,
  });

  const considerFloorLb = weightAtPayoutLikelihoodPercent(
    likelihood.projectedFinalBubbleLb,
    likelihood.projectedFinalBubbleSigmaLb,
    floorTh,
  );

  const currentKey = `${active.day}-W${active.window.id}`;
  const currentPercent = likelihood.percent ?? null;

  // Identify a meaningfully-better future window that starts reasonably soon.
  const reachableFuture = windowForecasts.filter(
    (f) => f.status === "future" && f.minutesUntilStart <= 240, // next ~4 hours
  );
  const bestFuture = reachableFuture.reduce<WindowForecast | null>((best, f) => {
    const p = f.payoutLikelihoodPercent;
    if (p == null) return best;
    if (!best || (best.payoutLikelihoodPercent ?? -1) < p) return f;
    return best;
  }, null);

  const shouldRecommendWait =
    bestFuture != null &&
    bestFuture.payoutLikelihoodPercent != null &&
    currentPercent != null &&
    bestFuture.payoutLikelihoodPercent - currentPercent >= 15 &&
    currentPercent < 70 &&
    bestFuture.minutesUntilStart <= 180;

  let decision: Decision;
  if (shouldRecommendWait && bestFuture && canMake) {
    const dp = bestFuture.payoutLikelihoodPercent ?? 0;
    const lead = Math.max(1, Math.round(bestFuture.minutesUntilStart));
    decision = {
      action: "wait-for-next-window",
      summary: `Consider waiting for ${bestFuture.label} — ~${dp}% chance there vs ~${currentPercent}% now.`,
      detail: `Fishing has been trending ${trend.factor > 1.02 ? "hotter" : trend.factor < 0.98 ? "slower" : "in line with"} history (x${trend.factor.toFixed(2)}). Next eligible window starts in ~${lead} min with a projected cutoff of ${bestFuture.projectedFinalBubbleLb?.toFixed(2) ?? "?"} lb.`,
    };
  } else {
    decision = decide({
      likelihoodPercent: likelihood.percent,
      projectedBubble: likelihood.projectedFinalBubbleLb,
      sigma: likelihood.projectedFinalBubbleSigmaLb,
      fishWeight: input.fishWeightLb,
      currentBubble: bubble,
      effectiveMinutesLeft: eff,
      minutesLeftInPeriod: minutesLeft,
      travelMinutes: input.travelMinutes,
      livewellCount: input.livewellCount,
      secondFishWeightLb: input.secondFishWeightLb,
      places,
    });
  }

  const bestKey = findBestWindowKey(windowForecasts);
  const waitCandidate =
    shouldRecommendWait && bestFuture
      ? {
          key: bestFuture.key,
          label: bestFuture.label,
          likelihoodPercent: bestFuture.payoutLikelihoodPercent,
          advantagePoints:
            (bestFuture.payoutLikelihoodPercent ?? 0) - (currentPercent ?? 0),
          minutesUntilStart: bestFuture.minutesUntilStart,
        }
      : null;

  return {
    summary: decision.summary,
    detail: decision.detail,
    action: canMake ? decision.action : "cannot-make",
    canMakeThisPeriod: canMake,
    effectiveMinutesLeft: eff,
    minutesLeftInPeriod: minutesLeft,
    fractionWindowElapsed: likelihood.fractionElapsed,
    activeDay: active.day,
    windowLabel: active.window.label,
    bubbleWeightLb: bubble,
    projectedFinalBubbleLb: likelihood.projectedFinalBubbleLb,
    projectedFinalBubbleSigmaLb: likelihood.projectedFinalBubbleSigmaLb,
    comparedToPlace: places,
    payoutLikelihoodPercent: likelihood.percent,
    payoutConsiderFloorLb: considerFloorLb,
    payoutConsiderFloorThresholdPercent: floorTh,
    historicalOnlyPercent: likelihood.historicalOnlyPercent,
    projectedRank: likelihood.projectedRank,
    projectedRankLow: likelihood.projectedRankLow,
    projectedRankHigh: likelihood.projectedRankHigh,
    currentRank: likelihood.currentRank,
    historicalOnlyRank: likelihood.historicalOnlyRank,
    avgFinalRowCount: likelihood.avgFinalRowCount,
    payoutLikelihoodDetail: likelihood.detail,
    windowForecasts,
    bestWindowKey: bestKey ?? currentKey,
    waitCandidate,
    trend,
    disclaimer,
  };
}

/** Snapshot of the modeled “bother weighing in” floor without a full recommendation. */
export interface PayoutConsiderFloorSnapshot {
  payoutConsiderFloorLb: number | null;
  payoutConsiderFloorThresholdPercent: number;
  activeDay: TournamentDayKind | null;
  windowLabel: string | null;
}

/**
 * Modeled minimum weight (~threshold% pay chance) for the active window, using the same μ/σ as payout %.
 * Independent of fish weight (pass any weight into the likelihood; bubble distribution is identical).
 */
export function computePayoutConsiderFloor(
  leaderboard: ParsedLeaderboard,
  opts: { shirtPurchased?: boolean; now?: Date; manualMinutesLeft?: number | null } = {},
): PayoutConsiderFloorSnapshot {
  const now = opts.now ?? new Date();
  const shirt = opts.shirtPurchased === true;
  const places = effectivePlaces(shirt);
  const floorTh = payoutConsiderFloorThresholdPercent();
  const active = getActiveWindow(now);
  if (!active) {
    return {
      payoutConsiderFloorLb: null,
      payoutConsiderFloorThresholdPercent: floorTh,
      activeDay: null,
      windowLabel: null,
    };
  }

  const period = leaderboard.periods.find((p) => periodMatchesWindow(p, active.window, active.day));
  const sorted = weightsForPeriod(leaderboard, period);
  const bubble = bubbleWeight(sorted, places);

  const minutesLeft =
    opts.manualMinutesLeft != null && Number.isFinite(opts.manualMinutesLeft)
      ? Math.max(0, opts.manualMinutesLeft)
      : active.minutesLeftInPeriod;

  const windowTotalMinutes = Math.max(1, active.window.endMinutes - active.window.startMinutes);
  const minutesElapsed = Math.max(0, windowTotalMinutes - minutesLeft);

  const likelihood = estimatePayoutLikelihood({
    fishWeightLb: 0,
    day: active.day,
    windowId: active.window.id,
    currentBubbleLb: bubble,
    rowCount: sorted.length,
    currentWeightsLb: sorted,
    minutesElapsedInWindow: minutesElapsed,
    windowTotalMinutes,
    placesPaidOverride: places,
  });

  const considerFloorLb = weightAtPayoutLikelihoodPercent(
    likelihood.projectedFinalBubbleLb,
    likelihood.projectedFinalBubbleSigmaLb,
    floorTh,
  );

  return {
    payoutConsiderFloorLb: considerFloorLb,
    payoutConsiderFloorThresholdPercent: floorTh,
    activeDay: active.day,
    windowLabel: active.window.label,
  };
}

function findBestWindowKey(forecasts: WindowForecast[]): string | null {
  let best: WindowForecast | null = null;
  for (const f of forecasts) {
    if (f.status === "past") continue;
    if (f.payoutLikelihoodPercent == null) continue;
    if (!best || (best.payoutLikelihoodPercent ?? -1) < (f.payoutLikelihoodPercent ?? -1)) {
      best = f;
    }
  }
  return best?.key ?? null;
}

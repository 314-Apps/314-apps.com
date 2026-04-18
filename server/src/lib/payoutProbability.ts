import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TournamentDayKind } from "./payoutWindows.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATS_PATH = path.join(__dirname, "..", "..", "data", "historical-payout-stats.json");

interface HistoricalYearRow {
  year: number;
  w45: number;
  rowCount: number;
  weights: number[];
}

interface HistoricalWindowRow {
  w45Samples: number[];
  n: number;
  mean: number;
  std: number;
  avgFinalRowCount?: number;
  pooledWeights?: number[];
  byYear?: HistoricalYearRow[];
}

interface HistoricalPayload {
  placesPaid: number;
  windows: Record<string, HistoricalWindowRow>;
}

let cached: HistoricalPayload | null = null;

function loadStats(): HistoricalPayload | null {
  if (cached) return cached;
  try {
    const raw = readFileSync(STATS_PATH, "utf8");
    cached = JSON.parse(raw) as HistoricalPayload;
    return cached;
  } catch {
    return null;
  }
}

export function statsKeyForWindow(day: TournamentDayKind, windowId: number): string | null {
  if (!day || windowId < 1 || windowId > 4) return null;
  return `${day}-W${windowId}`;
}

// Abramowitz & Stegun 7.1.26 approximation of erf (|err| < 1.5e-7).
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Inverse of the standard normal CDF (quantile). Bisection on `normalCdf`. */
export function normalPpf(p: number): number {
  const eps = 1e-12;
  const x = clamp(p, eps, 1 - eps);
  let lo = -8;
  let hi = 8;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Fish weight w* such that the modeled P(paid at window end) ≈ thresholdPercent,
 * using the same normal approximation as `estimatePayoutLikelihood` (cutoff ~ N(mu, sigma)).
 * Heavier fish → higher pay chance; w* is the weight at the threshold (fish below → lower chance).
 */
export function weightAtPayoutLikelihoodPercent(
  mu: number | null,
  sigma: number | null,
  thresholdPercent: number,
): number | null {
  if (mu == null || sigma == null || !Number.isFinite(mu) || !Number.isFinite(sigma)) return null;
  if (sigma <= 0) return null;
  const p = clamp(thresholdPercent / 100, 0.001, 0.999);
  const w = mu + sigma * normalPpf(p);
  return Math.max(0, w);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export interface SmartLikelihoodInput {
  fishWeightLb: number;
  day: TournamentDayKind;
  windowId: number;
  /** Current Nth-place (or last-place, if board is shorter) weight for this window. */
  currentBubbleLb: number | null;
  /** Number of rows currently on this window's board (live). */
  rowCount: number;
  /** All weights currently on the live board, descending order (used for projected rank). */
  currentWeightsLb?: number[];
  /** Minutes elapsed since window start. */
  minutesElapsedInWindow: number;
  /** Total length of the window in minutes. */
  windowTotalMinutes: number;
  /**
   * Override for how many places are paid. Shirt purchase bumps this from 45 → 46 in the
   * Big Bass Bash. When omitted, uses `placesPaid` from the calibration JSON.
   */
  placesPaidOverride?: number;
}

export interface SmartLikelihoodResult {
  /** Integer 0–100, probability that fish is still paid at window end. */
  percent: number | null;
  /** Projected final-of-window 45th-place weight (mean of posterior). */
  projectedFinalBubbleLb: number | null;
  /** Posterior stddev around the projected final cutoff. */
  projectedFinalBubbleSigmaLb: number | null;
  /** Historical-only probability (no live board, no time weighting). */
  historicalOnlyPercent: number | null;
  /** Expected final rank (1-based) at window close. */
  projectedRank: number | null;
  /** ±1 SD rank range; useful for uncertainty. */
  projectedRankLow: number | null;
  projectedRankHigh: number | null;
  /** Rank if this fish were added to the board right now. */
  currentRank: number | null;
  /** Average rank the fish would have earned in past archived years for this window. */
  historicalOnlyRank: number | null;
  /** Average number of fish visible at end of window historically. */
  avgFinalRowCount: number | null;
  /** Fraction of window elapsed, [0,1]. */
  fractionElapsed: number;
  historicalMeanLb: number | null;
  historicalStdLb: number | null;
  historicalSampleCount: number;
  windowKey: string | null;
  placesPaid: number;
  detail: string;
}

const DEFAULT_FALLBACK_STD = 0.25;

function historicalOnlyPercent(fishWeightLb: number, samples: number[]): number | null {
  if (!samples.length) return null;
  const eps = 1e-4;
  let above = 0;
  let tie = 0;
  for (const s of samples) {
    if (fishWeightLb > s + eps) above++;
    else if (Math.abs(fishWeightLb - s) <= eps) tie++;
  }
  const frac = (above + 0.5 * tie) / samples.length;
  return Math.round(clamp(frac, 0, 1) * 100);
}

function emptyResult(overrides: Partial<SmartLikelihoodResult> = {}): SmartLikelihoodResult {
  return {
    percent: null,
    projectedFinalBubbleLb: null,
    projectedFinalBubbleSigmaLb: null,
    historicalOnlyPercent: null,
    projectedRank: null,
    projectedRankLow: null,
    projectedRankHigh: null,
    currentRank: null,
    historicalOnlyRank: null,
    avgFinalRowCount: null,
    fractionElapsed: 0,
    historicalMeanLb: null,
    historicalStdLb: null,
    historicalSampleCount: 0,
    windowKey: null,
    placesPaid: 45,
    detail: "",
    ...overrides,
  };
}

function countAbove(weights: number[], w: number): number {
  const eps = 1e-4;
  let n = 0;
  for (const x of weights) if (x > w + eps) n++;
  return n;
}

export interface PlacesStats {
  samples: number[];
  mean: number;
  std: number;
  n: number;
}

/**
 * Recompute the Nth-place cutoff distribution across archived years. When `places`
 * matches the original training target (45) we fall back to the pre-aggregated fields,
 * but for any other value (e.g. 46 with shirt purchase) we derive from `byYear.weights`.
 */
export function getPlacesStatsForWindow(
  day: TournamentDayKind,
  windowId: number,
  places: number,
): PlacesStats | null {
  const key = statsKeyForWindow(day, windowId);
  if (!key) return null;
  const stats = loadStats();
  const row = stats?.windows[key];
  return placesStats(row, places);
}

export function getHistoricalPlacesPaid(): number {
  const stats = loadStats();
  return stats && Number.isFinite(stats.placesPaid) && stats.placesPaid > 0
    ? stats.placesPaid
    : 45;
}

function placesStats(row: HistoricalWindowRow | undefined, places: number): PlacesStats | null {
  if (!row) return null;
  if (row.byYear && row.byYear.length > 0) {
    const samples = row.byYear
      .map((y) => {
        const idx = Math.min(places, y.weights.length) - 1;
        return idx >= 0 ? y.weights[idx] : undefined;
      })
      .filter((w): w is number => typeof w === "number" && Number.isFinite(w));
    if (samples.length === 0) return null;
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const var_ =
      samples.length > 1
        ? samples.reduce((s, v) => s + (v - mean) ** 2, 0) / (samples.length - 1)
        : 0;
    const std = Math.sqrt(var_) || DEFAULT_FALLBACK_STD;
    return { samples, mean, std, n: samples.length };
  }
  // Legacy stats file (only w45Samples). Only valid for places=45.
  if (row.w45Samples && row.w45Samples.length > 0) {
    return {
      samples: row.w45Samples,
      mean: row.mean,
      std: row.std || DEFAULT_FALLBACK_STD,
      n: row.w45Samples.length,
    };
  }
  return null;
}

/**
 * Project the final window bubble (45th-place cutoff) as a Normal distribution
 * by blending:
 *   - Historical prior:           μ_h, σ_h  (final cutoffs from past years for this window)
 *   - Current-bubble extrapolation: combines additive growth (current + expected rise)
 *                                   and multiplicative scaling (current / f).
 *
 * Weighting shifts from history → current as the window progresses.
 * Posterior σ shrinks with time elapsed (less uncertainty remains).
 *
 * Then returns P(fishWeight > finalBubble) using a normal CDF.
 */
export function estimatePayoutLikelihood(input: SmartLikelihoodInput): SmartLikelihoodResult {
  const key = statsKeyForWindow(input.day, input.windowId);
  const stats = loadStats();
  const basePlaces =
    stats && Number.isFinite(stats.placesPaid) && stats.placesPaid > 0 ? stats.placesPaid : 45;
  const places =
    input.placesPaidOverride != null &&
    Number.isFinite(input.placesPaidOverride) &&
    input.placesPaidOverride > 0
      ? Math.round(input.placesPaidOverride)
      : basePlaces;

  if (!key) {
    return emptyResult({ placesPaid: places });
  }

  const row = stats?.windows[key];
  const ps = placesStats(row, places);
  const samples = ps?.samples ?? [];
  const hasHist = samples.length > 0;
  const muHist = hasHist ? ps!.mean : null;
  const sigmaHist = hasHist
    ? ps!.std && ps!.std > 0
      ? ps!.std
      : DEFAULT_FALLBACK_STD
    : null;

  const histOnly = hasHist ? historicalOnlyPercent(input.fishWeightLb, samples) : null;

  const totalMin = Math.max(1, input.windowTotalMinutes);
  const elapsed = clamp(input.minutesElapsedInWindow, 0, totalMin);
  const f = clamp(elapsed / totalMin, 0, 1);
  const rowCount = Math.max(0, input.rowCount | 0);
  const boardFull = rowCount >= places;

  // If we have no historical row AND no useful live signal, we cannot estimate.
  if (!hasHist && (!boardFull || input.currentBubbleLb == null)) {
    return emptyResult({
      fractionElapsed: f,
      windowKey: key,
      placesPaid: places,
      detail: stats
        ? `No historical samples for ${key} and board hasn't reached ${places} entries yet.`
        : "Historical calibration file missing; run npm run train:historical.",
    });
  }

  // Projected final bubble distribution.
  let mu: number;
  let sigma: number;
  const cb = input.currentBubbleLb;

  if (!boardFull) {
    // Board hasn't filled to `places`; no meaningful live "cutoff" yet.
    // Use historical prior; σ shrinks mildly as time elapses.
    mu = muHist!;
    sigma = (sigmaHist ?? DEFAULT_FALLBACK_STD) * Math.sqrt(clamp(1 - 0.4 * f, 0.3, 1));
  } else if (!hasHist) {
    // Full board, no history. Assume bubble grows roughly linearly to final.
    const mulExtrap = (cb ?? 0) / Math.max(f, 0.25);
    const addExtrap = (cb ?? 0) + (1 - f) * 0.6;
    mu = Math.max(cb ?? 0, 0.55 * addExtrap + 0.45 * mulExtrap);
    sigma = 0.35 * Math.sqrt(clamp(1 - 0.7 * f, 0.15, 1));
  } else {
    // Full board + history: blend historical prior with live extrapolation.
    const muH = muHist!;
    const sigH = sigmaHist!;
    const cbVal = cb!;

    // Additive model: bubble rises by ~μ_h from start to end, scaled by remaining time.
    const addExtrap = cbVal + (1 - f) * muH * 0.5;
    // Multiplicative model: bubble grows ~linearly from 0 → final.
    const mulExtrap = cbVal / Math.max(f, 0.2);
    // Cap multiplicative so an early hot start doesn't explode projection.
    const mulCapped = Math.min(mulExtrap, muH + 3 * sigH);

    const muLive = Math.max(cbVal, 0.55 * addExtrap + 0.45 * mulCapped);

    // Weight: trust live more as window progresses.
    const wLive = clamp(0.25 + 0.75 * f, 0.25, 0.95);
    mu = wLive * muLive + (1 - wLive) * muH;
    // Floor at current — final can't be less than the current 45th place.
    mu = Math.max(mu, cbVal);

    // Posterior σ shrinks with elapsed time; shrinks more when live+history agree.
    const disagreement = Math.abs(muLive - muH);
    const agreementShrink = clamp(1 - 0.5 * Math.max(0, 1 - disagreement / (2 * sigH)), 0.6, 1);
    sigma = sigH * Math.sqrt(clamp(1 - 0.7 * f, 0.12, 1)) * agreementShrink;
    sigma = Math.max(sigma, 0.08);
  }

  // P(fish > finalBubble) = 1 - Φ((mu - fish) / sigma) = Φ((fish - mu) / sigma)
  const z = (input.fishWeightLb - mu) / Math.max(sigma, 0.01);
  const prob = normalCdf(z);
  const percent = Math.round(clamp(prob, 0, 1) * 100);

  // ---- Projected rank ----------------------------------------------------
  const currentWeights = input.currentWeightsLb ?? [];
  const aboveNow = countAbove(currentWeights, input.fishWeightLb);
  const currentRank = currentWeights.length > 0 ? aboveNow + 1 : null;

  const pooled = row?.pooledWeights ?? [];
  const byYear = row?.byYear ?? [];
  const avgFinal = row?.avgFinalRowCount ?? null;

  let projectedRank: number | null = null;
  let projectedRankLow: number | null = null;
  let projectedRankHigh: number | null = null;

  if (avgFinal != null && pooled.length > 0) {
    const pAbove = clamp(countAbove(pooled, input.fishWeightLb) / pooled.length, 0, 1);

    // Expected ranks from two independent signals:
    //  (A) Historical only: 1 + avgFinal * pAbove
    //  (B) Live + history:  1 + aboveNow + (expected remaining arrivals) * pAbove
    //      where remaining = max(0, avgFinal - rowCount).
    const expectedRemaining = Math.max(0, avgFinal - rowCount);
    const liveBasedAboveExpected = aboveNow + expectedRemaining * pAbove;
    const histBasedAboveExpected = avgFinal * pAbove;

    // Weight between them (trust live more as window progresses, only once board is nontrivial).
    const wLive = clamp(
      currentWeights.length > 0 ? 0.15 + 0.8 * f * Math.min(1, currentWeights.length / Math.max(1, avgFinal * 0.5)) : 0,
      0,
      0.95,
    );
    const expectedAbove = wLive * liveBasedAboveExpected + (1 - wLive) * histBasedAboveExpected;
    const projected = 1 + expectedAbove;

    // Variance: binomial on "remaining" + residual historical year-to-year variance.
    const binomVar = expectedRemaining * pAbove * (1 - pAbove);
    // Year-to-year variance of rank (if we have multiple years).
    let yearVar = 0;
    if (byYear.length > 1) {
      const yearRanks = byYear.map((y) => 1 + countAbove(y.weights, input.fishWeightLb));
      const meanR = yearRanks.reduce((a, b) => a + b, 0) / yearRanks.length;
      yearVar =
        yearRanks.reduce((s, r) => s + (r - meanR) ** 2, 0) / (yearRanks.length - 1);
    }
    const rankSd = Math.sqrt(binomVar + 0.5 * yearVar);

    projectedRank = Math.max(1, Math.round(projected));
    projectedRankLow = Math.max(1, Math.round(projected - rankSd));
    projectedRankHigh = Math.round(projected + rankSd);
  } else if (currentWeights.length > 0) {
    // No historical distribution: project only from the live board as a lower bound.
    projectedRank = Math.max(1, aboveNow + 1);
    projectedRankLow = projectedRank;
    projectedRankHigh = projectedRank;
  }

  // Historical-only rank (what would rank have been in the average past year's final board).
  let historicalOnlyRank: number | null = null;
  if (byYear.length > 0) {
    const ranks = byYear.map((y) => 1 + countAbove(y.weights, input.fishWeightLb));
    historicalOnlyRank = Math.max(
      1,
      Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length),
    );
  }

  const parts: string[] = [];
  parts.push(
    `Projected final ~${places}th-place cutoff ≈ ${mu.toFixed(2)} lb (±${sigma.toFixed(2)}).`,
  );
  if (hasHist && muHist != null) {
    parts.push(
      `History (${samples.length} yr${samples.length === 1 ? "" : "s"}): μ=${muHist.toFixed(2)} lb, σ=${(sigmaHist ?? 0).toFixed(2)} lb.`,
    );
  }
  const pctElapsed = Math.round(f * 100);
  if (boardFull && cb != null) {
    parts.push(
      `Live ${places}th-place bubble ${cb.toFixed(2)} lb at ${pctElapsed}% through the window (full payout depth on the board).`,
    );
  } else if (cb != null) {
    parts.push(
      `Board has ${rowCount}/${places} fish scored at ${pctElapsed}% elapsed — the ${places}th-place weight is not on the board yet (only ${rowCount} entries), so the final-cutoff estimate leans on history until ${places} fish are posted.`,
    );
  } else {
    parts.push("No weights in this period yet; using history only for the cutoff.");
  }

  if (projectedRank != null) {
    const paidStr = projectedRank <= places ? "inside" : "outside";
    parts.push(
      `Projected final rank ≈ ${projectedRank}${projectedRankLow != null && projectedRankHigh != null && projectedRankHigh > projectedRankLow ? ` (${projectedRankLow}–${projectedRankHigh})` : ""} (${paidStr} ${places}-paid).`,
    );
  }
  if (currentRank != null) {
    parts.push(`Would slot in at rank ${currentRank} right now.`);
  }
  if (historicalOnlyRank != null) {
    parts.push(`Average rank in archived years: ${historicalOnlyRank}.`);
  }

  return {
    percent,
    projectedFinalBubbleLb: mu,
    projectedFinalBubbleSigmaLb: sigma,
    historicalOnlyPercent: histOnly,
    projectedRank,
    projectedRankLow,
    projectedRankHigh,
    currentRank,
    historicalOnlyRank,
    avgFinalRowCount: avgFinal,
    fractionElapsed: f,
    historicalMeanLb: muHist,
    historicalStdLb: sigmaHist,
    historicalSampleCount: samples.length,
    windowKey: key,
    placesPaid: places,
    detail: parts.join(" "),
  };
}

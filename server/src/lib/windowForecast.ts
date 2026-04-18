import { DateTime } from "luxon";
import type { ParsedLeaderboard, PeriodSection } from "./types.js";
import {
  PAYOUT_WINDOWS,
  type PayoutWindowDef,
  periodMatchesWindow,
  tournamentDayKind,
  type TournamentDayKind,
} from "./payoutWindows.js";
import {
  estimatePayoutLikelihood,
  getPlacesStatsForWindow,
  normalCdf,
  statsKeyForWindow,
} from "./payoutProbability.js";

const TZ = "America/Chicago";

export type WindowStatus = "past" | "current" | "future";

export interface WindowForecast {
  day: "Saturday" | "Sunday";
  windowId: number;
  key: string;
  label: string;
  status: WindowStatus;
  startsAtISO: string;
  endsAtISO: string;
  minutesUntilStart: number;
  minutesUntilEnd: number;
  rowCount: number;
  liveBubbleLb: number | null;
  historicalMeanLb: number | null;
  trendAdjustedMeanLb: number | null;
  projectedFinalBubbleLb: number | null;
  projectedFinalBubbleSigmaLb: number | null;
  fishWeightAtWeighInLb: number;
  payoutLikelihoodPercent: number | null;
  projectedRank: number | null;
  /** For past windows: actual rank the fish would have earned in the final board. */
  pastFinalRank: number | null;
}

export interface DailyTrend {
  factor: number;
  confidence: number;
  dataPoints: {
    key: string;
    observedBubbleLb: number;
    historicalMeanLb: number;
    ratio: number;
    weight: number;
  }[];
  note: string;
}

function fishDecayRateLbPerHour(): number {
  const n = Number.parseFloat(process.env.FISH_LIVEWELL_DECAY_LB_PER_HOUR || "0");
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function safeDateTime(now: Date): DateTime {
  return DateTime.fromJSDate(now, { zone: TZ });
}

function windowBounds(dayDate: DateTime, w: PayoutWindowDef): { start: DateTime; end: DateTime } {
  const base = dayDate.startOf("day");
  return {
    start: base.plus({ minutes: w.startMinutes }),
    end: base.plus({ minutes: w.endMinutes }),
  };
}

function eventDates(sim: DateTime): { sat: DateTime; sun: DateTime } {
  const satEnv = process.env.BBB_SATURDAY_DATE?.trim();
  const sunEnv = process.env.BBB_SUNDAY_DATE?.trim();
  let sat: DateTime;
  if (satEnv) {
    sat = DateTime.fromISO(satEnv, { zone: TZ });
  } else {
    const wd = sim.weekday;
    const daysBack = wd === 6 ? 0 : wd === 7 ? 1 : wd + 1;
    sat = sim.startOf("day").minus({ days: daysBack });
  }
  const sun = sunEnv ? DateTime.fromISO(sunEnv, { zone: TZ }) : sat.plus({ days: 1 });
  return { sat, sun };
}

function findPeriod(
  lb: ParsedLeaderboard,
  day: "Saturday" | "Sunday",
  w: PayoutWindowDef,
): PeriodSection | undefined {
  return lb.periods.find((p) => periodMatchesWindow(p, w, day));
}

function sortedWeights(p: PeriodSection | undefined): number[] {
  if (!p) return [];
  return p.rows
    .map((r) => r.weightLb)
    .filter((x): x is number => x != null && Number.isFinite(x))
    .sort((a, b) => b - a);
}

function countAbove(arr: number[], w: number): number {
  const eps = 1e-4;
  let n = 0;
  for (const x of arr) if (x > w + eps) n++;
  return n;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Build a trend signal from today's completed (or current) windows: compare the observed
 * end-of-window bubble vs historical mean. Gives a multiplicative factor for projecting
 * future windows on the same weekend.
 */
export function computeDailyTrend(
  leaderboard: ParsedLeaderboard,
  now: Date,
  placesPaid: number,
): DailyTrend {
  const simDt = safeDateTime(now);
  const { sat, sun } = eventDates(simDt);
  const days: { day: "Saturday" | "Sunday"; date: DateTime }[] = [
    { day: "Saturday", date: sat },
    { day: "Sunday", date: sun },
  ];

  const dataPoints: DailyTrend["dataPoints"] = [];

  for (const { day, date } of days) {
    for (const w of PAYOUT_WINDOWS) {
      const { end } = windowBounds(date, w);
      if (end.toMillis() > simDt.toMillis()) continue; // future or current window

      const key = statsKeyForWindow(day, w.id);
      if (!key) continue;
      const ps = getPlacesStatsForWindow(day, w.id, placesPaid);
      if (!ps) continue;

      const period = findPeriod(leaderboard, day, w);
      const ws = sortedWeights(period);
      if (ws.length < placesPaid) continue; // no meaningful cutoff

      const observed = ws[placesPaid - 1]!;
      const ratio = observed / ps.mean;
      // Weight past days' data a bit less than today's.
      const sameDay = simDt.toISODate() === date.toISODate();
      dataPoints.push({
        key,
        observedBubbleLb: observed,
        historicalMeanLb: ps.mean,
        ratio,
        weight: sameDay ? 1 : 0.6,
      });
    }
  }

  if (dataPoints.length === 0) {
    return {
      factor: 1.0,
      confidence: 0,
      dataPoints: [],
      note: "No completed windows yet — using historical means only.",
    };
  }

  const wsum = dataPoints.reduce((s, d) => s + d.weight, 0);
  const factorRaw = dataPoints.reduce((s, d) => s + d.ratio * d.weight, 0) / wsum;
  // Soft-clip extreme moves so a single hot window doesn't blow up projections.
  const factor = clamp(factorRaw, 0.75, 1.25);
  const confidence = clamp(wsum / 3, 0, 1);
  const pct = ((factor - 1) * 100).toFixed(0);
  const dir = factor >= 1.02 ? "hotter" : factor <= 0.98 ? "slower" : "in line";
  const note =
    dir === "in line"
      ? `Fishing ${dir} with history (x${factor.toFixed(2)}).`
      : `Fishing ${dir} than history by ${Math.abs(Number(pct))}% (x${factor.toFixed(2)}).`;

  return { factor, confidence, dataPoints, note };
}

export interface ForecastOptions {
  fishWeightLb: number;
  placesPaid: number;
  now: Date;
  /** Hard cap on how far ahead to include (minutes). Defaults to a full 2-day event. */
  maxMinutesAhead?: number;
  /**
   * When true (default), only return windows from the current tournament day — a fish caught
   * on Saturday cannot be weighed Sunday, so cross-day options are not useful as "wait" targets.
   * The daily trend signal still considers both days for context.
   */
  sameDayOnly?: boolean;
}

/** Forecast a single future window using history blended with today's observed trend. */
function forecastFutureWindow(
  opts: ForecastOptions,
  day: "Saturday" | "Sunday",
  w: PayoutWindowDef,
  trend: DailyTrend,
  minutesUntilStart: number,
): WindowForecast {
  const ps = getPlacesStatsForWindow(day, w.id, opts.placesPaid);
  const muHist = ps?.mean ?? null;
  const sigmaHist = ps?.std ?? null;

  // Apply trend: blend 1.0 and trendFactor by confidence.
  const alpha = 0.6 * trend.confidence;
  const adjFactor = 1 + alpha * (trend.factor - 1);
  const mu = muHist != null ? muHist * adjFactor : null;
  // Inflate sigma for future uncertainty and limited trend data.
  const sigma =
    sigmaHist != null
      ? sigmaHist * (1.15 + 0.25 * (1 - trend.confidence))
      : null;

  // Hold-fish weight decay.
  const holdHours = Math.max(0, minutesUntilStart / 60);
  const decay = fishDecayRateLbPerHour();
  const fishAtWeighIn = Math.max(0, opts.fishWeightLb - decay * holdHours);

  let percent: number | null = null;
  if (mu != null && sigma != null && sigma > 0) {
    const z = (fishAtWeighIn - mu) / sigma;
    percent = Math.round(clamp(normalCdf(z), 0, 1) * 100);
  }

  return {
    day,
    windowId: w.id,
    key: `${day}-W${w.id}`,
    label: `${day} ${w.label}`,
    status: "future",
    startsAtISO: "",
    endsAtISO: "",
    minutesUntilStart,
    minutesUntilEnd: 0,
    rowCount: 0,
    liveBubbleLb: null,
    historicalMeanLb: muHist,
    trendAdjustedMeanLb: mu,
    projectedFinalBubbleLb: mu,
    projectedFinalBubbleSigmaLb: sigma,
    fishWeightAtWeighInLb: fishAtWeighIn,
    payoutLikelihoodPercent: percent,
    projectedRank: null,
    pastFinalRank: null,
  };
}

function forecastPastWindow(
  opts: ForecastOptions,
  day: "Saturday" | "Sunday",
  w: PayoutWindowDef,
  leaderboard: ParsedLeaderboard,
): WindowForecast {
  const period = findPeriod(leaderboard, day, w);
  const ws = sortedWeights(period);
  const ps = getPlacesStatsForWindow(day, w.id, opts.placesPaid);
  const liveBubble = ws.length >= opts.placesPaid ? ws[opts.placesPaid - 1]! : null;

  let pastRank: number | null = null;
  if (ws.length > 0) {
    pastRank = 1 + countAbove(ws, opts.fishWeightLb);
  }

  const wouldHavePaid =
    pastRank != null && pastRank <= opts.placesPaid ? 100 : pastRank != null ? 0 : null;

  return {
    day,
    windowId: w.id,
    key: `${day}-W${w.id}`,
    label: `${day} ${w.label}`,
    status: "past",
    startsAtISO: "",
    endsAtISO: "",
    minutesUntilStart: 0,
    minutesUntilEnd: 0,
    rowCount: ws.length,
    liveBubbleLb: liveBubble,
    historicalMeanLb: ps?.mean ?? null,
    trendAdjustedMeanLb: null,
    projectedFinalBubbleLb: liveBubble,
    projectedFinalBubbleSigmaLb: null,
    fishWeightAtWeighInLb: opts.fishWeightLb,
    payoutLikelihoodPercent: wouldHavePaid,
    projectedRank: pastRank,
    pastFinalRank: pastRank,
  };
}

export function forecastAllWindows(
  leaderboard: ParsedLeaderboard,
  opts: ForecastOptions,
): { windows: WindowForecast[]; trend: DailyTrend; todayDay: TournamentDayKind } {
  const simDt = safeDateTime(opts.now);
  const { sat, sun } = eventDates(simDt);
  const sameDayOnly = opts.sameDayOnly !== false;
  const todayDay: TournamentDayKind = tournamentDayKind(opts.now);

  // If we're on a tournament day and restricting, only emit that day's windows.
  // If we're outside both tournament days, fall back to showing all (pre- or post-event context).
  const allDays: { day: "Saturday" | "Sunday"; date: DateTime }[] = [
    { day: "Saturday", date: sat },
    { day: "Sunday", date: sun },
  ];
  const days =
    sameDayOnly && todayDay
      ? allDays.filter((d) => d.day === todayDay)
      : allDays;

  const trend = computeDailyTrend(leaderboard, opts.now, opts.placesPaid);
  const maxAhead = opts.maxMinutesAhead ?? 48 * 60;

  const out: WindowForecast[] = [];

  for (const { day, date } of days) {
    for (const w of PAYOUT_WINDOWS) {
      const { start, end } = windowBounds(date, w);
      const minutesUntilStart = (start.toMillis() - simDt.toMillis()) / 60000;
      const minutesUntilEnd = (end.toMillis() - simDt.toMillis()) / 60000;
      if (minutesUntilStart > maxAhead) continue;

      let fc: WindowForecast;
      if (minutesUntilEnd <= 0) {
        fc = forecastPastWindow(opts, day, w, leaderboard);
      } else if (minutesUntilStart <= 0 && minutesUntilEnd > 0) {
        // Current window — reuse the smart live+history estimator.
        const period = findPeriod(leaderboard, day, w);
        const ws = sortedWeights(period);
        const totalMin = Math.max(1, w.endMinutes - w.startMinutes);
        const elapsed = Math.max(0, totalMin - minutesUntilEnd);
        const live = estimatePayoutLikelihood({
          fishWeightLb: opts.fishWeightLb,
          day,
          windowId: w.id,
          currentBubbleLb: ws.length > 0 ? ws[Math.min(ws.length, opts.placesPaid) - 1]! : null,
          rowCount: ws.length,
          currentWeightsLb: ws,
          minutesElapsedInWindow: elapsed,
          windowTotalMinutes: totalMin,
          placesPaidOverride: opts.placesPaid,
        });
        fc = {
          day,
          windowId: w.id,
          key: `${day}-W${w.id}`,
          label: `${day} ${w.label}`,
          status: "current",
          startsAtISO: "",
          endsAtISO: "",
          minutesUntilStart: 0,
          minutesUntilEnd,
          rowCount: ws.length,
          liveBubbleLb: ws.length > 0 ? ws[Math.min(ws.length, opts.placesPaid) - 1]! : null,
          historicalMeanLb: live.historicalMeanLb,
          trendAdjustedMeanLb: null,
          projectedFinalBubbleLb: live.projectedFinalBubbleLb,
          projectedFinalBubbleSigmaLb: live.projectedFinalBubbleSigmaLb,
          fishWeightAtWeighInLb: opts.fishWeightLb,
          payoutLikelihoodPercent: live.percent,
          projectedRank: live.projectedRank,
          pastFinalRank: null,
        };
      } else {
        fc = forecastFutureWindow(opts, day, w, trend, minutesUntilStart);
      }

      fc.startsAtISO = start.toISO() ?? start.toString();
      fc.endsAtISO = end.toISO() ?? end.toString();
      out.push(fc);
    }
  }

  return { windows: out, trend, todayDay };
}

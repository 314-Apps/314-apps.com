import { DateTime } from "luxon";
import type { LeaderboardRow, ParsedLeaderboard, PeriodSection } from "./types.js";
import { PAYOUT_WINDOWS, type PayoutWindowDef } from "./payoutWindows.js";

const TZ = "America/Chicago";

const MOCK_PERIODS: { day: "Saturday" | "Sunday"; h2: string; label: string }[] = [
  { day: "Saturday", h2: "Saturday: 6:30am-9am", label: "6:30am-9am" },
  { day: "Saturday", h2: "Saturday: 9:01am-11am", label: "9:01am-11am" },
  { day: "Saturday", h2: "Saturday: 11:01am-1pm", label: "11:01am-1pm" },
  { day: "Saturday", h2: "Saturday: 1:01pm-3pm", label: "1:01pm-3pm" },
  { day: "Sunday", h2: "Sunday: 6:30am-9am", label: "6:30am-9am" },
  { day: "Sunday", h2: "Sunday: 9:01am-11am", label: "9:01am-11am" },
  { day: "Sunday", h2: "Sunday: 11:01am-1pm", label: "11:01am-1pm" },
  { day: "Sunday", h2: "Sunday: 1:01pm-3pm", label: "1:01pm-3pm" },
];

/** Target 45th-place cutoff by period (historical averages from the calibration data). */
const TARGET_W45_BY_KEY: Record<string, number> = {
  "Saturday-W1": 4.39,
  "Saturday-W2": 4.48,
  "Saturday-W3": 4.48,
  "Saturday-W4": 4.27,
  "Sunday-W1": 4.08,
  "Sunday-W2": 3.9,
  "Sunday-W3": 3.98,
  "Sunday-W4": 3.99,
};

const FIRST = [
  "Tyler", "Jordan", "Morgan", "Chris", "Alex", "Sam", "Casey", "Riley", "Jamie",
  "Drew", "Blake", "Taylor", "Logan", "Cody", "Dakota", "Shane", "Parker", "Hunter",
  "Mason", "Avery", "Rowan", "Quinn", "Bryce", "Carter", "Dalton", "Easton", "Finn",
  "Garrett", "Hayden", "Isaac", "Jace", "Kyle", "Levi", "Micah", "Nolan",
];
const LAST = [
  "Miller", "Johnson", "Williams", "Brown", "Davis", "Wilson", "Moore", "Taylor",
  "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson",
  "Garcia", "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee",
  "Walker", "Hall", "Allen", "Young", "King", "Wright", "Scott", "Green",
  "Adams", "Baker", "Nelson",
];

function saturdayOfWeekContaining(dt: DateTime): DateTime {
  const wd = dt.weekday;
  const daysBack = wd === 6 ? 0 : wd === 7 ? 1 : wd + 1;
  return dt.startOf("day").minus({ days: daysBack });
}

function eventSaturday(sim: DateTime): DateTime {
  const env = process.env.BBB_SATURDAY_DATE?.trim();
  if (env) return DateTime.fromISO(env, { zone: TZ }).startOf("day");
  return saturdayOfWeekContaining(sim).startOf("day");
}

function eventSunday(sim: DateTime): DateTime {
  const env = process.env.BBB_SUNDAY_DATE?.trim();
  if (env) return DateTime.fromISO(env, { zone: TZ }).startOf("day");
  return eventSaturday(sim).plus({ days: 1 });
}

function windowForPeriodIndex(idx: number): PayoutWindowDef {
  return PAYOUT_WINDOWS[idx % 4]!;
}

function periodBounds(
  sim: DateTime,
  day: "Saturday" | "Sunday",
  win: PayoutWindowDef,
): { start: DateTime; end: DateTime } {
  const base = day === "Saturday" ? eventSaturday(sim) : eventSunday(sim);
  const start = base.plus({ minutes: win.startMinutes });
  const end = base.plus({ minutes: win.endMinutes });
  return { start, end };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

interface ScheduledWeighIn {
  at: DateTime;
  weightLb: number;
  name: string;
  station: string;
}

interface Schedule {
  /** One list per index into MOCK_PERIODS, arrival-time ascending. */
  periods: ScheduledWeighIn[][];
}

const scheduleCache = new Map<string, Schedule>();

function displayCap(): number {
  const n = Number.parseInt(process.env.MOCK_DISPLAY_CAP || "46", 10);
  return Number.isFinite(n) && n > 0 ? n : 46;
}

function weighinsPerPeriod(): number {
  const n = Number.parseInt(process.env.MOCK_WEIGHINS_PER_PERIOD || "58", 10);
  return Number.isFinite(n) && n >= 10 ? n : 58;
}

/**
 * Build a fixed schedule of weigh-ins for a single period.
 *
 * Design:
 *  - N total weigh-ins distributed over the window (most of the action in the middle
 *    ~80% of the window, a little slower at the very start and end).
 *  - Weight distribution is deterministically shaped so that the final (N → end) 45th-place
 *    cutoff lands near the historical target μ for this period, with a long upper tail
 *    (a few 6–7+ lb fish) and a thin lower tail.
 *  - Weights and arrival times are uncorrelated (any-size fish can hit at any time).
 */
function buildPeriodSchedule(
  start: DateTime,
  end: DateTime,
  target45: number,
  seed: number,
): ScheduledWeighIn[] {
  const rng = mulberry32(seed);
  const N = weighinsPerPeriod();

  // Weights: by rank (0 = biggest, N-1 = smallest).
  // Use a smooth curve that passes near target45 at rank 44 (the 45th place).
  const weights: number[] = [];
  for (let rank = 0; rank < N; rank++) {
    const normalized = rank / 44; // 0 at top, 1 at 45th place
    let base: number;
    if (normalized <= 1) {
      // Above-or-at bubble: exponential-ish decay from ~target45+3.1 to target45.
      base = target45 + 3.1 * Math.pow(1 - normalized, 1.85);
    } else {
      // Below bubble: linear drop to ~target45 - 1.2 at the bottom.
      const belowFrac = (normalized - 1) / Math.max(0.01, (N - 1) / 44 - 1);
      base = target45 - 1.25 * belowFrac;
    }
    // Add small jitter so weights aren't perfectly monotonic — makes the board look real.
    const jitter = (rng() - 0.5) * 0.22;
    weights.push(Math.max(0.5, base + jitter));
  }

  // Arrival time shape: slight dip at the start (tournament just opened) and end (pros waiting)
  // with heavy action through the middle. Implement as a CDF via accept-reject lite.
  const arrivalsFrac: number[] = [];
  const rng2 = mulberry32(seed ^ 0xc0ffee);
  while (arrivalsFrac.length < N) {
    const u = rng2();
    // Density ~ sin(pi*u)^0.7 — peaks in middle, thins at ends.
    const density = Math.pow(Math.sin(Math.PI * u), 0.7);
    if (rng2() < density) arrivalsFrac.push(u);
  }
  arrivalsFrac.sort((a, b) => a - b);

  // Pair weights with arrival times uncorrelated.
  const shuffled = [...weights];
  const rng3 = mulberry32(seed ^ 0xdeadbeef);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng3() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  const durMs = end.toMillis() - start.toMillis();
  const nameRng = mulberry32(seed ^ 0xfeedface);
  const result: ScheduledWeighIn[] = [];
  for (let i = 0; i < N; i++) {
    const at = start.plus({ milliseconds: arrivalsFrac[i]! * durMs });
    const w = Math.round(shuffled[i]! * 100) / 100;
    const first = FIRST[Math.floor(nameRng() * FIRST.length)]!;
    const last = LAST[Math.floor(nameRng() * LAST.length)]!;
    const station = `WS ${Math.floor(nameRng() * 8) + 1}`;
    result.push({
      at,
      weightLb: w,
      name: `${first} ${last}`,
      station,
    });
  }
  return result;
}

function getOrBuildSchedule(simDt: DateTime, seedBase: number): Schedule {
  const satISO = eventSaturday(simDt).toISODate() ?? "unknown";
  const cacheKey = `${satISO}|${seedBase}|${weighinsPerPeriod()}`;
  const cached = scheduleCache.get(cacheKey);
  if (cached) return cached;

  const periods: ScheduledWeighIn[][] = MOCK_PERIODS.map((p, idx) => {
    const win = windowForPeriodIndex(idx);
    const { start, end } = periodBounds(simDt, p.day, win);
    const key = `${p.day}-W${win.id}`;
    const target = TARGET_W45_BY_KEY[key] ?? 4.2;
    const periodSeed =
      (seedBase +
        idx * 2654435761 +
        hashString(key) +
        hashString(satISO)) >>>
      0;
    return buildPeriodSchedule(start, end, target, periodSeed);
  });

  const schedule: Schedule = { periods };
  scheduleCache.set(cacheKey, schedule);
  return schedule;
}

/** Called by tests or when tuning to force a regeneration. */
export function __resetMockScheduleCache(): void {
  scheduleCache.clear();
}

/**
 * Builds a realistic, monotonically-growing mock leaderboard:
 *   - Each period has a fixed schedule of weigh-ins (deterministic per weekend + seed).
 *   - At the current sim time, the board shows every weigh-in whose arrival ≤ sim,
 *     sorted by weight desc (like a real leaderboard).
 *   - A fish is never removed — it can only be pushed below the display cap as more
 *     (bigger) fish weigh in.
 */
export function buildMockLeaderboard(sim: Date): ParsedLeaderboard {
  const simDt = DateTime.fromJSDate(sim, { zone: TZ });
  const extraSeed = Number.parseInt(process.env.MOCK_RANDOM_SEED || "12345", 10) || 12345;
  const cap = displayCap();
  const schedule = getOrBuildSchedule(simDt, extraSeed);

  const periods: PeriodSection[] = MOCK_PERIODS.map((p, idx) => {
    const list = schedule.periods[idx] ?? [];
    const arrived = list.filter((w) => w.at.toMillis() <= simDt.toMillis());
    // Leaderboard sort: heaviest first. Ties broken by earlier arrival (seniority).
    const ranked = arrived
      .slice()
      .sort((a, b) => {
        if (b.weightLb !== a.weightLb) return b.weightLb - a.weightLb;
        return a.at.toMillis() - b.at.toMillis();
      })
      .slice(0, cap);

    const rows: LeaderboardRow[] = ranked.map((w, i) => ({
      rank: String(i + 1),
      name: w.name,
      weighStation: w.station,
      weightRaw: `${w.weightLb.toFixed(2)} lbs`,
      weightLb: w.weightLb,
    }));

    return {
      day: p.day,
      h2: p.h2,
      label: p.label,
      rows,
    };
  });

  return {
    sourceUrl: "mock://big-bass-bash-time-sim",
    fetchedAt: new Date().toISOString(),
    periods,
  };
}

export function isMockLeaderboardEnabled(): boolean {
  const v = process.env.USE_MOCK_LEADERBOARD?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

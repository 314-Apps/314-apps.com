/**
 * Read-only helper that reads the on-disk hourly weather files the collector writes and produces a
 * single "lake-average" current-hour snapshot for the /fish Live Leaderboard UI.
 *
 * Strategy:
 *   1. Resolve today's Chicago date; if that day's file does not exist (e.g. just past midnight
 *      before the first tick), fall back to yesterday's file.
 *   2. Pick each station's "current" hour: the row with hourStartMs <= now < hourStartMs + 3_600_000.
 *      If no such row exists (edge of file), pick the latest row whose hourStartMs <= now.
 *   3. Pick each station's "-3h" row using the same rule at (now - 3h), for the pressure trend.
 *   4. Average numeric fields across stations, skipping nulls. For windDeg use a vector mean
 *      (sin/cos) so 350° and 10° average near 0°, not 180°.
 *   5. Classify the 3h pressure delta with a ±0.3 hPa deadband into rising/steady/falling.
 *
 * No feedback into the recommendation engine — display only.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DateTime } from "luxon";
import type { WeatherHour } from "./weatherOpenMeteo.js";
import type { WeatherDayFile, WeatherStationFileEntry } from "./weatherCollector.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WEATHER_DIR = path.resolve(__dirname, "..", "..", "data", "weather");
const TZ = "America/Chicago";
const HOUR_MS = 3_600_000;
const TREND_WINDOW_MS = 3 * HOUR_MS;
const PRESSURE_DEADBAND_HPA = 0.3;

export type PressureDirection = "rising" | "steady" | "falling";

export interface WeatherSnapshot {
  asOfMs: number;
  stationsUsed: number;
  tempF: number | null;
  windMph: number | null;
  gustMph: number | null;
  windDeg: number | null;
  pressureHpa: number | null;
  pressureTrend: {
    deltaHpa3h: number | null;
    direction: PressureDirection | null;
  };
  humidityPct: number | null;
  cloudCoverPct: number | null;
  precipMm: number | null;
}

export interface BuildSnapshotOpts {
  nowMs?: number;
  weatherDir?: string;
}

function chicagoIsoDate(nowMs: number): string {
  return DateTime.fromMillis(nowMs, { zone: TZ }).toISODate() ?? "";
}

function addDays(isoDate: string, days: number): string {
  const dt = DateTime.fromISO(isoDate, { zone: TZ });
  return dt.plus({ days }).toISODate() ?? isoDate;
}

function readDayFile(weatherDir: string, date: string): WeatherDayFile | null {
  const file = path.join(weatherDir, `${date}.json`);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as WeatherDayFile;
    if (!parsed || typeof parsed !== "object" || !parsed.stations) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Pick the row whose bucket contains `targetMs` (hourStartMs <= targetMs < hourStartMs + 1h).
 * If none matches (file doesn't cover that time), fall back to the latest row with
 * hourStartMs <= targetMs. Returns null if no usable row exists.
 */
function pickHourRow(hourly: WeatherHour[], targetMs: number): WeatherHour | null {
  if (!Array.isArray(hourly) || hourly.length === 0) return null;
  let best: WeatherHour | null = null;
  for (const row of hourly) {
    if (!row || typeof row.hourStartMs !== "number") continue;
    if (row.hourStartMs <= targetMs && targetMs < row.hourStartMs + HOUR_MS) {
      return row;
    }
    if (row.hourStartMs <= targetMs && (!best || row.hourStartMs > best.hourStartMs)) {
      best = row;
    }
  }
  return best;
}

function avgNonNull(values: Array<number | null | undefined>): number | null {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    sum += v;
    n += 1;
  }
  return n > 0 ? sum / n : null;
}

/** Vector mean for compass bearings so 350° and 10° average to ~0°, not 180°. */
function avgBearing(values: Array<number | null | undefined>): number | null {
  let sumSin = 0;
  let sumCos = 0;
  let n = 0;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    const rad = (v * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
    n += 1;
  }
  if (n === 0) return null;
  if (sumSin === 0 && sumCos === 0) return null;
  const deg = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
  const norm = ((deg % 360) + 360) % 360;
  return norm;
}

function round(n: number | null, digits: number): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function classifyPressure(deltaHpa3h: number | null): PressureDirection | null {
  if (deltaHpa3h == null || !Number.isFinite(deltaHpa3h)) return null;
  if (deltaHpa3h > PRESSURE_DEADBAND_HPA) return "rising";
  if (deltaHpa3h < -PRESSURE_DEADBAND_HPA) return "falling";
  return "steady";
}

function loadDayWithFallback(
  weatherDir: string,
  nowMs: number,
): WeatherDayFile | null {
  const today = chicagoIsoDate(nowMs);
  const todayFile = readDayFile(weatherDir, today);
  if (todayFile) return todayFile;
  const yesterday = addDays(today, -1);
  return readDayFile(weatherDir, yesterday);
}

/**
 * Build the current-hour lake-average snapshot. Returns null when no day file is available at all
 * (caller should respond 503 `no-data`).
 */
export function buildWeatherSnapshot(opts: BuildSnapshotOpts = {}): WeatherSnapshot | null {
  const nowMs = opts.nowMs ?? Date.now();
  const weatherDir = opts.weatherDir ?? DEFAULT_WEATHER_DIR;
  const day = loadDayWithFallback(weatherDir, nowMs);
  if (!day) return null;

  const stations: WeatherStationFileEntry[] = Object.values(day.stations ?? {});
  const currentRows: WeatherHour[] = [];
  const priorRows: WeatherHour[] = [];
  for (const st of stations) {
    const cur = pickHourRow(st.hourly ?? [], nowMs);
    if (cur) currentRows.push(cur);
    const prior = pickHourRow(st.hourly ?? [], nowMs - TREND_WINDOW_MS);
    if (prior) priorRows.push(prior);
  }

  const pressureNow = avgNonNull(currentRows.map((r) => r.pressureHpa));
  const pressurePrior = avgNonNull(priorRows.map((r) => r.pressureHpa));
  const deltaHpa3h =
    pressureNow != null && pressurePrior != null ? pressureNow - pressurePrior : null;
  const direction = classifyPressure(deltaHpa3h);

  const asOfMs = currentRows.reduce(
    (mx, r) => (r.hourStartMs > mx ? r.hourStartMs : mx),
    0,
  );

  return {
    asOfMs: asOfMs || nowMs,
    stationsUsed: currentRows.length,
    tempF: round(avgNonNull(currentRows.map((r) => r.tempF)), 1),
    windMph: round(avgNonNull(currentRows.map((r) => r.windMph)), 1),
    gustMph: round(avgNonNull(currentRows.map((r) => r.gustMph)), 1),
    windDeg: round(avgBearing(currentRows.map((r) => r.windDeg)), 0),
    pressureHpa: round(pressureNow, 1),
    pressureTrend: {
      deltaHpa3h: round(deltaHpa3h, 1),
      direction,
    },
    humidityPct: round(avgNonNull(currentRows.map((r) => r.humidityPct)), 0),
    cloudCoverPct: round(avgNonNull(currentRows.map((r) => r.cloudCoverPct)), 0),
    precipMm: round(avgNonNull(currentRows.map((r) => r.precipMm)), 2),
  };
}

/**
 * Hourly weather collector (Open-Meteo). Runs in-process alongside the leaderboard scraper.
 *
 * On each tick:
 *   1. Resolve today's Chicago date.
 *   2. For every weigh station in weigh-station-locations.json, fetch hourly observations from the
 *      Open-Meteo forecast endpoint (which includes past hours for today + the near-future forecast
 *      when start_date is today). Failures are isolated per station.
 *   3. Merge into server/data/weather/{date}.json, preserving previously stored stations whose
 *      fetch failed this round (partial-update tolerance).
 *
 * Schedule: fires once on startup (after a short delay) and every WEATHER_HOURLY_INTERVAL_MS.
 * Disable with WEATHER_COLLECT_ENABLED=false.
 *
 * Storage layout (weather/{date}.json):
 *   { date, source, fetchedAt, stations: { [canonicalKey]: { lat, lon, label, hourly: WeatherHour[] } } }
 *
 * Collection-only module — nothing here feeds the recommendation engine yet.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DateTime } from "luxon";
import { fetchOpenMeteoHourly, type WeatherHour } from "./weatherOpenMeteo.js";
import { loadWeatherStations, type WeatherStation } from "./weatherStations.js";
import {
  fetchAmerenSurfaceWaterTemp,
  type WaterTempReading,
} from "./waterTempAmeren.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const WEATHER_DIR = path.join(DATA_DIR, "weather");
const WATER_TEMP_DIR = path.join(DATA_DIR, "water-temp");
const TZ = "America/Chicago";

export interface WeatherStationFileEntry {
  lat: number;
  lon: number;
  label: string;
  hourly: WeatherHour[];
}

export interface WeatherDayFile {
  date: string;
  source: "open-meteo:archive" | "open-meteo:forecast";
  fetchedAt: string;
  stations: Record<string, WeatherStationFileEntry>;
}

function chicagoIsoDate(nowMs: number = Date.now()): string {
  return DateTime.fromMillis(nowMs, { zone: TZ }).toISODate() ?? "";
}

function readWeatherDayFile(date: string): WeatherDayFile | null {
  const file = path.join(WEATHER_DIR, `${date}.json`);
  if (!existsSync(file)) return null;
  try {
    const text = readFileSync(file, "utf8");
    return JSON.parse(text) as WeatherDayFile;
  } catch {
    return null;
  }
}

function writeWeatherDayFile(file: WeatherDayFile): string {
  mkdirSync(WEATHER_DIR, { recursive: true });
  const out = path.join(WEATHER_DIR, `${file.date}.json`);
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  return out;
}

function readWaterTempFile(date: string): WaterTempReading & { date?: string } | null {
  const file = path.join(WATER_TEMP_DIR, `${date}.json`);
  if (!existsSync(file)) return null;
  try {
    const text = readFileSync(file, "utf8");
    return JSON.parse(text) as WaterTempReading & { date?: string };
  } catch {
    return null;
  }
}

function writeWaterTempFile(date: string, reading: WaterTempReading): string {
  mkdirSync(WATER_TEMP_DIR, { recursive: true });
  const out = path.join(WATER_TEMP_DIR, `${date}.json`);
  writeFileSync(out, `${JSON.stringify({ date, ...reading }, null, 2)}\n`, "utf8");
  return out;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function envEnabled(name: string, defaultOn: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw == null || raw === "") return defaultOn;
  return raw !== "false" && raw !== "0" && raw !== "no";
}

/**
 * One weather tick. Exported for testing / manual invocation. Returns the number of stations that
 * produced fresh hourly data this round (not counting preserved stale stations).
 */
export async function runWeatherTick(
  nowMs: number = Date.now(),
  stations: WeatherStation[] = loadWeatherStations(),
): Promise<{ date: string; freshCount: number; preservedCount: number; file: string }> {
  const date = chicagoIsoDate(nowMs);
  const existing = readWeatherDayFile(date);
  const merged: WeatherDayFile = existing ?? {
    date,
    source: "open-meteo:forecast",
    fetchedAt: new Date(nowMs).toISOString(),
    stations: {},
  };
  merged.source = "open-meteo:forecast";
  merged.fetchedAt = new Date(nowMs).toISOString();

  let freshCount = 0;
  let preservedCount = 0;

  for (const st of stations) {
    try {
      const hourly = await fetchOpenMeteoHourly({
        lat: st.lat,
        lon: st.lon,
        startIsoDay: date,
        endIsoDay: date,
        mode: "forecast",
      });
      merged.stations[st.key] = {
        lat: st.lat,
        lon: st.lon,
        label: st.label,
        hourly,
      };
      freshCount += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[weather] ${st.key}: ${msg}`);
      if (merged.stations[st.key]) preservedCount += 1;
    }
    await sleep(200);
  }

  const outFile = writeWeatherDayFile(merged);
  return { date, freshCount, preservedCount, file: outFile };
}

/**
 * Fetch today's Ameren surface water temperature and persist it to water-temp/{date}.json.
 * On fetch failure, leaves any existing file intact.
 */
export async function runWaterTempTick(
  nowMs: number = Date.now(),
): Promise<{ date: string; ok: boolean; file: string | null }> {
  const date = chicagoIsoDate(nowMs);
  try {
    const reading = await fetchAmerenSurfaceWaterTemp();
    const outFile = writeWaterTempFile(date, reading);
    return { date, ok: true, file: outFile };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[water-temp] fetch failed: ${msg}`);
    const existing = readWaterTempFile(date);
    return { date, ok: false, file: existing ? path.join(WATER_TEMP_DIR, `${date}.json`) : null };
  }
}

export interface WeatherCollectorHandle {
  stop: () => void;
}

/**
 * Start the hourly weather collector. Safe to call once at process boot.
 * Respects WEATHER_COLLECT_ENABLED (default true) and WEATHER_HOURLY_INTERVAL_MS (default 3600000).
 */
export function startWeatherCollector(): WeatherCollectorHandle | null {
  if (!envEnabled("WEATHER_COLLECT_ENABLED", true)) {
    console.log("[weather] collection disabled (WEATHER_COLLECT_ENABLED=false)");
    return null;
  }

  const rawInterval = Number.parseInt(process.env.WEATHER_HOURLY_INTERVAL_MS || "3600000", 10);
  const intervalMs = Number.isFinite(rawInterval) && rawInterval > 60_000 ? rawInterval : 3_600_000;
  const waterTempEnabled = envEnabled("WATER_TEMP_COLLECT_ENABLED", true);

  let lastWaterTempDay: string | null = null;

  const tick = (): void => {
    void (async () => {
      const now = Date.now();
      try {
        const r = await runWeatherTick(now);
        console.log(
          `[weather] ${r.date}: ${r.freshCount} stations fresh` +
            (r.preservedCount > 0 ? `, ${r.preservedCount} preserved from prior fetch` : "") +
            ` -> ${path.relative(process.cwd(), r.file)}`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[weather] tick failed: ${msg}`);
      }

      if (waterTempEnabled) {
        const today = chicagoIsoDate(now);
        if (today !== lastWaterTempDay) {
          try {
            const r = await runWaterTempTick(now);
            if (r.ok && r.file) {
              lastWaterTempDay = today;
              console.log(`[water-temp] ${r.date}: updated -> ${path.relative(process.cwd(), r.file)}`);
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[water-temp] tick failed: ${msg}`);
          }
        }
      }
    })();
  };

  const handle = setInterval(tick, intervalMs);
  setTimeout(tick, 10_000);
  console.log(`[weather] auto-collect every ${intervalMs}ms (set WEATHER_COLLECT_ENABLED=false to disable)`);
  return { stop: () => clearInterval(handle) };
}

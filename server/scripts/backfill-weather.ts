/**
 * Backfill per-station hourly weather for historical BBB tournament dates from Open-Meteo archive.
 *
 * Usage:
 *   npx tsx server/scripts/backfill-weather.ts
 *   npx tsx server/scripts/backfill-weather.ts --year=2024
 *   npx tsx server/scripts/backfill-weather.ts --date=2024-04-20
 *
 * Reads dates from server/data/historical-tournament-dates.json, loads the station list from
 * server/data/weigh-station-locations.json, and writes one consolidated file per date to
 * server/data/weather/{date}.json (same layout as the live collector).
 *
 * Idempotent: each date is fully rewritten on every run.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchOpenMeteoHourly } from "../src/lib/weatherOpenMeteo.js";
import { loadWeatherStations } from "../src/lib/weatherStations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");
const DATES_FILE = path.join(DATA_DIR, "historical-tournament-dates.json");
const WEATHER_DIR = path.join(DATA_DIR, "weather");

interface ParsedArgs {
  year?: string;
  singleDate?: string;
}

function parseArgs(): ParsedArgs {
  const out: ParsedArgs = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--year=")) out.year = a.slice("--year=".length).trim();
    else if (a.startsWith("--date=")) out.singleDate = a.slice("--date=".length).trim();
  }
  return out;
}

function loadDates(): string[] {
  const raw = JSON.parse(readFileSync(DATES_FILE, "utf8")) as Record<string, unknown>;
  const out: string[] = [];
  for (const [key, val] of Object.entries(raw)) {
    if (key.startsWith("_")) continue;
    if (!Array.isArray(val)) continue;
    for (const d of val) {
      if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) out.push(d);
    }
  }
  return Array.from(new Set(out)).sort();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function backfillDate(date: string): Promise<{ stationsOk: number; stationsFailed: number }> {
  const stations = loadWeatherStations();
  const filePayload: {
    date: string;
    source: "open-meteo:archive";
    fetchedAt: string;
    stations: Record<string, { lat: number; lon: number; label: string; hourly: unknown[] }>;
  } = {
    date,
    source: "open-meteo:archive",
    fetchedAt: new Date().toISOString(),
    stations: {},
  };

  let ok = 0;
  let failed = 0;
  for (const st of stations) {
    try {
      const hourly = await fetchOpenMeteoHourly({
        lat: st.lat,
        lon: st.lon,
        startIsoDay: date,
        endIsoDay: date,
        mode: "archive",
      });
      filePayload.stations[st.key] = {
        lat: st.lat,
        lon: st.lon,
        label: st.label,
        hourly,
      };
      ok += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ${date} / ${st.key}: ${msg}`);
      failed += 1;
    }
    await sleep(200);
  }

  mkdirSync(WEATHER_DIR, { recursive: true });
  const outFile = path.join(WEATHER_DIR, `${date}.json`);
  writeFileSync(outFile, `${JSON.stringify(filePayload, null, 2)}\n`, "utf8");
  console.log(
    `${date}: ${ok} stations ok, ${failed} failed -> ${path.relative(process.cwd(), outFile)}`,
  );
  return { stationsOk: ok, stationsFailed: failed };
}

async function main(): Promise<void> {
  const args = parseArgs();
  let dates: string[];
  if (args.singleDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.singleDate)) {
      console.error("--date must be YYYY-MM-DD");
      process.exit(1);
    }
    dates = [args.singleDate];
  } else {
    dates = loadDates();
    if (args.year) dates = dates.filter((d) => d.startsWith(`${args.year}-`));
  }

  if (dates.length === 0) {
    console.log("No dates to backfill.");
    return;
  }

  let totalOk = 0;
  let totalFailed = 0;
  for (const d of dates) {
    const { stationsOk, stationsFailed } = await backfillDate(d);
    totalOk += stationsOk;
    totalFailed += stationsFailed;
  }
  console.log(
    `Backfill complete: ${totalOk} station-day fetches ok, ${totalFailed} failed across ${dates.length} date(s).`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : String(e));
  process.exit(1);
});

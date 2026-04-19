/**
 * Load the list of weigh stations used for per-location weather fetches.
 * Source of truth: server/data/weigh-station-locations.json (same file the /fish map uses).
 *
 * Keys are already canonicalized (see weighStationNormalize.ts) so they line up 1:1 with
 * `weighStation` values emitted by trainingCapture / fishArrivals.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOCATIONS_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "data",
  "weigh-station-locations.json",
);

export interface WeatherStation {
  key: string;
  label: string;
  lat: number;
  lon: number;
}

interface LocationEntry {
  lat: unknown;
  lng: unknown;
  label?: unknown;
}

interface LocationsFile {
  _readme?: string;
  _aliases?: Record<string, string>;
  [canonicalKey: string]: string | Record<string, string> | LocationEntry | undefined;
}

function isLocationEntry(v: unknown): v is LocationEntry {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.lat === "number" && typeof o.lng === "number";
}

export function parseWeatherStations(fileContents: LocationsFile): WeatherStation[] {
  const out: WeatherStation[] = [];
  const seen = new Set<string>();
  for (const [key, value] of Object.entries(fileContents)) {
    if (key.startsWith("_")) continue;
    if (!isLocationEntry(value)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const lat = value.lat as number;
    const lon = value.lng as number;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const label = typeof value.label === "string" && value.label.trim().length > 0
      ? value.label
      : key;
    out.push({ key, label, lat, lon });
  }
  out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return out;
}

export function loadWeatherStations(filePath: string = DEFAULT_LOCATIONS_PATH): WeatherStation[] {
  const text = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(text) as LocationsFile;
  return parseWeatherStations(parsed);
}

/**
 * Minimal Open-Meteo client for hourly weather observations / reanalysis.
 *
 * Free, no API key. We hit two endpoints depending on the date:
 *   - archive: https://archive-api.open-meteo.com/v1/archive  (ERA5 reanalysis, ~5 day lag)
 *   - forecast: https://api.open-meteo.com/v1/forecast         (current + near past via past_days)
 *
 * Units are requested in our native preferred set (F, mph, hPa, mm, %) so no conversion is needed.
 * Times are requested as unix seconds (`timeformat=unixtime`) so hour alignment is trivial.
 *
 * Collection-only module — no storage, no scheduling. Live collector + backfill script call this.
 */

export interface WeatherHour {
  hourStartMs: number;
  tempF: number | null;
  windMph: number | null;
  gustMph: number | null;
  windDeg: number | null;
  pressureHpa: number | null;
  cloudCoverPct: number | null;
  precipMm: number | null;
  humidityPct: number | null;
}

export interface FetchOpenMeteoHourlyOpts {
  lat: number;
  lon: number;
  /** Inclusive start date, YYYY-MM-DD (America/Chicago calendar date). */
  startIsoDay: string;
  /** Inclusive end date, YYYY-MM-DD. */
  endIsoDay: string;
  mode: "archive" | "forecast";
  /** Abort signal for cancellation / timeouts. */
  signal?: AbortSignal;
}

const HOURLY_VARS = [
  "temperature_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "pressure_msl",
  "cloud_cover",
  "precipitation",
  "relative_humidity_2m",
] as const;

interface OpenMeteoHourlyJson {
  hourly?: {
    time?: unknown;
    temperature_2m?: unknown;
    wind_speed_10m?: unknown;
    wind_direction_10m?: unknown;
    wind_gusts_10m?: unknown;
    pressure_msl?: unknown;
    cloud_cover?: unknown;
    precipitation?: unknown;
    relative_humidity_2m?: unknown;
  };
  error?: boolean;
  reason?: string;
}

function endpointFor(mode: FetchOpenMeteoHourlyOpts["mode"]): string {
  if (mode === "archive") return "https://archive-api.open-meteo.com/v1/archive";
  return "https://api.open-meteo.com/v1/forecast";
}

function buildUrl(opts: FetchOpenMeteoHourlyOpts): string {
  const u = new URL(endpointFor(opts.mode));
  u.searchParams.set("latitude", String(opts.lat));
  u.searchParams.set("longitude", String(opts.lon));
  u.searchParams.set("start_date", opts.startIsoDay);
  u.searchParams.set("end_date", opts.endIsoDay);
  u.searchParams.set("hourly", HOURLY_VARS.join(","));
  u.searchParams.set("temperature_unit", "fahrenheit");
  u.searchParams.set("wind_speed_unit", "mph");
  u.searchParams.set("precipitation_unit", "mm");
  u.searchParams.set("timezone", "America/Chicago");
  u.searchParams.set("timeformat", "unixtime");
  return u.toString();
}

function toNumOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

/** Parse an Open-Meteo hourly JSON response. Missing hours / fields surface as null, not NaN. */
export function parseOpenMeteoHourly(json: unknown): WeatherHour[] {
  const j = (json as OpenMeteoHourlyJson) ?? {};
  const h = j.hourly ?? {};
  const times = Array.isArray(h.time) ? h.time : [];
  const temp = Array.isArray(h.temperature_2m) ? h.temperature_2m : [];
  const wind = Array.isArray(h.wind_speed_10m) ? h.wind_speed_10m : [];
  const gust = Array.isArray(h.wind_gusts_10m) ? h.wind_gusts_10m : [];
  const dir = Array.isArray(h.wind_direction_10m) ? h.wind_direction_10m : [];
  const pres = Array.isArray(h.pressure_msl) ? h.pressure_msl : [];
  const cloud = Array.isArray(h.cloud_cover) ? h.cloud_cover : [];
  const precip = Array.isArray(h.precipitation) ? h.precipitation : [];
  const hum = Array.isArray(h.relative_humidity_2m) ? h.relative_humidity_2m : [];

  const out: WeatherHour[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const t = times[i];
    const tsSec = typeof t === "number" && Number.isFinite(t) ? t : null;
    if (tsSec == null) continue;
    out.push({
      hourStartMs: tsSec * 1000,
      tempF: toNumOrNull(temp[i]),
      windMph: toNumOrNull(wind[i]),
      gustMph: toNumOrNull(gust[i]),
      windDeg: toNumOrNull(dir[i]),
      pressureHpa: toNumOrNull(pres[i]),
      cloudCoverPct: toNumOrNull(cloud[i]),
      precipMm: toNumOrNull(precip[i]),
      humidityPct: toNumOrNull(hum[i]),
    });
  }
  return out;
}

export async function fetchOpenMeteoHourly(opts: FetchOpenMeteoHourlyOpts): Promise<WeatherHour[]> {
  const url = buildUrl(opts);
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) {
    throw new Error(`Open-Meteo ${opts.mode} ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as OpenMeteoHourlyJson;
  if (json.error) {
    throw new Error(`Open-Meteo ${opts.mode} error: ${json.reason ?? "unknown"}`);
  }
  return parseOpenMeteoHourly(json);
}

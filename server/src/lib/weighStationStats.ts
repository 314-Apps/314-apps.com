/**
 * Aggregate fish counts and weights by weigh-in station from live-training JSONL,
 * using the same merged-by-angler+weight leaderboard as the training UI ([`periodLeaderboardForDisplay`](../../scripts/evalShared.ts)).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  periodLeaderboardForDisplay,
  type DayKind,
  type PeriodKey,
  type TrainingSnap,
} from "../../scripts/evalShared.js";
import {
  canonicalWeighStationKey,
  formatWeighStationDisplay,
} from "./weighStationNormalize.js";

const __dirnamePath = path.dirname(fileURLToPath(import.meta.url));
const WEIGH_STATION_LOCATIONS_FILE = path.join(__dirnamePath, "..", "..", "data", "weigh-station-locations.json");

/** Alias for {@link canonicalWeighStationKey} (same bucket rules). */
export function normalizeWeighStationKey(raw: string): string {
  return canonicalWeighStationKey(raw);
}

export type WeighStationAgg = {
  stationKey: string;
  displayName: string;
  count: number;
  totalLb: number;
  maxLb: number;
  topFishName: string;
};

export type WeighStationStatsResult = {
  minLb: number;
  maxLb: number;
  periodFilter: PeriodKey | null;
  totalFishInFilter: number;
  periodsIncluded: PeriodKey[];
  overallTopFish: {
    name: string;
    weightLb: number;
    stationKey: string;
    stationDisplayName: string;
    periodKey: PeriodKey;
  } | null;
  stations: WeighStationAgg[];
};

const ALL_PERIODS: () => Array<{ day: DayKind; wid: 1 | 2 | 3 | 4; key: PeriodKey }> = () => {
  const out: Array<{ day: DayKind; wid: 1 | 2 | 3 | 4; key: PeriodKey }> = [];
  for (const day of ["Saturday", "Sunday"] as DayKind[]) {
    for (const wid of [1, 2, 3, 4] as const) {
      out.push({ day, wid, key: `${day}-W${wid}` as PeriodKey });
    }
  }
  return out;
};

function parsePeriodKey(key: string): { day: DayKind; wid: 1 | 2 | 3 | 4 } | null {
  const m = key.match(/^(Saturday|Sunday)-W([1-4])$/);
  if (!m) return null;
  return { day: m[1] as DayKind, wid: Number(m[2]) as 1 | 2 | 3 | 4 };
}

/**
 * @param periodFilter - If set, only that pay window; otherwise all eight Sat/Sun × W1–W4 with data.
 */
export function computeWeighStationStats(
  snaps: TrainingSnap[],
  options: {
    minLb: number;
    maxLb: number;
    placesPaidHeuristic: number;
    periodFilter?: PeriodKey | null;
  },
): WeighStationStatsResult {
  const minLb = Number.isFinite(options.minLb) ? options.minLb : 0;
  const maxLb = Number.isFinite(options.maxLb) ? options.maxLb : 100;
  const lo = Math.min(minLb, maxLb);
  const hi = Math.max(minLb, maxLb);
  const places = options.placesPaidHeuristic;

  const periodList =
    options.periodFilter && parsePeriodKey(options.periodFilter)
      ? [
          {
            ...parsePeriodKey(options.periodFilter)!,
            key: options.periodFilter,
          },
        ]
      : ALL_PERIODS();

  type Bucket = {
    displayName: string;
    count: number;
    totalLb: number;
    maxLb: number;
    topFishName: string;
  };

  const byStation = new Map<string, Bucket>();
  let overallTop: WeighStationStatsResult["overallTopFish"] = null;
  const periodsIncluded: PeriodKey[] = [];
  let totalFishInFilter = 0;

  for (const { day, wid, key } of periodList) {
    const payload = periodLeaderboardForDisplay(snaps, day, wid, places);
    if (payload.entries.length === 0) continue;

    let addedFromPeriod = false;
    for (const e of payload.entries) {
      const w = e.weightLb;
      if (w < lo || w > hi) continue;
      addedFromPeriod = true;
      totalFishInFilter += 1;

      const stationKey = canonicalWeighStationKey(e.weighStation);
      const displayName = formatWeighStationDisplay(stationKey);

      if (
        !overallTop ||
        w > overallTop.weightLb ||
        (w === overallTop.weightLb && e.name.localeCompare(overallTop.name) < 0)
      ) {
        overallTop = {
          name: e.name || "—",
          weightLb: w,
          stationKey,
          stationDisplayName: displayName,
          periodKey: key,
        };
      }

      let b = byStation.get(stationKey);
      if (!b) {
        b = {
          displayName,
          count: 0,
          totalLb: 0,
          maxLb: -Infinity,
          topFishName: "",
        };
        byStation.set(stationKey, b);
      }
      b.count += 1;
      b.totalLb += w;
      if (w > b.maxLb || (w === b.maxLb && (e.name || "").localeCompare(b.topFishName) < 0)) {
        b.maxLb = w;
        b.topFishName = e.name || "—";
      }
    }
    if (addedFromPeriod) periodsIncluded.push(key);
  }

  const stations: WeighStationAgg[] = Array.from(byStation.entries()).map(([stationKey, b]) => ({
    stationKey,
    displayName: b.displayName,
    count: b.count,
    totalLb: Math.round(b.totalLb * 1000) / 1000,
    maxLb: b.maxLb === -Infinity ? 0 : Math.round(b.maxLb * 1000) / 1000,
    topFishName: b.topFishName,
  }));

  stations.sort((a, b) => b.count - a.count || b.totalLb - a.totalLb);

  return {
    minLb: lo,
    maxLb: hi,
    periodFilter: options.periodFilter ?? null,
    totalFishInFilter,
    periodsIncluded: [...new Set(periodsIncluded)].sort(),
    overallTopFish: overallTop,
    stations,
  };
}

export type WeighStationLocation = { lat: number; lng: number; label?: string };

/** Curated lat/lng keyed by `canonicalWeighStationKey` (see `server/data/weigh-station-locations.json`). */
export function loadWeighStationLocations(): Record<string, WeighStationLocation> {
  if (!existsSync(WEIGH_STATION_LOCATIONS_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(WEIGH_STATION_LOCATIONS_FILE, "utf8")) as Record<string, unknown>;
    const out: Record<string, WeighStationLocation> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith("_")) continue;
      if (!v || typeof v !== "object") continue;
      const o = v as { lat?: unknown; lng?: unknown; label?: unknown };
      const lat = typeof o.lat === "number" ? o.lat : Number(o.lat);
      const lng = typeof o.lng === "number" ? o.lng : Number(o.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const canonK = canonicalWeighStationKey(k);
      if (canonK === "__unknown__") continue;
      out[canonK] = {
        lat,
        lng,
        label: typeof o.label === "string" ? o.label : undefined,
      };
    }
    const aliases = raw._aliases;
    if (aliases && typeof aliases === "object" && !Array.isArray(aliases)) {
      for (const [from, to] of Object.entries(aliases as Record<string, unknown>)) {
        if (typeof to !== "string") continue;
        const fromK = canonicalWeighStationKey(from);
        const toK = canonicalWeighStationKey(to);
        if (fromK === "__unknown__" || toK === "__unknown__") continue;
        const loc = out[toK];
        if (loc) out[fromK] = loc;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function attachLocationsToStations(
  stations: WeighStationAgg[],
  locations: Record<string, WeighStationLocation>,
): Array<WeighStationAgg & { lat?: number; lng?: number; locationLabel?: string }> {
  return stations.map((s) => {
    const loc = locations[s.stationKey];
    if (!loc) return { ...s };
    return {
      ...s,
      lat: loc.lat,
      lng: loc.lng,
      locationLabel: loc.label,
    };
  });
}

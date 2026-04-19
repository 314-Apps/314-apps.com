/**
 * Case-insensitive substring search for anglers across all captured training snapshots.
 *
 * Scans every `YYYY-MM-DD.jsonl` under {@link trainingDataDirectory}, and for each row whose
 * scraped `name` contains the query, collects one entry per unique fish (`fishEntryKey`).
 * "First seen" is the earliest `fetchedAtMs` across snapshots that contained that fish, and
 * the associated period label/day come from that earliest snapshot.
 *
 * Grouping key is `anglerKey = lowercased name | lowercased weigh station` (same as
 * {@link trainingCapture.ts}); an angler who weighed in at two different stations yields two
 * result cards, which matches how the leaderboard identifies them.
 *
 * Tournament-day filter: rows are only read from period blocks whose scraped `day` matches the
 * snapshot's `tournamentDay` (when present), mirroring `evalShared.ts` to avoid bogus
 * duplicate-day rows when the widget occasionally mirrors a Saturday window under Sunday.
 */
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { trainingDataDirectory } from "./trainingCapture.js";
import { loadJsonl, type TrainingSnap } from "../../scripts/evalShared.js";
import { displayWeighStationFromRaw } from "./weighStationNormalize.js";

const TZ = "America/Chicago";

export interface AnglerFishHit {
  weightLb: number | null;
  weightRaw: string;
  weighStation: string;
  tournamentDate: string;
  periodDay: string;
  periodLabel: string;
  firstSeenAtMs: number;
  firstSeenIso: string;
}

export interface AnglerSearchHit {
  anglerKey: string;
  displayName: string;
  weighStation: string;
  totalWeightLb: number;
  fishCount: number;
  fish: AnglerFishHit[];
}

export interface SearchAnglersOptions {
  q: string;
  limit?: number;
  /** Override directory for tests. Defaults to {@link trainingDataDirectory}. */
  dir?: string;
}

const DATE_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;
const DEFAULT_LIMIT = 25;

function formatChicagoIso(ms: number): string {
  const dt = DateTime.fromMillis(ms, { zone: TZ });
  return dt.isValid ? dt.toFormat("yyyy-LL-dd HH:mm:ss ZZZZ") : "";
}

interface FishAccumulator {
  weightLb: number | null;
  weightRaw: string;
  weighStation: string;
  tournamentDate: string;
  periodDay: string;
  periodLabel: string;
  firstSeenAtMs: number;
}

interface AnglerAccumulator {
  anglerKey: string;
  displayName: string;
  weighStation: string;
  fishByEntryKey: Map<string, FishAccumulator>;
}

function listTrainingDateFiles(dir: string): { date: string; file: string }[] {
  if (!existsSync(dir)) return [];
  const out: { date: string; file: string }[] = [];
  for (const entry of readdirSync(dir)) {
    const m = DATE_FILE_RE.exec(entry);
    if (!m) continue;
    out.push({ date: m[1]!, file: path.join(dir, entry) });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

export function searchAnglers(opts: SearchAnglersOptions): AnglerSearchHit[] {
  const rawQ = (opts.q ?? "").trim();
  if (rawQ.length === 0) return [];
  const needle = rawQ.toLowerCase();
  const limit =
    opts.limit != null && Number.isFinite(opts.limit) && opts.limit > 0
      ? Math.floor(opts.limit)
      : DEFAULT_LIMIT;
  const dir = opts.dir ?? trainingDataDirectory();

  const anglers = new Map<string, AnglerAccumulator>();

  for (const { date, file } of listTrainingDateFiles(dir)) {
    const snaps = loadJsonl(file) as TrainingSnap[];
    for (const snap of snaps) {
      const fetchedAtMs = snap.fetchedAtMs;
      if (!Number.isFinite(fetchedAtMs) || fetchedAtMs == null || fetchedAtMs <= 0) continue;
      const snapDay = snap.tournamentDay;

      for (const period of snap.periods ?? []) {
        const periodDay = period.day ?? "";
        if (snapDay != null && snapDay !== "" && periodDay !== "" && periodDay !== snapDay) {
          continue;
        }
        const periodLabel = period.label ?? "";
        for (const row of period.rows ?? []) {
          const name = typeof row.name === "string" ? row.name : "";
          if (name.length === 0) continue;
          if (!name.toLowerCase().includes(needle)) continue;

          const anglerKey = typeof row.anglerKey === "string" ? row.anglerKey : "";
          const fishEntryKey = typeof row.fishEntryKey === "string" ? row.fishEntryKey : "";
          if (anglerKey.length === 0 || fishEntryKey.length === 0) continue;

          const rawStation = typeof row.weighStation === "string" ? row.weighStation : "";
          const stationDisplay = rawStation ? displayWeighStationFromRaw(rawStation) : "";
          const weightLb =
            typeof row.weightLb === "number" && Number.isFinite(row.weightLb)
              ? row.weightLb
              : null;
          const weightRaw =
            typeof (row as { weightRaw?: unknown }).weightRaw === "string"
              ? ((row as { weightRaw: string }).weightRaw)
              : weightLb != null
                ? weightLb.toFixed(2)
                : "";

          let angler = anglers.get(anglerKey);
          if (!angler) {
            angler = {
              anglerKey,
              displayName: name,
              weighStation: stationDisplay,
              fishByEntryKey: new Map(),
            };
            anglers.set(anglerKey, angler);
          }

          const existing = angler.fishByEntryKey.get(fishEntryKey);
          if (existing == null || fetchedAtMs < existing.firstSeenAtMs) {
            angler.fishByEntryKey.set(fishEntryKey, {
              weightLb,
              weightRaw,
              weighStation: stationDisplay,
              tournamentDate: date,
              periodDay,
              periodLabel,
              firstSeenAtMs: fetchedAtMs,
            });
          }
        }
      }
    }
  }

  const results: AnglerSearchHit[] = [];
  for (const angler of anglers.values()) {
    const fish: AnglerFishHit[] = [];
    let total = 0;
    for (const f of angler.fishByEntryKey.values()) {
      if (f.weightLb != null) total += f.weightLb;
      fish.push({
        weightLb: f.weightLb,
        weightRaw: f.weightRaw,
        weighStation: f.weighStation,
        tournamentDate: f.tournamentDate,
        periodDay: f.periodDay,
        periodLabel: f.periodLabel,
        firstSeenAtMs: f.firstSeenAtMs,
        firstSeenIso: formatChicagoIso(f.firstSeenAtMs),
      });
    }
    fish.sort((a, b) => a.firstSeenAtMs - b.firstSeenAtMs);
    results.push({
      anglerKey: angler.anglerKey,
      displayName: angler.displayName,
      weighStation: angler.weighStation,
      totalWeightLb: Math.round(total * 1000) / 1000,
      fishCount: fish.length,
      fish,
    });
  }

  results.sort((a, b) => {
    const aMax = a.fish.length > 0 ? a.fish[a.fish.length - 1]!.firstSeenAtMs : 0;
    const bMax = b.fish.length > 0 ? b.fish[b.fish.length - 1]!.firstSeenAtMs : 0;
    if (aMax !== bMax) return bMax - aMax;
    return a.displayName.localeCompare(b.displayName);
  });

  return results.slice(0, limit);
}

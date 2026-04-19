/**
 * Backfill daily surface water temperature for historical BBB tournament dates from the Wayback
 * Machine's archived Ameren Lake Level Reports page.
 *
 * Usage:
 *   npx tsx server/scripts/backfill-water-temp.ts
 *   npx tsx server/scripts/backfill-water-temp.ts --year=2024
 *   npx tsx server/scripts/backfill-water-temp.ts --date=2024-04-20
 *   npx tsx server/scripts/backfill-water-temp.ts --max-drift-days=5
 *
 * For each tournament date we ask the Wayback availability API for the closest archived snapshot
 * around noon CT on that date. If a snapshot exists within `--max-drift-days` (default 3) we
 * parse it and store the value. Otherwise we write a `null` surfaceTempF with an `unavailable`
 * reason so the file is present for downstream joins.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AMEREN_LAKE_REPORTS_URL,
  parseAmerenSurfaceWaterTemp,
  type WaterTempReading,
} from "../src/lib/waterTempAmeren.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");
const DATES_FILE = path.join(DATA_DIR, "historical-tournament-dates.json");
const WATER_TEMP_DIR = path.join(DATA_DIR, "water-temp");

const WAYBACK_AVAILABLE_URL = "https://archive.org/wayback/available";

interface ParsedArgs {
  year?: string;
  singleDate?: string;
  maxDriftDays: number;
}

function parseArgs(): ParsedArgs {
  const out: ParsedArgs = { maxDriftDays: 3 };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--year=")) out.year = a.slice("--year=".length).trim();
    else if (a.startsWith("--date=")) out.singleDate = a.slice("--date=".length).trim();
    else if (a.startsWith("--max-drift-days=")) {
      const n = Number.parseInt(a.slice("--max-drift-days=".length), 10);
      if (Number.isFinite(n) && n >= 0) out.maxDriftDays = n;
    }
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wayback timestamp (yyyyMMddHHmmss) anchored at noon CT on a given ISO date. */
function waybackTimestamp(isoDate: string): string {
  return `${isoDate.replace(/-/g, "")}120000`;
}

function daysBetween(yyyymmdd: string, isoDate: string): number {
  const y = Number.parseInt(yyyymmdd.slice(0, 4), 10);
  const m = Number.parseInt(yyyymmdd.slice(4, 6), 10);
  const d = Number.parseInt(yyyymmdd.slice(6, 8), 10);
  const snap = Date.UTC(y, m - 1, d);
  const target = Date.UTC(
    Number.parseInt(isoDate.slice(0, 4), 10),
    Number.parseInt(isoDate.slice(5, 7), 10) - 1,
    Number.parseInt(isoDate.slice(8, 10), 10),
  );
  return Math.abs(snap - target) / 86_400_000;
}

interface WaybackClosest {
  available?: boolean;
  url?: string;
  timestamp?: string;
  status?: string;
}

async function findWaybackSnapshot(
  isoDate: string,
): Promise<{ snapshotUrl: string; snapshotTimestamp: string; driftDays: number } | null> {
  const u = new URL(WAYBACK_AVAILABLE_URL);
  u.searchParams.set("url", AMEREN_LAKE_REPORTS_URL);
  u.searchParams.set("timestamp", waybackTimestamp(isoDate));

  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(u.toString(), {
      headers: { "User-Agent": "314-apps-fish/1.0 (historical water temp backfill)" },
    });
    lastStatus = res.status;
    if (res.ok) {
      const json = (await res.json()) as { archived_snapshots?: { closest?: WaybackClosest } };
      const closest = json.archived_snapshots?.closest;
      if (!closest?.available || !closest.url || !closest.timestamp) return null;
      if (closest.status && closest.status !== "200") return null;
      return {
        snapshotUrl: closest.url,
        snapshotTimestamp: closest.timestamp,
        driftDays: daysBetween(closest.timestamp, isoDate),
      };
    }
    if (res.status !== 503 && res.status !== 429) break;
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`Wayback availability ${lastStatus}`);
}

function writeReading(
  isoDate: string,
  reading: WaterTempReading & { unavailableReason?: string },
): string {
  mkdirSync(WATER_TEMP_DIR, { recursive: true });
  const outFile = path.join(WATER_TEMP_DIR, `${isoDate}.json`);
  writeFileSync(outFile, `${JSON.stringify({ date: isoDate, ...reading }, null, 2)}\n`, "utf8");
  return outFile;
}

async function backfillDate(
  isoDate: string,
  maxDriftDays: number,
): Promise<{ ok: boolean; surfaceTempF: number | null; driftDays: number | null }> {
  const snap = await findWaybackSnapshot(isoDate);
  if (!snap) {
    const file = writeReading(isoDate, {
      surfaceTempF: null,
      fetchedAt: new Date().toISOString(),
      source: "ameren-wayback",
      sourceUrl: AMEREN_LAKE_REPORTS_URL,
      unavailableReason: "no-wayback-snapshot",
    });
    console.log(`${isoDate}: no Wayback snapshot -> ${path.relative(process.cwd(), file)}`);
    return { ok: false, surfaceTempF: null, driftDays: null };
  }

  if (snap.driftDays > maxDriftDays) {
    const file = writeReading(isoDate, {
      surfaceTempF: null,
      fetchedAt: new Date().toISOString(),
      source: "ameren-wayback",
      sourceUrl: snap.snapshotUrl,
      snapshotDate: `${snap.snapshotTimestamp.slice(0, 4)}-${snap.snapshotTimestamp.slice(4, 6)}-${snap.snapshotTimestamp.slice(6, 8)}`,
      unavailableReason: `drift-${snap.driftDays.toFixed(1)}d-exceeds-max-${maxDriftDays}`,
    });
    console.log(
      `${isoDate}: closest snapshot ${snap.snapshotTimestamp} drifts ${snap.driftDays.toFixed(1)}d (> ${maxDriftDays}) -> ${path.relative(process.cwd(), file)}`,
    );
    return { ok: false, surfaceTempF: null, driftDays: snap.driftDays };
  }

  const res = await fetch(snap.snapshotUrl, {
    headers: { "User-Agent": "314-apps-fish/1.0 (historical water temp backfill)" },
  });
  if (!res.ok) throw new Error(`Wayback snapshot ${res.status} at ${snap.snapshotUrl}`);
  const html = await res.text();
  const surfaceTempF = parseAmerenSurfaceWaterTemp(html);

  const snapshotDate = `${snap.snapshotTimestamp.slice(0, 4)}-${snap.snapshotTimestamp.slice(4, 6)}-${snap.snapshotTimestamp.slice(6, 8)}`;
  const reading: WaterTempReading & { unavailableReason?: string } = {
    surfaceTempF,
    fetchedAt: new Date().toISOString(),
    source: "ameren-wayback",
    sourceUrl: snap.snapshotUrl,
    snapshotDate,
  };
  if (surfaceTempF == null) reading.unavailableReason = "parser-no-match";
  const file = writeReading(isoDate, reading);
  console.log(
    `${isoDate}: ${surfaceTempF != null ? `${surfaceTempF}F` : "parse-failed"} (snap ${snapshotDate}, drift ${snap.driftDays.toFixed(1)}d) -> ${path.relative(process.cwd(), file)}`,
  );
  return { ok: surfaceTempF != null, surfaceTempF, driftDays: snap.driftDays };
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

  let ok = 0;
  let missing = 0;
  for (const d of dates) {
    try {
      const r = await backfillDate(d, args.maxDriftDays);
      if (r.ok) ok += 1;
      else missing += 1;
    } catch (e) {
      missing += 1;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`${d}: ${msg}`);
    }
    await sleep(500);
  }

  console.log(
    `Water-temp backfill complete: ${ok} values recovered, ${missing} missing across ${dates.length} date(s).`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : String(e));
  process.exit(1);
});

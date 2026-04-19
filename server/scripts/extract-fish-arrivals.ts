/**
 * Extract per-fish arrival events from live-training snapshots.
 *
 * Usage:
 *   npx tsx server/scripts/extract-fish-arrivals.ts --date=2026-04-18
 *   npx tsx server/scripts/extract-fish-arrivals.ts --all
 *
 * Writes one JSONL per date to `server/data/fish-arrivals/{date}.jsonl`.
 * Idempotent: each run fully rewrites the target file(s).
 *
 * Arrivals are derived from existing snapshots — no new scraping is done.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractArrivalsFromSnapshots,
  type FishArrival,
} from "../src/lib/fishArrivals.js";
import type { TrainingSnapshotRecord } from "../src/lib/trainingCapture.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");
const LIVE_TRAINING_DIR = path.join(DATA_DIR, "live-training");
const ARRIVALS_DIR = path.join(DATA_DIR, "fish-arrivals");

interface ParsedArgs {
  mode: "date" | "all";
  date?: string;
}

function parseArgs(): ParsedArgs {
  const raw = process.argv.slice(2);
  let date: string | undefined;
  let all = false;
  for (const a of raw) {
    if (a === "--all") all = true;
    else if (a.startsWith("--date=")) date = a.slice("--date=".length).trim();
  }
  if (all) return { mode: "all" };
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return { mode: "date", date };
  console.error("Usage: --date=YYYY-MM-DD | --all");
  process.exit(1);
}

function loadSnapshotsForDate(date: string): TrainingSnapshotRecord[] {
  const file = path.join(LIVE_TRAINING_DIR, `${date}.jsonl`);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const out: TrainingSnapshotRecord[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const rec = JSON.parse(t) as TrainingSnapshotRecord;
      out.push(rec);
    } catch {
      // skip malformed line
    }
  }
  return out;
}

function listTrainingDates(): string[] {
  let entries: string[];
  try {
    entries = readdirSync(LIVE_TRAINING_DIR);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of entries) {
    const m = name.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
    if (m) out.push(m[1]!);
  }
  out.sort();
  return out;
}

function writeArrivals(date: string, arrivals: FishArrival[]): string {
  mkdirSync(ARRIVALS_DIR, { recursive: true });
  const outFile = path.join(ARRIVALS_DIR, `${date}.jsonl`);
  const lines = arrivals.map((a) => JSON.stringify(a)).join("\n");
  writeFileSync(outFile, arrivals.length > 0 ? `${lines}\n` : "", "utf8");
  return outFile;
}

function processDate(date: string): { count: number; outFile: string } {
  const snaps = loadSnapshotsForDate(date);
  const arrivals = extractArrivalsFromSnapshots(snaps);
  const outFile = writeArrivals(date, arrivals);
  return { count: arrivals.length, outFile };
}

function main(): void {
  const args = parseArgs();
  const dates = args.mode === "all" ? listTrainingDates() : [args.date!];
  if (dates.length === 0) {
    console.log("No live-training JSONL files found.");
    return;
  }
  let total = 0;
  for (const d of dates) {
    const { count, outFile } = processDate(d);
    total += count;
    const rel = path.relative(process.cwd(), outFile);
    console.log(`${d}: ${count} arrivals -> ${rel}`);
  }
  console.log(`Total arrivals: ${total} across ${dates.length} date(s).`);
}

main();

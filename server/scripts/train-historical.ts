/**
 * Fetches archived Big Bass Bash leaderboard widgets and writes aggregated
 * 45th-place (bubble) weights per payout window for model calibration.
 *
 * Usage: npx tsx server/scripts/train-historical.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseLeaderboardHtml } from "../src/lib/scrape.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "data");
const OUT_FILE = path.join(OUT_DIR, "historical-payout-stats.json");

const SOURCES: { year: number; url: string }[] = [
  { year: 2025, url: "https://aleaderboard.com/w2/a57a338d-a176-4247-afe6-8c037aa2837a" },
  { year: 2024, url: "https://aleaderboard.com/w2/84f6641d-0a7f-4b0f-a20d-cea56ad06ff6" },
  { year: 2023, url: "https://aleaderboard.com/w2/52c3f9a0-d216-437c-bb9f-952b5003e3f4" },
  { year: 2022, url: "https://aleaderboard.com/w2/77d1d666-b64e-4e5d-8797-de9c0f8185bd" },
  { year: 2021, url: "https://aleaderboard.com/w2/1bcc2d09-547a-44b3-8fc7-85a463ca7cd2" },
  { year: 2020, url: "https://aleaderboard.com/w2/a277af89-fbce-4fbc-a43a-9d429b1e5d6f" },
];

const PLACES = 45;

function windowIdFromH2(h2: string): 1 | 2 | 3 | 4 | null {
  const h = h2.toLowerCase();
  if (h.includes("6:30") && h.includes("9")) return 1;
  if (h.includes("9:01") && h.includes("11")) return 2;
  if (h.includes("11:01") && (h.includes("1pm") || h.includes("1 pm") || h.includes("1:00"))) return 3;
  if (h.includes("1:01") && h.includes("3")) return 4;
  return null;
}

function periodKey(day: "Saturday" | "Sunday", win: 1 | 2 | 3 | 4): string {
  return `${day}-W${win}`;
}

function weightAtRank(sortedDesc: number[], rank1Based: number): number | null {
  if (sortedDesc.length < rank1Based) return sortedDesc.length ? sortedDesc[sortedDesc.length - 1]! : null;
  return sortedDesc[rank1Based - 1]!;
}

async function main(): Promise<void> {
  type Sample = { year: number; w45: number; rowCount: number; weights: number[] };
  const byWindow = new Map<string, Sample[]>();

  for (const { year, url } of SOURCES) {
    const res = await fetch(url, { headers: { "User-Agent": "314-apps-historical-train/1.0" } });
    if (!res.ok) {
      console.warn(`Skip ${year}: HTTP ${res.status}`);
      continue;
    }
    const html = await res.text();
    const parsed = parseLeaderboardHtml(html, url);

    for (const p of parsed.periods) {
      const wid = windowIdFromH2(p.h2);
      if (wid == null) continue;
      const key = periodKey(p.day, wid);
      const ws = p.rows
        .map((r) => r.weightLb)
        .filter((w): w is number => w != null && Number.isFinite(w))
        .sort((a, b) => b - a);
      const w45 = weightAtRank(ws, PLACES);
      if (w45 == null) continue;
      const list = byWindow.get(key) ?? [];
      list.push({ year, w45, rowCount: ws.length, weights: ws });
      byWindow.set(key, list);
    }
  }

  const windows: Record<
    string,
    {
      w45Samples: number[];
      byYear: { year: number; w45: number; rowCount: number; weights: number[] }[];
      mean: number;
      std: number;
      n: number;
      avgFinalRowCount: number;
      pooledWeights: number[];
    }
  > = {};

  for (const [key, samples] of byWindow) {
    const vals = samples.map((s) => s.w45);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const var_ =
      vals.length > 1 ? vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1) : 0;
    const std = Math.sqrt(var_) || 0.12;
    const avgFinalRowCount =
      samples.reduce((s, y) => s + y.rowCount, 0) / samples.length;
    const pooled = samples
      .flatMap((s) => s.weights)
      .sort((a, b) => b - a)
      .map((w) => Math.round(w * 100) / 100);
    windows[key] = {
      w45Samples: vals,
      byYear: samples.map((s) => ({
        year: s.year,
        w45: s.w45,
        rowCount: s.rowCount,
        weights: s.weights,
      })),
      mean,
      std,
      n: vals.length,
      avgFinalRowCount,
      pooledWeights: pooled,
    };
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    placesPaid: PLACES,
    description:
      "45th-place weights per payout window from archived aleaderboard.com widgets (year-end or final snapshots).",
    sources: SOURCES,
    windows,
  };
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${OUT_FILE} (${Object.keys(windows).length} window keys)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

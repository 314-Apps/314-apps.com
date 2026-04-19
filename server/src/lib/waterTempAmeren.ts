/**
 * Scrape the daily "Surface Water Temp" value from Ameren's Lake Level Reports page.
 *
 * Source: https://www.ameren.com/property/lake-of-the-ozarks/reports
 *
 * The page renders a small forecast block containing a labelled value:
 *
 *   | Surface Water Temp is | 60  |
 *
 * We try a structural parse first (cheerio), then fall back to a tolerant regex on the raw HTML.
 * Returns `null` if neither matches — we never guess a number when the label is missing, since the
 * page structure is the only thing anchoring the value.
 */
import * as cheerio from "cheerio";

export const AMEREN_LAKE_REPORTS_URL =
  "https://www.ameren.com/property/lake-of-the-ozarks/reports";

export interface WaterTempReading {
  surfaceTempF: number | null;
  fetchedAt: string;
  source: "ameren" | "ameren-wayback";
  sourceUrl: string;
  snapshotDate?: string;
}

const LABEL_RE = /Surface\s+Water\s+Temp\s+is/i;

/** Parse a single Fahrenheit integer out of the Ameren reports HTML. */
export function parseAmerenSurfaceWaterTemp(html: string): number | null {
  if (typeof html !== "string" || html.length === 0) return null;

  try {
    const $ = cheerio.load(html);
    const cells = $("td, th, li, p, span, div").toArray();
    for (const el of cells) {
      const text = $(el).text().trim();
      if (LABEL_RE.test(text)) {
        const m = text.match(/Surface\s+Water\s+Temp\s+is[^0-9]*(\d{2,3})/i);
        if (m) {
          const n = Number.parseInt(m[1]!, 10);
          if (Number.isFinite(n) && n >= 30 && n <= 110) return n;
        }
        const next = $(el).next().text().trim();
        const nm = next.match(/(\d{2,3})/);
        if (nm) {
          const n = Number.parseInt(nm[1]!, 10);
          if (Number.isFinite(n) && n >= 30 && n <= 110) return n;
        }
      }
    }
  } catch {
    // fall through to regex fallback
  }

  const cleaned = html.replace(/\s+/g, " ");
  const m = cleaned.match(/Surface\s+Water\s+Temp\s+is[^0-9]*(\d{2,3})/i);
  if (m) {
    const n = Number.parseInt(m[1]!, 10);
    if (Number.isFinite(n) && n >= 30 && n <= 110) return n;
  }
  return null;
}

export interface FetchAmerenOpts {
  url?: string;
  source?: WaterTempReading["source"];
  snapshotDate?: string;
  signal?: AbortSignal;
}

/** Fetch the live Ameren page (or a specified URL — e.g. a Wayback snapshot) and parse the temp. */
export async function fetchAmerenSurfaceWaterTemp(
  opts: FetchAmerenOpts = {},
): Promise<WaterTempReading> {
  const url = opts.url ?? AMEREN_LAKE_REPORTS_URL;
  const source = opts.source ?? "ameren";
  const res = await fetch(url, {
    signal: opts.signal,
    headers: {
      "User-Agent": "314-apps-fish/1.0 (data collection for tournament weigh-in model)",
    },
  });
  if (!res.ok) {
    throw new Error(`Ameren ${res.status} at ${url}`);
  }
  const html = await res.text();
  const surfaceTempF = parseAmerenSurfaceWaterTemp(html);
  const reading: WaterTempReading = {
    surfaceTempF,
    fetchedAt: new Date().toISOString(),
    source,
    sourceUrl: url,
  };
  if (opts.snapshotDate) reading.snapshotDate = opts.snapshotDate;
  return reading;
}

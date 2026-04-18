import { load } from "cheerio";
import type { LeaderboardRow, ParsedLeaderboard, PeriodSection } from "./types.js";

function parseWeightLb(raw: string): number | null {
  const m = raw.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parseDayLabel(h2: string): { day: "Saturday" | "Sunday"; label: string } | null {
  const m = h2.match(/^(Saturday|Sunday)\s*:\s*(.+)$/i);
  if (!m) return null;
  const day = (m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()) as
    | "Saturday"
    | "Sunday";
  if (day !== "Saturday" && day !== "Sunday") return null;
  return { day, label: m[2].trim() };
}

export function parseLeaderboardHtml(html: string, sourceUrl: string): ParsedLeaderboard {
  const $ = load(html);
  const periods: PeriodSection[] = [];

  $("div.widget-leaderboard").each((_, el) => {
    const h2Text = $(el).find("h2").first().text().replace(/\s+/g, " ").trim();
    if (!h2Text) return;
    const parsed = parseDayLabel(h2Text);
    if (!parsed) return;

    const rows: LeaderboardRow[] = [];
    $(el)
      .find("tbody tr")
      .each((__, tr) => {
        const rowText = $(tr).text();
        if (rowText.includes("No participant scores posted")) return;

        const cells = $(tr).find("td");
        if (cells.length < 4) return;

        const rank = $(cells[0]).text().trim();
        const name = $(cells[1]).text().trim();
        const weighStation = $(cells[2]).text().trim();
        const weightRaw = $(cells[3]).text().trim();
        if (!rank && !name && !weightRaw) return;

        rows.push({
          rank,
          name,
          weighStation,
          weightRaw,
          weightLb: parseWeightLb(weightRaw),
        });
      });

    periods.push({
      day: parsed.day,
      h2: h2Text,
      label: parsed.label,
      rows,
    });
  });

  return {
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    periods,
  };
}

const IFRAME_SRC_RE = /https?:\/\/aleaderboard\.com\/w2\/[0-9a-f-]+/gi;

export async function resolveWidgetUrl(
  configuredUrl: string | undefined,
  midwestPageUrl: string | undefined,
): Promise<string> {
  const trimmed = configuredUrl?.trim();
  if (trimmed) return trimmed;

  if (!midwestPageUrl?.trim()) {
    throw new Error(
      "ALEADERBOARD_WIDGET_URL is empty and MIDWEST_LIVE_PAGE_URL is not set for discovery.",
    );
  }

  const res = await fetch(midwestPageUrl, {
    headers: { "User-Agent": "314-apps-fish-helper/1.0" },
  });
  if (!res.ok) throw new Error(`Failed to fetch Midwest page: ${res.status}`);
  const html = await res.text();

  let best: { url: string; height: number } | null = null;
  const iframeRe =
    /<iframe[^>]+src=['"]([^'"]+)['"][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = iframeRe.exec(html)) !== null) {
    const src = m[1];
    if (!src.includes("aleaderboard.com/w2/")) continue;
    const full = m[0];
    const heightMatch = /height=['"]?(\d+)/i.exec(full);
    const height = heightMatch ? Number.parseInt(heightMatch[1], 10) : 0;
    const url = src.startsWith("http") ? src : `https:${src}`;
    if (!best || height > best.height) best = { url, height };
  }

  if (!best) {
    const fallback = html.match(IFRAME_SRC_RE);
    if (fallback?.[0]) return fallback[0];
    throw new Error("Could not discover aleaderboard.com widget URL from Midwest page.");
  }

  return best.url;
}

export async function fetchAndParseLeaderboard(widgetUrl: string): Promise<ParsedLeaderboard> {
  const res = await fetch(widgetUrl, {
    headers: { "User-Agent": "314-apps-fish-helper/1.0" },
  });
  if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`);
  const html = await res.text();
  return parseLeaderboardHtml(html, widgetUrl);
}

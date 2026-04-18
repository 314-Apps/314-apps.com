import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirnamePath = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirnamePath, "..", "..", "data");
const SETTINGS_PATH = path.join(DATA_DIR, "runtime-settings.json");

export interface RuntimeSettings {
  liveScrapeEnabled: boolean;
  trainingCaptureEnabled: boolean;
}

function defaults(): RuntimeSettings {
  /** Opt-in: live fetch is off until DEFAULT_LIVE_SCRAPE_ENABLED=true or toggled in UI. */
  const liveDefault = process.env.DEFAULT_LIVE_SCRAPE_ENABLED?.trim().toLowerCase() === "true";
  const trainDefault = process.env.DEFAULT_TRAINING_CAPTURE?.trim().toLowerCase() === "true";
  return {
    liveScrapeEnabled: liveDefault,
    trainingCaptureEnabled: trainDefault,
  };
}

function readDisk(): Partial<RuntimeSettings> | null {
  try {
    if (!existsSync(SETTINGS_PATH)) return null;
    const raw = readFileSync(SETTINGS_PATH, "utf8");
    const j = JSON.parse(raw) as Partial<RuntimeSettings>;
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}

export function getRuntimeSettings(): RuntimeSettings {
  const d = defaults();
  const disk = readDisk();
  return {
    liveScrapeEnabled:
      typeof disk?.liveScrapeEnabled === "boolean" ? disk.liveScrapeEnabled : d.liveScrapeEnabled,
    trainingCaptureEnabled:
      typeof disk?.trainingCaptureEnabled === "boolean"
        ? disk.trainingCaptureEnabled
        : d.trainingCaptureEnabled,
  };
}

/** Write effective settings to disk if missing so operators can find `runtime-settings.json` after boot. */
export function ensureRuntimeSettingsFile(): void {
  try {
    if (existsSync(SETTINGS_PATH)) return;
    mkdirSync(DATA_DIR, { recursive: true });
    const s = getRuntimeSettings();
    writeFileSync(SETTINGS_PATH, `${JSON.stringify(s, null, 2)}\n`, "utf8");
  } catch {
    /* ignore — settings still work from env defaults in memory */
  }
}

export function saveRuntimeSettings(next: Partial<RuntimeSettings>): RuntimeSettings {
  const cur = getRuntimeSettings();
  const merged: RuntimeSettings = {
    liveScrapeEnabled:
      typeof next.liveScrapeEnabled === "boolean" ? next.liveScrapeEnabled : cur.liveScrapeEnabled,
    trainingCaptureEnabled:
      typeof next.trainingCaptureEnabled === "boolean"
        ? next.trainingCaptureEnabled
        : cur.trainingCaptureEnabled,
  };
  try {
    mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged;
}

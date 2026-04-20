import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { weightAtPayoutLikelihoodPercent } from "./payoutProbability.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAL_PATH = path.join(__dirname, "..", "..", "data", "payout-calibration.json");

/** v1 on-disk: top-level `knots`. */
export interface PayoutCalibrationFile {
  version: number;
  /** Monotonic knots [rawPercent, calibratedPercent] in [0,100], sorted by raw. */
  knots: [number, number][];
}

export type ElapsedCalibrationBucketKey = "0-25" | "25-50" | "50-75" | "75-100";

export interface PayoutCalibrationBucketSlice {
  knots: [number, number][];
}

/** v2 on-disk: default knots + optional per elapsed-fraction bucket. */
export interface PayoutCalibrationFileV2 {
  version: 2;
  default: PayoutCalibrationBucketSlice;
  byElapsedBucket?: Partial<Record<ElapsedCalibrationBucketKey, PayoutCalibrationBucketSlice>>;
}

export type PayoutCalibrationOnDisk = PayoutCalibrationFile | PayoutCalibrationFileV2;

export interface CalibratePayoutPercentOptions {
  /**
   * When true and the loaded file has `byElapsedBucket` for this fraction’s bucket,
   * use that slice’s knots; otherwise `default` knots from v2, or v1 top-level knots.
   */
  useElapsedBucket?: boolean;
  /** Window fraction elapsed [0,1], from `SmartLikelihoodResult.fractionElapsed`. */
  fractionElapsed?: number | null;
}

interface LoadedCalibration {
  version: number;
  defaultKnots: [number, number][];
  byBucket: Partial<Record<ElapsedCalibrationBucketKey, [number, number][]>>;
}

let cached: LoadedCalibration | undefined;

export function fractionElapsedToBucketKey(
  f: number | undefined | null,
): ElapsedCalibrationBucketKey | null {
  if (f == null || !Number.isFinite(f)) return null;
  const x = Math.max(0, Math.min(1, f));
  if (x < 0.25) return "0-25";
  if (x < 0.5) return "25-50";
  if (x < 0.75) return "50-75";
  return "75-100";
}

function identityKnots(): [number, number][] {
  return [
    [0, 0],
    [100, 100],
  ];
}

function normalizeKnots(k: unknown): [number, number][] {
  if (!Array.isArray(k) || k.length === 0) return identityKnots();
  const out: [number, number][] = [];
  for (const pair of k) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const a = Number(pair[0]);
    const b = Number(pair[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) out.push([a, b]);
  }
  return out.length > 0 ? out : identityKnots();
}

function parseCalibrationFile(raw: string): LoadedCalibration {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { version: 1, defaultKnots: identityKnots(), byBucket: {} };
  }
  if (!parsed || typeof parsed !== "object") {
    return { version: 1, defaultKnots: identityKnots(), byBucket: {} };
  }
  const o = parsed as Record<string, unknown>;
  const ver = Number(o.version);

  // v2: { version: 2, default: { knots }, byElapsedBucket?: { ... } }
  if (ver >= 2 && o.default && typeof o.default === "object") {
    const def = o.default as Record<string, unknown>;
    const defaultKnots = normalizeKnots(def.knots);
    const byBucket: Partial<Record<ElapsedCalibrationBucketKey, [number, number][]>> = {};
    const be = o.byElapsedBucket;
    if (be && typeof be === "object") {
      for (const key of ["0-25", "25-50", "50-75", "75-100"] as ElapsedCalibrationBucketKey[]) {
        const slice = (be as Record<string, unknown>)[key];
        if (slice && typeof slice === "object") {
          const knots = normalizeKnots((slice as Record<string, unknown>).knots);
          if (knots.length > 0) byBucket[key] = knots;
        }
      }
    }
    return { version: 2, defaultKnots, byBucket };
  }

  // v1: { version: 1, knots: [...] } or legacy { knots }
  const knots = normalizeKnots(o.knots);
  return { version: 1, defaultKnots: knots, byBucket: {} };
}

function loadCalibration(): LoadedCalibration {
  if (cached !== undefined) return cached;
  try {
    const raw = readFileSync(CAL_PATH, "utf8");
    cached = parseCalibrationFile(raw);
    return cached;
  } catch {
    cached = { version: 1, defaultKnots: identityKnots(), byBucket: {} };
    return cached;
  }
}

function pickKnots(opts?: CalibratePayoutPercentOptions): [number, number][] {
  const loaded = loadCalibration();
  if (opts?.useElapsedBucket === true) {
    const key = fractionElapsedToBucketKey(opts.fractionElapsed ?? undefined);
    const bk = key ? loaded.byBucket[key] : undefined;
    if (bk && bk.length > 0) return bk;
  }
  return loaded.defaultKnots;
}

/** Piecewise linear map of raw model percent → displayed percent (0–100). */
export function calibratePayoutPercent(
  rawPercent: number | null,
  options?: CalibratePayoutPercentOptions,
): number | null {
  if (rawPercent == null || !Number.isFinite(rawPercent)) return null;
  const x = Math.max(0, Math.min(100, rawPercent));
  const knots = pickKnots(options);
  return Math.round(interp(x, knots));
}

/**
 * Inverse: displayed percent → raw model percent such that calibrate(raw) ≈ target.
 * Uses **default** knots only (primary payout floor / scale ticks).
 */
export function inverseCalibratePayoutPercent(displayPercent: number): number {
  const y = Math.max(0, Math.min(100, displayPercent));
  const { defaultKnots } = loadCalibration();
  const inv = invertKnots(defaultKnots);
  return interp(y, inv);
}

function invertKnots(knots: [number, number][]): [number, number][] {
  const sorted = [...knots].sort((a, b) => a[1] - b[1]);
  const out: [number, number][] = sorted.map(([raw, cal]) => [cal, raw]);
  return dedupeKnots(out);
}

function dedupeKnots(pairs: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const k of pairs) {
    const last = out[out.length - 1];
    if (last && last[0] === k[0]) out[out.length - 1] = k;
    else out.push(k);
  }
  return out;
}

function interp(x: number, knots: [number, number][]): number {
  if (knots.length === 0) return x;
  const k = [...knots].sort((a, b) => a[0] - b[0]);
  if (x <= k[0]![0]) return k[0]![1];
  if (x >= k[k.length - 1]![0]) return k[k.length - 1]![1];
  for (let i = 0; i < k.length - 1; i++) {
    const [x0, y0] = k[i]!;
    const [x1, y1] = k[i + 1]!;
    if (x >= x0 && x <= x1) {
      if (x1 === x0) return y0;
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return x;
}

/** Test helper: reset cached calibration (e.g. after writing a temp file). */
export function resetPayoutCalibrationCache(): void {
  cached = undefined;
}

/**
 * Minimum fish weight (lb) where raw normal-CDF pay probability maps (after calibration)
 * to ~`thresholdDisplayPercent` on the displayed scale.
 */
export function weightAtCalibratedPayoutLikelihoodPercent(
  mu: number | null,
  sigma: number | null,
  thresholdDisplayPercent: number,
  lowerBoundLb?: number | null,
): number | null {
  const rawPercent = inverseCalibratePayoutPercent(thresholdDisplayPercent);
  return weightAtPayoutLikelihoodPercent(
    mu,
    sigma,
    rawPercent,
    undefined,
    lowerBoundLb,
  );
}

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalPpf } from "./payoutProbability.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAL_PATH = path.join(__dirname, "..", "..", "data", "payout-calibration.json");

export interface PayoutCalibrationFile {
  version: number;
  /** Monotonic knots [rawPercent, calibratedPercent] in [0,100], sorted by raw. */
  knots: [number, number][];
}

let cached: PayoutCalibrationFile | undefined;

function loadCalibration(): PayoutCalibrationFile {
  if (cached !== undefined) return cached;
  try {
    const raw = readFileSync(CAL_PATH, "utf8");
    const parsed = JSON.parse(raw) as PayoutCalibrationFile;
    if (!Array.isArray(parsed.knots) || parsed.knots.length === 0) {
      cached = { version: 1, knots: identityKnots() };
    } else {
      cached = parsed;
    }
    return cached;
  } catch {
    cached = { version: 1, knots: identityKnots() };
    return cached;
  }
}

function identityKnots(): [number, number][] {
  return [
    [0, 0],
    [100, 100],
  ];
}

/** Piecewise linear map of raw model percent → displayed percent (0–100). */
export function calibratePayoutPercent(rawPercent: number | null): number | null {
  if (rawPercent == null || !Number.isFinite(rawPercent)) return null;
  const x = Math.max(0, Math.min(100, rawPercent));
  const { knots } = loadCalibration();
  return Math.round(interp(x, knots));
}

/**
 * Inverse: displayed percent → raw model percent such that calibrate(raw) ≈ target.
 * Used for payout floor (same threshold on displayed scale).
 */
export function inverseCalibratePayoutPercent(displayPercent: number): number {
  const y = Math.max(0, Math.min(100, displayPercent));
  const { knots } = loadCalibration();
  const inv = invertKnots(knots);
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

function clamp01p(p: number): number {
  return Math.max(0.001, Math.min(0.999, p));
}

/**
 * Minimum fish weight (lb) where raw normal-CDF pay probability maps (after calibration)
 * to ~`thresholdDisplayPercent` on the displayed scale.
 */
export function weightAtCalibratedPayoutLikelihoodPercent(
  mu: number | null,
  sigma: number | null,
  thresholdDisplayPercent: number,
): number | null {
  if (mu == null || sigma == null || !Number.isFinite(mu) || !Number.isFinite(sigma)) return null;
  if (sigma <= 0) return null;
  const rawPercent = inverseCalibratePayoutPercent(thresholdDisplayPercent);
  const p = clamp01p(rawPercent / 100);
  const w = mu + sigma * normalPpf(p);
  return Math.max(0, w);
}

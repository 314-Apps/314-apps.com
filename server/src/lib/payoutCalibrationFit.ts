/**
 * Fit monotonic piecewise-linear payout calibration from (raw %, paid?) samples.
 * Used by `fit-payout-calibration.ts`; knots feed `payout-calibration.json`.
 */
import type {
  ElapsedCalibrationBucketKey,
  PayoutCalibrationFile,
  PayoutCalibrationFileV2,
} from "./payoutCalibration.js";
import { fractionElapsedToBucketKey } from "./payoutCalibration.js";

const BIN_COUNT = 10;

/** Bin index 0..9 for [0,10), …, [80,90), [90,100]. */
export function rawPercentBinIndex(rawPercent: number): number {
  const p = Math.max(0, Math.min(100, rawPercent));
  if (p >= 90) return 9;
  return Math.floor(p / 10);
}

export function binCenterForIndex(i: number): number {
  if (i < 0 || i >= BIN_COUNT) return 50;
  return i === 9 ? 95 : i * 10 + 5;
}

/**
 * Pool adjacent violators (increasing isotonic regression).
 * y[i] = empirical rate in [0,1], w[i] = weight (count).
 */
export function poolAdjacentViolators(y: number[], w: number[]): number[] {
  if (y.length !== w.length || y.length === 0) return [];
  const n = y.length;
  type Block = { sumYW: number; sumW: number; start: number; end: number };
  const stack: Block[] = [];

  for (let i = 0; i < n; i++) {
    const yi = y[i]!;
    const wi = w[i]!;
    stack.push({ sumYW: yi * wi, sumW: wi, start: i, end: i });
    while (stack.length >= 2) {
      const b = stack[stack.length - 1]!;
      const a = stack[stack.length - 2]!;
      const ma = a.sumYW / a.sumW;
      const mb = b.sumYW / b.sumW;
      if (mb >= ma) break;
      stack.pop();
      stack.pop();
      stack.push({
        sumYW: a.sumYW + b.sumYW,
        sumW: a.sumW + b.sumW,
        start: a.start,
        end: b.end,
      });
    }
  }

  const out = new Array(n).fill(0);
  for (const b of stack) {
    const m = b.sumYW / b.sumW;
    for (let j = b.start; j <= b.end; j++) out[j] = m;
  }
  return out;
}

export type PayCalibrationSample = { rawPercent: number; paid: boolean };

export type PayCalibrationSampleWithElapsed = PayCalibrationSample & {
  fractionElapsed?: number | null;
};

const ALL_BUCKET_KEYS: ElapsedCalibrationBucketKey[] = ["0-25", "25-50", "50-75", "75-100"];

/**
 * Build calibration knots [raw, display] in [0,100] from labeled samples.
 * Uses 10% bins on **raw** model percent, isotonic regression on empirical pay rates.
 */
export function buildCalibrationKnotsFromSamples(
  samples: PayCalibrationSample[],
  options?: { minSamplesTotal?: number },
): { file: PayoutCalibrationFile; binCounts: number[]; binRatesRaw: number[]; binRatesIso: number[] } {
  const minTotal = options?.minSamplesTotal ?? 30;
  const nPerBin = new Array(BIN_COUNT).fill(0);
  const paidPerBin = new Array(BIN_COUNT).fill(0);

  for (const s of samples) {
    if (!Number.isFinite(s.rawPercent)) continue;
    const bi = rawPercentBinIndex(s.rawPercent);
    nPerBin[bi] += 1;
    if (s.paid) paidPerBin[bi] += 1;
  }

  const y: number[] = [];
  const weights: number[] = [];
  for (let i = 0; i < BIN_COUNT; i++) {
    const ni = nPerBin[i]!;
    if (ni === 0) {
      y.push(0);
      weights.push(0);
    } else {
      y.push(paidPerBin[i]! / ni);
      weights.push(ni);
    }
  }

  const total = weights.reduce((a, b) => a + b, 0);
  if (total < minTotal) {
    return {
      file: { version: 1, knots: identityKnots() },
      binCounts: nPerBin,
      binRatesRaw: y,
      binRatesIso: y,
    };
  }

  const yFit: number[] = [];
  const wFit: number[] = [];
  const idxMap: number[] = [];
  for (let i = 0; i < BIN_COUNT; i++) {
    if (weights[i]! > 0) {
      yFit.push(y[i]!);
      wFit.push(weights[i]!);
      idxMap.push(i);
    }
  }

  if (yFit.length === 0) {
    return {
      file: { version: 1, knots: identityKnots() },
      binCounts: nPerBin,
      binRatesRaw: y,
      binRatesIso: y,
    };
  }

  const isoPart = poolAdjacentViolators(yFit, wFit);
  const isoFull = [...y];
  for (let j = 0; j < idxMap.length; j++) {
    isoFull[idxMap[j]!] = isoPart[j]!;
  }
  for (let i = 0; i < BIN_COUNT; i++) {
    if (weights[i] === 0) {
      let left = -1;
      for (let k = i - 1; k >= 0; k--) {
        if (weights[k]! > 0) {
          left = k;
          break;
        }
      }
      let right = -1;
      for (let k = i + 1; k < BIN_COUNT; k++) {
        if (weights[k]! > 0) {
          right = k;
          break;
        }
      }
      if (left >= 0 && right >= 0) {
        const t = (i - left) / (right - left);
        isoFull[i] = isoFull[left]! + t * (isoFull[right]! - isoFull[left]!);
      } else if (left >= 0) isoFull[i] = isoFull[left]!;
      else if (right >= 0) isoFull[i] = isoFull[right]!;
      else isoFull[i] = 0.5;
    }
  }

  const knots: [number, number][] = [[0, 0]];
  for (let i = 0; i < BIN_COUNT; i++) {
    const cx = binCenterForIndex(i);
    const display = Math.max(0, Math.min(100, Math.round(isoFull[i]! * 1000) / 10));
    const last = knots[knots.length - 1]![1];
    const yk = Math.max(last, display);
    if (cx === knots[knots.length - 1]![0]) {
      knots[knots.length - 1] = [cx, yk];
    } else {
      knots.push([cx, yk]);
    }
  }
  const lastK = knots[knots.length - 1]![0];
  if (lastK < 100) knots.push([100, 100]);
  else knots[knots.length - 1] = [100, 100];

  return {
    file: { version: 1, knots },
    binCounts: nPerBin,
    binRatesRaw: y,
    binRatesIso: isoFull,
  };
}

function identityKnots(): [number, number][] {
  return [
    [0, 0],
    [100, 100],
  ];
}

/**
 * Build v2 calibration: pooled `default` knots plus optional per elapsed-bucket fits.
 * Buckets with fewer than `minPerBucket` samples reuse `default.knots`.
 */
export function buildCalibrationFileV2FromSamples(
  samples: PayCalibrationSampleWithElapsed[],
  options?: { minSamplesTotal?: number; minPerBucket?: number },
): {
  file: PayoutCalibrationFileV2;
  binCounts: number[];
  binRatesRaw: number[];
  binRatesIso: number[];
  perBucketSampleCounts: Record<ElapsedCalibrationBucketKey, number>;
} {
  const minTotal = options?.minSamplesTotal ?? 30;
  const minPerBucket = options?.minPerBucket ?? 5;

  const pooled: PayCalibrationSample[] = samples.map(({ rawPercent, paid }) => ({
    rawPercent,
    paid,
  }));
  const { file: v1file, binCounts, binRatesRaw, binRatesIso } = buildCalibrationKnotsFromSamples(
    pooled,
    { minSamplesTotal: minTotal },
  );
  const defaultKnots = v1file.knots.length > 0 ? v1file.knots : identityKnots();

  const perBucketSampleCounts = {
    "0-25": 0,
    "25-50": 0,
    "50-75": 0,
    "75-100": 0,
  } as Record<ElapsedCalibrationBucketKey, number>;

  const byElapsedBucket: PayoutCalibrationFileV2["byElapsedBucket"] = {};

  for (const key of ALL_BUCKET_KEYS) {
    const sub = samples.filter((s) => fractionElapsedToBucketKey(s.fractionElapsed) === key);
    perBucketSampleCounts[key] = sub.length;
    if (sub.length >= minPerBucket) {
      const built = buildCalibrationKnotsFromSamples(
        sub.map(({ rawPercent, paid }) => ({ rawPercent, paid })),
        { minSamplesTotal: minPerBucket },
      );
      byElapsedBucket[key] = { knots: built.file.knots };
    } else {
      byElapsedBucket[key] = { knots: [...defaultKnots] };
    }
  }

  return {
    file: {
      version: 2,
      default: { knots: [...defaultKnots] },
      byElapsedBucket,
    },
    binCounts,
    binRatesRaw,
    binRatesIso,
    perBucketSampleCounts,
  };
}

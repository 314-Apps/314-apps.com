/**
 * Long-running client: periodically requests /api/recommendation for a grid of fish weights
 * so you accumulate prediction traces while the API is up (for calibrating / improving the model).
 *
 * When the server has "Save snapshots for training data" enabled, each successful call is
 * also appended to data/recommendation-queries/*.jsonl (same as the fish UI).
 *
 * Run in a second terminal while the API is running, e.g.:
 *   npm run sweep:predictions
 *
 * Env (optional):
 *   PREDICTION_SWEEP_API_BASE   full URL override (wins over port)
 *   PREDICTION_SWEEP_PORT       port only if API base not set (default 8787 — same as npm run fish:dev)
 *   FISH_DEV_PORT               also used if set (so it matches your fish:dev terminal)
 *   PREDICTION_SWEEP_INTERVAL_MS  default 60000 (1 minute)
 *   PREDICTION_SWEEP_MIN_LB       default 2
 *   PREDICTION_SWEEP_MAX_LB       default 6
 *   PREDICTION_SWEEP_STEP_LB      default 0.25
 *   PREDICTION_SWEEP_TRAVEL_MIN   default 15
 *   PREDICTION_SWEEP_LIVEWELL     default 1  (1 or 2)
 *   PREDICTION_SWEEP_SHIRT        default false
 *   PREDICTION_SWEEP_DELAY_MS     delay between each POST in a sweep (default 150)
 */
import "dotenv/config";

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return fallback;
}

/**
 * Port for the sweep client. Defaults to 8787 so it matches `npm run fish:dev` even when
 * `.env` has PORT=3000 (the dev server is often on FISH_DEV_PORT / 8787).
 * For `npm run dev` on port 3000, set PREDICTION_SWEEP_PORT=3000 or PREDICTION_SWEEP_API_BASE=...
 */
function sweepListenPort(): number {
  if (process.env.PREDICTION_SWEEP_PORT != null && process.env.PREDICTION_SWEEP_PORT !== "") {
    return envNum("PREDICTION_SWEEP_PORT", 8787);
  }
  if (process.env.FISH_DEV_PORT != null && process.env.FISH_DEV_PORT !== "") {
    return envNum("FISH_DEV_PORT", 8787);
  }
  return 8787;
}

function apiBase(): string {
  const fromEnv = process.env.PREDICTION_SWEEP_API_BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `http://127.0.0.1:${sweepListenPort()}`;
}

function formatFetchError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const parts = [e.message];
  const withCause = e as Error & { cause?: unknown };
  const c = withCause.cause;
  if (c instanceof Error) parts.push(`cause: ${c.message}`);
  else if (c != null) parts.push(`cause: ${String(c)}`);
  return parts.join(" — ");
}

function buildWeightGrid(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let w = min; w <= max + 1e-9; w += step) {
    out.push(Math.round(w * 1000) / 1000);
  }
  return out;
}

async function getHealth(base: string): Promise<{ ok: boolean; err?: string }> {
  const url = `${base}/api/health`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return { ok: false, err: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, err: formatFetchError(e) };
  }
}

async function postRecommendation(
  base: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; err?: string }> {
  const url = `${base}/api/recommendation`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      let err = text.slice(0, 200);
      try {
        const j = JSON.parse(text) as { error?: string };
        if (j.error) err = j.error;
      } catch {
        /* keep raw */
      }
      return { ok: false, status: res.status, err };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      err: formatFetchError(e),
    };
  }
}

async function runSweepOnce(
  base: string,
  weights: number[],
  common: {
    travelMinutes: number;
    livewellCount: 1 | 2;
    shirtPurchased: boolean;
  },
  delayMs: number,
): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;
  let firstErr: string | undefined;
  let firstStatus = 0;

  for (const fishWeightLb of weights) {
    const r = await postRecommendation(base, {
      fishWeightLb,
      travelMinutes: common.travelMinutes,
      livewellCount: common.livewellCount,
      shirtPurchased: common.shirtPurchased,
    });
    if (r.ok) {
      ok += 1;
    } else {
      fail += 1;
      if (firstErr === undefined) {
        firstErr = r.err ?? "unknown";
        firstStatus = r.status;
        console.error(`  first failure (${fishWeightLb} lb): HTTP ${firstStatus} — ${firstErr}`);
      }
    }
    if (delayMs > 0) {
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }

  if (fail > 1) {
    console.error(
      `  … ${fail - 1} more failed with the same pattern (HTTP ${firstStatus}). Check PREDICTION_SWEEP_API_BASE / port.`,
    );
  }

  return { ok, fail };
}

async function mainAsync(): Promise<void> {
  const base = apiBase();
  const intervalMs = envNum("PREDICTION_SWEEP_INTERVAL_MS", 60_000);
  const minLb = envNum("PREDICTION_SWEEP_MIN_LB", 2);
  const maxLb = envNum("PREDICTION_SWEEP_MAX_LB", 6);
  const stepLb = envNum("PREDICTION_SWEEP_STEP_LB", 0.25);
  const travelMinutes = envNum("PREDICTION_SWEEP_TRAVEL_MIN", 15);
  const livewellRaw = envNum("PREDICTION_SWEEP_LIVEWELL", 1);
  const livewellCount: 1 | 2 = livewellRaw >= 2 ? 2 : 1;
  const shirtPurchased = envBool("PREDICTION_SWEEP_SHIRT", false);
  const delayMs = envNum("PREDICTION_SWEEP_DELAY_MS", 150);

  if (minLb > maxLb || stepLb <= 0) {
    console.error("Invalid PREDICTION_SWEEP_* range (need min <= max and step > 0).");
    process.exit(1);
  }

  const weights = buildWeightGrid(minLb, maxLb, stepLb);

  console.log(`Prediction sweep → ${base}`);
  console.log(
    `Every ${intervalMs}ms: ${weights.length} weights from ${minLb}–${maxLb} lb (step ${stepLb}); travel ${travelMinutes} min; livewell ${livewellCount}; shirt ${shirtPurchased}; inter-request delay ${delayMs}ms`,
  );
  console.log("Ctrl+C to stop. Ensure training capture is on if you want JSONL logs.\n");

  const health = await getHealth(base);
  if (!health.ok) {
    console.error(`Cannot reach API: GET ${base}/api/health failed — ${health.err ?? "unknown"}`);
    console.error("");
    console.error("Fix the base URL, e.g.:");
    console.error("  export PREDICTION_SWEEP_API_BASE=http://127.0.0.1:8787   # default fish:dev port");
    console.error("  export PREDICTION_SWEEP_PORT=3000                     # if your server uses PORT=3000");
    console.error("Then run: npm run sweep:predictions");
    process.exit(1);
  }
  console.log(`Health check OK: ${base}/api/health\n`);

  let sweepRunning = false;

  const tick = async () => {
    if (sweepRunning) {
      console.warn(`[${new Date().toISOString()}] Previous sweep still running; skipping tick.`);
      return;
    }
    sweepRunning = true;
    const t0 = Date.now();
    console.log(`[${new Date().toISOString()}] Sweep start (${weights.length} requests)…`);
    const { ok, fail } = await runSweepOnce(
      base,
      weights,
      { travelMinutes, livewellCount, shirtPurchased },
      delayMs,
    );
    const ms = Date.now() - t0;
    console.log(`[${new Date().toISOString()}] Sweep done in ${ms}ms — ok ${ok}, fail ${fail}\n`);
    sweepRunning = false;
  };

  const bootDelay = envNum("PREDICTION_SWEEP_BOOT_DELAY_MS", 3000);
  setTimeout(() => {
    void tick();
  }, bootDelay);

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);

  const stop = () => {
    clearInterval(timer);
    console.log("\nPrediction sweep stopped.");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

mainAsync().catch((e) => {
  console.error(e);
  process.exit(1);
});

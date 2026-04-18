const API_STORAGE_KEY = "fishApiBase";

function defaultApiBase() {
  if (typeof window === "undefined") return "";
  if (window.location.protocol === "file:") return "http://localhost:3000";
  // Same host/port as this page (e.g. Express serving static + API on one port).
  return "";
}

function getApiBase() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("api");
  if (fromQuery) {
    try {
      localStorage.setItem(API_STORAGE_KEY, fromQuery);
    } catch {
      /* ignore */
    }
    return fromQuery.replace(/\/$/, "");
  }
  try {
    const stored = localStorage.getItem(API_STORAGE_KEY);
    if (stored) return stored.replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  return defaultApiBase();
}

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}

/** @type {ReturnType<typeof setInterval> | null} */
let mockClockTimer = null;

/** @type {ReturnType<typeof setInterval> | null} */
let leaderboardPollTimer = null;

/** Whether last /api/health reported mock mode (faster poll). */
let apiMockMode = false;

const LEADERBOARD_POLL_MS_MOCK = 2000;
const LEADERBOARD_POLL_MS_LIVE = 15000;

function stopLeaderboardPoll() {
  if (leaderboardPollTimer != null) {
    clearInterval(leaderboardPollTimer);
    leaderboardPollTimer = null;
  }
}

function startLeaderboardPoll() {
  stopLeaderboardPoll();
  if (document.hidden) return;
  const ms = apiMockMode ? LEADERBOARD_POLL_MS_MOCK : LEADERBOARD_POLL_MS_LIVE;
  leaderboardPollTimer = setInterval(async () => {
    await loadLeaderboard({ silent: true });
    await loadPayoutStatus();
  }, ms);
}

function formatMockChicagoTime(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return String(isoString);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

function stopMockClock() {
  if (mockClockTimer != null) {
    clearInterval(mockClockTimer);
    mockClockTimer = null;
  }
  const wrap = document.getElementById("mockClockWrap");
  if (wrap) wrap.hidden = true;
}

async function tickMockClock() {
  try {
    const h = await fetchJson("/api/health");
    if (!h.mockLeaderboard) {
      stopMockClock();
      el("mockBanner").hidden = true;
      return;
    }

    const wrap = document.getElementById("mockClockWrap");
    const timeEl = document.getElementById("mockClockTime");
    const metaEl = document.getElementById("mockClockMeta");
    const sim = h.simulation;

    if (wrap) wrap.hidden = false;
    if (timeEl && sim?.simulatedIso) {
      timeEl.textContent = formatMockChicagoTime(sim.simulatedIso);
    }
    if (metaEl && sim) {
      const scale = sim.timeScale ?? 20;
      const simMin = sim.simulatedElapsedMinutes ?? 0;
      metaEl.textContent = `${scale}× real speed · ${simMin.toFixed(1)} simulated minutes since start · bubble vs ~${h.payoutPlacesHeuristic ?? 45}th place`;
    }
  } catch {
    stopMockClock();
    const wrap = document.getElementById("mockClockWrap");
    if (wrap) wrap.hidden = true;
  }
}

function startMockClock() {
  stopMockClock();
  tickMockClock();
  mockClockTimer = setInterval(tickMockClock, 1000);
}

async function fetchJson(path, options) {
  const base = getApiBase();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options?.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Bad JSON from ${url}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const err = data?.error || res.statusText;
    throw new Error(typeof err === "string" ? err : JSON.stringify(err));
  }
  return data;
}

function renderPayoutStatus(data) {
  const t = el("payoutStatusText");
  const day = data.tournamentDay;
  const win = data.activeWindow;
  if (!day) {
    t.textContent =
      "Not a tournament day (configure BBB_SATURDAY_DATE / BBB_SUNDAY_DATE or use a weekend).";
    return;
  }
  if (!win) {
    t.textContent = `${day}: no payout window right now (Central). Between windows or outside 6:30am–3pm.`;
    return;
  }
  t.textContent = `${day} — ${win.window.label} — ~${win.minutesLeftInPeriod.toFixed(1)} min left in period (Central).`;
}

async function loadHealthBanner() {
  try {
    const h = await fetchJson("/api/health");
    apiMockMode = !!h.mockLeaderboard;
    const banner = el("mockBanner");
    const text = el("mockBannerText");
    if (h.mockLeaderboard) {
      banner.hidden = false;
      const n = h.payoutPlacesHeuristic ?? 45;
      text.textContent = `Time-simulated weigh-ins and payouts (not live data). Leaderboard windows fill over time; past windows stay full. Heuristic: ~${n} paid places.`;
      startMockClock();
    } else {
      banner.hidden = true;
      stopMockClock();
    }
  } catch {
    apiMockMode = false;
    el("mockBanner").hidden = true;
    stopMockClock();
  }
}

async function loadPayoutStatus() {
  try {
    const data = await fetchJson("/api/payout-status");
    renderPayoutStatus(data);
  } catch (e) {
    el("payoutStatusText").textContent =
      e instanceof Error ? e.message : "Could not load payout status.";
  }
}

function renderPeriods(leaderboard) {
  const mount = el("periodsMount");
  // Preserve which periods are open across re-renders.
  const openKeys = new Set(
    Array.from(mount.querySelectorAll("details.fish-period-block[open]")).map(
      (d) => d.dataset.periodKey || "",
    ),
  );
  mount.innerHTML = "";
  const periods = leaderboard.periods || [];
  if (!periods.length) {
    mount.innerHTML = "<p class=\"fish-meta\">No Saturday/Sunday period tables parsed.</p>";
    return;
  }

  for (const p of periods) {
    const key = `${p.day}:${p.label}`;
    const block = document.createElement("details");
    block.className = "fish-period-block";
    block.dataset.periodKey = key;
    if (openKeys.has(key)) block.open = true;

    const summary = document.createElement("summary");
    summary.className = "fish-period-summary";
    const badge = p.rows.length ? `${p.rows.length} fish` : "empty";
    summary.innerHTML = `<span class="fish-period-title">${escapeHtml(p.day)} · ${escapeHtml(p.label)}</span><span class="fish-period-count">${badge}</span>`;
    block.appendChild(summary);

    const wrap = document.createElement("div");
    wrap.className = "fish-table-wrap";
    const table = document.createElement("table");
    table.className = "fish-table";
    table.innerHTML = `
      <thead><tr>
        <th>Rank</th><th>Name</th><th>Weigh station</th><th>Weight</th>
      </tr></thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");
    if (!p.rows.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td colspan=\"4\">No scores posted for this period.</td>";
      tbody.appendChild(tr);
    } else {
      for (const r of p.rows) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${escapeHtml(r.rank)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.weighStation)}</td><td>${escapeHtml(r.weightRaw)}</td>`;
        tbody.appendChild(tr);
      }
    }
    wrap.appendChild(table);
    block.appendChild(wrap);
    mount.appendChild(block);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.silent] If true, no "Loading…" flash (used for auto-refresh).
 */
async function loadLeaderboard(opts = {}) {
  const silent = opts.silent === true;
  const meta = el("leaderboardMeta");
  if (!silent) {
    meta.textContent = "Loading…";
  }
  try {
    const data = await fetchJson("/api/leaderboard");
    const pollSec = (apiMockMode ? LEADERBOARD_POLL_MS_MOCK : LEADERBOARD_POLL_MS_LIVE) / 1000;
    meta.textContent = `Source: ${data.sourceUrl} — fetched ${data.fetchedAt} (cache to ${data.expiresAt}) · Auto-refresh every ${pollSec}s.`;
    renderPeriods(data.leaderboard);
  } catch (e) {
    meta.textContent = e instanceof Error ? e.message : String(e);
  }
}

async function refreshLeaderboard() {
  const meta = el("leaderboardMeta");
  meta.textContent = "Refreshing…";
  try {
    const data = await fetchJson("/api/leaderboard/refresh", { method: "POST" });
    const pollSec = (apiMockMode ? LEADERBOARD_POLL_MS_MOCK : LEADERBOARD_POLL_MS_LIVE) / 1000;
    meta.textContent = `Source: ${data.sourceUrl} — fetched ${data.fetchedAt} · Auto-refresh every ${pollSec}s`;
    renderPeriods(data.leaderboard);
  } catch (e) {
    meta.textContent = e instanceof Error ? e.message : String(e);
  }
}

const SHIRT_STORAGE_KEY = "fishShirtPurchased";

async function submitReco(ev) {
  ev.preventDefault();
  const fishWeightLb = Number(el("fishWeightLb").value);
  const travelMinutes = Number(el("travelMinutes").value || 0);
  const livewellCount = el("livewellCount").value === "2" ? 2 : 1;
  const secondRaw = el("secondFishWeightLb").value;
  const manualRaw = el("manualMinutesLeft").value;
  const shirtPurchased = el("shirtPurchased").checked === true;

  const body = {
    fishWeightLb,
    travelMinutes,
    livewellCount,
    shirtPurchased,
  };
  if (secondRaw !== "") body.secondFishWeightLb = Number(secondRaw);
  if (manualRaw !== "") body.manualMinutesLeft = Number(manualRaw);

  const box = el("recoBox");
  try {
    const data = await fetchJson("/api/recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const r = data.recommendation;
    box.hidden = false;
    el("recoSummary").textContent = r.summary;
    el("recoDetail").textContent = r.detail;
    renderActionPill(r.action);
    renderLikelihood(r);
    renderForecasts(r);
    el("recoDisclaimer").textContent = r.disclaimer;
  } catch (e) {
    box.hidden = false;
    el("recoSummary").textContent = "Error";
    el("recoDetail").textContent = e instanceof Error ? e.message : String(e);
    renderActionPill(null);
    renderLikelihood(null);
    renderForecasts(null);
    el("recoDisclaimer").textContent = "";
  }
}

const ACTION_LABELS = {
  "weigh-now": "Weigh now",
  "weigh-before-end": "Weigh before close",
  wait: "Keep fishing",
  "wait-for-next-window": "Wait for next window",
  "cannot-make": "Can't make it",
};

function renderActionPill(action) {
  const pill = el("recoAction");
  pill.classList.remove(
    "fish-action-weigh-now",
    "fish-action-weigh-before-end",
    "fish-action-wait",
    "fish-action-wait-for-next-window",
    "fish-action-cannot-make",
  );
  if (!action || !ACTION_LABELS[action]) {
    pill.hidden = true;
    pill.textContent = "";
    return;
  }
  pill.hidden = false;
  pill.classList.add(`fish-action-${action}`);
  pill.textContent = ACTION_LABELS[action];
}

function renderLikelihood(r) {
  const wrap = el("recoLikelihood");
  const pct = el("recoLikelihoodPct");
  const label = el("recoLikelihoodLabel");
  const meta = el("recoLikelihoodMeta");
  const rankWrap = el("recoRankWrap");
  const rankEl = el("recoProjectedRank");
  const rankLabel = el("recoProjectedRankLabel");

  if (!r || (r.payoutLikelihoodPercent == null && !r.payoutLikelihoodDetail)) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  if (r.payoutLikelihoodPercent != null) {
    pct.textContent = `${r.payoutLikelihoodPercent}%`;
    label.textContent = `chance still paid at window close (~${r.comparedToPlace ?? 45} spots)`;
  } else {
    pct.textContent = "—";
    label.textContent = "(insufficient data for probability)";
  }

  if (r.projectedRank != null) {
    rankWrap.hidden = false;
    const paid = r.comparedToPlace ?? 45;
    const out = r.projectedRank > paid;
    rankEl.classList.toggle("is-out", out);
    const range =
      r.projectedRankLow != null &&
      r.projectedRankHigh != null &&
      r.projectedRankHigh > r.projectedRankLow
        ? ` (${r.projectedRankLow}–${r.projectedRankHigh})`
        : "";
    rankEl.textContent = `#${r.projectedRank}${range}`;
    rankLabel.textContent = `projected final rank${out ? ` — outside top ${paid}` : ` — paid spot`}`;
  } else {
    rankWrap.hidden = true;
    rankEl.classList.remove("is-out");
  }

  const metaBits = [];
  if (r.payoutLikelihoodDetail) metaBits.push(r.payoutLikelihoodDetail);
  if (r.currentRank != null) {
    metaBits.push(`If weighed now: rank #${r.currentRank}.`);
  }
  if (r.historicalOnlyRank != null) {
    metaBits.push(`Average rank in archived years: #${r.historicalOnlyRank}.`);
  }
  if (r.historicalOnlyPercent != null && r.historicalOnlyPercent !== r.payoutLikelihoodPercent) {
    metaBits.push(`History-only pay probability: ~${r.historicalOnlyPercent}%.`);
  }
  if (r.minutesLeftInPeriod != null && r.fractionWindowElapsed != null) {
    const elapsedPct = Math.round((r.fractionWindowElapsed ?? 0) * 100);
    metaBits.push(
      `Window: ${elapsedPct}% elapsed, ${r.minutesLeftInPeriod.toFixed(1)} min left (effective ${r.effectiveMinutesLeft.toFixed(1)} after travel).`,
    );
  }
  meta.textContent = metaBits.join(" ");
}

function formatLeadTime(mins) {
  if (!Number.isFinite(mins)) return "";
  if (mins <= 1) return "now";
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh === 0 ? `${d}d` : `${d}d ${rh}h`;
}

function shortDay(day) {
  return day === "Saturday" ? "Sat" : day === "Sunday" ? "Sun" : day;
}

function renderForecasts(r) {
  const wrap = el("forecastBox");
  const list = el("forecastList");
  const pill = el("trendPill");
  const hint = el("forecastHint");
  list.innerHTML = "";
  pill.hidden = true;
  pill.className = "fish-trend-pill";
  pill.textContent = "";

  if (!r || !Array.isArray(r.windowForecasts) || r.windowForecasts.length === 0) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;

  if (r.trend && typeof r.trend.factor === "number") {
    const f = r.trend.factor;
    const pct = Math.round((f - 1) * 100);
    let cls = "fish-trend-flat";
    let label = `Trend x${f.toFixed(2)}`;
    if (f > 1.02) {
      cls = "fish-trend-hot";
      label = `Hot: +${pct}% vs history`;
    } else if (f < 0.98) {
      cls = "fish-trend-slow";
      label = `Slow: ${pct}% vs history`;
    } else {
      label = "In line with history";
    }
    pill.hidden = false;
    pill.classList.add(cls);
    pill.textContent = label;
    if (r.trend.confidence != null) {
      pill.title = `Confidence ${(r.trend.confidence * 100).toFixed(0)}% from ${r.trend.dataPoints?.length ?? 0} observed windows`;
    }
  }

  if (r.waitCandidate) {
    const wc = r.waitCandidate;
    hint.textContent = `Tip: ${wc.label} looks better by +${Math.round(wc.advantagePoints)} pts (in ${formatLeadTime(wc.minutesUntilStart)}). Fish must be weighed the same day caught.`;
  } else {
    hint.textContent = "Today's windows only — a fish caught today can't be weighed tomorrow.";
  }

  const bestKey = r.bestWindowKey;
  for (const f of r.windowForecasts) {
    const row = document.createElement("div");
    row.className = `fish-forecast-row fish-forecast-${f.status}`;
    if (f.key === bestKey) row.classList.add("is-best");

    const left = document.createElement("div");
    left.className = "fish-forecast-left";
    const title = document.createElement("div");
    title.className = "fish-forecast-title";
    const uniqueDays = new Set(r.windowForecasts.map((w) => w.day));
    const labelCore = f.label.replace(/^\w+\s+/, "");
    title.textContent = uniqueDays.size > 1 ? `${shortDay(f.day)} · ${labelCore}` : labelCore;

    const sub = document.createElement("div");
    sub.className = "fish-forecast-sub";
    if (f.status === "current") {
      sub.textContent = `Now · ${formatLeadTime(f.minutesUntilEnd)} left`;
    } else if (f.status === "future") {
      sub.textContent = `Starts in ${formatLeadTime(f.minutesUntilStart)}`;
    } else {
      sub.textContent = "Closed";
    }

    left.appendChild(title);
    left.appendChild(sub);

    const cutoff = document.createElement("div");
    cutoff.className = "fish-forecast-cutoff";
    const cutoffVal =
      f.projectedFinalBubbleLb != null
        ? `${f.projectedFinalBubbleLb.toFixed(2)} lb`
        : f.historicalMeanLb != null
        ? `${f.historicalMeanLb.toFixed(2)} lb`
        : "—";
    const cutoffLabel =
      f.status === "past"
        ? "actual bubble"
        : f.status === "current"
        ? "projected bubble"
        : "expected bubble";
    cutoff.innerHTML = `<span class="fish-forecast-cutoff-val">${escapeHtml(cutoffVal)}</span><span class="fish-forecast-cutoff-label">${escapeHtml(cutoffLabel)}</span>`;

    const metric = document.createElement("div");
    metric.className = "fish-forecast-metric";
    if (f.payoutLikelihoodPercent != null) {
      const paid = f.payoutLikelihoodPercent >= 50;
      metric.innerHTML = `<span class="fish-forecast-pct ${paid ? "is-in" : "is-out"}">${f.payoutLikelihoodPercent}%</span><span class="fish-forecast-pct-label">${f.status === "past" ? "would pay" : "chance paid"}</span>`;
    } else {
      metric.innerHTML = `<span class="fish-forecast-pct">—</span><span class="fish-forecast-pct-label">no data</span>`;
    }

    row.appendChild(left);
    row.appendChild(cutoff);
    row.appendChild(metric);
    list.appendChild(row);
  }
}

async function boot() {
  await loadHealthBanner();
  await loadPayoutStatus();
  await loadLeaderboard({ silent: false });
  startLeaderboardPoll();
}

function init() {
  const apiInput = el("apiBase");
  apiInput.value = getApiBase();
  apiInput.addEventListener("change", async () => {
    const v = apiInput.value.trim().replace(/\/$/, "");
    try {
      localStorage.setItem(API_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
    stopLeaderboardPoll();
    await loadHealthBanner();
    await loadPayoutStatus();
    await loadLeaderboard({ silent: false });
    startLeaderboardPoll();
  });

  const livewellSel = el("livewellCount");
  const secondFishWrap = el("secondFishWrap");
  const syncSecondFish = () => {
    secondFishWrap.hidden = livewellSel.value !== "2";
  };
  livewellSel.addEventListener("change", syncSecondFish);
  syncSecondFish();

  const shirtInput = el("shirtPurchased");
  try {
    const stored = localStorage.getItem(SHIRT_STORAGE_KEY);
    if (stored === "1") shirtInput.checked = true;
  } catch {
    /* ignore */
  }
  shirtInput.addEventListener("change", () => {
    try {
      localStorage.setItem(SHIRT_STORAGE_KEY, shirtInput.checked ? "1" : "0");
    } catch {
      /* ignore */
    }
  });

  el("recoForm").addEventListener("submit", submitReco);
  el("refreshLb").addEventListener("click", refreshLeaderboard);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopLeaderboardPoll();
    } else {
      startLeaderboardPoll();
      loadLeaderboard({ silent: true });
      loadPayoutStatus();
    }
  });

  boot();
}

init();

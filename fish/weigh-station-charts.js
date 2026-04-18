/**
 * Weigh station bar chart + table from /api/weigh-station-stats
 */
const API_BASE = "";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function defaultDateISO() {
  return new Date().toISOString().slice(0, 10);
}

function renderChart(stations, metric) {
  const mount = document.getElementById("wsChart");
  if (!mount) return;
  mount.innerHTML = "";
  if (!stations.length) {
    mount.innerHTML = "<p class=\"fish-meta\">No stations in this weight range.</p>";
    return;
  }
  const values = stations.map((s) => (metric === "totalLb" ? s.totalLb : s.count));
  const maxVal = Math.max(...values, 1e-6);

  const frag = document.createDocumentFragment();
  for (const s of stations) {
    const v = metric === "totalLb" ? s.totalLb : s.count;
    const pct = Math.min(100, (v / maxVal) * 100);
    const row = document.createElement("div");
    row.className = "fish-ws-bar-row";
    row.innerHTML = `
      <div class="fish-ws-bar-label" title="${esc(s.displayName)}">${esc(s.displayName)}</div>
      <div class="fish-ws-bar-track">
        <div class="fish-ws-bar-fill" style="width:${pct.toFixed(2)}%"></div>
      </div>
      <div class="fish-ws-bar-val">${metric === "totalLb" ? esc(String(s.totalLb)) : esc(String(s.count))}</div>
    `;
    frag.appendChild(row);
  }
  mount.appendChild(frag);
}

function renderTable(stations) {
  const tbody = document.getElementById("wsTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  for (const s of stations) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(s.displayName)}</td>
      <td>${esc(String(s.count))}</td>
      <td>${esc(String(s.totalLb))}</td>
      <td>${esc(String(s.maxLb))}</td>
      <td>${esc(s.topFishName)} (${esc(String(s.maxLb))} lb)</td>
    `;
    tbody.appendChild(tr);
  }
}

async function load() {
  const dateEl = document.getElementById("wsDate");
  const minEl = document.getElementById("wsMinLb");
  const maxEl = document.getElementById("wsMaxLb");
  const periodEl = document.getElementById("wsPeriod");
  const metricEl = document.getElementById("wsMetric");
  const status = document.getElementById("wsStatus");
  const date = dateEl && "value" in dateEl ? String(dateEl.value).trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    if (status) status.textContent = "Pick a valid date.";
    return;
  }
  const minLb = minEl && "value" in minEl ? minEl.value : "0";
  const maxLb = maxEl && "value" in maxEl ? maxEl.value : "10";
  const period = periodEl && "value" in periodEl ? String(periodEl.value).trim() : "";
  const metric = metricEl && "value" in metricEl ? String(metricEl.value) : "count";

  if (status) status.textContent = "Loading…";

  let u = `${API_BASE}/api/weigh-station-stats?date=${encodeURIComponent(date)}&minLb=${encodeURIComponent(minLb)}&maxLb=${encodeURIComponent(maxLb)}&metric=${encodeURIComponent(metric)}`;
  if (period) u += `&period=${encodeURIComponent(period)}`;

  let data;
  try {
    const res = await fetch(u);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (status) status.textContent = body.error || `HTTP ${res.status}`;
      return;
    }
    data = body;
  } catch (e) {
    if (status) status.textContent = e instanceof Error ? e.message : "Request failed";
    return;
  }

  if (status) {
    status.textContent = `Loaded ${data.stations?.length ?? 0} station(s), ${data.totalFishInFilter ?? 0} fish in weight range. Locations file: ${data.locationsLoaded ?? 0} entries.`;
  }

  const summary = document.getElementById("wsSummary");
  const summaryText = document.getElementById("wsSummaryText");
  const overall = document.getElementById("wsOverallTop");
  if (summary) summary.hidden = false;
  if (summaryText) {
    summaryText.textContent = `Range ${data.minLb}–${data.maxLb} lb. Periods: ${(data.periodsIncluded || []).join(", ") || "—"}.`;
  }
  if (overall) {
    const t = data.overallTopFish;
    if (t) {
      overall.innerHTML = `<p class="fish-floor-value" style="margin:0 0 8px;font-size:1.25rem;">Heaviest in range: <strong>${esc(t.name)}</strong> — ${esc(String(t.weightLb))} lb <span class="fish-meta">(${esc(t.stationDisplayName)} · ${esc(t.periodKey)})</span></p>`;
    } else {
      overall.innerHTML = "<p class=\"fish-meta\">No fish in this weight range.</p>";
    }
  }

  const chartSec = document.getElementById("wsChartSection");
  const tableSec = document.getElementById("wsTableSection");
  if (chartSec) chartSec.hidden = false;
  if (tableSec) tableSec.hidden = false;

  renderChart(data.stations || [], metric);
  renderTable(data.stations || []);
}

function init() {
  const date = document.getElementById("wsDate");
  if (date && "value" in date && !date.value) date.value = defaultDateISO();
  document.getElementById("wsLoadBtn")?.addEventListener("click", () => void load());
}

init();

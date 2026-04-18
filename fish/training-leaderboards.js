/**
 * Fetches /api/training-leaderboards?date=YYYY-MM-DD and renders per-period tables.
 */
const API_BASE = "";

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMs(ms) {
  if (!ms || !Number.isFinite(ms)) return "—";
  try {
    return new Date(ms).toLocaleString("en-US", { timeZone: "America/Chicago" });
  } catch {
    return "—";
  }
}

function periodSummaryBadge(p) {
  const parts = [];
  if (p.entryCount > 0) parts.push(`${p.entryCount} fish`);
  else parts.push("empty");
  if (p.groundTruth === "merged") parts.push("merged");
  else if (p.groundTruth === "single_snapshot") parts.push("single snapshot");
  return parts.join(" · ");
}

function renderPeriod(p, placesN) {
  const gt =
    p.groundTruth === "merged"
      ? "Merged (all snapshots, one row per angler, latest weight)"
      : p.groundTruth === "single_snapshot"
        ? "Single snapshot (richest scrape — identity missing for merge)"
        : "No captures for this window";
  const threshold = p.meetsEvalCompleteThreshold ? "yes" : "no";
  const lines =
    p.entries.length === 0
      ? '<p class="fish-meta fish-training-empty">No rows in training data for this period.</p>'
      : `<div class="fish-table-wrap"><table class="fish-table" aria-label="${esc(p.key)}">
<thead><tr><th scope="col">Rank</th><th scope="col">Weight (lb)</th><th scope="col">Angler</th><th scope="col">Station</th></tr></thead>
<tbody>${p.entries
  .map(
    (r) =>
      `<tr><td>${esc(String(r.rank))}</td><td>${esc(r.weightLb.toFixed(2))}</td><td>${esc(r.name || "—")}</td><td>${esc(r.weighStation || "—")}</td></tr>`,
  )
  .join("")}</tbody></table></div>`;

  return el(`<details class="fish-period-block fish-training-period" data-period-key="${esc(p.key)}">
  <summary class="fish-period-summary">
    <span class="fish-period-title">${esc(p.day)} · ${esc(p.windowLabel)} <span class="fish-training-key">(${esc(p.key)})</span></span>
    <span class="fish-period-count">${esc(periodSummaryBadge(p))}</span>
  </summary>
  <div class="fish-training-details-inner">
    <p class="fish-meta fish-training-meta">${esc(gt)} · meets ≥N for eval: <strong>${esc(threshold)}</strong> (N=${esc(String(placesN))}) · ref time: ${esc(fmtMs(p.fetchedAtMs))}</p>
    ${lines}
  </div>
</details>`);
}

async function load(dateStr) {
  const status = document.getElementById("trainStatus");
  const root = document.getElementById("periodsRoot");
  if (!status || !root) return;

  status.textContent = "Loading…";
  const openKeys = new Set(
    Array.from(root.querySelectorAll("details.fish-training-period[open]")).map(
      (d) => d.dataset.periodKey || "",
    ),
  );
  root.innerHTML = "";

  const url = `${API_BASE}/api/training-leaderboards?date=${encodeURIComponent(dateStr)}`;
  let data;
  try {
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      status.textContent = body.error || `HTTP ${res.status}`;
      return;
    }
    data = body;
  } catch (e) {
    status.textContent = e instanceof Error ? e.message : "Request failed";
    return;
  }

  const placesN = data.placesPaidHeuristic ?? 46;
  status.textContent = `Loaded ${data.date} — ${data.periods.filter((x) => x.entryCount > 0).length} period(s) with data.`;

  const frag = document.createDocumentFragment();
  for (const p of data.periods) {
    const node = renderPeriod(p, placesN);
    const key = p.key || "";
    node.open = openKeys.has(key);
    frag.appendChild(node);
  }
  root.appendChild(frag);
}

function defaultDateISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function init() {
  const input = document.getElementById("trainDate");
  const btn = document.getElementById("loadBtn");
  if (input && "value" in input && !input.value) {
    input.value = defaultDateISO();
  }
  btn?.addEventListener("click", () => {
    const v = input && "value" in input ? String(input.value).trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const st = document.getElementById("trainStatus");
      if (st) st.textContent = "Pick a valid date.";
      return;
    }
    void load(v);
  });
}

init();

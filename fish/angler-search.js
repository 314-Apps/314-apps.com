/**
 * Debounced search against /api/anglers/search. Renders one card per angler with a fish table
 * (weight, station, tournament date, payout window, first-seen Chicago-local time).
 */
const API_BASE = "";
const DEBOUNCE_MS = 250;

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtLb(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} lb`;
}

function fmtMsChicago(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "—";
  try {
    return new Date(ms).toLocaleString("en-US", { timeZone: "America/Chicago" });
  } catch {
    return "—";
  }
}

function renderFishRow(f) {
  const weight = f.weightLb != null ? `${Number(f.weightLb).toFixed(2)}` : esc(f.weightRaw || "—");
  const station = esc(f.weighStation || "—");
  const date = esc(f.tournamentDate || "—");
  const windowLabel = [f.periodDay, f.periodLabel].filter(Boolean).join(" · ") || "—";
  const firstSeen = f.firstSeenIso && f.firstSeenIso.length > 0
    ? esc(f.firstSeenIso)
    : esc(fmtMsChicago(f.firstSeenAtMs));
  return `<tr>
    <td>${esc(weight)}</td>
    <td>${station}</td>
    <td>${date}</td>
    <td>${esc(windowLabel)}</td>
    <td>${firstSeen}</td>
  </tr>`;
}

function renderAnglerCard(a) {
  const fishRows = a.fish.map(renderFishRow).join("");
  const station = esc(a.weighStation || "—");
  const name = esc(a.displayName || "—");
  const fishWord = a.fishCount === 1 ? "fish" : "fish";
  return el(`<section class="fish-card fish-angler-card" data-angler-key="${esc(a.anglerKey)}">
    <header class="fish-angler-head">
      <h2 class="fish-angler-name">${name}</h2>
      <p class="fish-meta fish-angler-meta">${station} · ${esc(fmtLb(a.totalWeightLb))} total · ${esc(String(a.fishCount))} ${fishWord}</p>
    </header>
    <div class="fish-table-wrap">
      <table class="fish-table fish-angler-fish" aria-label="Fish for ${name}">
        <thead>
          <tr>
            <th scope="col">Weight (lb)</th>
            <th scope="col">Station</th>
            <th scope="col">Date</th>
            <th scope="col">Payout window</th>
            <th scope="col">First seen (Chicago)</th>
          </tr>
        </thead>
        <tbody>${fishRows}</tbody>
      </table>
    </div>
  </section>`);
}

let currentRequestId = 0;

async function runSearch(q) {
  const status = document.getElementById("anglerStatus");
  const root = document.getElementById("anglerResults");
  if (!status || !root) return;

  const trimmed = q.trim();
  if (trimmed.length === 0) {
    status.textContent = "Type a name to search.";
    root.innerHTML = "";
    return;
  }

  const reqId = ++currentRequestId;
  status.textContent = `Searching for "${trimmed}"…`;

  const url = `${API_BASE}/api/anglers/search?q=${encodeURIComponent(trimmed)}`;
  let data;
  try {
    const res = await fetch(url);
    const body = await res.json().catch(() => ({}));
    if (reqId !== currentRequestId) return;
    if (!res.ok) {
      status.textContent = body.error || `HTTP ${res.status}`;
      root.innerHTML = "";
      return;
    }
    data = body;
  } catch (e) {
    if (reqId !== currentRequestId) return;
    status.textContent = e instanceof Error ? e.message : "Request failed";
    root.innerHTML = "";
    return;
  }

  const results = Array.isArray(data.results) ? data.results : [];
  if (results.length === 0) {
    status.textContent = `No anglers matched "${trimmed}".`;
    root.innerHTML = "";
    return;
  }

  const anglerWord = results.length === 1 ? "angler" : "anglers";
  status.textContent = `${results.length} matching ${anglerWord} for "${trimmed}".`;
  const frag = document.createDocumentFragment();
  for (const a of results) {
    frag.appendChild(renderAnglerCard(a));
  }
  root.innerHTML = "";
  root.appendChild(frag);
}

function debounce(fn, ms) {
  let handle;
  return (...args) => {
    if (handle) clearTimeout(handle);
    handle = setTimeout(() => fn(...args), ms);
  };
}

function init() {
  const input = document.getElementById("anglerQuery");
  const status = document.getElementById("anglerStatus");
  if (!input) return;
  if (status) status.textContent = "Type a name to search.";
  const debounced = debounce((v) => {
    void runSearch(v);
  }, DEBOUNCE_MS);
  input.addEventListener("input", (ev) => {
    const v = String(ev.target && "value" in ev.target ? ev.target.value : "");
    debounced(v);
  });
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      void runSearch(input.value || "");
    }
  });
}

init();

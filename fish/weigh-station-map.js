/**
 * Map view: /api/weigh-station-stats + lat/lng from weigh-station-locations.json (via API).
 * Requires global L from Leaflet (loaded before this module).
 */
const API_BASE = "";

/** Lake of the Ozarks approximate center */
const DEFAULT_CENTER = [38.12, -92.58];
const DEFAULT_ZOOM = 10;

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

let mapInstance = null;
let layerGroup = null;

function ensureMap() {
  const L = globalThis.L;
  if (!L) {
    return null;
  }
  const el = document.getElementById("wsMapMount");
  if (!el) return null;
  if (!mapInstance) {
    mapInstance = L.map(el).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(mapInstance);
    layerGroup = L.layerGroup().addTo(mapInstance);
  } else {
    layerGroup.clearLayers();
  }
  return { L, map: mapInstance, layerGroup };
}

async function loadMap() {
  const L = globalThis.L;
  const status = document.getElementById("wsMapStatus");
  const hint = document.getElementById("wsMapHint");
  const unmappedEl = document.getElementById("wsMapUnmapped");

  if (!L) {
    if (status) status.textContent = "Leaflet failed to load.";
    return;
  }

  const dateEl = document.getElementById("wsMapDate");
  const minEl = document.getElementById("wsMapMinLb");
  const maxEl = document.getElementById("wsMapMaxLb");
  const periodEl = document.getElementById("wsMapPeriod");
  const date = dateEl && "value" in dateEl ? String(dateEl.value).trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    if (status) status.textContent = "Pick a valid date.";
    return;
  }
  const minLb = minEl && "value" in minEl ? minEl.value : "0";
  const maxLb = maxEl && "value" in maxEl ? maxEl.value : "10";
  const period = periodEl && "value" in periodEl ? String(periodEl.value).trim() : "";

  if (status) status.textContent = "Loading…";

  let u = `${API_BASE}/api/weigh-station-stats?date=${encodeURIComponent(date)}&minLb=${encodeURIComponent(minLb)}&maxLb=${encodeURIComponent(maxLb)}`;
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

  const stations = data.stations || [];
  const withGeo = stations.filter((s) => typeof s.lat === "number" && typeof s.lng === "number");
  const withoutGeo = stations.filter((s) => typeof s.lat !== "number" || typeof s.lng !== "number");

  if (status) {
    status.textContent = `Plotted ${withGeo.length} station(s) with coordinates. ${data.locationsLoaded ?? 0} location(s) in JSON. ${withoutGeo.length} station(s) missing coordinates.`;
  }
  if (hint) {
    hint.textContent =
      withGeo.length === 0
        ? "No stations have lat/lng yet. Edit server/data/weigh-station-locations.json using keys from the chart page (normalized station names)."
        : "Circle radius scales with √count (min 6px). Station names are labeled on the map; click a circle for counts and weights.";
  }

  const ctx = ensureMap();
  if (!ctx) {
    if (status) status.textContent = "Map container missing.";
    return;
  }

  const { L: Leaflet, layerGroup: layers } = ctx;
  const bounds = [];

  for (const s of withGeo) {
    const r = Math.min(36, 6 + Math.sqrt(s.count) * 5);
    const m = Leaflet.circleMarker([s.lat, s.lng], {
      radius: r,
      color: "#0d5c2e",
      fillColor: "#5cb85c",
      fillOpacity: 0.55,
      weight: 2,
    });
    const stationTitle =
      typeof s.locationLabel === "string" && s.locationLabel.trim() !== ""
        ? s.locationLabel.trim()
        : String(s.displayName ?? "");
    m.bindTooltip(esc(stationTitle), {
      permanent: true,
      direction: "top",
      offset: [0, -r - 4],
      className: "ws-map-station-label",
    });
    m.bindPopup(
      `<strong>${esc(s.displayName)}</strong><br>${esc(String(s.count))} fish · ${esc(String(s.totalLb))} lb total<br>Max: ${esc(String(s.maxLb))} lb (${esc(s.topFishName)})`,
    );
    m.addTo(layers);
    bounds.push([s.lat, s.lng]);
  }

  if (bounds.length > 0) {
    ctx.map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
  } else {
    ctx.map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }

  if (unmappedEl) {
    if (withoutGeo.length === 0) {
      unmappedEl.textContent = "";
    } else {
      unmappedEl.innerHTML = `<strong>Stations without coordinates (${withoutGeo.length}):</strong> ${withoutGeo.map((s) => esc(s.displayName)).join(", ")}`;
    }
  }
}

function init() {
  const date = document.getElementById("wsMapDate");
  if (date && "value" in date && !date.value) date.value = defaultDateISO();
  document.getElementById("wsMapLoadBtn")?.addEventListener("click", () => void loadMap());
}

init();

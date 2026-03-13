import { csvParse } from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { Delaunay } from "https://cdn.jsdelivr.net/npm/d3-delaunay@6/+esm";

const CONFIG = {
  dataUrls: [
    "https://pm25.lass-net.org/GIS/voronoi/data/data.csv",
    "./data/data.csv",
    "/data/data.csv"
  ],
  refreshIntervalMs: 60000,
  maxBackoffMs: 300000,
  map: {
    center: [23.77, 120.88],
    zoom: 8,
    minZoom: 5,
    maxZoom: 19,
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  initialTypes: [
    "AirBox",
    "AirBoxK",
    "ASLUNG",
    "LASS",
    "MAPS",
    "RESCUE_TW",
    "CI_Taiwan",
    "ProbeCube",
    "Webduino",
    "AirQ",
    "AirU",
    "DustBoy",
    "CityAir",
    "AoT",
    "PurpleAir"
  ]
};

const REQUIRED_COLUMNS = [
  "id",
  "latitude",
  "longitude",
  "name",
  "type",
  "pm25",
  "color",
  "url",
  "label"
];

const PM25_COLORS = ["#31CF00", "#FFFF00", "#FF0000", "#CE30FF"];

const dom = {
  controls: document.getElementById("controls"),
  sensorCount: document.getElementById("sensor-count"),
  lastUpdated: document.getElementById("last-updated"),
  legendContent: document.getElementById("legend-content"),
  legendToggle: document.getElementById("legend-toggle"),
  selectedPanel: document.getElementById("selected-panel"),
  logoTime: document.getElementById("logo-time"),
  status: document.getElementById("status"),
  mobileToggle: document.getElementById("mobile-panel-toggle"),
  leftPanel: document.getElementById("left-panel"),
  legendPanel: document.getElementById("legend-panel")
};

let selectedSensorId = null;
let selectedTypes = new Set();
let allSensors = [];
let map = null;
let overlay = null;
let rafId = null;
let pollInterval = CONFIG.refreshIntervalMs;
let initializedFilters = false;
let latestProjectedPoints = [];

function setStatus(message, isError = false) {
  dom.status.textContent = message;
  dom.status.classList.toggle("is-error", isError);
}

function formatDockTime(now = new Date()) {
  const local = now.toLocaleString("zh-TW", {
    hour12: false,
    timeZone: "Asia/Taipei",
    timeZoneName: "short"
  });
  return `Current Time (Asia/Taipei): ${local}`;
}

function startLogoClock() {
  if (!dom.logoTime) {
    return;
  }

  const refresh = () => {
    dom.logoTime.textContent = formatDockTime();
  };

  refresh();
  window.setInterval(refresh, 1000);
}

function formatLastUpdated(rawValue) {
  const value = rawValue ? new Date(rawValue) : new Date();
  if (Number.isNaN(value.valueOf())) {
    return "Last updated: unknown";
  }

  const localeTime = value.toLocaleString("zh-TW", {
    hour12: false,
    timeZone: "Asia/Taipei",
    timeZoneName: "short"
  });

  return `Last updated: ${localeTime}`;
}

function normalizeUrl(url) {
  if (!url) {
    return "";
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return url.startsWith("/") ? url : `/${url}`;
}

function parseSensorIdentity(sensor) {
  const fallbackSource = sensor.type || "Unknown";
  const link = sensor.url
    ? sensor.url.startsWith("http://") || sensor.url.startsWith("https://")
      ? sensor.url
      : `${window.location.origin}${sensor.url.startsWith("/") ? sensor.url : `/${sensor.url}`}`
    : "";

  if (!link) {
    return { source: fallbackSource, deviceId: "N/A" };
  }

  try {
    const url = new URL(link);
    const source = url.searchParams.get("var-source") || fallbackSource;
    const rawDeviceId = url.searchParams.get("var-device_id") || "";
    const deviceId = rawDeviceId.replace(/,+$/, "").trim() || "N/A";
    return { source, deviceId };
  } catch {
    return { source: fallbackSource, deviceId: "N/A" };
  }
}

function parseCsv(csvText) {
  const rows = csvParse(csvText);
  const headers = rows.columns || [];
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));

  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(", ")}`);
  }

  const sensors = [];

  rows.forEach((row, idx) => {
    const line = idx + 2;
    const latitude = Number.parseFloat(row.latitude);
    const longitude = Number.parseFloat(row.longitude);
    const pm25 = Number.parseInt(row.pm25, 10);
    const id = String(row.id || "").trim();
    const name = String(row.name || "").trim();
    const type = String(row.type || "").trim();
    const color = String(row.color || "").trim();

    if (!id || !name || !type) {
      console.warn(`[csv] line ${line} skipped: id/name/type cannot be empty`);
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      console.warn(`[csv] line ${line} skipped: invalid latitude/longitude`);
      return;
    }
    if (!Number.isFinite(pm25)) {
      console.warn(`[csv] line ${line} skipped: invalid pm25`);
      return;
    }
    if (!/^[0-9a-fA-F]{6}$/.test(color)) {
      console.warn(`[csv] line ${line} skipped: invalid color format`);
      return;
    }

    sensors.push({
      id,
      latitude,
      longitude,
      name,
      type,
      pm25,
      color: color.toLowerCase(),
      url: normalizeUrl(String(row.url || "").trim()),
      label: String(row.label || "").trim()
    });
  });

  return sensors;
}

async function fetchCsvWithFallback(urls) {
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const csvText = await response.text();
      return {
        url,
        lastModified: response.headers.get("Last-Modified"),
        sensors: parseCsv(csvText)
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to fetch CSV from all candidates");
}

function buildLegend() {
  const levels = [
    { label: "0-34", color: "#31CF00" },
    { label: "35-52", color: "#FFFF00" },
    { label: "53-69", color: "#FF0000" },
    { label: "70+", color: "#CE30FF" }
  ];

  const ul = document.createElement("ul");
  ul.className = "legend-list";

  levels.forEach((level) => {
    const li = document.createElement("li");
    li.className = "legend-row";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = level.color;

    const text = document.createElement("span");
    text.textContent = level.label;

    li.append(swatch, text);
    ul.appendChild(li);
  });

  dom.legendContent.innerHTML = "";
  dom.legendContent.appendChild(ul);

  let collapsed = false;
  dom.legendToggle.addEventListener("click", () => {
    collapsed = !collapsed;
    dom.legendToggle.setAttribute("aria-expanded", String(!collapsed));
    dom.legendContent.hidden = collapsed;
  });
}

function renderSelectedPanel(sensor) {
  if (!sensor) {
    dom.selectedPanel.innerHTML = `
      <div class="selected-title">PM2.5 Voronoi Map</div>
      <div class="selected-subtitle">Click a Voronoi region to inspect a sensor.</div>
    `;
    return;
  }

  const link = sensor.url
    ? sensor.url.startsWith("http://") || sensor.url.startsWith("https://")
      ? sensor.url
      : `${window.location.origin}${sensor.url}`
    : "";
  const identity = parseSensorIdentity(sensor);

  dom.selectedPanel.innerHTML = "";

  const title = document.createElement("div");
  title.className = "selected-title";
  title.textContent = sensor.name;

  const meta = document.createElement("div");
  meta.className = "selected-meta";
  meta.textContent = `Source: ${identity.source} | PM2.5 bucket ${sensor.pm25}`;

  const device = document.createElement("div");
  device.className = "selected-device";
  device.textContent = `Device ID: ${identity.deviceId}`;

  const label = document.createElement("div");
  label.className = "selected-label";
  label.innerHTML = sensor.label || "-";

  dom.selectedPanel.append(title, meta, device, label);

  if (link) {
    const anchor = document.createElement("a");
    anchor.className = "selected-link";
    anchor.href = link;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = "Open sensor dashboard";
    dom.selectedPanel.appendChild(anchor);
  }
}

function groupTypes(sensors) {
  const mapByType = new Map();

  sensors.forEach((sensor) => {
    const current = mapByType.get(sensor.type);
    if (!current) {
      mapByType.set(sensor.type, {
        type: sensor.type,
        count: 1,
        previewColor: `#${sensor.color}`
      });
    } else {
      current.count += 1;
    }
  });

  return [...mapByType.values()].sort((a, b) => a.type.localeCompare(b.type));
}

function renderControls(sensors) {
  const grouped = groupTypes(sensors);
  const previous = new Set(selectedTypes);

  selectedTypes = new Set();

  grouped.forEach((entry) => {
    if (previous.has(entry.type)) {
      selectedTypes.add(entry.type);
      return;
    }

    if (!initializedFilters) {
      const token = entry.type.trim().split(/\s+/)[0];
      if (CONFIG.initialTypes.includes(entry.type) || CONFIG.initialTypes.includes(token)) {
        selectedTypes.add(entry.type);
      }
    }
  });

  dom.controls.innerHTML = "";

  grouped.forEach((entry) => {
    const row = document.createElement("label");
    row.className = "control-row";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "sensor-type";
    input.value = entry.type;
    input.checked = selectedTypes.has(entry.type);
    input.addEventListener("change", () => {
      if (input.checked) selectedTypes.add(entry.type);
      else selectedTypes.delete(entry.type);
      scheduleRender();
    });

    const dot = document.createElement("span");
    dot.className = "control-dot";
    dot.style.backgroundColor = entry.previewColor;

    const name = document.createElement("span");
    name.className = "control-name";
    name.textContent = entry.type;

    const count = document.createElement("span");
    count.className = "control-count";
    count.textContent = String(entry.count);

    row.append(input, dot, name, count);
    dom.controls.appendChild(row);
  });

  initializedFilters = true;
}

function getFilteredSensors() {
  if (selectedTypes.size === 0) {
    return [];
  }
  return allSensors.filter((sensor) => selectedTypes.has(sensor.type));
}

function removeOverlay() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

function getPm25Color(pm25, sensorId, sensorName) {
  if (!Number.isFinite(pm25) || pm25 < 0 || pm25 >= PM25_COLORS.length) {
    console.warn(`[voronoi] sensor ${sensorId} (${sensorName}) pm25 bucket ${pm25} mapped to highest color`);
    return PM25_COLORS[PM25_COLORS.length - 1];
  }
  return PM25_COLORS[pm25];
}

function renderVoronoi() {
  removeOverlay();

  const sensors = getFilteredSensors();
  const bounds = map.getBounds();
  const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
  const bottomRight = map.latLngToLayerPoint(bounds.getSouthEast());
  const drawLimit = bounds.pad(0.4);

  const existing = new Set();
  const projected = [];

  sensors.forEach((sensor) => {
    const latLng = L.latLng(sensor.latitude, sensor.longitude);
    if (!drawLimit.contains(latLng)) return;

    const pt = map.latLngToLayerPoint(latLng);
    const key = `${pt.x},${pt.y}`;
    if (existing.has(key)) return;

    existing.add(key);
    projected.push({ ...sensor, x: pt.x, y: pt.y });
  });

  dom.sensorCount.textContent = `${projected.length}/${allSensors.length}`;
  latestProjectedPoints = projected;

  if (!projected.length) {
    return;
  }

  const delaunay = Delaunay.from(projected, (p) => p.x, (p) => p.y);
  const voronoi = delaunay.voronoi([topLeft.x, topLeft.y, bottomRight.x, bottomRight.y]);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "voronoi-overlay";
  svg.setAttribute("class", "leaflet-zoom-hide voronoi-overlay");

  const mapSize = map.getSize();
  svg.style.width = `${mapSize.x}px`;
  svg.style.height = `${mapSize.y}px`;
  svg.style.marginLeft = `${topLeft.x}px`;
  svg.style.marginTop = `${topLeft.y}px`;

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("transform", `translate(${-topLeft.x},${-topLeft.y})`);
  svg.appendChild(g);

  projected.forEach((sensor, idx) => {
    const polygon = voronoi.cellPolygon(idx);
    if (!polygon || polygon.length < 3) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "voronoi-cell");
    path.setAttribute("tabindex", "0");
    path.setAttribute("role", "button");
    path.setAttribute("aria-label", `${sensor.name}, ${sensor.type}, pm25 ${sensor.pm25}`);
    path.setAttribute("d", `M${polygon.map(([x, y]) => `${x},${y}`).join("L")}Z`);
    path.style.fill = getPm25Color(sensor.pm25, sensor.id, sensor.name);

    if (selectedSensorId === sensor.id) {
      path.classList.add("is-selected");
    }

    const select = () => {
      selectedSensorId = sensor.id;
      renderSelectedPanel(sensor);
      scheduleRender();
    };

    path.addEventListener("click", select);
    path.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "voronoi-point");
    circle.setAttribute("cx", String(sensor.x));
    circle.setAttribute("cy", String(sensor.y));
    circle.setAttribute("r", "1.75");

    g.append(path, circle);
  });

  map.getPanes().overlayPane.appendChild(svg);
  overlay = svg;
}

function scheduleRender() {
  if (rafId !== null) {
    return;
  }

  rafId = window.requestAnimationFrame(() => {
    rafId = null;
    renderVoronoi();
  });
}

function selectNearestByLatLng(latLng) {
  if (!latestProjectedPoints.length) {
    return false;
  }

  const clickPoint = map.latLngToLayerPoint(latLng);
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  latestProjectedPoints.forEach((sensor) => {
    const dx = sensor.x - clickPoint.x;
    const dy = sensor.y - clickPoint.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = sensor;
    }
  });

  if (!best) {
    return false;
  }

  selectedSensorId = best.id;
  renderSelectedPanel(best);
  scheduleRender();
  return true;
}

async function refreshData() {
  try {
    setStatus("Updating sensor data...");
    const payload = await fetchCsvWithFallback(CONFIG.dataUrls);

    allSensors = payload.sensors;
    renderControls(allSensors);

    if (selectedSensorId && !allSensors.find((s) => s.id === selectedSensorId)) {
      selectedSensorId = null;
      renderSelectedPanel(null);
    }

    dom.lastUpdated.textContent = `${formatLastUpdated(payload.lastModified)} | Source: ${payload.url}`;
    setStatus("Live");

    scheduleRender();
    pollInterval = CONFIG.refreshIntervalMs;
    return true;
  } catch (error) {
    console.error(error);
    setStatus("Data update failed; retrying with backoff", true);
    pollInterval = Math.min(pollInterval * 2, CONFIG.maxBackoffMs);
    return false;
  }
}

function setupMobilePanels() {
  let open = false;

  const sync = () => {
    dom.mobileToggle.setAttribute("aria-expanded", String(open));
    dom.leftPanel.classList.toggle("is-mobile-open", open);
    dom.legendPanel.classList.toggle("is-mobile-open", open);
  };

  dom.mobileToggle.addEventListener("click", () => {
    open = !open;
    sync();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      open = false;
      sync();
    }
  });

  sync();
}

async function pollLoop() {
  await refreshData();
  window.setTimeout(pollLoop, pollInterval);
}

function initMap() {
  map = L.map("map", {
    attributionControl: true,
    maxZoom: CONFIG.map.maxZoom
  }).setView(CONFIG.map.center, CONFIG.map.zoom);

  L.tileLayer(CONFIG.map.tileUrl, {
    minZoom: CONFIG.map.minZoom,
    maxZoom: CONFIG.map.maxZoom,
    attribution: CONFIG.map.attribution
  }).addTo(map);

  L.control.scale({ position: "topright" }).addTo(map);

  map.on("moveend zoomend", scheduleRender);
  map.on("click", (event) => {
    selectNearestByLatLng(event.latlng);
  });
}

function bootstrap() {
  startLogoClock();
  buildLegend();
  renderSelectedPanel(null);
  setupMobilePanels();
  initMap();
  pollLoop();
}

bootstrap();

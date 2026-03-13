import "./styles/main.css";

import { loadAppConfig, fetchSensorsCsv } from "./data/fetchSensors";
import { createMap } from "./map/createMap";
import { createVoronoiRenderer } from "./voronoi/renderVoronoi";
import { createFilterControls, wireMobilePanels } from "./ui/controls";
import { createLegendControl } from "./ui/legend";
import { createSelectedPanel } from "./ui/selectedPanel";

const dom = {
  map: document.getElementById("map"),
  controls: document.getElementById("controls"),
  sensorCount: document.getElementById("sensor-count"),
  lastUpdated: document.getElementById("last-updated"),
  legendContent: document.getElementById("legend-content"),
  legendToggle: document.getElementById("legend-toggle"),
  selectedPanel: document.getElementById("selected-panel"),
  status: document.getElementById("status"),
  mobileToggle: document.getElementById("mobile-panel-toggle"),
  leftPanel: document.getElementById("left-panel"),
  legendPanel: document.getElementById("legend-panel")
};

const appDebug = {
  bootId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  refreshCount: 0,
  renderRequests: 0,
  lastPollIntervalMs: null
};
window.__appDebug = appDebug;

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

function setStatus(message, mode = "normal") {
  dom.status.textContent = message;
  dom.status.classList.toggle("is-error", mode === "error");
}

function groupSensorTypes(sensors) {
  const map = new Map();

  for (const sensor of sensors) {
    const current = map.get(sensor.type);
    if (!current) {
      map.set(sensor.type, {
        type: sensor.type,
        count: 1,
        previewColor: `#${sensor.color}`
      });
      continue;
    }

    current.count += 1;
  }

  return [...map.values()];
}

async function bootstrap() {
  const config = await loadAppConfig("/config.json");

  const map = createMap("map", config.map);
  const selectedPanel = createSelectedPanel(dom.selectedPanel);
  createLegendControl({
    container: dom.legendContent,
    toggleButton: dom.legendToggle
  });

  wireMobilePanels({
    toggleButton: dom.mobileToggle,
    panels: [dom.leftPanel, dom.legendPanel]
  });

  let selectedSensorId = null;
  let allSensors = [];
  let selectedTypes = new Set();

  const renderer = createVoronoiRenderer(map, {
    warn: (message) => console.warn(message),
    onSelect: (sensor) => {
      selectedSensorId = sensor.id;
      renderer.setSelectedSensorId(sensor.id);
      selectedPanel.setSensor(sensor);
    }
  });

  const controls = createFilterControls({
    container: dom.controls,
    initialTypes: config.ui.initialTypes,
    onSelectionChange: (nextSelectedTypes) => {
      selectedTypes = nextSelectedTypes;
      renderCurrentView();
    }
  });

  function getFilteredSensors() {
    if (selectedTypes.size === 0) {
      return [];
    }
    return allSensors.filter((sensor) => selectedTypes.has(sensor.type));
  }

  function renderCurrentView() {
    const filtered = getFilteredSensors();
    appDebug.renderRequests += 1;
    renderer.scheduleRender(filtered);
    dom.sensorCount.textContent = `${filtered.length}/${allSensors.length}`;
  }

  map.on("moveend zoomend", () => {
    renderCurrentView();
  });

  // Fallback selection path: if SVG cell click is swallowed by some browsers/layers,
  // clicking the map still selects the nearest Voronoi sensor.
  map.on("click", (event) => {
    renderer.selectByLatLng(event.latlng);
  });

  async function refreshSensors() {
    try {
      setStatus("Updating sensor data...");

      const payload = await fetchSensorsCsv(config.dataUrl, {
        warn: (message) => console.warn(message)
      });

      allSensors = payload.sensors;
      appDebug.refreshCount += 1;

      controls.setTypes(groupSensorTypes(allSensors));

      if (selectedSensorId) {
        const selected = allSensors.find((sensor) => sensor.id === selectedSensorId);
        if (!selected) {
          selectedSensorId = null;
          renderer.setSelectedSensorId(null);
          selectedPanel.clear();
        }
      }

      dom.lastUpdated.textContent = formatLastUpdated(payload.lastModified);
      setStatus("Live", "normal");
      return true;
    } catch (error) {
      console.error(error);
      setStatus("Data update failed; retrying with backoff", "error");
      return false;
    }
  }

  const baseInterval = config.refreshIntervalMs;
  const maxInterval = config.polling.maxIntervalMs;
  let pollInterval = baseInterval;

  async function pollLoop() {
    const success = await refreshSensors();
    if (success) {
      pollInterval = baseInterval;
    } else {
      pollInterval = Math.min(pollInterval * 2, maxInterval);
    }

    appDebug.lastPollIntervalMs = pollInterval;
    window.setTimeout(pollLoop, pollInterval);
  }

  await pollLoop();
}

bootstrap().catch((error) => {
  console.error(error);
  setStatus("Initialization failed", "error");
});

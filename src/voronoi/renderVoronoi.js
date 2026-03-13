import L from "leaflet";
import { Delaunay } from "d3-delaunay";

const SVG_NS = "http://www.w3.org/2000/svg";
const PM25_COLORS = ["#31CF00", "#FFFF00", "#FF0000", "#CE30FF"];

function toPath(points) {
  return `M${points.map(([x, y]) => `${x},${y}`).join("L")}Z`;
}

function createSvgElement(tagName, className) {
  const node = document.createElementNS(SVG_NS, tagName);
  if (className) {
    node.setAttribute("class", className);
  }
  return node;
}

export function buildVoronoiCells(projectedPoints, bbox) {
  if (!projectedPoints.length) {
    return [];
  }

  const delaunay = Delaunay.from(
    projectedPoints,
    (point) => point.x,
    (point) => point.y
  );
  const voronoi = delaunay.voronoi(bbox);

  return projectedPoints
    .map((point, index) => {
      const polygon = voronoi.cellPolygon(index);
      if (!polygon || polygon.length < 3) {
        return null;
      }
      return {
        point,
        polygon
      };
    })
    .filter(Boolean);
}

export function projectSensorsForVoronoi(map, sensors, drawPad = 0.4) {
  const bounds = map.getBounds();
  const drawLimit = bounds.pad(drawPad);
  const topLeft = map.latLngToLayerPoint(bounds.getNorthWest());
  const bottomRight = map.latLngToLayerPoint(bounds.getSouthEast());

  const existing = new Set();
  const projected = [];

  for (const sensor of sensors) {
    const latLng = new L.LatLng(sensor.latitude, sensor.longitude);
    if (!drawLimit.contains(latLng)) {
      continue;
    }

    const point = map.latLngToLayerPoint(latLng);
    const key = `${point.x},${point.y}`;
    if (existing.has(key)) {
      continue;
    }

    existing.add(key);
    projected.push({
      ...sensor,
      x: point.x,
      y: point.y
    });
  }

  return {
    projected,
    bbox: [topLeft.x, topLeft.y, bottomRight.x, bottomRight.y],
    topLeft,
    bottomRight,
    mapSize: map.getSize()
  };
}

export function getPm25Color(pm25Value, options = {}) {
  const warn = options.warn ?? (() => {});

  if (!Number.isFinite(pm25Value) || pm25Value < 0 || pm25Value >= PM25_COLORS.length) {
    warn(`[voronoi] pm25 bucket out of range: ${pm25Value}`);
    return PM25_COLORS[PM25_COLORS.length - 1];
  }

  return PM25_COLORS[pm25Value];
}

export function createVoronoiRenderer(map, options) {
  const onSelect = options.onSelect ?? (() => {});
  const warn = options.warn ?? (() => {});

  let selectedSensorId = null;
  let latestSensors = [];
  let latestProjectedPoints = [];
  let rafId = null;

  const warnedOutliers = new Set();
  const overlayPane = map.getPanes().overlayPane;

  function removeOverlay() {
    const current = overlayPane.querySelector("#voronoi-overlay");
    if (current) {
      current.remove();
    }
  }

  function emitOutlierWarning(sensor) {
    if (warnedOutliers.has(sensor.id)) {
      return;
    }
    warnedOutliers.add(sensor.id);
    warn(`[voronoi] sensor ${sensor.id} (${sensor.name}) pm25 bucket ${sensor.pm25} mapped to highest color`);
  }

  function drawNow() {
    removeOverlay();

    const { projected, bbox, topLeft, mapSize } = projectSensorsForVoronoi(map, latestSensors);
    latestProjectedPoints = projected;

    const svg = createSvgElement("svg");
    svg.setAttribute("id", "voronoi-overlay");
    svg.setAttribute("class", "leaflet-zoom-hide voronoi-overlay");
    svg.style.width = `${mapSize.x}px`;
    svg.style.height = `${mapSize.y}px`;
    svg.style.marginLeft = `${topLeft.x}px`;
    svg.style.marginTop = `${topLeft.y}px`;

    const group = createSvgElement("g");
    group.setAttribute("transform", `translate(${-topLeft.x},${-topLeft.y})`);
    svg.appendChild(group);

    const cells = buildVoronoiCells(projected, bbox);

    for (const cell of cells) {
      const sensor = cell.point;
      const path = createSvgElement("path", "voronoi-cell");
      const isSelected = selectedSensorId === sensor.id;

      path.setAttribute("d", toPath(cell.polygon));
      path.setAttribute("tabindex", "0");
      path.setAttribute("role", "button");
      path.setAttribute(
        "aria-label",
        `${sensor.name}, ${sensor.type}, pm25 ${sensor.pm25}`
      );

      if (isSelected) {
        path.classList.add("is-selected");
      }

      const fillColor = getPm25Color(sensor.pm25, {
        warn: () => emitOutlierWarning(sensor)
      });

      path.style.fill = fillColor;
      path.addEventListener("click", () => {
        selectedSensorId = sensor.id;
        onSelect(sensor);
        scheduleRender(latestSensors);
      });

      path.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectedSensorId = sensor.id;
          onSelect(sensor);
          scheduleRender(latestSensors);
        }
      });

      const circle = createSvgElement("circle", "voronoi-point");
      circle.setAttribute("cx", String(sensor.x));
      circle.setAttribute("cy", String(sensor.y));
      circle.setAttribute("r", "1.75");

      group.append(path, circle);
    }

    overlayPane.appendChild(svg);
  }

  function scheduleRender(sensors) {
    latestSensors = sensors;

    if (rafId !== null) {
      return;
    }

    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      drawNow();
    });
  }

  function selectByLatLng(latLng) {
    if (!latestProjectedPoints.length) {
      return false;
    }

    const clickPoint = map.latLngToLayerPoint(latLng);
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const sensor of latestProjectedPoints) {
      const dx = sensor.x - clickPoint.x;
      const dy = sensor.y - clickPoint.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = sensor;
      }
    }

    if (!best) {
      return false;
    }

    selectedSensorId = best.id;
    onSelect(best);
    scheduleRender(latestSensors);
    return true;
  }

  return {
    scheduleRender,
    selectByLatLng,
    setSelectedSensorId(sensorId) {
      selectedSensorId = sensorId;
    },
    destroy() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      removeOverlay();
    }
  };
}

import { csvParse } from "d3";

export const REQUIRED_COLUMNS = [
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

const DEFAULT_CONFIG = {
  dataUrl: "https://pm25.lass-net.org/GIS/voronoi/data/data.csv",
  refreshIntervalMs: 60000,
  polling: {
    maxIntervalMs: 300000
  },
  map: {
    center: [23.77, 120.88],
    zoom: 8,
    minZoom: 5,
    maxZoom: 19,
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  ui: {
    initialTypes: []
  }
};

function deepMerge(base, patch) {
  if (!patch || typeof patch !== "object") {
    return base;
  }

  const merged = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      merged[key] = [...value];
    } else if (value && typeof value === "object") {
      merged[key] = deepMerge(base[key] ?? {}, value);
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

export async function loadAppConfig(url = "/config.json") {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      console.warn(`[config] failed to load ${url}: ${response.status}`);
      return structuredClone(DEFAULT_CONFIG);
    }

    const payload = await response.json();
    return deepMerge(structuredClone(DEFAULT_CONFIG), payload);
  } catch (error) {
    console.warn("[config] failed to parse config, fallback to defaults", error);
    return structuredClone(DEFAULT_CONFIG);
  }
}

function validateHeaders(headers, warn) {
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    warn(`[csv] missing required columns: ${missing.join(", ")}`);
    return false;
  }
  return true;
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

function parseCsvPayload(csvText, options = {}) {
  const warn = options.warn ?? console.warn;
  const rows = csvParse(csvText);

  if (!validateHeaders(rows.columns ?? [], warn)) {
    return {
      sensors: [],
      dataVersion: ""
    };
  }

  const versionColumn = (rows.columns ?? []).find(
    (column) => String(column).trim().toLowerCase() === "version"
  );

  const sensors = [];
  let dataVersion = "";

  rows.forEach((row, index) => {
    const line = index + 2;

    if (!dataVersion && versionColumn) {
      const candidate = String(row[versionColumn] ?? "").trim();
      if (candidate) {
        dataVersion = candidate;
      }
    }

    const latitude = Number.parseFloat(row.latitude);
    const longitude = Number.parseFloat(row.longitude);
    const pm25 = Number.parseInt(row.pm25, 10);
    const id = String(row.id ?? "").trim();
    const name = String(row.name ?? "").trim();
    const type = String(row.type ?? "").trim();
    const color = String(row.color ?? "").trim();

    if (!id || !name || !type) {
      warn(`[csv] line ${line} skipped: id/name/type cannot be empty`);
      return;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      warn(`[csv] line ${line} skipped: invalid latitude/longitude`);
      return;
    }

    if (!Number.isFinite(pm25)) {
      warn(`[csv] line ${line} skipped: invalid pm25`);
      return;
    }

    if (!/^[0-9a-fA-F]{6}$/.test(color)) {
      warn(`[csv] line ${line} skipped: invalid color format`);
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
      url: normalizeUrl(String(row.url ?? "").trim()),
      label: String(row.label ?? "").trim()
    });
  });

  return {
    sensors,
    dataVersion
  };
}

export function parseSensorsCsv(csvText, options = {}) {
  return parseCsvPayload(csvText, options).sensors;
}

export async function fetchSensorsCsv(url, options = {}) {
  const warn = options.warn ?? console.warn;

  const response = await fetch(url, {
    cache: "no-store",
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch sensor CSV: ${response.status}`);
  }

  const csvText = await response.text();
  const payload = parseCsvPayload(csvText, { warn });

  return {
    sensors: payload.sensors,
    dataVersion: payload.dataVersion,
    lastModified: response.headers.get("Last-Modified")
  };
}

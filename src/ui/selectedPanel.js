function buildLink(url) {
  if (!url) {
    return null;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
}

function parseSensorIdentity(sensor) {
  const fallbackSource = sensor.type || "Unknown";
  const link = buildLink(sensor.url);

  if (!link) {
    return {
      source: fallbackSource,
      deviceId: "N/A"
    };
  }

  try {
    const url = new URL(link);
    const source = url.searchParams.get("var-source") || fallbackSource;
    const rawDeviceId = url.searchParams.get("var-device_id") || "";
    const deviceId = rawDeviceId.replace(/,+$/, "").trim() || "N/A";

    return {
      source,
      deviceId
    };
  } catch {
    return {
      source: fallbackSource,
      deviceId: "N/A"
    };
  }
}

export function createSelectedPanel(container) {
  function renderPlaceholder() {
    container.innerHTML = `
      <div class="selected-title">PM2.5 Voronoi Map</div>
      <div class="selected-subtitle">Click a Voronoi region to inspect a sensor.</div>
    `;
  }

  function renderSensor(sensor) {
    const safeName = sensor.name;
    const link = buildLink(sensor.url);
    const identity = parseSensorIdentity(sensor);

    container.innerHTML = "";

    const title = document.createElement("div");
    title.className = "selected-title";
    title.textContent = safeName;

    const meta = document.createElement("div");
    meta.className = "selected-meta";
    meta.textContent = `Source: ${identity.source} | PM2.5 bucket ${sensor.pm25}`;

    const device = document.createElement("div");
    device.className = "selected-device";
    device.textContent = `Device ID: ${identity.deviceId}`;

    const label = document.createElement("div");
    label.className = "selected-label";
    label.innerHTML = sensor.label || "-";

    container.append(title, meta, device, label);

    if (link) {
      const anchor = document.createElement("a");
      anchor.className = "selected-link";
      anchor.href = link;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = "Open sensor dashboard";
      container.appendChild(anchor);
    }
  }

  renderPlaceholder();

  return {
    clear: renderPlaceholder,
    setSensor: renderSensor
  };
}

import L from "leaflet";
import "leaflet/dist/leaflet.css";

export function createMap(containerId, mapConfig) {
  const map = L.map(containerId, {
    attributionControl: true,
    maxZoom: mapConfig.maxZoom
  }).setView(mapConfig.center, mapConfig.zoom);

  L.tileLayer(mapConfig.tileUrl, {
    minZoom: mapConfig.minZoom,
    maxZoom: mapConfig.maxZoom,
    attribution: mapConfig.attribution
  }).addTo(map);

  L.control.scale({ position: "topright" }).addTo(map);

  return map;
}

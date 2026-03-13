# Voronoi

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0.0-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![D3](https://img.shields.io/badge/D3-7.9.0-F9A03C?logo=d3.js&logoColor=white)](https://d3js.org/)
[![Deploy](https://img.shields.io/badge/Deploy-Static%20Hosting-0ea5e9)](#deployment)
[![Demo Site](https://img.shields.io/badge/Demo%20Site-Online-22c55e)](https://pm25.lass-net.org/GIS/Voronoi/)

Modernized PM2.5 Voronoi map for LASS/Open PM2.5 data.

This repository upgrades a legacy visualization stack to a modern, maintainable frontend while preserving the original CSV workflow and static deployment model.

## Live Site

- Production: [https://pm25.lass-net.org/GIS/Voronoi/](https://pm25.lass-net.org/GIS/Voronoi/)
- Demo Site: [https://pm25.lass-net.org/GIS/Voronoi/](https://pm25.lass-net.org/GIS/Voronoi/)

## Key Features

- Modern stack with fixed versions for reproducible builds
- Basemap restored using OpenStreetMap standard tiles
- Voronoi engine migrated from `d3.geom.voronoi()` to `d3-delaunay`
- Incremental polling updates (no full-page reload)
- Sensor detail panel includes source name and `device_id`
- Responsive, map-first UI for desktop and mobile
- Standalone `plain-js/` variant for no-build static hosting

## Tech Stack

- Runtime: Node.js `22.x LTS`
- Build Tool: Vite `8.0.0`
- Map: Leaflet `1.9.4`
- Visualization: D3 `7.9.0`, `d3-delaunay 6.0.4`
- Testing: Vitest `3.2.4`, Playwright `1.58.2`

## Repository Structure

```text
.
├── src/
│   ├── data/              # CSV parsing, validation, polling
│   ├── map/               # Leaflet map bootstrap
│   ├── ui/                # controls/legend/selected panel
│   ├── voronoi/           # Delaunay/Voronoi rendering
│   └── styles/            # app styles
├── public/
│   ├── config.json        # runtime config
│   ├── data/data.csv      # sample/local data source
│   └── images/            # logos/assets
├── plain-js/              # no-npm static version
├── tests/                 # unit + e2e tests
└── dist/                  # production output (generated)
```

## Getting Started (Vite)

### Prerequisites

- Node.js `22+`
- npm `10+`

### Install and Run

```bash
npm install
npm run dev
```

Open the local URL shown in terminal (default: `http://localhost:5173`).

## Build and Preview

```bash
npm run build
npm run preview
```

Production assets are generated in `dist/`.

## Standalone Mode (No npm)

If you need direct static hosting without Node/npm, use:

- `plain-js/index.html`

For details, see:

- `plain-js/README.md`

## Runtime Configuration

Edit `public/config.json`:

- `dataUrl`: CSV endpoint URL
- `refreshIntervalMs`: normal polling interval
- `polling.maxIntervalMs`: max retry interval on failures
- `map.tileUrl`: tile URL template
- `map.attribution`: map attribution text
- `map.maxZoom`: max zoom level
- `ui.initialTypes`: default selected sensor types

## Data Contract

Expected CSV headers:

```text
id,latitude,longitude,name,type,pm25,color,url,label
```

Validation behavior:

- invalid rows are skipped
- warnings are logged in browser console
- `device_id` is extracted from `url` query parameter `var-device_id`

## Available Scripts

- `npm run dev`: start development server
- `npm run build`: create production bundle
- `npm run preview`: preview built bundle
- `npm run test`: run unit tests (Vitest)
- `npm run test:e2e`: run end-to-end tests (Playwright)

## Deployment

This project is designed for static hosting.

1. Build assets with `npm run build`
2. Upload `dist/` to your web root (Nginx/Apache/CDN)
3. Verify map tiles, Voronoi rendering, filter controls, and detail panel

Recommended rollout strategy:

1. Deploy to stage path (for example `/GIS/voronoi-v2/`)
2. Validate on real data
3. Switch production route to `/GIS/Voronoi/`
4. Keep previous static bundle for quick rollback

## Compatibility

- Chrome / Edge / Firefox / Safari latest two major versions
- No IE or legacy Android WebView support

## License

MIT License. See [LICENSE](./LICENSE).

# Voronoi

Modernized PM2.5 Voronoi map for LASS/Open PM2.5 data.

This project restores and upgrades a legacy visualization stack while keeping the original data workflow (CSV schema + sensor identity links) and static-site deployment model.

## Highlights

- Modern frontend stack
  - Leaflet `1.9.4`
  - D3 `7.9.0`
  - `d3-delaunay 6.0.4`
  - Vite `8.0.0`
- Restored basemap with OpenStreetMap tiles
- Voronoi rendering migrated from legacy `d3.geom.voronoi` to `Delaunay.voronoi`
- Live polling without full-page refresh (with exponential backoff)
- Sensor selection panel includes source and `device_id`
- Keyboard-friendly interactions and mobile-friendly floating controls
- Includes a standalone `plain-js/` build that can run without npm

## Repository Structure

```text
.
├── src/                  # Vite app source
│   ├── data/             # Config + CSV parsing + fetch
│   ├── map/              # Leaflet map bootstrap
│   ├── ui/               # Controls/legend/selected panel
│   ├── voronoi/          # Delaunay/Voronoi rendering logic
│   └── styles/           # Application styles
├── public/               # Static assets/config used by Vite
│   ├── config.json
│   ├── data/data.csv
│   └── images/
├── tests/                # Unit + Playwright E2E tests
├── plain-js/             # Standalone static JS variant (no npm required)
└── dist/                 # Production build output (generated)
```

## Requirements

- Node.js `22+` (or newer compatible runtime)
- npm `10+`

## Quick Start (Vite)

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`).

## Build for Deployment

```bash
npm run build
```

Deploy the generated `dist/` folder to any static web server (Nginx/Apache/CDN static hosting).

## Runtime Configuration

Edit `public/config.json`:

- `dataUrl`: currently set to original source URL
  - `https://pm25.lass-net.org/GIS/voronoi/data/data.csv`
- `refreshIntervalMs`: normal polling interval
- `polling.maxIntervalMs`: max retry interval on failures
- `map.tileUrl`, `map.attribution`, `map.maxZoom`
- `ui.initialTypes`: default checked sensor groups on first load

## Data Contract

Expected CSV headers:

```text
id,latitude,longitude,name,type,pm25,color,url,label
```

Validation behavior:

- Rows with invalid/missing required fields are skipped
- Warnings are emitted to browser console
- `device_id` is parsed from `url` query parameter `var-device_id`

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - create production bundle in `dist/`
- `npm run preview` - preview built bundle
- `npm run test` - run unit tests (Vitest)
- `npm run test:e2e` - run Playwright end-to-end tests

## Standalone Mode (No npm)

If you need a static version without tooling, use `plain-js/`.

See: `plain-js/README.md`

## Deployment Notes

Recommended rollout:

1. Deploy new build to stage path (e.g. `/GIS/voronoi-v2/`)
2. Verify map rendering, filter interactions, and sensor detail panel
3. Switch production route to new build (`/GIS/voronoi/`)
4. Keep previous static bundle for immediate rollback

## License

MIT. See `LICENSE`.

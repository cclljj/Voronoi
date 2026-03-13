# Plain JS Version (No npm)

This folder contains a standalone static build that does not require npm, Vite, or any local build step.

## Run Locally

```bash
cd plain-js
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy

Upload all files in `plain-js/` to any static hosting environment and open `index.html`.

## Data Source Priority

The app tries CSV sources in this order:

1. `https://pm25.lass-net.org/GIS/voronoi/data/data.csv` (original source)
2. `./data/data.csv`
3. `/data/data.csv`

## Notes

- Leaflet + D3 are loaded from CDN.
- Device identity is shown in the selected panel (`source` and `device_id`).

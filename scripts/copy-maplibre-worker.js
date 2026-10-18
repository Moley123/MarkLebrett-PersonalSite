/**
 * Copies MapLibre's worker bundle into public/ so it can be served as a
 * static asset.
 *
 * MapLibre 6 does its geometry and tile work in a module Worker, constructed
 * as `new Worker(url, { type: 'module' })`. CRA 5's webpack does not emit a
 * module worker for that, so the worker silently fails to load and the map
 * renders nothing — no basemap, and no GeoJSON layers either, even though the
 * sources and layers are registered correctly. The symptom is only a console
 * line: "Worker failed to load. Check that the worker URL is correct".
 *
 * Copying the shipped worker and pointing `setWorkerUrl` at it sidesteps the
 * bundler entirely. Run on prestart and prebuild so it tracks whatever version
 * of maplibre-gl is installed rather than being committed and going stale.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl-worker.mjs');
const DEST_DIR = path.join(__dirname, '..', 'public');
const DEST = path.join(DEST_DIR, 'maplibre-gl-worker.mjs');

if (!fs.existsSync(SRC)) {
  // Not an error: the main site does not use MapLibre, only the lab page does.
  console.log('[maplibre] worker not found in node_modules — skipping copy');
  process.exit(0);
}

fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(SRC, DEST);

const { version } = require('../node_modules/maplibre-gl/package.json');
const kb = (fs.statSync(DEST).size / 1024).toFixed(0);
console.log(`[maplibre] copied worker v${version} -> public/maplibre-gl-worker.mjs (${kb} KB)`);

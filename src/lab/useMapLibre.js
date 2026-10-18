import { useEffect, useRef, useState } from 'react';
// MapLibre 6 is named-exports-only — there is no default export. `Map` is
// aliased so it doesn't shadow the global.
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  FullscreenControl,
  AttributionControl,
  LngLatBounds,
  setWorkerUrl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * MapLibre 6 runs its geometry work in a module Worker, which CRA 5's webpack
 * does not emit correctly — the worker fails to load and NOTHING renders, not
 * even GeoJSON layers that are otherwise registered fine. scripts/copy-
 * maplibre-worker.js copies the shipped worker into public/ on prebuild, and
 * this points MapLibre at it instead of the bundled one.
 */
setWorkerUrl(`${process.env.PUBLIC_URL || ''}/maplibre-gl-worker.mjs`);

/**
 * A MapLibre map on OpenFreeMap tiles.
 *
 * OpenFreeMap serves vector tiles with no API key, no registration and no
 * stated request limits — it is donation-funded, so that promise rests on
 * continued funding. Swapping to another provider (VersaTiles, MapTiler,
 * Protomaps via PMTiles) is a one-line change to STYLE_URL.
 */

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Used when the tile style can't be fetched — offline, provider down, or
 * blocked by a network policy. The eruv boundary matters far more than the
 * basemap, so rather than hang on a spinner the map falls back to a plain
 * background and still draws every GeoJSON layer on top.
 */
const FALLBACK_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0f172a' } }],
};

/**
 * Creates the map once and returns it. The map is deliberately NOT React
 * state — MapLibre owns its own DOM and re-rendering it on every state change
 * would be both wasteful and wrong.
 *
 * @param {object} opts
 * @param {{lat:number,lng:number}} opts.center
 * @param {number} opts.zoom
 * @returns {{ containerRef, map, ready }}
 */
export default function useMapLibre({ center, zoom }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [basemapFailed, setBasemapFailed] = useState(false);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: [center.lng, center.lat],
      zoom,
      attributionControl: false,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new FullscreenControl(), 'top-right');
    map.addControl(new AttributionControl({
      compact: true,
      // OpenFreeMap and OpenStreetMap both require attribution.
      customAttribution:
        '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · '
        + '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>',
    }));

    mapRef.current = map;
    map.on('load', () => setReady(true));

    // If the style itself cannot be fetched, `load` never fires. Swap in the
    // plain fallback so the page becomes usable instead of hanging.
    let fellBack = false;
    map.on('error', (e) => {
      const failedStyle = !map.isStyleLoaded() && !fellBack;
      if (!failedStyle) return;             // tile-level errors are not fatal
      fellBack = true;
      setBasemapFailed(true);
      try {
        map.setStyle(FALLBACK_STYLE);
        map.once('styledata', () => setReady(true));
      } catch {
        setReady(true);
      }
      // eslint-disable-next-line no-console
      console.warn('[lab] basemap style failed, falling back to plain background', e?.error?.message || e);
    });

    // Belt and braces: never leave the spinner up indefinitely.
    const timeout = setTimeout(() => setReady((r) => r || true), 10000);

    return () => {
      clearTimeout(timeout);
      map.remove();
      mapRef.current = null;
      setReady(false);
      setBasemapFailed(false);
    };
    // Center and zoom are initial values only; moving the map later is done
    // imperatively via the returned instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, map: mapRef, ready, basemapFailed };
}

/* ══════════════════ GeoJSON helpers ══════════════════ */

/** `{lat,lng}[]` → a GeoJSON LineString feature. */
export const lineFeature = (points) => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) },
  properties: {},
});

/** `{lat,lng}[]` → a GeoJSON Polygon feature, closing the ring if needed. */
export const polygonFeature = (points) => {
  const ring = points.map((p) => [p.lng, p.lat]);
  const [first] = ring;
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} };
};

export const featureCollection = (features) => ({ type: 'FeatureCollection', features });

/**
 * Add a source + layers if absent, or update the data if already present.
 * Called on every render, so it must be idempotent.
 */
export function upsertGeoJson(map, id, data, layers) {
  if (!map || !map.getStyle()) return;
  const existing = map.getSource(id);
  if (existing) {
    existing.setData(data);
    return;
  }
  map.addSource(id, { type: 'geojson', data });
  layers.forEach((layer, i) => {
    const layerId = `${id}-${i}`;
    if (!map.getLayer(layerId)) map.addLayer({ id: layerId, source: id, ...layer });
  });
}

/** Fit the viewport to a set of points, with padding in pixels. */
export function fitToPoints(map, points, padding = 48) {
  if (!map || !points.length) return;
  const b = new LngLatBounds();
  points.forEach((p) => b.extend([p.lng, p.lat]));
  map.fitBounds(b, { padding, duration: 600 });
}

export { Marker };

import { useCallback, useEffect, useRef, useState } from 'react';
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
 * Esri's World Imagery, as a minimal raster style.
 *
 * OpenFreeMap is vector-only and has no aerial imagery, so satellite needs a
 * second provider. Note the tile path is {z}/{y}/{x} — row before column,
 * which is Esri's order and not the {z}/{x}/{y} most providers use.
 *
 * Esri permit this for non-commercial use provided the attribution below is
 * shown. It is a different organisation with different terms from
 * OpenFreeMap, so if imagery stops loading one day, this is the line to look
 * at first.
 */
const ESRI_SATELLITE_STYLE = {
  version: 8,
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a>, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'esri-imagery', type: 'raster', source: 'esri-imagery' }],
};

/**
 * The basemaps offered by the layer switcher.
 *
 * Attribution is deliberately NOT set on the map: every style here carries its
 * own in its source definitions, so MapLibre's AttributionControl shows
 * whichever is actually on screen. Hard-coding OpenFreeMap's would have
 * credited them for Esri's imagery.
 */
export const BASEMAPS = [
  { id: 'liberty', label: 'Streets', style: 'https://tiles.openfreemap.org/styles/liberty' },
  { id: 'bright', label: 'Bright', style: 'https://tiles.openfreemap.org/styles/bright' },
  { id: 'positron', label: 'Minimal', style: 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'satellite', label: 'Satellite', style: ESRI_SATELLITE_STYLE },
];

export const DEFAULT_BASEMAP = 'liberty';

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
 * @param {boolean} [opts.cooperativeGestures] ctrl+scroll to zoom and two
 *   fingers to pan, so a map embedded in a longer page doesn't trap scrolling
 * @returns {{ containerRef, map, ready }}
 */
export default function useMapLibre({ center, zoom, cooperativeGestures = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [basemapFailed, setBasemapFailed] = useState(false);
  const [basemap, setBasemapId] = useState(DEFAULT_BASEMAP);

  /**
   * Bumped every time a new style finishes loading.
   *
   * `setStyle` throws away every source and layer that was added on top of the
   * old one, so the eruv boundaries and the route vanish with it. Callers put
   * this in the dependency array of whatever draws them, and they are put back
   * as soon as the new style is ready.
   */
  const [styleEpoch, setStyleEpoch] = useState(0);

  // Whether the plain fallback is currently standing in for a style that
  // wouldn't load. A ref rather than a closure variable so that picking a
  // different basemap can clear it and a later failure is reported again.
  const fellBackRef = useRef(false);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: [center.lng, center.lat],
      zoom,
      cooperativeGestures,
      attributionControl: false,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new FullscreenControl(), 'top-right');
    // No customAttribution: each style carries its own, so the credit follows
    // whichever basemap is actually being shown.
    map.addControl(new AttributionControl({ compact: true }));

    mapRef.current = map;
    map.on('load', () => setReady(true));

    // If the style itself cannot be fetched, `load` never fires. Swap in the
    // plain fallback so the page becomes usable instead of hanging.
    map.on('error', (e) => {
      const failedStyle = !map.isStyleLoaded() && !fellBackRef.current;
      if (!failedStyle) return;             // tile-level errors are not fatal
      fellBackRef.current = true;
      setBasemapFailed(true);
      try {
        // The fallback discards custom layers just as any other style swap
        // does, so callers need the same nudge to redraw them — see
        // setBasemap below for why it is `style.load` and `diff: false`.
        map.once('style.load', () => {
          setReady(true);
          setStyleEpoch((n) => n + 1);
        });
        map.setStyle(FALLBACK_STYLE, { diff: false });
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

  /**
   * Swap the basemap, keeping the camera where it is.
   *
   * The new style arrives without the eruv boundaries and the route — they
   * were added on top of the old one — so callers are told to put them back
   * by bumping styleEpoch, once and only once the new style is in place.
   *
   * Knowing *when* is the whole difficulty, and two earlier attempts got it
   * wrong. By default MapLibre switches styles by diffing: for a URL it keeps
   * the OLD style loaded while it fetches the new one, so "is the style
   * loaded?" answers yes for the outgoing style. Acting on that put the
   * boundaries back onto the old style, which the incoming one then removed —
   * intermittently, depending on network timing, which is why the bug was
   * "boundaries don't always show".
   *
   * `diff: false` tears the old style down straight away and builds the new
   * one from scratch, and `style.load` fires exactly once, when it is ready —
   * the same for a URL as for the satellite style, which is supplied as an
   * object. The listener goes on before setStyle, so it can't miss an event
   * fired during the call. If several switches overlap, only the last style
   * ever loads and every pending listener fires on it; re-adding is
   * idempotent, so that is harmless.
   */
  const setBasemap = useCallback((id) => {
    const map = mapRef.current;
    const next = BASEMAPS.find((b) => b.id === id);
    if (!map || !next) return;

    setBasemapId(id);
    setBasemapFailed(false);
    fellBackRef.current = false;

    map.once('style.load', () => setStyleEpoch((n) => n + 1));
    map.setStyle(next.style, { diff: false });
  }, []);

  return {
    containerRef, map: mapRef, ready, basemapFailed, basemap, setBasemap, styleEpoch,
  };
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

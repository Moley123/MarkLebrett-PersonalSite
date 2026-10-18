/**
 * Zurich Eruv — LAB
 *
 * A sandbox copy of src/components/EruvMap.js, trialling open-source
 * replacements for the Google Maps dependencies. The live page at
 * /zurich-eiruv is untouched: every CSS class here is renamed zlab-* so the
 * two share no styles.
 *
 * What has moved off Google so far:
 *
 *   Map and tiles      MapLibre GL JS + OpenFreeMap (no API key)
 *   Boundary rendering GeoJSON layers instead of <Polygon>/<Polyline>
 *   Containment maths  ./eruvGeometry (Turf) — and now unit-tested, which
 *                      was impossible while it needed a live Google map
 *   Polyline decoding  @mapbox/polyline
 *   Drag to modify     ./routeEditing + ./useRouteDrag, replacing
 *                      DirectionsRenderer's built-in dragging
 *
 * What still uses Google, deliberately:
 *
 *   Address search     Places Autocomplete. Zurich needs a non-UK geocoder;
 *                      postcodes.io only covers the UK.
 *   Walking routes     DirectionsService. Without self-hosting a router we
 *                      cannot clip the graph to the eruv, and the free
 *                      alternatives' daily quotas do not fit a search that
 *                      can make up to 26 route calls.
 *
 * So the Maps JS API is still loaded, but only with the `places` library —
 * `geometry` is gone.
 *
 * Dragging the route is now better than the live page's, not merely equal to
 * it: the handle turns red as soon as it leaves the eruv, the committed route
 * is measured against the boundary rather than assumed to be fine, the part
 * that strays is drawn in red, and every edit can be undone.
 *
 * The route is not linked from anywhere, sets noindex/nofollow/noarchive and
 * is disallowed in robots.txt, so it won't be crawled or stumbled upon. It is
 * unlisted rather than secret — the path is in src/App.js, in a public repo.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import polyline from '@mapbox/polyline';

import ERUV_BOUNDARY from '../data/eruv_boundary';
import ERUV_SEGMENTS from '../data/eruv_segments';
import ERUV_POLYGONS from '../data/eruv_polygons';
import { createEruv, interiorGrid } from './eruvGeometry';
import {
  formatMetres, nextViaId, outsideMetres, routeLengthMetres,
  splitByContainment, withoutVia,
} from './routeEditing';
import useRouteDrag from './useRouteDrag';
import useMapLibre, {
  featureCollection, fitToPoints, lineFeature, polygonFeature, upsertGeoJson, Marker,
} from './useMapLibre';
import './ZurichEruvLab.css';

/* Places only — Turf has replaced everything `geometry` was used for. */
const LIBRARIES = ['places'];

const MAP_CENTER = { lat: 47.376, lng: 8.541 };
const MAP_ZOOM = 12;

const ROUTE_ID = 'eruv-route';
const ROUTE_LINE_LAYER = `${ROUTE_ID}-1`;
const ROUTE_HIT_LAYER = `${ROUTE_ID}-2`;

/**
 * Google's walking geometry follows road centrelines, which within a few
 * metres of the boundary can fall on the wrong side of it. Below this, a
 * reported excursion is measurement noise rather than a real problem. It only
 * ever softens the verdict on a dragged route; the initial search still
 * demands that every point be strictly inside.
 */
const STRAY_NOISE_M = 25;

/* The eruv is static, so build the tester once for the lifetime of the module. */
const ERUV = createEruv(ERUV_BOUNDARY, ERUV_POLYGONS);

let cachedWaypoints = null;
const getInteriorWaypoints = () => {
  if (!cachedWaypoints) cachedWaypoints = interiorGrid(ERUV, 20);
  return cachedWaypoints;
};

/* ══════════════════ Route helpers ══════════════════ */

/** Every point of a Directions result, decoded to `{lat,lng}`. */
function routePoints(result) {
  const out = [];
  for (const leg of result.routes[0].legs) {
    for (const step of leg.steps) {
      const encoded = step.polyline?.points;
      if (!encoded) continue;
      for (const [lat, lng] of polyline.decode(encoded)) out.push({ lat, lng });
    }
  }
  return out;
}

/** Plain `{lat,lng}` literals throughout — Google accepts them directly. */
const latLng = ({ lat, lng }) => ({ lat, lng });

function requestRoute(origin, dest, waypoints, service) {
  return new Promise((resolve) => {
    service.route({
      origin: latLng(origin),
      destination: latLng(dest),
      travelMode: window.google.maps.TravelMode.WALKING,
      waypoints: waypoints.map((wp) => ({ location: latLng(wp), stopover: false })),
      optimizeWaypoints: false,
    }, (result, status) => resolve(status === 'OK' ? result : null));
  });
}

/**
 * Multi-attempt in-eruv routing.
 *
 * Unchanged in approach from the live page — ask for a route, check whether it
 * strayed, retry with interior waypoints near the first crossing. The checking
 * is now done by Turf rather than Google, so it costs no API calls; only the
 * route requests themselves do.
 *
 * It now also reports which waypoints it settled on, so they can be handed to
 * the user as draggable stops rather than hidden inside a renderer.
 */
async function findInBoundaryRoute(origin, dest, service) {
  const direct = await requestRoute(origin, dest, [], service);
  if (direct && ERUV.containsAll(routePoints(direct))) {
    return { result: direct, waypoints: [] };
  }

  const crossing = direct ? ERUV.firstOutside(routePoints(direct)) : null;
  const ref = crossing || {
    lat: (origin.lat + dest.lat) / 2,
    lng: (origin.lng + dest.lng) / 2,
  };

  const sorted = [...getInteriorWaypoints()].sort((a, b) => (
    Math.hypot(a.lat - ref.lat, a.lng - ref.lng)
    - Math.hypot(b.lat - ref.lat, b.lng - ref.lng)
  ));

  for (const wp of sorted.slice(0, 10)) {
    const result = await requestRoute(origin, dest, [wp], service);
    if (result && ERUV.containsAll(routePoints(result))) {
      return { result, waypoints: [wp] };
    }
  }

  const near6 = sorted.slice(0, 6);
  for (let i = 0; i < near6.length; i += 1) {
    for (let j = i + 1; j < near6.length; j += 1) {
      const pair = [near6[i], near6[j]];
      const result = await requestRoute(origin, dest, pair, service);
      if (result && ERUV.containsAll(routePoints(result))) {
        return { result, waypoints: pair };
      }
    }
  }
  return null;
}

/* ══════════════════ Component ══════════════════ */

const ZurichEruvLab = () => {
  // Google is still needed for Places Autocomplete and DirectionsService.
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  const { containerRef, map, ready, basemapFailed } = useMapLibre({ center: MAP_CENTER, zoom: MAP_ZOOM });

  const originRef = useRef(null);
  const destRef = useRef(null);
  const locationRef = useRef(null);
  const locationInputRef = useRef(null);
  const originInputRef = useRef(null);
  const destInputRef = useRef(null);
  const markerRef = useRef(null);
  const directionsRef = useRef(null);

  const [tab, setTab] = useState('check');
  const [marker, setMarker] = useState(null);
  const [insideStatus, setInsideStatus] = useState(null);

  /* A trip is the editable thing: two endpoints and an ordered list of stops.
     Everything drawn on the map is derived from it plus Google's answer. */
  const [trip, setTrip] = useState(null);
  const [routePath, setRoutePath] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeStatus, setRouteStatus] = useState(null);
  const [routeMsg, setRouteMsg] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [showSteps, setShowSteps] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);

  // Read by async callbacks that must not close over a stale trip.
  const tripRef = useRef(null);
  tripRef.current = trip;

  // Every re-route carries a token; a reply whose token has been superseded by
  // a later drag is dropped rather than flashing an out-of-date line.
  const tokenRef = useRef(0);
  const historyRef = useRef([]);

  const getService = () => {
    if (!directionsRef.current) {
      directionsRef.current = new window.google.maps.DirectionsService();
    }
    return directionsRef.current;
  };

  /* ── Title, favicon, noindex ── */
  useEffect(() => {
    document.title = 'LAB · Zurich Eruv Route Planner';

    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(robots);

    const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#3b82f6"/>
      </linearGradient></defs>
      <rect width="32" height="32" rx="7" fill="#0f172a"/>
      <path d="M16 6 L6 14 v12 h20 V14 Z" fill="none" stroke="url(#g)" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="16" cy="18" r="3" fill="url(#g)"/>
    </svg>`;
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.href = `data:image/svg+xml,${encodeURIComponent(svgFavicon)}`;
    document.head.appendChild(favicon);

    return () => {
      if (document.head.contains(favicon)) document.head.removeChild(favicon);
      if (document.head.contains(robots)) document.head.removeChild(robots);
    };
  }, []);

  /* ── Static boundary layers, drawn once the style is ready ── */
  const boundaryData = useMemo(() => polygonFeature(ERUV_BOUNDARY), []);
  const exclusionData = useMemo(
    () => featureCollection(ERUV_POLYGONS.map((p) => polygonFeature(p.paths[0]))),
    [],
  );
  const segmentData = useMemo(
    () => featureCollection(ERUV_SEGMENTS.map((seg) => lineFeature(seg))),
    [],
  );

  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current;

    // Handy when poking at the lab from the console or a test harness.
    window.__labMap = m;

    upsertGeoJson(m, 'eruv-fill', boundaryData, [
      { type: 'fill', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.07 } },
    ]);
    upsertGeoJson(m, 'eruv-exclusions', exclusionData, [
      { type: 'fill', paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.22 } },
      { type: 'line', paint: { 'line-color': '#ef4444', 'line-width': 2 } },
    ]);
    upsertGeoJson(m, 'eruv-segments', segmentData, [
      { type: 'line', paint: { 'line-color': '#111111', 'line-width': 3 } },
    ]);
  }, [ready, map, boundaryData, exclusionData, segmentData]);

  /* ── Marker for the checked address ── */
  useEffect(() => {
    if (!ready || !map.current) return;
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (!marker || tab !== 'check') return;
    markerRef.current = new Marker({
      color: insideStatus === 'inside' ? '#22c55e' : '#ef4444',
    })
      .setLngLat([marker.lng, marker.lat])
      .addTo(map.current);
  }, [ready, map, marker, insideStatus, tab]);

  /* ── Route line ──
     Split into inside/outside runs so the part that strays can be drawn in
     red. DirectionsRenderer draws one colour and leaves you to guess. */
  const routeFeatures = useMemo(() => {
    if (!routePath || routePath.length < 2) return featureCollection([]);
    const runs = splitByContainment(routePath, ERUV);
    const source = runs.length ? runs : [{ inside: true, points: routePath }];
    return featureCollection(source.map((run) => ({
      ...lineFeature(run.points),
      properties: { inside: run.inside },
    })));
  }, [routePath]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const data = tab === 'route' ? routeFeatures : featureCollection([]);
    upsertGeoJson(map.current, ROUTE_ID, data, [
      // Casing, so the line reads against both the basemap and the boundary.
      {
        type: 'line',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0b1220', 'line-width': 9, 'line-opacity': 0.5 },
      },
      {
        type: 'line',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['case', ['get', 'inside'], '#3b82f6', '#ef4444'],
          'line-width': 5,
        },
      },
      // An invisible fat line, purely to be grabbed. Paint opacity doesn't
      // affect hit-testing, so this widens the target to a comfortable 26px
      // without widening what you see.
      {
        type: 'line',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 26, 'line-opacity': 0 },
      },
    ]);
  }, [ready, map, routeFeatures, tab]);

  /* Dim the line while a re-route is in flight, so a slow reply reads as
     "working on it" rather than "nothing happened". */
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !m.getLayer(ROUTE_LINE_LAYER)) return;
    m.setPaintProperty(ROUTE_LINE_LAYER, 'line-opacity', rerouting ? 0.4 : 1);
  }, [ready, map, rerouting, routeFeatures]);

  /* ══════════ Routing ══════════ */

  /** Turn a Directions reply into everything the page shows about it. */
  const describeRoute = useCallback((result, note) => {
    const path = routePoints(result);
    const leg = result.routes[0].legs[0];

    setRoutePath(path);
    setRouteInfo({
      from: leg.start_address,
      to: leg.end_address,
      distance: leg.distance?.text || formatMetres(routeLengthMetres(path)),
      duration: leg.duration?.text || '',
      steps: leg.steps.map((s, i) => ({
        num: i + 1,
        instruction: s.instructions?.replace(/<[^>]*>/g, '') || '',
        distance: s.distance?.text || '',
      })),
    });

    const strayed = outsideMetres(path, ERUV);
    if (strayed <= STRAY_NOISE_M) {
      setRouteStatus('inside');
      setRouteMsg(note || 'Route stays within the Eruv boundary.');
    } else {
      setRouteStatus('strays');
      setRouteMsg(`This route leaves the Eruv for about ${formatMetres(strayed)}. Drag it back inside.`);
    }
    return path;
  }, []);

  /** Route the given trip and adopt the answer. Called after every edit. */
  const applyTrip = useCallback(async (nextTrip) => {
    const token = (tokenRef.current += 1);
    setTrip(nextTrip);

    // A dragged endpoint can land outside the boundary, in which case there is
    // nothing worth asking Google for.
    if (!ERUV.contains(nextTrip.origin) || !ERUV.contains(nextTrip.destination)) {
      setRerouting(false);
      setRouteStatus('outside');
      setRouteMsg(!ERUV.contains(nextTrip.origin)
        ? 'The start point is now outside the Eruv. Drag it back inside.'
        : 'The destination is now outside the Eruv. Drag it back inside.');
      return;
    }

    setRerouting(true);
    const result = await requestRoute(
      nextTrip.origin, nextTrip.destination, nextTrip.vias, getService(),
    );
    if (token !== tokenRef.current) return; // a later edit has already won

    setRerouting(false);
    if (!result) {
      setRouteStatus('error');
      setRouteMsg('No walking route through that point. Try dragging it somewhere else.');
      return;
    }
    describeRoute(result);
  }, [describeRoute]);

  /** Record the current trip so the edit can be undone, then apply the new one. */
  const handleTripChange = useCallback((nextTrip) => {
    if (tripRef.current) {
      historyRef.current = [...historyRef.current.slice(-19), tripRef.current];
      setUndoDepth(historyRef.current.length);
    }
    applyTrip(nextTrip);
  }, [applyTrip]);

  const handleUndo = useCallback(() => {
    const previous = historyRef.current.pop();
    setUndoDepth(historyRef.current.length);
    if (previous) applyTrip(previous);
  }, [applyTrip]);

  const handleRemoveVia = useCallback((id) => {
    const t = tripRef.current;
    if (!t) return;
    handleTripChange({ ...t, vias: withoutVia(t.vias, id) });
  }, [handleTripChange]);

  const handleClearStops = useCallback(() => {
    const t = tripRef.current;
    if (!t || !t.vias.length) return;
    handleTripChange({ ...t, vias: [] });
  }, [handleTripChange]);

  /* Ctrl/Cmd+Z, because an edit you can't take back is an edit you won't make. */
  useEffect(() => {
    if (tab !== 'route') return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!historyRef.current.length) return;
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, handleUndo]);

  /* ── Drag to modify ──
     Declared after the layer effects above so that by the time it looks for
     the hit layer, that layer exists. */
  const { dragging } = useRouteDrag({
    map,
    ready,
    active: ready && tab === 'route' && !!trip && !!routePath,
    hitLayerId: ROUTE_HIT_LAYER,
    trip,
    path: routePath,
    eruv: ERUV,
    onChange: handleTripChange,
    onRemoveVia: handleRemoveVia,
  });

  /* ── Location check ── */
  const handleLocationSearch = () => {
    const place = locationRef.current?.getPlace();
    if (!place?.geometry?.location) return;
    const pt = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
    setMarker(pt);
    setInsideStatus(ERUV.contains(pt) ? 'inside' : 'outside');
    map.current?.flyTo({ center: [pt.lng, pt.lat], zoom: 15, duration: 800 });
  };

  /* ── Route planner ── */
  const handleRoutePlan = async () => {
    const origin = originRef.current?.getPlace();
    const dest = destRef.current?.getPlace();
    if (!origin?.geometry?.location || !dest?.geometry?.location) {
      setRouteStatus('error');
      setRouteMsg('Please select addresses from the dropdown suggestions.');
      return;
    }

    const o = { lat: origin.geometry.location.lat(), lng: origin.geometry.location.lng() };
    const d = { lat: dest.geometry.location.lat(), lng: dest.geometry.location.lng() };

    const oIn = ERUV.contains(o);
    const dIn = ERUV.contains(d);
    if (!oIn || !dIn) {
      setRouteStatus('outside');
      setRouteMsg(
        !oIn && !dIn ? 'Both the start and end points are outside the Eruv boundary.'
          : !oIn ? 'The starting address is outside the Eruv boundary.'
            : 'The destination is outside the Eruv boundary.',
      );
      setTrip(null);
      setRoutePath(null);
      setRouteInfo(null);
      return;
    }

    setRouteLoading(true);
    setLoadingMsg('Searching for an Eruv-safe walking route…');
    setRouteStatus(null);
    setTrip(null);
    setRoutePath(null);
    setRouteInfo(null);
    historyRef.current = [];
    setUndoDepth(0);

    const found = await findInBoundaryRoute(o, d, getService());

    setRouteLoading(false);
    setLoadingMsg('');

    if (!found) {
      setRouteStatus('outside');
      setRouteMsg('No walking route found that stays entirely within the Eruv boundary between these addresses.');
      return;
    }

    // Any detour waypoints the search needed become visible, draggable stops
    // rather than something hidden inside the routing call.
    tokenRef.current += 1;
    setTrip({
      origin: o,
      destination: d,
      vias: found.waypoints.map((wp) => ({ id: nextViaId(), ...wp })),
    });
    const path = describeRoute(found.result, found.waypoints.length
      ? 'Indirect route — detoured to stay inside the Eruv. Drag the line to reshape it.'
      : 'Route stays within the Eruv boundary. Drag the line to reshape it.');
    fitToPoints(map.current, path, 60);
  };

  const handleLocationReset = () => {
    setMarker(null);
    setInsideStatus(null);
    if (locationInputRef.current) locationInputRef.current.value = '';
  };

  const handleRouteClear = () => {
    tokenRef.current += 1;
    setTrip(null);
    setRoutePath(null);
    setRouteInfo(null);
    setRouteStatus(null);
    setRouteMsg('');
    setShowSteps(false);
    historyRef.current = [];
    setUndoDepth(0);
    if (originInputRef.current) originInputRef.current.value = '';
    if (destInputRef.current) destInputRef.current.value = '';
  };

  /* ── Print (text only — the static-map image was a Google API) ── */
  const handlePrint = () => {
    if (!routeInfo) return;
    const stepsHtml = routeInfo.steps.map((s) => (
      `<tr><td style="padding:6px 12px 6px 0;color:#666;font-weight:600;vertical-align:top;white-space:nowrap">${s.num}.</td>`
      + `<td style="padding:6px 0;vertical-align:top">${s.instruction}</td>`
      + `<td style="padding:6px 0 6px 12px;color:#666;white-space:nowrap;vertical-align:top">${s.distance}</td></tr>`
    )).join('');
    const html = `<!DOCTYPE html><html><head><title>Eruv Route</title><style>`
      + `body{font-family:Inter,system-ui,sans-serif;margin:40px;color:#1a1a2e;line-height:1.6}`
      + `h1{font-size:1.4rem;margin:0 0 4px}h2{font-size:1rem;color:#666;font-weight:400;margin:0 0 20px}`
      + `.meta{display:flex;gap:24px;margin-bottom:16px;font-size:0.9rem;color:#444}`
      + `.meta span{background:#f0f4ff;padding:4px 12px;border-radius:6px}`
      + `table{border-collapse:collapse;width:100%;font-size:0.9rem}`
      + `hr{border:none;border-top:1px solid #e2e8f0;margin:16px 0}`
      + `.footer{margin-top:24px;font-size:0.75rem;color:#999;text-align:center}</style></head><body>`
      + `<h1>Zurich Eiruv — Walking Route</h1><h2>${routeInfo.from} → ${routeInfo.to}</h2>`
      + `<div class="meta"><span>${routeInfo.distance}</span><span>${routeInfo.duration}</span></div>`
      + `<hr/><table>${stepsHtml}</table>`
      + `<div class="footer">Printed from the Zurich Eiruv lab</div></body></html>`;
    const win = window.open('', '_blank', 'width=800,height=600');
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  };

  if (loadError) {
    return (
      <div className="zlab-page zlab-error">
        <p>Failed to load the Google Places API (still used for address search).</p>
      </div>
    );
  }

  const stops = trip ? trip.vias : [];

  return (
    <div className="zlab-page">

      {/* ── Lab banner — this page is a sandbox, never the live one ── */}
      <div className="zlab-banner" role="status">
        <strong>LAB</strong>
        <span>
          MapLibre + OpenFreeMap tiles, Turf.js geometry, home-built
          drag-to-modify. Address search and routing still use Google. The live
          page is <Link to="/zurich-eiruv">/zurich-eiruv</Link> and is unchanged.
        </span>
      </div>

      {/* ── Header ── */}
      <div className="zlab-header">
        <div className="zlab-header-row">
          <Link to="/" className="zlab-back-btn" aria-label="Back to portal">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Portal
          </Link>
          <div className="zlab-header-text">
            <h1 className="zlab-title">🕍 Zurich Eiruv Route Planner</h1>
            <p className="zlab-subtitle">
              Check if an address is within the Eiruv, or plan a walking route that stays inside the boundary.
            </p>
          </div>
        </div>
      </div>

      {/* ── Sidebar + Map ── */}
      <div className="zlab-container">

        <div className="zlab-sidebar">
          <div className="zlab-tabs">
            <button
              className={`zlab-tab ${tab === 'check' ? 'active' : ''}`}
              onClick={() => setTab('check')}
            >
              📍 Location Check
            </button>
            <button
              className={`zlab-tab ${tab === 'route' ? 'active' : ''}`}
              onClick={() => { setTab('route'); setMarker(null); setInsideStatus(null); }}
            >
              🗺 Route Planner
            </button>
          </div>

          <div className="zlab-panel">
            {tab === 'check' && (
              <div className="zlab-check-form">
                <h3>Check an Address</h3>
                <p>Enter an address to verify whether it falls within the Zürich Eiruv boundary.</p>
                <div className="zlab-input-wrap">
                  {isLoaded ? (
                    <Autocomplete
                      onLoad={(ac) => { locationRef.current = ac; }}
                      onPlaceChanged={handleLocationSearch}
                      options={{ componentRestrictions: { country: 'ch' } }}
                    >
                      <input ref={locationInputRef} className="zlab-input" type="text" placeholder="Search an address in Zürich…" />
                    </Autocomplete>
                  ) : (
                    <input className="zlab-input" type="text" placeholder="Loading address search…" disabled />
                  )}
                </div>
                <button className="zlab-btn zlab-btn--ghost" onClick={handleLocationReset}>Reset</button>
                {insideStatus === 'inside' && <div className="zlab-alert zlab-alert--success">✓ Inside Eruv</div>}
                {insideStatus === 'outside' && <div className="zlab-alert zlab-alert--error">✕ Outside Eruv</div>}
              </div>
            )}

            {tab === 'route' && (
              <div className="zlab-route-form">
                <h3>Plan a Route</h3>
                <p>Find a walking route that stays entirely within the Eiruv.</p>
                <div className="zlab-input-wrap">
                  <label>Origin</label>
                  {isLoaded ? (
                    <Autocomplete
                      onLoad={(ac) => { originRef.current = ac; }}
                      options={{ componentRestrictions: { country: 'ch' } }}
                    >
                      <input ref={originInputRef} className="zlab-input" type="text" placeholder="Start address…" />
                    </Autocomplete>
                  ) : (
                    <input className="zlab-input" type="text" placeholder="Loading…" disabled />
                  )}
                </div>
                <div className="zlab-input-wrap">
                  <label>Destination</label>
                  {isLoaded ? (
                    <Autocomplete
                      onLoad={(ac) => { destRef.current = ac; }}
                      options={{ componentRestrictions: { country: 'ch' } }}
                    >
                      <input ref={destInputRef} className="zlab-input" type="text" placeholder="End address…" />
                    </Autocomplete>
                  ) : (
                    <input className="zlab-input" type="text" placeholder="Loading…" disabled />
                  )}
                </div>
                <div className="zlab-btn-row">
                  <button className="zlab-btn zlab-btn--primary" onClick={handleRoutePlan} disabled={routeLoading || !isLoaded}>
                    {routeLoading ? <><span className="zlab-btn-spinner" /> Searching…</> : 'Find Safe Route'}
                  </button>
                  <button className="zlab-btn zlab-btn--ghost" onClick={handleRouteClear}>Reset</button>
                  {routeInfo && !routeLoading && (
                    <button className="zlab-btn zlab-btn--ghost" onClick={handlePrint}>🖨 Print Route</button>
                  )}
                </div>

                {routeLoading && loadingMsg && (
                  <div className="zlab-alert zlab-alert--info">
                    <span className="zlab-btn-spinner zlab-btn-spinner--dark" /> {loadingMsg}
                  </div>
                )}
                {!routeLoading && routeStatus === 'outside' && <div className="zlab-alert zlab-alert--error">⚠ {routeMsg}</div>}
                {!routeLoading && routeStatus === 'error' && <div className="zlab-alert zlab-alert--error">✕ {routeMsg}</div>}
                {!routeLoading && routeStatus === 'strays' && <div className="zlab-alert zlab-alert--warn">⚠ {routeMsg}</div>}
                {!routeLoading && routeStatus === 'inside' && <div className="zlab-alert zlab-alert--success">✓ {routeMsg}</div>}

                {/* ── Route editor ── */}
                {routeInfo && !routeLoading && (
                  <div className="zlab-editor">
                    <div className="zlab-chips">
                      <span className="zlab-chip">{routeInfo.distance}</span>
                      {routeInfo.duration && <span className="zlab-chip">{routeInfo.duration}</span>}
                      {rerouting && (
                        <span className="zlab-chip zlab-chip--busy">
                          <span className="zlab-btn-spinner zlab-btn-spinner--dark" /> Updating…
                        </span>
                      )}
                    </div>

                    <p className={`zlab-hint ${dragging ? 'zlab-hint--active' : ''}`}>
                      {dragging
                        ? 'Release to reroute — red means outside the Eruv.'
                        : 'Drag the blue line to reshape the route, or drag a pin to move an end.'}
                    </p>

                    <ol className="zlab-stops">
                      <li className="zlab-stop zlab-stop--end">
                        <span className="zlab-stop-marker zlab-stop-marker--origin" aria-hidden="true">A</span>
                        <span className="zlab-stop-label">{routeInfo.from}</span>
                      </li>
                      {stops.map((via, i) => (
                        <li key={via.id} className="zlab-stop">
                          <span className="zlab-stop-marker zlab-stop-marker--via" aria-hidden="true">{i + 1}</span>
                          <span className="zlab-stop-label">
                            Stop {i + 1}
                            <span className="zlab-stop-coords">
                              {via.lat.toFixed(5)}, {via.lng.toFixed(5)}
                            </span>
                          </span>
                          <button
                            type="button"
                            className="zlab-stop-remove"
                            onClick={() => handleRemoveVia(via.id)}
                            aria-label={`Remove stop ${i + 1}`}
                            title={`Remove stop ${i + 1}`}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                      <li className="zlab-stop zlab-stop--end">
                        <span className="zlab-stop-marker zlab-stop-marker--dest" aria-hidden="true">B</span>
                        <span className="zlab-stop-label">{routeInfo.to}</span>
                      </li>
                    </ol>

                    <div className="zlab-btn-row">
                      <button
                        className="zlab-btn zlab-btn--ghost"
                        onClick={handleUndo}
                        disabled={!undoDepth}
                        title="Undo the last edit (Ctrl+Z)"
                      >
                        ↶ Undo
                      </button>
                      <button
                        className="zlab-btn zlab-btn--ghost"
                        onClick={handleClearStops}
                        disabled={!stops.length}
                      >
                        Clear stops
                      </button>
                      <button
                        className="zlab-btn zlab-btn--ghost"
                        onClick={() => setShowSteps((s) => !s)}
                      >
                        {showSteps ? 'Hide' : 'Show'} directions
                      </button>
                    </div>

                    {showSteps && (
                      <ol className="zlab-steps">
                        {routeInfo.steps.map((step) => (
                          <li key={step.num}>
                            <span>{step.instruction}</span>
                            <em>{step.distance}</em>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Map ── */}
        <div className="zlab-map-wrap">
          <div ref={containerRef} className="zlab-map" />
          {!ready && (
            <div className="zlab-map-loading">
              <div className="zlab-spinner" />
              <p>Loading map…</p>
            </div>
          )}
          {basemapFailed && (
            <div className="zlab-map-notice" role="status">
              Basemap tiles unavailable — boundaries are still accurate.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ZurichEruvLab;

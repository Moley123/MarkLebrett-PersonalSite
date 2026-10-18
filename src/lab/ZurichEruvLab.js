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
 * The route is drawn as a GeoJSON line rather than a DirectionsRenderer, so
 * drag-to-modify is not available here. The live page keeps it.
 *
 * The route is not linked from anywhere, sets noindex/nofollow/noarchive and
 * is disallowed in robots.txt, so it won't be crawled or stumbled upon. It is
 * unlisted rather than secret — the path is in src/App.js, in a public repo.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import polyline from '@mapbox/polyline';

import ERUV_BOUNDARY from '../data/eruv_boundary';
import ERUV_SEGMENTS from '../data/eruv_segments';
import ERUV_POLYGONS from '../data/eruv_polygons';
import { createEruv, interiorGrid } from './eruvGeometry';
import useMapLibre, {
  featureCollection, fitToPoints, lineFeature, polygonFeature, upsertGeoJson, Marker,
} from './useMapLibre';
import './ZurichEruvLab.css';

/* Places only — Turf has replaced everything `geometry` was used for. */
const LIBRARIES = ['places'];

const MAP_CENTER = { lat: 47.376, lng: 8.541 };
const MAP_ZOOM = 12;

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

function requestRoute(origin, dest, waypoints, service) {
  return new Promise((resolve) => {
    service.route({
      origin,
      destination: dest,
      travelMode: window.google.maps.TravelMode.WALKING,
      waypoints: waypoints.map((ll) => ({
        location: new window.google.maps.LatLng(ll.lat, ll.lng),
        stopover: false,
      })),
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
 */
async function findInBoundaryRoute(originLoc, destLoc, service) {
  const direct = await requestRoute(originLoc, destLoc, [], service);
  if (direct && ERUV.containsAll(routePoints(direct))) {
    return { result: direct, indirect: false };
  }

  const crossing = direct ? ERUV.firstOutside(routePoints(direct)) : null;
  const ref = crossing || {
    lat: (originLoc.lat() + destLoc.lat()) / 2,
    lng: (originLoc.lng() + destLoc.lng()) / 2,
  };

  const sorted = [...getInteriorWaypoints()].sort((a, b) => (
    Math.hypot(a.lat - ref.lat, a.lng - ref.lng)
    - Math.hypot(b.lat - ref.lat, b.lng - ref.lng)
  ));

  for (const wp of sorted.slice(0, 10)) {
    const result = await requestRoute(originLoc, destLoc, [wp], service);
    if (result && ERUV.containsAll(routePoints(result))) return { result, indirect: true };
  }

  const near6 = sorted.slice(0, 6);
  for (let i = 0; i < near6.length; i += 1) {
    for (let j = i + 1; j < near6.length; j += 1) {
      const result = await requestRoute(originLoc, destLoc, [near6[i], near6[j]], service);
      if (result && ERUV.containsAll(routePoints(result))) return { result, indirect: true };
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

  const [tab, setTab] = useState('check');
  const [marker, setMarker] = useState(null);
  const [insideStatus, setInsideStatus] = useState(null);
  const [routePath, setRoutePath] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeStatus, setRouteStatus] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeMsg, setRouteMsg] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');

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

  /* ── Route line ── */
  useEffect(() => {
    if (!ready || !map.current) return;
    const data = routePath && tab === 'route'
      ? lineFeature(routePath)
      : featureCollection([]);
    upsertGeoJson(map.current, 'eruv-route', data, [
      {
        type: 'line',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 5 },
      },
    ]);
  }, [ready, map, routePath, tab]);

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

    const originLoc = origin.geometry.location;
    const destLoc = dest.geometry.location;
    const o = { lat: originLoc.lat(), lng: originLoc.lng() };
    const d = { lat: destLoc.lat(), lng: destLoc.lng() };

    const oIn = ERUV.contains(o);
    const dIn = ERUV.contains(d);
    if (!oIn || !dIn) {
      setRouteStatus('outside');
      setRouteMsg(
        !oIn && !dIn ? 'Both the start and end points are outside the Eruv boundary.'
          : !oIn ? 'The starting address is outside the Eruv boundary.'
            : 'The destination is outside the Eruv boundary.',
      );
      setRoutePath(null);
      setRouteInfo(null);
      return;
    }

    setRouteLoading(true);
    setLoadingMsg('Searching for an Eruv-safe walking route…');
    setRouteStatus(null);
    setRoutePath(null);
    setRouteInfo(null);

    const service = new window.google.maps.DirectionsService();
    const found = await findInBoundaryRoute(originLoc, destLoc, service);

    setRouteLoading(false);
    setLoadingMsg('');

    if (found) {
      const path = routePoints(found.result);
      const leg = found.result.routes[0].legs[0];
      setRoutePath(path);
      setRouteInfo({
        from: leg.start_address,
        to: leg.end_address,
        distance: leg.distance?.text || '',
        duration: leg.duration?.text || '',
        steps: leg.steps.map((s, i) => ({
          num: i + 1,
          instruction: s.instructions?.replace(/<[^>]*>/g, '') || '',
          distance: s.distance?.text || '',
        })),
      });
      setRouteStatus('inside');
      setRouteMsg(found.indirect
        ? 'Indirect route found — detoured to stay within the Eruv boundary.'
        : 'Route stays within the Eruv boundary.');
      fitToPoints(map.current, path, 60);
    } else {
      setRouteStatus('outside');
      setRouteMsg('No walking route found that stays entirely within the Eruv boundary between these addresses.');
    }
  };

  const handleLocationReset = () => {
    setMarker(null);
    setInsideStatus(null);
    if (locationInputRef.current) locationInputRef.current.value = '';
  };

  const handleRouteClear = () => {
    setRoutePath(null);
    setRouteInfo(null);
    setRouteStatus(null);
    setRouteMsg('');
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

  return (
    <div className="zlab-page">

      {/* ── Lab banner — this page is a sandbox, never the live one ── */}
      <div className="zlab-banner" role="status">
        <strong>LAB</strong>
        <span>
          MapLibre + OpenFreeMap tiles, Turf.js geometry. Address search and
          routing still use Google. The live page is{' '}
          <Link to="/zurich-eiruv">/zurich-eiruv</Link> and is unchanged.
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
              onClick={() => { setTab('check'); setRoutePath(null); }}
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
                {!routeLoading && routeStatus === 'inside' && <div className="zlab-alert zlab-alert--success">✓ {routeMsg}</div>}
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

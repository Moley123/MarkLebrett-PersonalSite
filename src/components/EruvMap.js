import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GoogleMap,
  useJsApiLoader,
  Autocomplete,
  Polygon,
  Polyline,
  Marker,
  DirectionsRenderer,
} from '@react-google-maps/api';
import ERUV_BOUNDARY from '../data/eruv_boundary';
import ERUV_SEGMENTS from '../data/eruv_segments';
import ERUV_POLYGONS from '../data/eruv_polygons';
import './EruvMap.css';

const LIBRARIES = ['places', 'geometry'];

const MAP_CENTER = { lat: 47.376, lng: 8.541 };
const MAP_OPTIONS = {
  mapTypeControl: true,
  mapTypeControlOptions: { style: 2 }, // DROPDOWN_MENU style — compact
  streetViewControl: false,
  fullscreenControl: true,
  /* Removed POI hidden styles so landmarks and restaurants appear */
};

const POLYGON_OPTIONS = {
  strokeOpacity: 0,   // invisible — only exists for containsLocation()
  fillOpacity: 0.06,
  fillColor: '#3b82f6',
};

const POLYLINE_OPTIONS = {
  strokeColor: '#111111',
  strokeOpacity: 1,
  strokeWeight: 3,
};

/* ══════════════════════════════════════════════════════════════
   Boundary helpers
══════════════════════════════════════════════════════════════ */
function makePoly() {
  return new window.google.maps.Polygon({ paths: ERUV_BOUNDARY });
}

function pointInEruv(latLng) {
  return window.google.maps.geometry.poly.containsLocation(latLng, makePoly());
}

function decodePath(encoded) {
  if (!encoded) return [];
  return window.google.maps.geometry.encoding.decodePath(encoded);
}

/** Strict check — every decoded polyline point must be inside the polygon. */
function routeStaysInEruv(result) {
  const poly = makePoly();
  for (const leg of result.routes[0].legs) {
    for (const step of leg.steps) {
      const pts = decodePath(step.polyline?.points || '');
      for (const pt of pts) {
        if (!window.google.maps.geometry.poly.containsLocation(pt, poly)) return false;
      }
    }
  }
  return true;
}

/* ══════════════════════════════════════════════════════════════
   Interior waypoint grid
   12×12 = 144 candidates → finer coverage in narrow eruv sections.
   Lazily computed and cached after the Maps API loads.
══════════════════════════════════════════════════════════════ */
let _cachedWaypoints = null;

function getInteriorWaypoints() {
  if (_cachedWaypoints) return _cachedWaypoints;

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const p of ERUV_BOUNDARY) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const poly   = makePoly();
  const inside = [];
  const G = 20; // 20×20 = 400 candidates

  for (let i = 0; i <= G; i++) {
    for (let j = 0; j <= G; j++) {
      const lat = minLat + (maxLat - minLat) * (i / G);
      const lng = minLng + (maxLng - minLng) * (j / G);
      const ll  = new window.google.maps.LatLng(lat, lng);
      if (window.google.maps.geometry.poly.containsLocation(ll, poly)) {
        inside.push({ lat, lng });
      }
    }
  }

  _cachedWaypoints = inside;
  return inside;
}

/* Find the first lat/lng on a route that exits the eruv polygon. */
function firstCrossingPoint(result) {
  const poly = makePoly();
  for (const leg of result.routes[0].legs) {
    for (const step of leg.steps) {
      const pts = decodePath(step.polyline?.points || '');
      for (const pt of pts) {
        if (!window.google.maps.geometry.poly.containsLocation(pt, poly)) {
          return { lat: pt.lat(), lng: pt.lng() };
        }
      }
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════
   Single route request (Promise wrapper)
══════════════════════════════════════════════════════════════ */
function requestRoute(origin, dest, waypointLatLngs, service) {
  return new Promise(resolve => {
    service.route(
      {
        origin,
        destination: dest,
        travelMode: window.google.maps.TravelMode.WALKING,
        waypoints: waypointLatLngs.map(ll => ({
          location: new window.google.maps.LatLng(ll.lat, ll.lng),
          stopover: false,
        })),
        optimizeWaypoints: false,
      },
      (result, status) => resolve(status === 'OK' ? result : null),
    );
  });
}

/* ══════════════════════════════════════════════════════════════
   Multi-attempt in-boundary routing
   Strategy:
   1. Try direct route — if valid, done.
   2. Find where the direct route FIRST crosses outside the eruv.
   3. Sort all interior waypoints by distance to that crossing point
      (not the midpoint!) — this picks waypoints nearest to the
      problematic street, keeping the detour minimal.
   4. Try 1-waypoint routes with the 10 nearest such waypoints.
   5. Try 2-waypoint pairs from the 5 nearest.
   Returns { result, indirect } or null.
══════════════════════════════════════════════════════════════ */
async function findInBoundaryRoute(originLoc, destLoc, service) {
  const waypoints = getInteriorWaypoints();

  // Attempt 1: direct route
  const direct = await requestRoute(originLoc, destLoc, [], service);
  if (direct && routeStaysInEruv(direct)) return { result: direct, indirect: false };

  // Find the first crossing point to use as the reference for waypoint selection
  const crossing = direct ? firstCrossingPoint(direct) : null;
  const ref = crossing || {
    lat: (originLoc.lat() + destLoc.lat()) / 2,
    lng: (originLoc.lng() + destLoc.lng()) / 2,
  };

  // Sort by proximity to the crossing point — nearest = minimal detour first
  const sorted = [...waypoints].sort((a, b) =>
    Math.hypot(a.lat - ref.lat, a.lng - ref.lng) -
    Math.hypot(b.lat - ref.lat, b.lng - ref.lng)
  );

  // Try 1-waypoint routes with the 10 nearest interior points
  for (const wp of sorted.slice(0, 10)) {
    const result = await requestRoute(originLoc, destLoc, [wp], service);
    if (result && routeStaysInEruv(result)) return { result, indirect: true };
  }

  // Try 2-waypoint combinations from the 6 nearest
  const near6 = sorted.slice(0, 6);
  for (let i = 0; i < near6.length; i++) {
    for (let j = i + 1; j < near6.length; j++) {
      const result = await requestRoute(originLoc, destLoc, [near6[i], near6[j]], service);
      if (result && routeStaysInEruv(result)) return { result, indirect: true };
    }
  }

  return null;
}

/* ══════════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════════ */
const EruvMap = () => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  const mapRef         = useRef(null);
  const originRef      = useRef(null);
  const destRef        = useRef(null);
  const locationRef    = useRef(null);
  const dirRendererRef = useRef(null);

  const [tab,          setTab]          = useState('check');
  const [marker,       setMarker]       = useState(null);
  const [insideStatus, setInsideStatus] = useState(null);
  const [directions,   setDirections]   = useState(null);
  const [routeStatus,  setRouteStatus]  = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeMsg,     setRouteMsg]     = useState('');
  const [loadingMsg,   setLoadingMsg]   = useState('');

  const onMapLoad = useCallback(map => { mapRef.current = map; }, []);

  useEffect(() => {
    // ── Page title ──
    document.title = 'Zurich Eruv Route Planner | Mark Lebrett';

    // ── Favicon: Map Pin / House motif with Emerald-Blue gradient ──
    const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#3b82f6"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="#0f172a"/>
      <!-- A simple eruv/house shape -->
      <path d="M16 6 L6 14 v12 h20 V14 Z" fill="none" stroke="url(#g)" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="16" cy="18" r="3" fill="url(#g)"/>
    </svg>`;
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.href = 'data:image/svg+xml,' + encodeURIComponent(svgFavicon);
    document.head.appendChild(favicon);

    return () => {
      if (document.head.contains(favicon)) {
        document.head.removeChild(favicon);
      }
    };
  }, []);

  /* ── Location Check ── */
  const handleLocationSearch = () => {
    if (!locationRef.current) return;
    const place = locationRef.current.getPlace();
    if (!place?.geometry?.location) return;
    const latLng = place.geometry.location;
    setMarker({ lat: latLng.lat(), lng: latLng.lng() });
    setInsideStatus(pointInEruv(latLng) ? 'inside' : 'outside');
    mapRef.current?.panTo(latLng);
    mapRef.current?.setZoom(15);
  };

  /* ── Route Dragging (User modified) ── */
  const handleDirectionsChanged = () => {
    if (!dirRendererRef.current) return;
    const result = dirRendererRef.current.getDirections();
    if (!result) return;
    
    // Check the new dragged route against the eruv boundary
    const stays = routeStaysInEruv(result);
    if (stays) {
      setRouteStatus('inside');
      setRouteMsg('Modified route stays within the Eruv boundary.');
    } else {
      setRouteStatus('outside');
      setRouteMsg('This modified walking route crosses outside the Eruv boundary.');
    }
  };

  /* ── Route Planner ── */
  const handleRoutePlan = async () => {
    if (!originRef.current || !destRef.current) return;
    const origin = originRef.current.getPlace();
    const dest   = destRef.current.getPlace();

    if (!origin?.geometry?.location || !dest?.geometry?.location) {
      setRouteStatus('error');
      setRouteMsg('Please select addresses from the dropdown suggestions.');
      return;
    }

    const originLoc = origin.geometry.location;
    const destLoc   = dest.geometry.location;

    // Quick check: are endpoints inside?
    const oIn = pointInEruv(originLoc);
    const dIn = pointInEruv(destLoc);
    if (!oIn || !dIn) {
      setRouteStatus('outside');
      setRouteMsg(
        !oIn && !dIn ? 'Both the start and end points are outside the Eruv boundary.'
        : !oIn       ? 'The starting address is outside the Eruv boundary.'
        :              'The destination is outside the Eruv boundary.'
      );
      setDirections(null);
      return;
    }

    setRouteLoading(true);
    setLoadingMsg('Requesting direct route…');
    setRouteStatus(null);
    setDirections(null);

    const service = new window.google.maps.DirectionsService();

    // Small delay so the first loading message renders before the async loop
    await new Promise(r => setTimeout(r, 50));
    setLoadingMsg('Searching for an Eruv-safe walking route…');

    const found = await findInBoundaryRoute(originLoc, destLoc, service);

    setRouteLoading(false);
    setLoadingMsg('');

    if (found) {
      setDirections(found.result);
      setRouteStatus('inside');
      setRouteMsg(
        found.indirect
          ? 'Indirect route found — detoured to stay within the Eruv boundary.'
          : 'Route stays within the Eruv boundary.'
      );
      mapRef.current?.fitBounds(found.result.routes[0].bounds, 60);
    } else {
      setRouteStatus('outside');
      setRouteMsg('No walking route found that stays entirely within the Eruv boundary between these addresses.');
    }
  };

  const handleRouteClear = () => {
    setDirections(null);
    setRouteStatus(null);
    setRouteMsg('');
  };

  if (loadError) return (
    <div className="eruv-page eruv-error">
      <p>Failed to load Google Maps. Check your API key.</p>
    </div>
  );

  if (!isLoaded) return (
    <div className="eruv-page eruv-loading">
      <div className="eruv-spinner" />
      <p>Loading map…</p>
    </div>
  );

  return (
    <div className="eruv-page">

      {/* ── Header ── */}
      <div className="eruv-header">
        <Link to="/" className="eruv-back-btn" aria-label="Back to portal">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Portal
        </Link>
        <h1 className="eruv-title">🕍 Zurich Eruv Route Planner</h1>
        <p className="eruv-subtitle">
          Check if an address is within the Eruv, or plan a walking route that stays inside the boundary.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="eruv-tabs">
        <button className={`eruv-tab ${tab === 'check' ? 'eruv-tab--active' : ''}`} onClick={() => setTab('check')}>
          📍 Location Check
        </button>
        <button className={`eruv-tab ${tab === 'route' ? 'eruv-tab--active' : ''}`} onClick={() => setTab('route')}>
          🗺 Route Planner
        </button>
      </div>

      {/* ── Controls ── */}
      <div className="eruv-controls">
        {tab === 'check' && (
          <div className="eruv-control-row">
            <Autocomplete onLoad={ac => { locationRef.current = ac; }} onPlaceChanged={handleLocationSearch} options={{ componentRestrictions: { country: 'ch' } }}>
              <input className="eruv-input" type="text" placeholder="Search an address in Zürich…" />
            </Autocomplete>
            {insideStatus && (
              <button className="eruv-btn eruv-btn--ghost" onClick={() => { setMarker(null); setInsideStatus(null); }}>Reset</button>
            )}
            {insideStatus === 'inside'  && <span className="eruv-badge eruv-badge--inside">✓ Inside Eruv</span>}
            {insideStatus === 'outside' && <span className="eruv-badge eruv-badge--outside">✗ Outside Eruv</span>}
          </div>
        )}

        {tab === 'route' && (
          <div className="eruv-route-controls">
            <div className="eruv-control-row">
              <Autocomplete onLoad={ac => { originRef.current = ac; }} onPlaceChanged={() => {}} options={{ componentRestrictions: { country: 'ch' } }}>
                <input className="eruv-input" type="text" placeholder="Start address…" />
              </Autocomplete>
              <Autocomplete onLoad={ac => { destRef.current = ac; }} onPlaceChanged={() => {}} options={{ componentRestrictions: { country: 'ch' } }}>
                <input className="eruv-input" type="text" placeholder="End address…" />
              </Autocomplete>
              <button className="eruv-btn eruv-btn--primary" onClick={handleRoutePlan} disabled={routeLoading}>
                {routeLoading ? (
                  <><span className="eruv-btn-spinner" /> Searching…</>
                ) : 'Plan Route'}
              </button>
              {(directions || routeStatus) && !routeLoading && (
                <button className="eruv-btn eruv-btn--ghost" onClick={handleRouteClear}>Clear</button>
              )}
            </div>

            {routeLoading && loadingMsg && (
              <div className="eruv-alert eruv-alert--info">
                <span className="eruv-btn-spinner eruv-btn-spinner--dark" /> {loadingMsg}
              </div>
            )}
            {!routeLoading && routeStatus === 'outside' && (
              <div className="eruv-alert eruv-alert--error">⚠ {routeMsg}</div>
            )}
            {!routeLoading && routeStatus === 'error' && (
              <div className="eruv-alert eruv-alert--error">✕ {routeMsg}</div>
            )}
            {!routeLoading && routeStatus === 'inside' && (
              <div className="eruv-alert eruv-alert--success">✓ {routeMsg}</div>
            )}
          </div>
        )}
      </div>

      {/* ── Map ── */}
      <div className="eruv-map-wrap">
        <GoogleMap mapContainerClassName="eruv-map" center={MAP_CENTER} zoom={13} options={MAP_OPTIONS} onLoad={onMapLoad}>
          {/* Invisible polygon — used only for containsLocation() point-in-polygon checks */}
          <Polygon paths={ERUV_BOUNDARY} options={POLYGON_OPTIONS} />

          {/* Special cutout polygons (like river banks / Tel HaMislaket) */}
          {ERUV_POLYGONS.map((polyItem, i) => (
             <Polygon key={`poly-${i}`} paths={polyItem.paths} options={{
               strokeColor: '#ef4444',
               strokeOpacity: polyItem.properties['stroke-opacity'] || 1,
               strokeWeight: polyItem.properties['stroke-width'] || 2,
               fillColor: '#ef4444',
               fillOpacity: 0.2, // Custom override for a clear red wash
             }} />
          ))}

          {/* All GeoJSON segments rendered as polylines — shows every boundary
              section including river stubs that can't form closed rings */}
          {ERUV_SEGMENTS.map((seg, i) => (
            <Polyline key={i} path={seg} options={POLYLINE_OPTIONS} />
          ))}

          {tab === 'check' && marker && (
            <Marker position={marker} icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: insideStatus === 'inside' ? '#22c55e' : '#ef4444',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            }} />
          )}

          {tab === 'route' && directions && (
            <DirectionsRenderer
              directions={directions}
              onLoad={ref => { dirRendererRef.current = ref; }}
              onDirectionsChanged={handleDirectionsChanged}
              options={{
                draggable: true,
                polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 5 },
                suppressMarkers: false,
              }}
            />
          )}
        </GoogleMap>

        <div className="eruv-legend">
          <span className="eruv-legend-item"><span className="eruv-legend-line" />Eruv boundary</span>
          <span className="eruv-legend-item"><span className="eruv-legend-fill" />Inside area</span>
        </div>
      </div>
    </div>
  );
};

export default EruvMap;

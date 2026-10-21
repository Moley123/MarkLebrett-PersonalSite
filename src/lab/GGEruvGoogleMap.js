/**
 * Golders Green Eruv — the Google Maps version of the embedded map.
 *
 * The same location check and route planner as the lab engine (./EruvLab.js),
 * on Google's own map, for anyone who prefers it to OpenStreetMap. It shares
 * the engine's sidebar styles, its containment maths (Turf, via
 * ./eruvGeometry) and its in-eruv route search, so the two versions give the
 * same answers; only the map differs.
 *
 * Dragging the route is Google's DirectionsRenderer's own, as on the live
 * pages. After every drag the new route is measured against the boundary, so
 * a route dragged out of the eruv says so rather than being trusted.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Autocomplete, DirectionsRenderer, GoogleMap, Marker, Polygon, Polyline, useJsApiLoader,
} from '@react-google-maps/api';

import { LIBRARIES, defaultRouteContext, findInBoundaryRoute, routePoints } from './EruvLab';
import { formatMetres, outsideMetres } from './routeEditing';
import './EruvLab.css';

/* As in the engine: Google's walking lines follow road centrelines, so a few
   metres "outside" near the boundary is noise, not a real excursion. */
const STRAY_NOISE_M = 25;

const MAP_OPTIONS = {
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  mapTypeControl: true,
  // It sits partway down a long page: scrolling past it mustn't zoom it.
  gestureHandling: 'cooperative',
};

const dot = (color) => ({
  path: window.google.maps.SymbolPath.CIRCLE,
  scale: 9,
  fillColor: color,
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2,
});

/** What the sidebar shows about a Directions reply. */
function describe(result, eruv, note) {
  const path = routePoints(result);
  const leg = result.routes[0].legs[0];
  const strayed = outsideMetres(path, eruv);
  return {
    from: leg.start_address,
    to: leg.end_address,
    distance: leg.distance?.text || '',
    duration: leg.duration?.text || '',
    steps: leg.steps.map((s, i) => ({
      num: i + 1,
      instruction: s.instructions?.replace(/<[^>]*>/g, '') || '',
      distance: s.distance?.text || '',
    })),
    status: strayed > STRAY_NOISE_M ? 'strays' : 'inside',
    message: strayed > STRAY_NOISE_M
      ? `This route leaves the Eruv for about ${formatMetres(strayed)}. Drag it back inside.`
      : note || 'Route stays within the Eruv boundary.',
  };
}

/**
 * @param {object}    props.config  the same config the lab engine takes; only
 *                                  the eruv, wording and view are used
 * @param {object}    props.boundary the eruv's data: color, rawSegments,
 *                                  containmentPath
 * @param {ReactNode} [props.toolbar] a bar above the map
 */
const GGEruvGoogleMap = ({ config, boundary, toolbar = null }) => {
  const {
    eruv, checkIntro, placeholders = {}, autocompleteOptions = {},
  } = config;
  // Google's tiles are 256px to MapLibre's 512, so one zoom level higher
  // frames the same view.
  const zoom = config.zoom + 1;
  const center = config.center;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  const mapRef = useRef(null);
  const serviceRef = useRef(null);
  const rendererRef = useRef(null);
  const locationRef = useRef(null);
  const originRef = useRef(null);
  const destRef = useRef(null);
  const locationInputRef = useRef(null);
  const originInputRef = useRef(null);
  const destInputRef = useRef(null);

  const [tab, setTab] = useState('check');
  const [marker, setMarker] = useState(null);
  // The search's answer. Drags are read back from the renderer rather than
  // stored here: handing a dragged route back to the renderer as a new prop
  // would fire another directions_changed, and so on forever.
  const [directions, setDirections] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeError, setRouteError] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const routeContext = useMemo(() => defaultRouteContext(eruv), [eruv]);
  const inside = marker ? eruv.contains(marker) : null;

  const handleLocationSearch = () => {
    const place = locationRef.current?.getPlace();
    if (!place?.geometry?.location) return;
    const pt = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
    setMarker(pt);
    mapRef.current?.panTo(pt);
    mapRef.current?.setZoom(16);
  };

  const handleLocationReset = () => {
    setMarker(null);
    if (locationInputRef.current) locationInputRef.current.value = '';
  };

  const handleRoutePlan = async () => {
    const origin = originRef.current?.getPlace();
    const dest = destRef.current?.getPlace();
    if (!origin?.geometry?.location || !dest?.geometry?.location) {
      setRouteError('Please select addresses from the dropdown suggestions.');
      return;
    }
    const o = { lat: origin.geometry.location.lat(), lng: origin.geometry.location.lng() };
    const d = { lat: dest.geometry.location.lat(), lng: dest.geometry.location.lng() };

    setDirections(null);
    setRoute(null);
    setShowSteps(false);
    const ctx = routeContext({ origin: o, destination: d });
    if (ctx.error) {
      setRouteError(ctx.error);
      return;
    }

    setRouteError('');
    setRouteLoading(true);
    if (!serviceRef.current) serviceRef.current = new window.google.maps.DirectionsService();
    const found = await findInBoundaryRoute(o, d, serviceRef.current, ctx);
    setRouteLoading(false);

    if (!found) {
      setRouteError('No walking route found that stays entirely within the Eruv boundary between these addresses.');
      return;
    }
    setDirections(found.result);
    setRoute(describe(found.result, eruv, found.waypoints.length
      ? 'Indirect route — detoured to stay inside the Eruv. Drag the line to reshape it.'
      : 'Route stays within the Eruv boundary. Drag the line to reshape it.'));
  };

  /* Fires for the search's own result too, which is re-described to the
     same effect; after a drag it is the only place the new route appears. */
  const handleDirectionsChanged = useCallback(() => {
    const next = rendererRef.current?.getDirections();
    if (!next?.routes?.length) return;
    const leg = next.routes[0].legs[0];
    const ctx = routeContext({
      origin: { lat: leg.start_location.lat(), lng: leg.start_location.lng() },
      destination: { lat: leg.end_location.lat(), lng: leg.end_location.lng() },
    });
    const described = describe(next, eruv);
    setRoute((prev) => ({
      ...described,
      // An initial detour note is worth keeping until the route is changed.
      message: ctx.error
        ? `${ctx.error} Drag it back inside.`
        : described.status === 'inside' && prev?.status === 'inside' ? prev.message : described.message,
      status: ctx.error ? 'strays' : described.status,
    }));
  }, [eruv, routeContext]);

  const handleRouteClear = () => {
    setDirections(null);
    setRoute(null);
    setRouteError('');
    setShowSteps(false);
    if (originInputRef.current) originInputRef.current.value = '';
    if (destInputRef.current) destInputRef.current.value = '';
  };

  if (loadError) {
    return (
      <div className="zlab-page zlab-page--embedded">
        {toolbar}
        <div className="zlab-error"><p>Google Maps could not be loaded.</p></div>
      </div>
    );
  }

  const routeColour = route?.status === 'strays' ? '#ef4444' : '#3b82f6';

  return (
    <div className="zlab-page zlab-page--embedded">
      {toolbar}

      <div className="zlab-container">
        <div className="zlab-sidebar">
          <div className="zlab-tabs">
            <button className={`zlab-tab ${tab === 'check' ? 'active' : ''}`} onClick={() => setTab('check')}>
              📍 Location Check
            </button>
            <button
              className={`zlab-tab ${tab === 'route' ? 'active' : ''}`}
              onClick={() => { setTab('route'); setMarker(null); }}
            >
              🗺 Route Planner
            </button>
          </div>

          <div className="zlab-panel">
            {tab === 'check' && (
              <div className="zlab-check-form">
                <h3>Check an Address</h3>
                <p>{checkIntro}</p>
                <div className="zlab-input-wrap">
                  {isLoaded ? (
                    <Autocomplete
                      onLoad={(ac) => { locationRef.current = ac; }}
                      onPlaceChanged={handleLocationSearch}
                      options={autocompleteOptions}
                    >
                      <input ref={locationInputRef} className="zlab-input" type="text" placeholder={placeholders.check || 'Search an address…'} />
                    </Autocomplete>
                  ) : (
                    <input className="zlab-input" type="text" placeholder="Loading address search…" disabled />
                  )}
                </div>
                <button className="zlab-btn zlab-btn--ghost" onClick={handleLocationReset}>Reset</button>
                {inside === true && <div className="zlab-alert zlab-alert--success">✓ Inside Eruv</div>}
                {inside === false && <div className="zlab-alert zlab-alert--error">✕ Outside Eruv</div>}
              </div>
            )}

            {tab === 'route' && (
              <div className="zlab-route-form">
                <h3>Plan a Route</h3>
                <p>Find a walking route that stays entirely within the Eruv.</p>
                <div className="zlab-input-wrap">
                  <label>Origin</label>
                  {isLoaded ? (
                    <Autocomplete onLoad={(ac) => { originRef.current = ac; }} options={autocompleteOptions}>
                      <input ref={originInputRef} className="zlab-input" type="text" placeholder={placeholders.origin || 'Start address…'} />
                    </Autocomplete>
                  ) : (
                    <input className="zlab-input" type="text" placeholder="Loading…" disabled />
                  )}
                </div>
                <div className="zlab-input-wrap">
                  <label>Destination</label>
                  {isLoaded ? (
                    <Autocomplete onLoad={(ac) => { destRef.current = ac; }} options={autocompleteOptions}>
                      <input ref={destInputRef} className="zlab-input" type="text" placeholder={placeholders.destination || 'End address…'} />
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
                </div>

                {routeLoading && (
                  <div className="zlab-alert zlab-alert--info">
                    <span className="zlab-btn-spinner zlab-btn-spinner--dark" /> Searching for an Eruv-safe walking route…
                  </div>
                )}
                {!routeLoading && routeError && <div className="zlab-alert zlab-alert--error">⚠ {routeError}</div>}
                {!routeLoading && route && (
                  <div className={`zlab-alert ${route.status === 'inside' ? 'zlab-alert--success' : 'zlab-alert--warn'}`}>
                    {route.status === 'inside' ? '✓' : '⚠'} {route.message}
                  </div>
                )}

                {route && !routeLoading && (
                  <div className="zlab-editor">
                    <div className="zlab-chips">
                      <span className="zlab-chip">{route.distance}</span>
                      {route.duration && <span className="zlab-chip">{route.duration}</span>}
                    </div>
                    <ol className="zlab-stops">
                      <li className="zlab-stop zlab-stop--end">
                        <span className="zlab-stop-marker zlab-stop-marker--origin" aria-hidden="true">A</span>
                        <span className="zlab-stop-label">{route.from}</span>
                      </li>
                      <li className="zlab-stop zlab-stop--end">
                        <span className="zlab-stop-marker zlab-stop-marker--dest" aria-hidden="true">B</span>
                        <span className="zlab-stop-label">{route.to}</span>
                      </li>
                    </ol>
                    <div className="zlab-btn-row">
                      <button className="zlab-btn zlab-btn--ghost" onClick={() => setShowSteps((s) => !s)}>
                        {showSteps ? 'Hide' : 'Show'} directions
                      </button>
                    </div>
                    {showSteps && (
                      <ol className="zlab-steps">
                        {route.steps.map((step) => (
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

        <div className="zlab-map-wrap">
          {isLoaded ? (
            <GoogleMap
              mapContainerClassName="zlab-map"
              center={center}
              zoom={zoom}
              options={MAP_OPTIONS}
              onLoad={(m) => { mapRef.current = m; }}
            >
              <Polygon
                paths={boundary.containmentPath}
                options={{ fillColor: boundary.color, fillOpacity: 0.1, strokeOpacity: 0, clickable: false }}
              />
              {boundary.rawSegments.filter((seg) => seg.length > 1).map((seg, i) => (
                <Polyline
                  key={`seg-${i}`}
                  path={seg}
                  options={{ strokeColor: boundary.color, strokeWeight: 3, clickable: false }}
                />
              ))}
              {tab === 'check' && marker && (
                <Marker position={marker} icon={dot(inside ? '#22c55e' : '#ef4444')} />
              )}
              {tab === 'route' && directions && (
                <DirectionsRenderer
                  directions={directions}
                  options={{
                    draggable: true,
                    polylineOptions: { strokeColor: routeColour, strokeWeight: 5 },
                  }}
                  onLoad={(r) => { rendererRef.current = r; }}
                  onUnmount={() => { rendererRef.current = null; }}
                  onDirectionsChanged={handleDirectionsChanged}
                />
              )}
            </GoogleMap>
          ) : (
            <div className="zlab-map-loading">
              <div className="zlab-spinner" />
              <p>Loading map…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GGEruvGoogleMap;

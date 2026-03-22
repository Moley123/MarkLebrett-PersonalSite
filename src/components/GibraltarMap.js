import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { GIBRALTAR_ERUV } from '../data/gibraltar_data';
import { GIBRALTAR_ERUV_NOTES } from '../data/gibraltar_notes';
import './GibraltarMap.css';

const LIBRARIES = ['places', 'geometry'];

const MAP_CENTER = { lat: 36.140, lng: -5.353 };
const MAP_OPTIONS = {
  mapTypeControl: true,
  mapTypeControlOptions: { style: 2 },
  streetViewControl: false,
  fullscreenControl: true,
};

/* ═══════ Geometry helpers ═══════ */

function buildContainmentPolys() {
  if (!window.google?.maps) return [];
  return GIBRALTAR_ERUV.map(e => ({
    name: e.name,
    poly: new window.google.maps.Polygon({ paths: e.containmentPath }),
  }));
}

function whichEruvContains(latLng, activePolys) {
  for (const { name, poly } of activePolys) {
    if (window.google.maps.geometry.poly.containsLocation(latLng, poly)) return name;
  }
  return null;
}

function decodePath(encoded) {
  if (!encoded) return [];
  return window.google.maps.geometry.encoding.decodePath(encoded);
}

function routeStaysValid(result, activePolys) {
  for (const leg of result.routes[0].legs) {
    for (const step of leg.steps) {
      for (const pt of decodePath(step.polyline?.points || '')) {
        if (!whichEruvContains(pt, activePolys)) return false;
      }
    }
  }
  return true;
}

/* ═══════ Component ═══════ */
const GibraltarMap = () => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  useEffect(() => {
    document.title = 'Mark Lebrett | Gibraltar Eruv';
  }, []);

  const [activeTab, setActiveTab] = useState('check');
  const [checkResult, setCheckResult] = useState({ state: 'idle', msg: '' });
  const [routeStatus, setRouteStatus] = useState('idle');
  const [routeMsg, setRouteMsg] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  const [checkMarker, setCheckMarker] = useState(null);
  const [directionsResult, setDirectionsResult] = useState(null);

  const mapRef = useRef(null);
  const routeServiceRef = useRef(null);
  const dirRendererRef = useRef(null);
  const autocompleteCheckRef = useRef(null);
  const autocompleteStartRef = useRef(null);
  const autocompleteEndRef = useRef(null);
  const checkInputRef = useRef(null);
  const startInputRef = useRef(null);
  const endInputRef   = useRef(null);

  const onMapLoad = useCallback(map => {
    mapRef.current = map;
    routeServiceRef.current = new window.google.maps.DirectionsService();
  }, []);

  const onDirectionsChanged = useCallback(() => {
    if (!dirRendererRef.current) return;
    const newDirs = dirRendererRef.current.getDirections();
    if (!newDirs) return;
    const activePolys = buildContainmentPolys();
    const valid = routeStaysValid(newDirs, activePolys);
    setRouteStatus(valid ? 'inside' : 'outside');
    setRouteMsg(valid ? 'Modified route stays within Eruv.' : 'Modified route exits boundary!');
  }, []);

  const onCheckPlace = () => {
    if (!autocompleteCheckRef.current) return;
    const place = autocompleteCheckRef.current.getPlace();
    if (!place?.geometry?.location) return;
    const loc = place.geometry.location;
    setCheckMarker({ lat: loc.lat(), lng: loc.lng() });
    mapRef.current.panTo(loc);
    mapRef.current.setZoom(15);
    setDirectionsResult(null);
    const polys = buildContainmentPolys();
    const name = whichEruvContains(loc, polys);
    setCheckResult(name
      ? { state: 'inside', msg: `Inside ${name}!` }
      : { state: 'outside', msg: 'Outside Eruv bounds.' }
    );
  };

  const handleCheckReset = () => {
    if (checkInputRef.current) checkInputRef.current.value = '';
    setCheckMarker(null);
    setCheckResult({ state: 'idle', msg: '' });
    mapRef.current.panTo(MAP_CENTER);
    mapRef.current.setZoom(14);
  };

  const handleRoute = (e) => {
    e.preventDefault();
    setDirectionsResult(null);
    setRouteStatus('idle'); setRouteMsg(''); setCheckMarker(null);
    
    if (!autocompleteStartRef.current || !autocompleteEndRef.current) return;
    const pA = autocompleteStartRef.current.getPlace();
    const pB = autocompleteEndRef.current.getPlace();
    if (!pA?.geometry?.location || !pB?.geometry?.location) return;

    setRouteLoading(true);
    const originLoc = pA.geometry.location;
    const destLoc = pB.geometry.location;
    const activePolys = buildContainmentPolys();

    if (!whichEruvContains(originLoc, activePolys) || !whichEruvContains(destLoc, activePolys)) {
      setRouteStatus('error');
      setRouteMsg('Both origin and destination must be inside the Eruv.');
      setRouteLoading(false);
      return;
    }

    routeServiceRef.current.route({
      origin: originLoc,
      destination: destLoc,
      travelMode: 'WALKING',
      provideRouteAlternatives: true,
    }, (result, status) => {
      setRouteLoading(false);
      if (status !== 'OK') {
        setRouteStatus('error'); setRouteMsg('Could not calculate a route.');
        return;
      }
      for (const r of result.routes) {
        if (routeStaysValid({ routes: [r] }, activePolys)) {
          setDirectionsResult({ ...result, routes: [r] });
          setRouteStatus('inside'); setRouteMsg('Found safe route.');
          return;
        }
      }
      setRouteStatus('outside');
      setRouteMsg('No direct internal route found. Try modifying the route.');
      setDirectionsResult({ ...result, routes: [result.routes[0]] });
    });
  };

  const handleRouteClear = () => {
    setDirectionsResult(null); setRouteStatus('idle'); setRouteMsg('');
    if (startInputRef.current) startInputRef.current.value = '';
    if (endInputRef.current) endInputRef.current.value = '';
    mapRef.current.panTo(MAP_CENTER); mapRef.current.setZoom(14);
  };

  if (loadError) return <div className="eruv-error">Error loading maps...</div>;
  if (!isLoaded) return <div className="eruv-loading">Loading Map...</div>;

  return (
    <div className="eruv-page">
      <nav className="eruv-top-nav">
        <div className="nav-col-left" />
        <div className="nav-col-center">
          <h2>Gibraltar Eruv Route Planner</h2>
        </div>
        <div className="nav-col-right">
          <Link to="/" className="eruv-portal-btn">← Portal</Link>
        </div>
      </nav>

      <div className="eruv-container">
        <div className="eruv-sidebar">
          <div className="eruv-tabs">
            <button className={`eruv-tab ${activeTab === 'check' ? 'active' : ''}`} onClick={() => setActiveTab('check')}>Location Check</button>
            <button className={`eruv-tab ${activeTab === 'route' ? 'active' : ''}`} onClick={() => setActiveTab('route')}>Route Planner</button>
            <button className={`eruv-tab ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>Eruv Notes</button>
          </div>
          
          <div className="eruv-panel">
            {activeTab === 'check' && (
              <div className="eruv-check-form">
                <h3>Check Location</h3>
                <p>Enter an address to check if it falls inside the Gibraltar Eruv.</p>
                <div className="eruv-input-wrap">
                  <Autocomplete onLoad={ac => autocompleteCheckRef.current = ac} onPlaceChanged={onCheckPlace}>
                    <input ref={checkInputRef} type="text" placeholder="Search address, postcode..." className="eruv-input" />
                  </Autocomplete>
                </div>
                <button type="button" className="eruv-btn eruv-btn--ghost" onClick={handleCheckReset}>Reset</button>
                {checkResult.state === 'inside' && <div className="eruv-alert eruv-alert--success">✓ {checkResult.msg}</div>}
                {checkResult.state === 'outside' && <div className="eruv-alert eruv-alert--error">✕ {checkResult.msg}</div>}
              </div>
            )}

            {activeTab === 'route' && (
              <form className="eruv-route-form" onSubmit={handleRoute}>
                <h3>Plan a Route</h3>
                <p>Plan a walking route. Drag the blue line to modify it if necessary.</p>
                <div className="eruv-input-wrap">
                  <label>Origin</label>
                  <Autocomplete onLoad={ac => autocompleteStartRef.current = ac}>
                    <input ref={startInputRef} type="text" placeholder="Start location" className="eruv-input" required />
                  </Autocomplete>
                </div>
                <div className="eruv-input-wrap">
                  <label>Destination</label>
                  <Autocomplete onLoad={ac => autocompleteEndRef.current = ac}>
                    <input ref={endInputRef} type="text" placeholder="End location" className="eruv-input" required />
                  </Autocomplete>
                </div>
                <div className="eruv-btn-row">
                  <button type="submit" className="eruv-btn" disabled={routeLoading}>
                    {routeLoading ? 'Calculating…' : 'Find Route'}
                  </button>
                  <button type="button" className="eruv-btn eruv-btn--ghost" onClick={handleRouteClear}>Reset</button>
                </div>
                {routeStatus === 'outside' && <div className="eruv-alert eruv-alert--error">⚠ {routeMsg}</div>}
                {routeStatus === 'error' && <div className="eruv-alert eruv-alert--error">✕ {routeMsg}</div>}
                {routeStatus === 'inside' && <div className="eruv-alert eruv-alert--success">✓ {routeMsg}</div>}
              </form>
            )}

            {activeTab === 'notes' && (
              <div className="eruv-notes-form">
                <h3>Eruv Information</h3>
                <div className="eruv-notes-content">
                  {GIBRALTAR_ERUV_NOTES.map((note, idx) => (
                    <div key={idx} className="eruv-notes-special" style={{marginBottom: "1rem"}}>
                      <strong>{note.title}</strong>
                      <p style={{whiteSpace: 'pre-line'}}>{note.content}</p>
                      {note.links && note.links.map((l, i) => (
                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="eruv-note-link">{l.name}</a>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <hr className="nwl-divider" />
            <div className="nwl-layers">
              <h3>Layer Toggles</h3>
              <div className="nwl-layer-list">
                <label className="nwl-checkbox">
                  <input type="checkbox" checked={true} readOnly />
                  <span className="nwl-color-swatch" style={{ backgroundColor: '#e91e63' }}></span>
                  Gibraltar Eruv
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="eruv-map-wrap">
          <GoogleMap mapContainerClassName="eruv-map" center={MAP_CENTER} zoom={14} options={MAP_OPTIONS} onLoad={onMapLoad}>
            {GIBRALTAR_ERUV.map((eruv, ei) => eruv.polygonPaths.map((poly, pi) => (
                <Polygon key={`poly-${ei}-${pi}`} paths={poly} options={{
                  strokeColor: eruv.color, strokeOpacity: 1, strokeWeight: 2,
                  fillColor: eruv.color, fillOpacity: 0.08,
                }} />
            )))}
            {checkMarker && <Marker position={checkMarker} />}
            {directionsResult && (
              <DirectionsRenderer
                directions={directionsResult}
                options={{ preserveViewport: true, draggable: true }}
                onLoad={r => { dirRendererRef.current = r; }}
                onDirectionsChanged={onDirectionsChanged}
              />
            )}
          </GoogleMap>
        </div>
      </div>
    </div>
  );
};

export default GibraltarMap;

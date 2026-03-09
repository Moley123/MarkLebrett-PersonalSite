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
import { NWLONDON_ERUVIM, CROSSING_POINTS } from '../data/nwlondon_data';
import './NWLondonMap.css';

const LIBRARIES = ['places', 'geometry'];

const MAP_CENTER = { lat: 51.614, lng: -0.276 }; // Centered near Edgware/Mill Hill
const MAP_OPTIONS = {
  mapTypeControl: true,
  mapTypeControlOptions: { style: 2 }, 
  streetViewControl: false,
  fullscreenControl: true,
};

const GOLDERS_GREEN_PLACEHOLDER = {
  name: 'Golders Green Eruv (Coming Soon)',
  color: '#888888',
  paths: [],
  disabled: true
};

const ALL_ERUVIM_OPTIONS = [...NWLONDON_ERUVIM, GOLDERS_GREEN_PLACEHOLDER];

// Helper to convert data paths to google.maps.Polygon objects for geometry calculations
function makePolys(activeNames) {
  if (!window.google || !window.google.maps) return [];
  return NWLONDON_ERUVIM
    .filter(e => activeNames.includes(e.name))
    .map(e => ({
      name: e.name,
      poly: new window.google.maps.Polygon({ paths: e.paths })
    }));
}

// 1. Point Check: Returns the name of the Eruv the point is in, or null.
function whichEruvContains(latLng, activePolys) {
  for (const { name, poly } of activePolys) {
    if (window.google.maps.geometry.poly.containsLocation(latLng, poly)) {
      return name;
    }
  }
  return null;
}

function decodePath(encoded) {
  if (!encoded) return [];
  return window.google.maps.geometry.encoding.decodePath(encoded);
}

// Distance helper
function distanceBetween(ll1, ll2) {
  return window.google.maps.geometry.spherical.computeDistanceBetween(ll1, ll2);
}

// Helper to find the nearest valid crossing point to a given latLng
function isNearValidCrossingPoint(latLng) {
  for (const cp of CROSSING_POINTS) {
    const cpLatLng = new window.google.maps.LatLng(cp.pos.lat, cp.pos.lng);
    const dist = distanceBetween(latLng, cpLatLng);
    if (dist < 80) { // If transit happened within 80 meters of a designated cross
      return true;
    }
  }
  return false;
}

// 2. Route Check: Validates the decoded route against strict/crossing rules
function routeStaysInNWLondon(result, isCrossingMode, activePolys) {
  let currentEruv = null;

  for (const leg of result.routes[0].legs) {
    for (const step of leg.steps) {
      const pts = decodePath(step.polyline?.points || '');
      for (const pt of pts) {
        
        const occupyingEruv = whichEruvContains(pt, activePolys);

        // If it's entirely outside any active Eruv, fail immediately
        if (!occupyingEruv) return false;

        // Validating transition between Eruvin
        if (currentEruv === null) {
          currentEruv = occupyingEruv;
        } else if (currentEruv !== occupyingEruv) {
          
          if (!isCrossingMode) {
             // Strict mode: NOT allowed to cross into a different Eruv at all.
             return false;
          } else {
             // Crossing mode: MUST be near a valid CROSSING_POINT
             if (!isNearValidCrossingPoint(pt)) {
                return false;
             }
             currentEruv = occupyingEruv; // Transition successful
          }
        }
      }
    }
  }
  return true;
}

// 3. Waypoint generation
let _cachedWaypoints = {};

function getInteriorWaypoints(eruvName, activePolys) {
  if (_cachedWaypoints[eruvName]) return _cachedWaypoints[eruvName];

  const eruvObj = activePolys.find(p => p.name === eruvName);
  if (!eruvObj) return [];

  // Find bounding box to generate grid
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  // paths could be an array of points OR array of arrays of points
  const rawData = NWLONDON_ERUVIM.find(e => e.name === eruvName);
  const extractPoints = (paths) => {
    if(!paths) return;
    if(paths.length > 0 && Array.isArray(paths[0])) {
      paths.forEach(extractPoints);
    } else {
      paths.forEach(p => {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      });
    }
  };
  extractPoints(rawData.paths);

  const inside = [];
  const G = 15; // 15x15 = 225 candidates per Eruv

  for (let i = 0; i <= G; i++) {
    for (let j = 0; j <= G; j++) {
      const lat = minLat + (maxLat - minLat) * (i / G);
      const lng = minLng + (maxLng - minLng) * (j / G);
      const ll  = new window.google.maps.LatLng(lat, lng);
      if (window.google.maps.geometry.poly.containsLocation(ll, eruvObj.poly)) {
        inside.push({ lat, lng });
      }
    }
  }

  _cachedWaypoints[eruvName] = inside;
  return inside;
}

// Find first point where route exits valid zone to anchor waypoints
function firstExitOrInvalidCrossing(result, isCrossingMode, activePolys) {
  let currentEruv = null;
  for (const leg of result.routes[0].legs) {
    for (const step of leg.steps) {
      const pts = decodePath(step.polyline?.points || '');
      for (const pt of pts) {
        const occupyingEruv = whichEruvContains(pt, activePolys);
        if (!occupyingEruv) return { pt: {lat: pt.lat(), lng: pt.lng()}, type: 'outside' };
        
        if (currentEruv === null) currentEruv = occupyingEruv;
        else if (currentEruv !== occupyingEruv) {
          if (!isCrossingMode || !isNearValidCrossingPoint(pt)) {
             return { pt: {lat: pt.lat(), lng: pt.lng()}, type: 'invalid_cross' };
          }
          currentEruv = occupyingEruv;
        }
      }
    }
  }
  return null;
}

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

async function findInBoundaryRoute(originLoc, destLoc, isCrossingMode, activePolys, service) {
  // Try direct route
  const direct = await requestRoute(originLoc, destLoc, [], service);
  if (direct && routeStaysInNWLondon(direct, isCrossingMode, activePolys)) {
     return { result: direct, indirect: false };
  }

  // Find where rule was violated
  const violation = direct ? firstExitOrInvalidCrossing(direct, isCrossingMode, activePolys) : null;
  const ref = violation ? violation.pt : {
    lat: (originLoc.lat() + destLoc.lat()) / 2,
    lng: (originLoc.lng() + destLoc.lng()) / 2,
  };

  // Determine which waypoints to pull from.
  // If strict mode, we ONLY use waypoints from the origin's Eruv
  // If crossing mode, we can use waypoints from any active Eruv, or rely on CROSSING_POINTS directly.
  const originEruvName = whichEruvContains(originLoc, activePolys);
  if(!originEruvName) return null; // Origin itself is outside

  let waypoints = [];
  if (!isCrossingMode) {
      waypoints = getInteriorWaypoints(originEruvName, activePolys);
  } else {
      // If we failed in crossing mode (e.g. invalid crossing or outside boundary),
      // we inject the valid Crossing Points as strong anchor candidates too!
      activePolys.forEach(p => {
          waypoints = waypoints.concat(getInteriorWaypoints(p.name, activePolys));
      });
      CROSSING_POINTS.forEach(cp => waypoints.push(cp.pos));
  }

  const sorted = [...waypoints].sort((a, b) =>
    Math.hypot(a.lat - ref.lat, a.lng - ref.lng) -
    Math.hypot(b.lat - ref.lat, b.lng - ref.lng)
  );

  // Try 1-waypoint routes (12 nearest)
  for (const wp of sorted.slice(0, 12)) {
    const result = await requestRoute(originLoc, destLoc, [wp], service);
    if (result && routeStaysInNWLondon(result, isCrossingMode, activePolys)) return { result, indirect: true };
  }

  // Try 2-waypoint pairs (6 nearest)
  const near6 = sorted.slice(0, 6);
  for (let i = 0; i < near6.length; i++) {
    for (let j = i + 1; j < near6.length; j++) {
      const result = await requestRoute(originLoc, destLoc, [near6[i], near6[j]], service);
      if (result && routeStaysInNWLondon(result, isCrossingMode, activePolys)) return { result, indirect: true };
    }
  }

  return null;
}

const NWLondonMap = () => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  const [activeTab, setActiveTab] = useState('check');
  const [activeEruvinNames, setActiveEruvinNames] = useState(
      NWLONDON_ERUVIM.map(e => e.name)
  );
  
  // UI State
  const [checkResult, setCheckResult] = useState({ state: 'idle', msg: '' });
  const [routeStatus, setRouteStatus] = useState('idle');
  const [routeMsg, setRouteMsg] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  
  // Toggles
  const [allowCrossing, setAllowCrossing] = useState(false);
  const [showToggles, setShowToggles] = useState(false);

  // Map state
  const mapRef = useRef(null);
  const routeServiceRef = useRef(null);
  const autocompleteCheckRef = useRef(null);
  const autocompleteStartRef = useRef(null);
  const autocompleteEndRef = useRef(null);

  const [checkMarker, setCheckMarker] = useState(null);
  const [directionsResult, setDirectionsResult] = useState(null);

  const onMapLoad = useCallback(map => {
    mapRef.current = map;
    routeServiceRef.current = new window.google.maps.DirectionsService();
  }, []);

  const handleEruvToggle = (name) => {
    setActiveEruvinNames(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  /* Tab 1: Check */
  const onCheckPlaceSelected = () => {
    if (!autocompleteCheckRef.current) return;
    const place = autocompleteCheckRef.current.getPlace();
    if (!place?.geometry?.location) return;

    const loc = place.geometry.location;
    setCheckMarker({ lat: loc.lat(), lng: loc.lng() });
    mapRef.current.panTo(loc);
    mapRef.current.setZoom(16);

    const activePolys = makePolys(activeEruvinNames);
    const eruvName = whichEruvContains(loc, activePolys);

    setDirectionsResult(null);

    if (eruvName) {
      setCheckResult({ state: 'inside', msg: `Inside ${eruvName}!` });
    } else {
      setCheckResult({ state: 'outside', msg: 'Outside active Eruvin bounds. (Check if you have toggles disabled on the menu)' });
    }
  };

  /* Tab 2: Route */
  const handleRouteSubmit = async (e) => {
    e.preventDefault();
    if (!autocompleteStartRef.current || !autocompleteEndRef.current) return;

    const startPlace = autocompleteStartRef.current.getPlace();
    const endPlace = autocompleteEndRef.current.getPlace();

    if (!startPlace?.geometry?.location || !endPlace?.geometry?.location) {
      setRouteStatus('error');
      setRouteMsg('Please select addresses from the dropdown.');
      return;
    }

    setRouteLoading(true);
    setRouteStatus('idle');
    setRouteMsg('');
    setDirectionsResult(null);
    setCheckMarker(null);
    
    // Auto-fit bounds
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(startPlace.geometry.location);
    bounds.extend(endPlace.geometry.location);
    mapRef.current.fitBounds(bounds);

    const activePolys = makePolys(activeEruvinNames);
    
    // Quick origin/dest validation BEFORE routing
    const originEruv = whichEruvContains(startPlace.geometry.location, activePolys);
    const destEruv = whichEruvContains(endPlace.geometry.location, activePolys);
    
    if (!originEruv || !destEruv) {
        setRouteLoading(false);
        setRouteStatus('outside');
        setRouteMsg('Origin or destination is completely outside the active Eruvin boundaries.');
        return;
    }
    
    if (!allowCrossing && originEruv !== destEruv) {
        setRouteLoading(false);
        setRouteStatus('outside');
        setRouteMsg(`Strict Mode is ON. You cannot route from ${originEruv} to ${destEruv}. Turn on 'Allow Crossing'.`);
        return;
    }

    const outcome = await findInBoundaryRoute(
      startPlace.geometry.location,
      endPlace.geometry.location,
      allowCrossing,
      activePolys,
      routeServiceRef.current
    );

    setRouteLoading(false);

    if (outcome) {
      setDirectionsResult(outcome.result);
      setRouteStatus('inside');
      setRouteMsg(
        outcome.indirect
          ? 'Route found with slight adjustments to stay inside boundary limits.'
          : 'Direct route stays completely inside bounds.'
      );
    } else {
      setRouteStatus('outside');
      setRouteMsg(allowCrossing 
        ? 'No valid route found. Path leaves the boundary entirely or crosses between Eruvin at an invalid point.'
        : `No route found strictly within ${originEruv}.`
      );
    }
  };

  if (loadError) return <div className="eruv-error">Failed to load Google Maps</div>;
  if (!isLoaded) return (
    <div className="eruv-loading">
      <div className="eruv-spinner" />
      <p>Loading mapping engine…</p>
    </div>
  );

  return (
    <div className="eruv-page">
      <div className="eruv-header">
        <Link to="/" className="eruv-back-btn" aria-label="Back to portal">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Portal
        </Link>
        <h1 className="eruv-title">NW London Eiruvim Network</h1>
        <p className="eruv-subtitle">
          Check locations or plan complex routes across multiple interconnected North West London Eruv zones.
        </p>
      </div>

      <div className="eruv-container">
        {/* ── Left Sidebar: Controls ── */}
        <div className="eruv-sidebar">
          
          <div className="eruv-tabs">
            <button
              className={`eruv-tab ${activeTab === 'check' ? 'active' : ''}`}
              onClick={() => { setActiveTab('check'); setDirectionsResult(null); }}
            >
              Location Check
            </button>
            <button
              className={`eruv-tab ${activeTab === 'route' ? 'active' : ''}`}
              onClick={() => { setActiveTab('route'); setCheckMarker(null); }}
            >
              Route Planner
            </button>
          </div>

          <div className="eruv-panel">
            {activeTab === 'check' && (
              <div className="eruv-check-form">
                <h3>Check an Address</h3>
                <p>Enter a specific address or postcode to verify if it falls within any active Eruv.</p>
                <div className="eruv-input-wrap">
                  <Autocomplete onLoad={ac => autocompleteCheckRef.current = ac} onPlaceChanged={onCheckPlaceSelected}>
                    <input type="text" placeholder="e.g., Station Road, Edgware" className="eruv-input" />
                  </Autocomplete>
                </div>
                {checkResult.state === 'inside' && (
                  <div className="eruv-alert eruv-alert--success">✓ {checkResult.msg}</div>
                )}
                {checkResult.state === 'outside' && (
                  <div className="eruv-alert eruv-alert--error">✕ {checkResult.msg}</div>
                )}
              </div>
            )}

            {activeTab === 'route' && (
              <form className="eruv-route-form" onSubmit={handleRouteSubmit}>
                <h3>Plan a Route</h3>
                <p>Plan a walking route that doesn't cross the boundary incorrectly.</p>

                <div className="eruv-input-wrap">
                  <label>Origin</label>
                  <Autocomplete onLoad={ac => autocompleteStartRef.current = ac}>
                    <input type="text" placeholder="Start location" className="eruv-input" required />
                  </Autocomplete>
                </div>
                <div className="eruv-input-wrap">
                  <label>Destination</label>
                  <Autocomplete onLoad={ac => autocompleteEndRef.current = ac}>
                    <input type="text" placeholder="End location" className="eruv-input" required />
                  </Autocomplete>
                </div>
                
                <label className="nwl-crossing-toggle">
                   <input type="checkbox" checked={allowCrossing} onChange={e => setAllowCrossing(e.target.checked)} />
                   <span>Allow Crossing Between Eiruvim (Requires using assigned official crossing boundaries).</span>
                </label>

                <button type="submit" className="eruv-btn" disabled={routeLoading}>
                  {routeLoading ? 'Calculating…' : 'Find Safe Route'}
                </button>

                {routeStatus === 'outside' && ( <div className="eruv-alert eruv-alert--error">⚠ {routeMsg}</div> )}
                {routeStatus === 'error' && ( <div className="eruv-alert eruv-alert--error">✕ {routeMsg}</div> )}
                {routeStatus === 'inside' && ( <div className="eruv-alert eruv-alert--success">✓ {routeMsg}</div> )}
              </form>
            )}
            
            <hr className="nwl-divider" />
            
            <div className="nwl-layers">
               <div className="nwl-layers-header" onClick={() => setShowToggles(!showToggles)}>
                   <h3>Layer Toggles</h3>
                   <span>{showToggles ? '▲' : '▼'}</span>
               </div>
               
               {showToggles && (
                 <div className="nwl-layer-list">
                    {ALL_ERUVIM_OPTIONS.map((eruv, idx) => (
                       <label key={idx} className={`nwl-checkbox ${eruv.disabled ? 'disabled' : ''}`}>
                          <input 
                             type="checkbox" 
                             checked={activeEruvinNames.includes(eruv.name)}
                             disabled={eruv.disabled}
                             onChange={() => handleEruvToggle(eruv.name)} 
                          />
                          <span className="nwl-color-swatch" style={{backgroundColor: eruv.color}}></span>
                          {eruv.name}
                       </label>
                    ))}
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* ── Right Side: Map ── */}
        <div className="eruv-map-wrap">
          <GoogleMap mapContainerClassName="eruv-map" center={MAP_CENTER} zoom={12} options={MAP_OPTIONS} onLoad={onMapLoad}>
            
            {/* Draw all active polygons distinctly */}
            {NWLONDON_ERUVIM.map((eruvItem, i) => {
               if(!activeEruvinNames.includes(eruvItem.name)) return null;
               
               return (
                 <Polygon 
                   key={`poly-${i}`} 
                   paths={eruvItem.paths} 
                   options={{
                     strokeColor: eruvItem.color,
                     strokeOpacity: 1,
                     strokeWeight: 2,
                     fillColor: eruvItem.color,
                     fillOpacity: 0.1,
                   }} 
                 />
               );
            })}

            {checkMarker && <Marker position={checkMarker} />}
            {directionsResult && <DirectionsRenderer directions={directionsResult} options={{ preserveViewport: true }} />}
          </GoogleMap>
        </div>
      </div>
    </div>
  );
};

export default NWLondonMap;

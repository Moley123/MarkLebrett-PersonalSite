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
import { NWLONDON_ERUVIM, CROSSING_POINTS } from '../data/nwlondon_data';
import { ERUV_NOTES } from '../data/eruv_notes';
import './NWLondonMap.css';

const LIBRARIES = ['places', 'geometry'];

const MAP_CENTER = { lat: 51.614, lng: -0.276 };
const MAP_OPTIONS = {
  mapTypeControl: true,
  mapTypeControlOptions: { style: 2 },
  streetViewControl: false,
  fullscreenControl: true,
};

const GOLDERS_GREEN_PLACEHOLDER = {
  name: 'Golders Green Eruv (Coming Soon)',
  color: '#888888',
  disabled: true,
};

const STAMFORD_HILL_PLACEHOLDER = {
  name: 'Stamford Hill Eruv (Coming Soon)',
  color: '#888888',
  disabled: true,
};

const ALL_TOGGLE_OPTIONS = [
  ...NWLONDON_ERUVIM,
  { name: '── Crossing Points', color: '#ffd600', isCrossing: true },
  GOLDERS_GREEN_PLACEHOLDER,
  STAMFORD_HILL_PLACEHOLDER,
];

/* ═══════ Geometry helpers ═══════ */

function buildContainmentPolys(activeNames) {
  if (!window.google?.maps) return [];
  return NWLONDON_ERUVIM
    .filter(e => activeNames.includes(e.name) && e.containmentPath.length > 2)
    .map(e => ({
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

function isNearCrossingPoint(latLng) {
  for (const cp of CROSSING_POINTS) {
    for (const pt of cp.path) {
      const cpLL = new window.google.maps.LatLng(pt.lat, pt.lng);
      if (window.google.maps.geometry.spherical.computeDistanceBetween(latLng, cpLL) < 100) return true;
    }
  }
  return false;
}

function routeStaysValid(result, isCrossingMode, activePolys) {
  let currentEruv = null;
  for (const leg of result.routes[0].legs) {
    for (const step of leg.steps) {
      for (const pt of decodePath(step.polyline?.points || '')) {
        const occupying = whichEruvContains(pt, activePolys);
        if (!occupying) return false;
        if (currentEruv === null) { currentEruv = occupying; continue; }
        if (currentEruv !== occupying) {
          if (!isCrossingMode) return false;
          if (!isNearCrossingPoint(pt)) return false;
          currentEruv = occupying;
        }
      }
    }
  }
  return true;
}

/* ═══════ Waypoint grid ═══════ */
const _wpCache = {};
function getWaypoints(eruvName, activePolys) {
  if (_wpCache[eruvName]) return _wpCache[eruvName];
  const eruvObj = activePolys.find(p => p.name === eruvName);
  if (!eruvObj) return [];
  const raw = NWLONDON_ERUVIM.find(e => e.name === eruvName);
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  const scan = pts => pts.forEach(p => {
    if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng; if (p.lng > maxLng) maxLng = p.lng;
  });
  raw.containmentPath.forEach(p => scan([p]));
  raw.rawSegments.forEach(scan);
  const inside = [];
  const G = 15;
  for (let i = 0; i <= G; i++) for (let j = 0; j <= G; j++) {
    const lat = minLat + (maxLat - minLat) * (i / G);
    const lng = minLng + (maxLng - minLng) * (j / G);
    const ll = new window.google.maps.LatLng(lat, lng);
    if (window.google.maps.geometry.poly.containsLocation(ll, eruvObj.poly)) inside.push({ lat, lng });
  }
  _wpCache[eruvName] = inside;
  return inside;
}

function requestRoute(origin, dest, wps, service) {
  return new Promise(resolve => {
    service.route({
      origin, destination: dest,
      travelMode: window.google.maps.TravelMode.WALKING,
      waypoints: wps.map(ll => ({ location: new window.google.maps.LatLng(ll.lat, ll.lng), stopover: false })),
      optimizeWaypoints: false,
    }, (result, status) => resolve(status === 'OK' ? result : null));
  });
}

async function findRoute(originLoc, destLoc, isCrossing, activePolys, service) {
  const direct = await requestRoute(originLoc, destLoc, [], service);
  if (direct && routeStaysValid(direct, isCrossing, activePolys)) return { result: direct, indirect: false };

  const originEruv = whichEruvContains(originLoc, activePolys);
  if (!originEruv) return null;

  let wps = [];
  if (!isCrossing) {
    wps = getWaypoints(originEruv, activePolys);
  } else {
    activePolys.forEach(p => { wps = wps.concat(getWaypoints(p.name, activePolys)); });
    CROSSING_POINTS.forEach(cp => { const mid = cp.path[Math.floor(cp.path.length / 2)]; wps.push(mid); });
  }

  const ref = { lat: (originLoc.lat() + destLoc.lat()) / 2, lng: (originLoc.lng() + destLoc.lng()) / 2 };
  const sorted = [...wps].sort((a, b) =>
    Math.hypot(a.lat - ref.lat, a.lng - ref.lng) - Math.hypot(b.lat - ref.lat, b.lng - ref.lng)
  );

  for (const wp of sorted.slice(0, 12)) {
    const r = await requestRoute(originLoc, destLoc, [wp], service);
    if (r && routeStaysValid(r, isCrossing, activePolys)) return { result: r, indirect: true };
  }
  const near6 = sorted.slice(0, 6);
  for (let i = 0; i < near6.length; i++) for (let j = i + 1; j < near6.length; j++) {
    const r = await requestRoute(originLoc, destLoc, [near6[i], near6[j]], service);
    if (r && routeStaysValid(r, isCrossing, activePolys)) return { result: r, indirect: true };
  }
  return null;
}

/* ═══════ Component ═══════ */
const NWLondonMap = () => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  useEffect(() => {
    document.title = 'Mark Lebrett | NW London Eiruvim';
    const metaUpdates = [
      { sel: 'meta[property="og:title"]',       attr: 'content', val: 'Mark Lebrett | NW London Eiruvim' },
      { sel: 'meta[property="og:description"]', attr: 'content', val: 'Check boundaries and plan walking routes across NW London Eiruvim.' },
      { sel: 'meta[property="og:url"]',          attr: 'content', val: 'https://marklebrett.co.uk/nwlondon-eiruv' },
      { sel: 'meta[name="description"]',         attr: 'content', val: 'Check boundaries and plan walking routes across NW London Eiruvim.' },
      { sel: 'meta[name="twitter:title"]',       attr: 'content', val: 'Mark Lebrett | NW London Eiruvim' },
      { sel: 'meta[name="twitter:description"]', attr: 'content', val: 'Check boundaries and plan walking routes across NW London Eiruvim.' },
    ];
    metaUpdates.forEach(({ sel, attr, val }) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute(attr, val);
    });
  }, []);

  const [activeTab, setActiveTab] = useState('check');
  const [activeEruvinNames, setActiveEruvinNames] = useState(NWLONDON_ERUVIM.map(e => e.name));
  const [showCrossingPins, setShowCrossingPins] = useState(true);
  const [checkResult, setCheckResult] = useState({ state: 'idle', msg: '' });
  const [routeStatus, setRouteStatus] = useState('idle');
  const [routeMsg, setRouteMsg] = useState('');
  const [routeLoading, setRouteLoading] = useState(false);
  const [allowCrossing, setAllowCrossing] = useState(false);
  const [showToggles, setShowToggles] = useState(false);
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

  const handleToggle = (item) => {
    if (item.isCrossing) { setShowCrossingPins(prev => !prev); return; }
    if (item.disabled) return;
    setActiveEruvinNames(prev => prev.includes(item.name) ? prev.filter(n => n !== item.name) : [...prev, item.name]);
  };

  /* ── Draggable route re-validation ── */
  const onDirectionsChanged = useCallback(() => {
    if (!dirRendererRef.current) return;
    const newDirs = dirRendererRef.current.getDirections();
    if (!newDirs) return;
    const activePolys = buildContainmentPolys(activeEruvinNames);
    const valid = routeStaysValid(newDirs, allowCrossing, activePolys);
    setRouteStatus(valid ? 'inside' : 'outside');
    setRouteMsg(valid
      ? 'Modified route stays within Eruv boundaries.'
      : 'Modified route exits boundary! Drag it back inside.');
  }, [activeEruvinNames, allowCrossing]);

  /* ── Tab 1: Check ── */
  const onCheckPlace = () => {
    if (!autocompleteCheckRef.current) return;
    const place = autocompleteCheckRef.current.getPlace();
    if (!place?.geometry?.location) return;
    const loc = place.geometry.location;
    setCheckMarker({ lat: loc.lat(), lng: loc.lng() });
    mapRef.current.panTo(loc);
    mapRef.current.setZoom(15);
    setDirectionsResult(null);
    const polys = buildContainmentPolys(activeEruvinNames);
    const name = whichEruvContains(loc, polys);
    setCheckResult(name
      ? { state: 'inside', msg: `Inside ${name}!` }
      : { state: 'outside', msg: 'Outside active Eruvin bounds.' }
    );
  };

  /* ── Tab 2: Route ── */
  const handleRoute = async (e) => {
    e.preventDefault();
    if (!autocompleteStartRef.current || !autocompleteEndRef.current) return;
    const sp = autocompleteStartRef.current.getPlace();
    const ep = autocompleteEndRef.current.getPlace();
    if (!sp?.geometry?.location || !ep?.geometry?.location) {
      setRouteStatus('error'); setRouteMsg('Select addresses from the dropdown.'); return;
    }
    setRouteLoading(true); setRouteStatus('idle'); setRouteMsg('');
    setDirectionsResult(null); setCheckMarker(null);

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(sp.geometry.location); bounds.extend(ep.geometry.location);
    mapRef.current.fitBounds(bounds);

    const polys = buildContainmentPolys(activeEruvinNames);
    const oEruv = whichEruvContains(sp.geometry.location, polys);
    const dEruv = whichEruvContains(ep.geometry.location, polys);

    if (!oEruv || !dEruv) {
      setRouteLoading(false); setRouteStatus('outside');
      setRouteMsg('Origin or destination is outside active Eruvin.'); return;
    }
    if (!allowCrossing && oEruv !== dEruv) {
      setRouteLoading(false); setRouteStatus('outside');
      setRouteMsg(`Strict Mode: Cannot route from ${oEruv} to ${dEruv}. Enable "Allow Crossing".`); return;
    }

    const outcome = await findRoute(sp.geometry.location, ep.geometry.location, allowCrossing, polys, routeServiceRef.current);
    setRouteLoading(false);
    if (outcome) {
      setDirectionsResult(outcome.result);
      setRouteStatus('inside');
      setRouteMsg(outcome.indirect
        ? 'Route found with adjustments. Drag to modify — we\'ll check if it stays inside.'
        : 'Direct route stays inside bounds. Drag to modify — we\'ll check if it stays inside.');
    } else {
      setRouteStatus('outside');
      setRouteMsg(allowCrossing
        ? 'No valid route found within boundaries.'
        : `No route found strictly within ${oEruv}.`);
    }
  };

  /* ── Reset handlers ── */
  const handleCheckReset = () => {
    setCheckResult({ state: 'idle', msg: '' });
    setCheckMarker(null);
    if (checkInputRef.current) checkInputRef.current.value = '';
  };

  const handleRouteClear = (e) => {
    if (e) e.preventDefault();
    setDirectionsResult(null);
    setRouteStatus('idle');
    setRouteMsg('');
    if (startInputRef.current) startInputRef.current.value = '';
    if (endInputRef.current) endInputRef.current.value = '';
  };

  /* ── Print helpers ── */
  const getRouteText = () => {
    if (!directionsResult) return null;
    const route = directionsResult.routes[0];
    const leg = route.legs[0];
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
    };
  };

  const buildPrintHtml = (includeMap) => {
    const info = getRouteText();
    if (!info) return null;
    const stepsHtml = info.steps.map(s =>
      `<tr><td style="padding:6px 12px 6px 0;color:#666;font-weight:600;vertical-align:top;white-space:nowrap">${s.num}.</td><td style="padding:6px 0;vertical-align:top">${s.instruction}</td><td style="padding:6px 0 6px 12px;color:#666;white-space:nowrap;vertical-align:top">${s.distance}</td></tr>`
    ).join('');
    let mapSection = '';
    if (includeMap && mapRef.current) {
      const center = mapRef.current.getCenter();
      const zoom = mapRef.current.getZoom();
      const origin = encodeURIComponent(info.from);
      const dest = encodeURIComponent(info.to);
      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
      const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?size=640x400&scale=2&maptype=roadmap&markers=color:green|label:A|${origin}&markers=color:red|label:B|${dest}&path=enc:${encodeURIComponent(directionsResult.routes[0].overview_polyline)}&center=${center.lat()},${center.lng()}&zoom=${zoom}&key=${apiKey}`;
      mapSection = `<div style="margin:20px 0;text-align:center"><img src="${staticUrl}" style="max-width:100%;border:1px solid #ddd;border-radius:8px" alt="Route map" onerror="this.style.display='none'"/></div>`;
    }
    return `<!DOCTYPE html><html><head><title>Eruv Route</title><style>body{font-family:Inter,system-ui,sans-serif;margin:40px;color:#1a1a2e;line-height:1.6}h1{font-size:1.4rem;margin:0 0 4px}h2{font-size:1rem;color:#666;font-weight:400;margin:0 0 20px}.meta{display:flex;gap:24px;margin-bottom:16px;font-size:0.9rem;color:#444}.meta span{background:#f0f4ff;padding:4px 12px;border-radius:6px}table{border-collapse:collapse;width:100%;font-size:0.9rem}hr{border:none;border-top:1px solid #e2e8f0;margin:16px 0}.footer{margin-top:24px;font-size:0.75rem;color:#999;text-align:center}</style></head><body><h1>NW London Eiruvim — Walking Route</h1><h2>${info.from} → ${info.to}</h2><div class="meta"><span>📏 ${info.distance}</span><span>⏱ ${info.duration}</span></div>${mapSection}<hr/><table>${stepsHtml}</table><div class="footer">Printed from marklebrett.co.uk/nwlondon-eiruv</div></body></html>`;
  };

  const handlePrint = (includeMap) => {
    const html = buildPrintHtml(includeMap);
    if (!html) return;
    const win = window.open('', '_blank', 'width=800,height=600');
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
  };

  if (loadError) return <div className="eruv-error">Failed to load Google Maps</div>;
  if (!isLoaded) return <div className="eruv-loading"><div className="eruv-spinner" /><p>Loading…</p></div>;

  return (
    <div className="eruv-page">
      <div className="eruv-header">
        <div className="eruv-header-row">
          <Link to="/" className="eruv-back-btn" aria-label="Back to portal">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Portal
          </Link>
          <div className="eruv-header-text">
            <h1 className="eruv-title">NW London Eiruvim Network</h1>
            <p className="eruv-subtitle">Check locations or plan routes across interconnected North West London Eruv zones.</p>
          </div>
        </div>
      </div>

      <div className="eruv-container">
        <div className="eruv-sidebar">
          <div className="eruv-tabs">
            <button className={`eruv-tab ${activeTab === 'check' ? 'active' : ''}`}
              onClick={() => { setActiveTab('check'); setDirectionsResult(null); }}>Location Check</button>
            <button className={`eruv-tab ${activeTab === 'route' ? 'active' : ''}`}
              onClick={() => { setActiveTab('route'); setCheckMarker(null); }}>Route Planner</button>
            <button className={`eruv-tab ${activeTab === 'notes' ? 'active' : ''}`}
              onClick={() => { setActiveTab('notes'); setCheckMarker(null); setDirectionsResult(null); }}>Eruv Notes</button>
          </div>

          <div className="eruv-panel">
            {activeTab === 'check' && (
              <div className="eruv-check-form">
                <h3>Check an Address</h3>
                <p>Enter an address to verify which Eruv it falls within.</p>
                <div className="eruv-input-wrap">
                  <Autocomplete onLoad={ac => autocompleteCheckRef.current = ac} onPlaceChanged={onCheckPlace}>
                    <input ref={checkInputRef} type="text" placeholder="e.g., Station Road, Edgware" className="eruv-input" />
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
                <p>Plan a walking route. Drag the blue line on the map to modify it.</p>
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
                <label className="nwl-crossing-toggle">
                  <input type="checkbox" checked={allowCrossing} onChange={e => setAllowCrossing(e.target.checked)} />
                  <span>Allow Crossing Between Eiruvim (via official crossing points only)</span>
                </label>
                <div className="eruv-btn-row">
                  <button type="submit" className="eruv-btn" disabled={routeLoading}>
                    {routeLoading ? 'Calculating…' : 'Find Safe Route'}
                  </button>
                  <button type="button" className="eruv-btn eruv-btn--ghost" onClick={handleRouteClear}>Reset</button>
                  {directionsResult && !routeLoading && (
                    <>
                      <button type="button" className="eruv-btn eruv-btn--ghost" onClick={() => handlePrint(false)}>🖨 Print Route</button>
                      <button type="button" className="eruv-btn eruv-btn--ghost" onClick={() => handlePrint(true)}>🗺 Print with Map</button>
                    </>
                  )}
                </div>
                {routeStatus === 'outside' && <div className="eruv-alert eruv-alert--error">⚠ {routeMsg}</div>}
                {routeStatus === 'error' && <div className="eruv-alert eruv-alert--error">✕ {routeMsg}</div>}
                {routeStatus === 'inside' && <div className="eruv-alert eruv-alert--success">✓ {routeMsg}</div>}
              </form>
            )}

            {activeTab === 'notes' && (
              <div className="eruv-notes-form">
                <h3>Eruv Information</h3>
                <p className="eruv-notes-credit">
                  Sourced from <a href="https://www.eruv.co.uk/eruvin/" target="_blank" rel="noopener noreferrer">KLBD Eruv (eruv.co.uk)</a> and <a href="https://edgwareeruv.org/" target="_blank" rel="noopener noreferrer">edgwareeruv.org</a>. We do not take responsibility for accuracy — please verify independently.
                </p>
                <div className="eruv-notes-content">
                  {NWLONDON_ERUVIM.map((eruv) => {
                    const info = ERUV_NOTES[eruv.name];
                    if (!info) return null;
                    const hasNotes = info.notes && info.notes.length > 0;
                    const hasLinks = info.links && info.links.length > 0;
                    return (
                      <details key={eruv.name} className="eruv-notes-accordion">
                        <summary>
                          <span className="nwl-color-swatch" style={{ backgroundColor: eruv.color }} />
                          {eruv.name}
                        </summary>
                        <div className="eruv-notes-body">
                          {/* Contact info */}
                          {info.contact && (
                            <div className="eruv-notes-row">
                              <strong>Contact:</strong>{' '}
                              {info.contact.name}
                              {info.contact.email && (
                                <> — <a href={`mailto:${info.contact.email}`}>{info.contact.email}</a></>
                              )}
                              {info.contact.phone && <> — {info.contact.phone}</>}
                            </div>
                          )}

                          {/* Sponsor */}
                          {info.sponsorEmail && (
                            <div className="eruv-notes-row">
                              <strong>Sponsor:</strong>{' '}
                              <a href={`mailto:${info.sponsorEmail}?subject=I'd like to sponsor the ${eruv.name}`}>{info.sponsorEmail}</a>
                            </div>
                          )}

                          {/* Shul links */}
                          {info.shuls && info.shuls.length > 0 && (
                            <div className="eruv-notes-row">
                              <strong>Shuls & Links:</strong>
                              <div className="eruv-notes-list">
                                {info.shuls.map((s, i) => (
                                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="eruv-note-link">{s.name}</a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* WhatsApp */}
                          {info.whatsapp && (
                            <div className="eruv-notes-row">
                              <a href={info.whatsapp} target="_blank" rel="noopener noreferrer" className="eruv-note-link eruv-note-link--wa">
                                📱 Join WhatsApp Alerts
                              </a>
                            </div>
                          )}

                          {/* Extra links */}
                          {hasLinks && (
                            <div className="eruv-notes-row">
                              <div className="eruv-notes-list">
                                {info.links.map((l, i) => (
                                  <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="eruv-note-link">{l.name}</a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Special notes */}
                          {hasNotes && (
                            <div className="eruv-notes-special">
                              <strong>⚠ Important Notes:</strong>
                              {info.notes.map((note, i) => (
                                <p key={i}>{note}</p>
                              ))}
                            </div>
                          )}

                          {/* KLBD page link */}
                          {info.url && (
                            <div className="eruv-notes-row eruv-notes-row--source">
                              <a href={info.url} target="_blank" rel="noopener noreferrer" className="eruv-note-link">
                                View on eruv.co.uk →
                              </a>
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>
            )}

            <hr className="nwl-divider" />

            <div className="nwl-layers">
              <div className="nwl-layers-header" onClick={() => setShowToggles(!showToggles)}>
                <h3>Layer Toggles</h3>
                <span>{showToggles ? '▲' : '▼'}</span>
              </div>
              {showToggles && (
                <div className="nwl-layer-list">
                  {ALL_TOGGLE_OPTIONS.map((item, idx) => (
                    <label key={idx} className={`nwl-checkbox ${item.disabled ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={item.isCrossing ? showCrossingPins : activeEruvinNames.includes(item.name)}
                        disabled={item.disabled}
                        onChange={() => handleToggle(item)}
                      />
                      <span className="nwl-color-swatch" style={{ backgroundColor: item.color }}></span>
                      {item.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="eruv-map-wrap">
          <GoogleMap mapContainerClassName="eruv-map" center={MAP_CENTER} zoom={12} options={MAP_OPTIONS} onLoad={onMapLoad}>

            {/* Raw segment Polylines for accurate boundary rendering */}
            {NWLONDON_ERUVIM.map((eruv, ei) =>
              activeEruvinNames.includes(eruv.name) && eruv.rawSegments.map((seg, si) => (
                <Polyline key={`seg-${ei}-${si}`} path={seg} options={{
                  strokeColor: eruv.color, strokeOpacity: 1, strokeWeight: 3,
                }} />
              ))
            )}

            {/* Pre-closed polygon fills for Eruvin that have them */}
            {NWLONDON_ERUVIM.map((eruv, ei) =>
              activeEruvinNames.includes(eruv.name) && eruv.polygonPaths.map((poly, pi) => (
                <Polygon key={`poly-${ei}-${pi}`} paths={poly} options={{
                  strokeColor: eruv.color, strokeOpacity: 1, strokeWeight: 2,
                  fillColor: eruv.color, fillOpacity: 0.08,
                }} />
              ))
            )}

            {/* Crossing point lines */}
            {showCrossingPins && CROSSING_POINTS.map((cp, i) => (
              <Polyline key={`cp-${i}`} path={cp.path} options={{
                strokeColor: '#ffd600', strokeOpacity: 1, strokeWeight: 4,
                zIndex: 10,
              }} />
            ))}

            {checkMarker && <Marker position={checkMarker} />}

            {/* Eruv name labels */}
            {NWLONDON_ERUVIM.map((eruv, ei) =>
              activeEruvinNames.includes(eruv.name) && eruv.labelPosition && (
                <Marker
                  key={`label-${ei}`}
                  position={eruv.labelPosition}
                  icon={{
                    path: 'M 0,0',
                    scale: 0,
                  }}
                  label={{
                    text: eruv.name,
                    color: eruv.color,
                    fontSize: '12px',
                    fontWeight: 'bold',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    className: 'eruv-map-label',
                  }}
                  clickable={false}
                />
              )
            )}

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

export default NWLondonMap;

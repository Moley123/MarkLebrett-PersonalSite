import React, { useCallback, useRef, useState } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Autocomplete,
  Polygon,
  Marker,
  DirectionsRenderer,
} from '@react-google-maps/api';
import ERUV_BOUNDARY from '../data/eruv_boundary';
import './EruvMap.css';

const LIBRARIES = ['places', 'geometry'];

const MAP_CENTER = { lat: 47.376, lng: 8.541 };
const MAP_OPTIONS = {
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  zoomControlOptions: { position: 9 }, // RIGHT_CENTER
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  ],
};

const POLYGON_OPTIONS = {
  strokeColor: '#1a1a1a',
  strokeOpacity: 1,
  strokeWeight: 3,
  fillColor: '#3b82f6',
  fillOpacity: 0.08,
};

function pointInEruv(latLng) {
  if (!window.google) return null;
  const poly = new window.google.maps.Polygon({ paths: ERUV_BOUNDARY });
  return window.google.maps.geometry.poly.containsLocation(latLng, poly);
}

function decodePath(encoded) {
  if (!window.google) return [];
  return window.google.maps.geometry.encoding.decodePath(encoded);
}

function routeInEruv(directionsResult) {
  if (!window.google || !directionsResult) return false;
  const poly = new window.google.maps.Polygon({ paths: ERUV_BOUNDARY });
  const legs = directionsResult.routes[0].legs;
  for (const leg of legs) {
    for (const step of leg.steps) {
      const points = decodePath(step.encoded_lat_lngs || step.polyline?.points || '');
      for (const pt of points) {
        if (!window.google.maps.geometry.poly.containsLocation(pt, poly)) return false;
      }
    }
  }
  return true;
}

const EruvMap = () => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES,
  });

  const mapRef = useRef(null);
  const originRef = useRef(null);
  const destRef = useRef(null);
  const locationRef = useRef(null);

  const [tab, setTab] = useState('check'); // 'check' | 'route'
  const [marker, setMarker] = useState(null);
  const [insideStatus, setInsideStatus] = useState(null); // null | 'inside' | 'outside'
  const [directions, setDirections] = useState(null);
  const [routeStatus, setRouteStatus] = useState(null); // null | 'inside' | 'outside' | 'error'
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeMsg, setRouteMsg] = useState('');

  const onMapLoad = useCallback(map => { mapRef.current = map; }, []);

  /* ── Location Check ── */
  const handleLocationSearch = () => {
    if (!locationRef.current) return;
    const place = locationRef.current.getPlace();
    if (!place?.geometry?.location) return;
    const latLng = place.geometry.location;
    setMarker({ lat: latLng.lat(), lng: latLng.lng() });
    const inside = pointInEruv(latLng);
    setInsideStatus(inside ? 'inside' : 'outside');
    mapRef.current?.panTo(latLng);
    mapRef.current?.setZoom(15);
  };

  const handleLocationReset = () => {
    setMarker(null);
    setInsideStatus(null);
  };

  /* ── Route Planner ── */
  const handleRoutePlan = () => {
    if (!originRef.current || !destRef.current) return;
    const origin = originRef.current.getPlace();
    const dest   = destRef.current.getPlace();
    if (!origin?.geometry?.location || !dest?.geometry?.location) {
      setRouteStatus('error');
      setRouteMsg('Please select addresses from the dropdown suggestions.');
      return;
    }

    // Check origin / destination are inside eruv
    const originInside = pointInEruv(origin.geometry.location);
    const destInside   = pointInEruv(dest.geometry.location);

    if (!originInside || !destInside) {
      setRouteStatus('outside');
      setRouteMsg(
        !originInside && !destInside
          ? 'Both the start and end points are outside the Eruv boundary.'
          : !originInside
          ? 'The starting address is outside the Eruv boundary.'
          : 'The destination is outside the Eruv boundary.'
      );
      setDirections(null);
      return;
    }

    setRouteLoading(true);
    setRouteStatus(null);
    setDirections(null);

    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin: origin.geometry.location,
        destination: dest.geometry.location,
        travelMode: window.google.maps.TravelMode.WALKING,
      },
      (result, status) => {
        setRouteLoading(false);
        if (status !== 'OK') {
          setRouteStatus('error');
          setRouteMsg('Could not find a walking route between these addresses.');
          return;
        }
        const stays = routeInEruv(result);
        if (!stays) {
          setRouteStatus('outside');
          setRouteMsg('This walking route crosses outside the Eruv boundary. No valid in-boundary route could be found.');
          return;
        }
        setDirections(result);
        setRouteStatus('inside');
        setRouteMsg('');
        const bounds = result.routes[0].bounds;
        mapRef.current?.fitBounds(bounds, 60);
      }
    );
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
        <h1 className="eruv-title">🕍 Zurich Eruv Route Planner</h1>
        <p className="eruv-subtitle">
          Check if an address is within the Eruv, or plan a walking route that stays inside the boundary.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="eruv-tabs">
        <button
          className={`eruv-tab ${tab === 'check' ? 'eruv-tab--active' : ''}`}
          onClick={() => setTab('check')}
        >
          📍 Location Check
        </button>
        <button
          className={`eruv-tab ${tab === 'route' ? 'eruv-tab--active' : ''}`}
          onClick={() => setTab('route')}
        >
          🗺 Route Planner
        </button>
      </div>

      {/* ── Controls ── */}
      <div className="eruv-controls">
        {tab === 'check' && (
          <div className="eruv-control-row">
            <Autocomplete
              onLoad={ac => { locationRef.current = ac; }}
              onPlaceChanged={handleLocationSearch}
              options={{ componentRestrictions: { country: 'ch' } }}
            >
              <input
                className="eruv-input"
                type="text"
                placeholder="Search an address in Zürich…"
              />
            </Autocomplete>
            {insideStatus && (
              <button className="eruv-btn eruv-btn--ghost" onClick={handleLocationReset}>
                Reset
              </button>
            )}
            {insideStatus === 'inside' && (
              <span className="eruv-badge eruv-badge--inside">✓ Inside Eruv</span>
            )}
            {insideStatus === 'outside' && (
              <span className="eruv-badge eruv-badge--outside">✗ Outside Eruv</span>
            )}
          </div>
        )}

        {tab === 'route' && (
          <div className="eruv-route-controls">
            <div className="eruv-control-row">
              <Autocomplete
                onLoad={ac => { originRef.current = ac; }}
                onPlaceChanged={() => {}}
                options={{ componentRestrictions: { country: 'ch' } }}
              >
                <input className="eruv-input" type="text" placeholder="Start address…" />
              </Autocomplete>
              <Autocomplete
                onLoad={ac => { destRef.current = ac; }}
                onPlaceChanged={() => {}}
                options={{ componentRestrictions: { country: 'ch' } }}
              >
                <input className="eruv-input" type="text" placeholder="End address…" />
              </Autocomplete>
              <button
                className="eruv-btn eruv-btn--primary"
                onClick={handleRoutePlan}
                disabled={routeLoading}
              >
                {routeLoading ? 'Routing…' : 'Plan Route'}
              </button>
              {(directions || routeStatus) && (
                <button className="eruv-btn eruv-btn--ghost" onClick={handleRouteClear}>
                  Clear
                </button>
              )}
            </div>

            {routeStatus === 'outside' && (
              <div className="eruv-alert eruv-alert--error">
                ⚠ {routeMsg}
              </div>
            )}
            {routeStatus === 'error' && (
              <div className="eruv-alert eruv-alert--error">
                ✕ {routeMsg}
              </div>
            )}
            {routeStatus === 'inside' && (
              <div className="eruv-alert eruv-alert--success">
                ✓ Route stays within the Eruv boundary.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Map ── */}
      <div className="eruv-map-wrap">
        <GoogleMap
          mapContainerClassName="eruv-map"
          center={MAP_CENTER}
          zoom={13}
          options={MAP_OPTIONS}
          onLoad={onMapLoad}
        >
          {/* Eruv boundary polygon */}
          <Polygon paths={ERUV_BOUNDARY} options={POLYGON_OPTIONS} />

          {/* Location check marker */}
          {tab === 'check' && marker && (
            <Marker
              position={marker}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: insideStatus === 'inside' ? '#22c55e' : '#ef4444',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              }}
            />
          )}

          {/* Route */}
          {tab === 'route' && directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 5 },
                suppressMarkers: false,
              }}
            />
          )}
        </GoogleMap>

        {/* Legend */}
        <div className="eruv-legend">
          <span className="eruv-legend-item">
            <span className="eruv-legend-line" />
            Eruv boundary
          </span>
          <span className="eruv-legend-item">
            <span className="eruv-legend-fill" />
            Inside area
          </span>
        </div>
      </div>
    </div>
  );
};

export default EruvMap;

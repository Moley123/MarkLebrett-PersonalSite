/**
 * NW London Eruvim — LAB. Sandbox copy of /nwlondon-eiruv on the lab engine
 * (./EruvLab.js). The live page is untouched.
 *
 * Unlike Zurich and Gibraltar this lab has several eruvim, so it owns the
 * state the others don't need — which eruvim are switched on, whether a route
 * may cross between them, whether crossing points are drawn — and derives
 * the engine's config from it. The rules themselves (where a route must stay,
 * how an address is reported) are in ./nwlondonLab.js and are unit-tested.
 *
 * Differences from the live page, beyond the lab engine itself:
 *   - Strict mode holds a route to an eruv containing BOTH endpoints, rather
 *     than refusing whenever the first-matched eruv differs; see
 *     nwlondonLab.js.
 *   - Switching an eruv off, or changing the crossing option, re-checks a
 *     planned route and an address result against the new settings instead
 *     of leaving a stale verdict on screen.
 *   - Printing is text only; "Print with Map" used Google's Static Maps API.
 */

import React, { useCallback, useMemo, useState } from 'react';
import EruvLab from './EruvLab';
import { CROSSING_POINTS } from '../data/nwlondon_data';
import { ALL_ERUVIM } from '../data/nwlondonEruvim';
import { ERUV_NOTES } from '../data/eruv_notes';
import { featureCollection, lineFeature, polygonFeature } from './useMapLibre';
import { makeCheckLocation, makeRouteContext, unionEruv, withTesters } from './nwlondonLab';

/* Built once: every eruv with its point-in-polygon tester, in shared order. */
const ERUVIM = withTesters(ALL_ERUVIM);

const AUTHORITIES = [
  { id: 'LBD', label: 'London Beis Din (LBD)' },
  { id: 'KF', label: 'Federation (KF)' },
  { id: 'UOHC', label: 'UOHC' },
];

const CROSSING_COLOUR = '#ffd600';

/* Settings that never change. The parts that depend on toggles are merged in
   below. Zoom is one lower than the live page's 12: MapLibre's tiles are
   512px to Google's 256, so this frames the same view. */
const STATIC_CONFIG = {
  id: 'nwlondon',
  livePath: '/nwlondon-eiruv',
  docTitle: 'LAB · NW London Eiruvim',
  heading: 'NW London Eiruvim Network',
  printTitle: 'NW London Eiruvim — Walking Route',
  subtitle: 'Check locations or plan routes across interconnected North West London Eruv zones.',
  checkIntro: 'Enter an address to verify which Eruv it falls within.',
  placeholders: { check: 'e.g., Station Road, Edgware', origin: 'Start location', destination: 'End location' },
  autocompleteOptions: {},
  // Finchley Central, as on the live page.
  center: { lat: 51.601, lng: -0.193 },
  zoom: 11,
};

/* ── Map layers ──
   One source per kind of shape, each feature carrying its eruv's colour, so
   switching an eruv off is a data update rather than layers coming and going.
   Source ids match the other labs' where they mean the same thing. */
function buildMapLayers(active, showCrossings) {
  const tagged = (feature, color) => ({ ...feature, properties: { color } });
  return [
    {
      id: 'eruv-fill',
      data: featureCollection(active.flatMap((e) => (e.polygonPaths || [])
        .map((ring) => tagged(polygonFeature(ring), e.color)))),
      layers: [
        { type: 'fill', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.08 } },
        { type: 'line', paint: { 'line-color': ['get', 'color'], 'line-width': 2 } },
      ],
    },
    {
      id: 'eruv-segments',
      data: featureCollection(active.flatMap((e) => (e.rawSegments || [])
        .filter((seg) => seg.length > 1)
        .map((seg) => tagged(lineFeature(seg), e.color)))),
      layers: [{ type: 'line', paint: { 'line-color': ['get', 'color'], 'line-width': 3 } }],
    },
    {
      id: 'eruv-crossings',
      data: featureCollection(showCrossings
        ? CROSSING_POINTS.filter((cp) => cp.path.length > 1).map((cp) => lineFeature(cp.path))
        : []),
      layers: [{
        type: 'line',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': CROSSING_COLOUR, 'line-width': 4 },
      }],
    },
  ];
}

const NWLondonEruvLab = () => {
  const [activeNames, setActiveNames] = useState(() => ERUVIM.map((e) => e.name));
  const [allowCrossing, setAllowCrossing] = useState(false);
  const [showCrossings, setShowCrossings] = useState(true);
  const [showToggles, setShowToggles] = useState(false);

  // Active eruvim, kept in the shared order — it decides first matches.
  const active = useMemo(() => ERUVIM.filter((e) => activeNames.includes(e.name)), [activeNames]);

  /* Each piece memoised on exactly what it depends on. The engine re-checks a
     planned route whenever routeContext changes, so it must change only when
     the rules do — showing or hiding the crossing points mustn't re-route. */
  const eruv = useMemo(() => unionEruv(active.length ? active : ERUVIM), [active]);
  const routeContext = useMemo(
    () => makeRouteContext(active, allowCrossing, CROSSING_POINTS),
    [active, allowCrossing],
  );
  const checkLocation = useMemo(() => makeCheckLocation(active), [active]);
  const mapLayers = useMemo(() => buildMapLayers(active, showCrossings), [active, showCrossings]);
  const mapLabels = useMemo(() => active
    .filter((e) => e.labelPosition)
    .map((e) => ({ text: e.name, color: e.color, ...e.labelPosition })), [active]);

  const config = useMemo(() => ({
    ...STATIC_CONFIG,
    eruv,  // the fallback region; routeContext is what actually governs
    routeContext,
    checkLocation,
    mapLayers,
    mapLabels,
  }), [eruv, routeContext, checkLocation, mapLayers, mapLabels]);

  const toggleOne = useCallback((name) => {
    setActiveNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }, []);

  const toggleAuthority = useCallback((authority, on) => {
    const names = ERUVIM.filter((e) => e.authority === authority).map((e) => e.name);
    setActiveNames((prev) => (on
      ? [...prev, ...names.filter((n) => !prev.includes(n))]
      : prev.filter((n) => !names.includes(n))));
  }, []);

  const routeOptions = (
    <label className="zlab-option">
      <input type="checkbox" checked={allowCrossing} onChange={(e) => setAllowCrossing(e.target.checked)} />
      <span>Allow crossing between Eiruvim (via official crossing points only)</span>
    </label>
  );

  const sidebarFooter = (
    <div className="zlab-toggles">
      <button
        type="button"
        className="zlab-toggles-header"
        onClick={() => setShowToggles((v) => !v)}
        aria-expanded={showToggles}
      >
        <span>Layer Toggles</span>
        <span aria-hidden="true">{showToggles ? '▲' : '▼'}</span>
      </button>
      {showToggles && (
        <div className="zlab-toggles-body">
          {AUTHORITIES.map((auth) => {
            const list = ERUVIM.filter((e) => e.authority === auth.id);
            if (!list.length) return null;
            const allOn = list.every((e) => activeNames.includes(e.name));
            return (
              <div key={auth.id} className="zlab-toggle-group">
                <label className="zlab-toggle zlab-toggle--master">
                  <input type="checkbox" checked={allOn} onChange={(e) => toggleAuthority(auth.id, e.target.checked)} />
                  <strong>{auth.label}</strong>
                </label>
                {list.map((e) => (
                  <label key={e.name} className="zlab-toggle">
                    <input type="checkbox" checked={activeNames.includes(e.name)} onChange={() => toggleOne(e.name)} />
                    <span className="zlab-swatch" style={{ backgroundColor: e.color }} />
                    {e.name}
                    {e.isPrototype && <span className="zlab-badge">Prototype</span>}
                  </label>
                ))}
              </div>
            );
          })}
          <label className="zlab-toggle zlab-toggle--sep">
            <input type="checkbox" checked={showCrossings} onChange={() => setShowCrossings((v) => !v)} />
            <span className="zlab-swatch" style={{ backgroundColor: CROSSING_COLOUR }} />
            Crossing points
          </label>
        </div>
      )}
    </div>
  );

  const notesPanel = (
    <div className="zlab-notes">
      <h3>Eruv Information</h3>
      <p className="zlab-notes-credit">
        Sourced from <a href="https://www.eruv.co.uk/eruvin/" target="_blank" rel="noopener noreferrer">KLBD Eruv (eruv.co.uk)</a>
        {' '}and <a href="https://edgwareeruv.org/" target="_blank" rel="noopener noreferrer">edgwareeruv.org</a>.
        {' '}We do not take responsibility for accuracy — please verify independently.
      </p>
      {ERUVIM.map((e) => {
        const info = ERUV_NOTES[e.name];
        if (!info) return null;
        return (
          <details key={e.name} className="zlab-acc">
            <summary>
              <span className="zlab-swatch" style={{ backgroundColor: e.color }} />
              {e.name}
            </summary>
            <div className="zlab-acc-body">
              {info.contact && (
                <div>
                  <strong>Contact:</strong> {info.contact.name}
                  {info.contact.email && <> — <a href={`mailto:${info.contact.email}`}>{info.contact.email}</a></>}
                  {info.contact.phone && <> — {info.contact.phone}</>}
                </div>
              )}
              {info.sponsorEmail && (
                <div>
                  <strong>Sponsor:</strong>{' '}
                  <a href={`mailto:${info.sponsorEmail}?subject=I'd like to sponsor the ${e.name}`}>{info.sponsorEmail}</a>
                </div>
              )}
              {info.shuls && info.shuls.length > 0 && (
                <div>
                  <strong>Shuls &amp; Links:</strong>
                  <div className="zlab-acc-links">
                    {info.shuls.map((sh, i) => <a key={`${sh.url}-${i}`} href={sh.url} target="_blank" rel="noopener noreferrer">{sh.name}</a>)}
                  </div>
                </div>
              )}
              {info.whatsapp && (
                <div><a href={info.whatsapp} target="_blank" rel="noopener noreferrer">📱 Join WhatsApp Alerts</a></div>
              )}
              {info.links && info.links.length > 0 && (
                <div className="zlab-acc-links">
                  {info.links.map((l, i) => <a key={`${l.url}-${i}`} href={l.url} target="_blank" rel="noopener noreferrer">{l.name}</a>)}
                </div>
              )}
              {info.notes && info.notes.length > 0 && (
                <div className="zlab-acc-warn">
                  <strong>⚠ Important Notes:</strong>
                  {info.notes.map((n, i) => <p key={i}>{n}</p>)}
                </div>
              )}
              {info.url && (
                <div><a href={info.url} target="_blank" rel="noopener noreferrer">View on eruv.co.uk →</a></div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );

  return (
    <EruvLab
      config={config}
      routeOptions={routeOptions}
      sidebarFooter={sidebarFooter}
      notesPanel={notesPanel}
    />
  );
};

export default NWLondonEruvLab;

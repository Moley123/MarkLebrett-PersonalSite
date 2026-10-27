/**
 * Golders Green Eruv — the interactive map for the eruv's own website.
 *
 * Built to sit in an iframe on ggeruv.org, below the static map image.
 * It opens on the lab engine (MapLibre + OpenStreetMap, ./EruvLab.js) and a
 * toggle switches to the same tools on Google Maps (./GGEruvGoogleMap.js).
 * Both give the same answers: they share the boundary, the containment maths
 * and the route search.
 *
 * Embedded, so no lab banner and no portal link — the host page is the
 * context. Noindex like the labs; see src/experiments.js.
 */

import React, { useEffect, useState } from 'react';
import EruvLab from './EruvLab';
import GGEruvGoogleMap from './GGEruvGoogleMap';
import { GG_EMBED } from './labs';
import { GG_ERUV } from '../data/gg_eruv';

const MODES = [
  { id: 'lab', label: 'OpenStreetMap' },
  { id: 'google', label: 'Google Maps' },
];

const STORAGE_KEY = 'gg-embed-map';

const GGEruvEmbed = () => {
  // Remembered per browser for convenience only; private windows and blocked
  // storage just start on the default.
  const [mode, setMode] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'google' ? 'google' : 'lab';
    } catch {
      return 'lab';
    }
  });

  // EruvLab does this itself; the Google version doesn't, so it's done here
  // for both.
  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(robots);
    document.title = GG_EMBED.docTitle;
    return () => robots.remove();
  }, []);

  const choose = (next) => {
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — the choice just won't persist */
    }
  };

  const toolbar = (
    <div className="zlab-embed-bar">
      <span className="zlab-embed-title">
        <span className="zlab-swatch" style={{ backgroundColor: GG_ERUV.color }} />
        Golders Green Eruv
      </span>
      <div className="zlab-embed-modes" role="group" aria-label="Map provider">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`zlab-layer-btn ${mode === m.id ? 'is-active' : ''}`}
            onClick={() => choose(m.id)}
            aria-pressed={mode === m.id}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );

  return mode === 'google'
    ? <GGEruvGoogleMap config={GG_EMBED} boundary={GG_ERUV} toolbar={toolbar} />
    : <EruvLab config={GG_EMBED} embedded toolbar={toolbar} />;
};

export default GGEruvEmbed;

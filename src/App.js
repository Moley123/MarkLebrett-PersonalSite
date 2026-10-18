import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import EmelSolutions from './components/EmelSolutions';
import EmelSolutionsNew from './components/EmelSolutionsNew';
import CertMonitor from './components/CertMonitor';
import EruvMap from './components/EruvMap';
import NWLondonMap from './components/NWLondonMap';
import GibraltarMap from './components/GibraltarMap';
import GematriaApp from './gematria/GematriaApp';

/* ══════════════════════════════════════════════════════════════════════
   Lab routes — sandbox pages, not part of the public site.

   Mounted only when REACT_APP_LAB=1 at BUILD time. craco.config.js rewrites
   the ./lab/* import to a stub unless that flag is set, so in a normal
   production build the sandbox source never enters the webpack module graph
   and nothing about it reaches the bundle. (Guarding the route alone is not
   enough — webpack emits a chunk for an `import()` even on a dead branch.)

   The path segment comes from REACT_APP_LAB_TOKEN rather than being written
   here, because this repository is public: a literal in the source would be
   published to GitHub. Keep the token in .env, which is gitignored.

   The route is deliberately ONE segment deep (/lab-<token>). package.json
   sets `homepage: "."`, so the bundle is referenced with relative paths; from
   a nested path like /lab/<token>/zurich the browser would resolve those
   against the wrong directory, nginx's try_files would hand back index.html,
   and the page would fail to boot.

   To be explicit: this makes the page UNLISTED, not authenticated. A build
   shipped with the flag on is readable by anyone who learns the URL. For real
   protection, put HTTP basic auth on /lab- in nginx.conf.
══════════════════════════════════════════════════════════════════════ */
const LAB_TOKEN = process.env.REACT_APP_LAB_TOKEN;
const LAB_ENABLED = process.env.REACT_APP_LAB === '1' && !!LAB_TOKEN;
const ZurichEruvLab = LAB_ENABLED
  ? lazy(() => import('./lab/ZurichEruvLab'))
  : null;

const App = () => {
  // Debug: Log to console so we know the App is actually running
  console.log("App is mounting. Current Path:", window.location.pathname);

  return (
    <Router>
      <Routes>
        {/* 1. Root URL */}
        <Route path="/" element={<LandingPage />} />

        {/* 2. Gematria App */}
        <Route path="/gematria" element={<GematriaApp />} />

        {/* 3. Emel Solutions — full consultancy site */}
        <Route path="/emelsolutions" element={<EmelSolutionsNew />} />

        {/* 3b. Services showcase (portal entry point) */}
        <Route path="/services" element={<EmelSolutions />} />

        {/* 4. CertStream Monitor */}
        <Route path="/certmonitor" element={<CertMonitor />} />

        {/* 5. Zurich Eiruv */}
        <Route path="/zurich-eiruv" element={<EruvMap />} />

        {/* 6. NW London Eiruvim */}
        <Route path="/nwlondon-eiruv" element={<NWLondonMap />} />

        {/* 7. Gibraltar Eruv */}
        <Route path="/gibraltareruv" element={<GibraltarMap />} />

        {/* 8. Lab — absent unless REACT_APP_LAB=1 at build time */}
        {LAB_ENABLED && (
          <Route
            path={`/lab-${LAB_TOKEN}`}
            element={(
              <Suspense fallback={<div style={{ padding: 50 }}>Loading lab…</div>}>
                <ZurichEruvLab />
              </Suspense>
            )}
          />
        )}

        {/* 4. DEBUG: Catch-all for 404s */}
        {/* This will show us what URL the router is seeing */}
        <Route path="*" element={
            <div style={{ padding: 50, color: 'red', textAlign: 'center' }}>
                <h1>404 - Route Not Found</h1>
                <p>The router sees this path: <strong>{window.location.pathname}</strong></p>
                <p>Check your address bar.</p>
            </div>
        } />
      </Routes>
    </Router>
  );
};

export default App;
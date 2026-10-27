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
import UpdateToast from './components/UpdateToast';
import ExperimentsPage from './components/ExperimentsPage';
import { PATHS } from './experiments';

/* ══════════════════════════════════════════════════════════════════════
   Lab route — a sandbox copy of the Zurich eruv page, used to trial
   open-source mapping without touching the live one.

   It is linked from /experiments (the portal's Beta & Experiments tile),
   and is noindex/nofollow plus disallowed in robots.txt, so it stays out of
   search results. The paths are in src/experiments.js, shared with that
   page.

   The path is deliberately ONE segment deep. package.json sets
   `homepage: "."`, so the bundle is referenced with relative paths; from a
   nested path like /lab/<token>/zurich the browser resolves those against
   the wrong directory, nginx's try_files hands back index.html, and the
   page fails to boot on "Unexpected token '<'".

   Lazy-loaded so the sandbox never weighs down the main bundle.
══════════════════════════════════════════════════════════════════════ */
const ZurichEruvLab = lazy(() => import('./lab/ZurichEruvLab'));

const GibraltarEruvLab = lazy(() => import('./lab/GibraltarEruvLab'));
const NWLondonEruvLab = lazy(() => import('./lab/NWLondonEruvLab'));

// The Golders Green Eruv's map, embedded in ggeruv.org by iframe. Its
// permanent address is /ggeruv-map, which their site links to; the original
// lab path stays working for anything that already points at it. The preview
// of their page, public/ggeruv-preview-*.html, shows it the same way.
const GGEruvEmbed = lazy(() => import('./lab/GGEruvEmbed'));
const ggEruvMap = (
  <Suspense fallback={<div style={{ padding: 50 }}>Loading map…</div>}>
    <GGEruvEmbed />
  </Suspense>
);

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

        {/* 8. Beta & Experiments, and the labs it lists */}
        <Route path="/experiments" element={<ExperimentsPage />} />
        <Route
          path={PATHS.zurichLab}
          element={(
            <Suspense fallback={<div style={{ padding: 50 }}>Loading lab…</div>}>
              <ZurichEruvLab />
            </Suspense>
          )}
        />
        <Route
          path={PATHS.gibraltarLab}
          element={(
            <Suspense fallback={<div style={{ padding: 50 }}>Loading lab…</div>}>
              <GibraltarEruvLab />
            </Suspense>
          )}
        />
        <Route
          path={PATHS.nwLondonLab}
          element={(
            <Suspense fallback={<div style={{ padding: 50 }}>Loading lab…</div>}>
              <NWLondonEruvLab />
            </Suspense>
          )}
        />
        <Route path={PATHS.ggMap} element={ggEruvMap} />
        <Route path={PATHS.ggMapLegacy} element={ggEruvMap} />

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

      {/* "New version available" — outside the routes so it shows on every page. */}
      <UpdateToast />
    </Router>
  );
};

export default App;
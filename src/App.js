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

/* ══════════════════════════════════════════════════════════════════════
   Lab route — a sandbox copy of the Zurich eruv page, used to trial
   open-source mapping without touching the live one.

   It lives on an unguessable path and is noindex/nofollow plus disallowed
   in robots.txt, so it won't be crawled or stumbled upon. It is not secret:
   the path is in this file, and this repository is public.

   The path is deliberately ONE segment deep. package.json sets
   `homepage: "."`, so the bundle is referenced with relative paths; from a
   nested path like /lab/<token>/zurich the browser resolves those against
   the wrong directory, nginx's try_files hands back index.html, and the
   page fails to boot on "Unexpected token '<'".

   Lazy-loaded so the sandbox never weighs down the main bundle.
══════════════════════════════════════════════════════════════════════ */
const LAB_TOKEN = 'x490i98i_lRc';
const ZurichEruvLab = lazy(() => import('./lab/ZurichEruvLab'));

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

        {/* 8. Lab — sandbox copy of the Zurich page, unlisted */}
        <Route
          path={`/lab-${LAB_TOKEN}`}
          element={(
            <Suspense fallback={<div style={{ padding: 50 }}>Loading lab…</div>}>
              <ZurichEruvLab />
            </Suspense>
          )}
        />

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
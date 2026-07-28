import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import EmelSolutions from './components/EmelSolutions';
import EmelSolutionsNew from './components/EmelSolutionsNew';
import CertMonitor from './components/CertMonitor';
import EruvMap from './components/EruvMap';
import NWLondonMap from './components/NWLondonMap';
import GibraltarMap from './components/GibraltarMap';
import GematriaApp from './gematria/GematriaApp';

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
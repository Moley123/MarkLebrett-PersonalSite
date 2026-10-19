import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorkerRegistration';

console.log('Sanity Check: index.js is running and mounting App');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Installable as an app, with an offline page and an update notice. Production
// builds only — a service worker in development would fight the dev server.
serviceWorker.register();

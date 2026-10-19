/**
 * Registers the service worker and reports when a new deploy is ready.
 *
 * The worker itself (src/service-worker.js) only supplies an offline page; it
 * never caches the app. What this module adds is the update notice: an
 * installed app window can stay open for days, running whatever version it
 * opened with, so it checks for a new deploy now and then and raises
 * `onUpdateReady` when one has been downloaded and is waiting.
 *
 * Nothing changes on screen until the person chooses to reload — see
 * applyUpdate().
 */

const CHECK_EVERY_MS = 30 * 60 * 1000;

let registration = null;
let updateReady = false;
let reloadRequested = false;
const listeners = new Set();

function announce() {
  updateReady = true;
  listeners.forEach((fn) => fn());
}

/**
 * A worker that has finished installing while another is in control is an
 * update. One that installs with no controller is simply the first visit,
 * and must not raise the notice.
 */
function watch(reg) {
  if (reg.waiting && navigator.serviceWorker.controller) announce();

  reg.addEventListener('updatefound', () => {
    const incoming = reg.installing;
    if (!incoming) return;
    incoming.addEventListener('statechange', () => {
      if (incoming.state === 'installed' && navigator.serviceWorker.controller) announce();
    });
  });
}

export function register() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      // Absolute, not PUBLIC_URL: package.json sets `homepage: "."`, which
      // would make this relative to whatever page happens to be open.
      registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[pwa] service worker registration failed', err);
      return;
    }

    watch(registration);

    const check = () => registration.update().catch(() => {});
    setInterval(() => { if (document.visibilityState === 'visible') check(); }, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  });

  // Fires when the waiting worker takes over. The first-ever visit fires it
  // too (the new worker claims the page), so only reload when asked to.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadRequested) return;
    reloadRequested = false;
    window.location.reload();
  });
}

/** Subscribe to "a new version is ready". Returns an unsubscribe function. */
export function onUpdateReady(fn) {
  listeners.add(fn);
  if (updateReady) fn();
  return () => listeners.delete(fn);
}

/** Switch to the waiting version, then reload once it has taken over. */
export function applyUpdate() {
  const waiting = registration && registration.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  reloadRequested = true;
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

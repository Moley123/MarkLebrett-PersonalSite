/* eslint-disable no-restricted-globals */
/**
 * Service worker — the minimum for an installable site, and nothing more.
 *
 * It caches exactly one thing: public/offline.html. Every page load still goes
 * to the network first; only when that fails outright (no connection) does the
 * offline page stand in. Scripts, styles, data, map tiles and API calls are
 * never intercepted, so this worker can't serve anyone a stale copy of the
 * site — the classic way a service worker goes wrong.
 *
 * ── Why the build manifest is here although nothing is precached ──
 *
 * CRA compiles this file through Workbox's InjectManifest, which replaces
 * self.__WB_MANIFEST with the list of the build's hashed assets (and refuses
 * to build if the token is missing). That list changes whenever a deploy
 * changes anything, so folding it into BUILD makes this file's bytes change
 * with every deploy. Browsers detect a new deploy by exactly that — a byte
 * difference in the worker — and that is what drives the "New version
 * available" toast. Without it, a worker that caches nothing would almost
 * never change, and the toast would almost never appear.
 *
 * ── If this ever needs switching off ──
 *
 * Deploy a version whose install handler calls self.skipWaiting() and whose
 * activate handler calls self.registration.unregister() and reloads clients.
 * Deleting the file is not enough: browsers keep the last worker they saw
 * until they fetch a replacement.
 */

const BUILD = self.__WB_MANIFEST
  .map((entry) => (typeof entry === 'string' ? entry : `${entry.url}#${entry.revision || ''}`))
  .join('|');

// A short, stable fingerprint of the build, so the cache name changes per
// deploy and old ones can be found and removed.
function fingerprint(text) {
  let h = 0x811c9dc5;                       // FNV-1a, 32-bit
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const CACHE = `offline-${fingerprint(BUILD)}`;
const OFFLINE_URL = new URL('offline.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // `reload` skips the HTTP cache, so a new deploy's offline page is
      // fetched fresh rather than whatever the browser had lying around.
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))),
  );
  // Deliberately no skipWaiting() here: the page asks for it, from the
  // toast, so nobody's open tab changes underneath them.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Remove offline pages from earlier deploys.
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n.startsWith('offline-') && n !== CACHE).map((n) => caches.delete(n)),
    );
    // Lets the network request for a page start while this worker is still
    // waking up, so routing navigations through it costs no extra time.
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  // Sent by the update toast's Reload button.
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Page loads only. Everything else goes to the network as if this worker
  // weren't here — by not calling respondWith at all.
  if (event.request.mode !== 'navigate') return;

  event.respondWith((async () => {
    try {
      const preloaded = await event.preloadResponse;
      if (preloaded) return preloaded;
      return await fetch(event.request);
    } catch {
      // Only a network failure lands here. A 404 or 500 is still a response
      // and is passed through as-is: the site being up but unhappy is not
      // the same as the visitor being offline.
      const cached = await caches.match(OFFLINE_URL);
      return cached || Response.error();
    }
  })());
});

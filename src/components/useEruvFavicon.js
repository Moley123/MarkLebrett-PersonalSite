import { useEffect } from 'react';

/**
 * The eruv pages' tab icon: a house outline with an emerald-to-blue gradient.
 *
 * Every eruv page — Zurich, NW London, Gibraltar and their lab copies — shows
 * this one icon, so it lives here rather than as a copy in each page. Other
 * pages fall back to the site-wide ML monogram from index.html.
 */
export const ERUV_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="#0f172a"/>
  <path d="M16 6 L6 14 v12 h20 V14 Z" fill="none" stroke="url(#g)" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="16" cy="18" r="3" fill="url(#g)"/>
</svg>`;

/**
 * Show the eruv icon in the tab while the calling page is mounted.
 *
 * It's added as the last <link rel="icon">, which browsers prefer over the
 * defaults in index.html, and removed again on unmount so navigating away
 * restores whatever the next page shows.
 */
export default function useEruvFavicon() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = `data:image/svg+xml,${encodeURIComponent(ERUV_FAVICON_SVG)}`;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
}

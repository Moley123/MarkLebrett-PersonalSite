import { useEffect } from 'react';

/**
 * Scroll-reveal for the EMEL site.
 *
 * Any element marked `data-reveal` fades and slides into place the first time
 * it enters the viewport. The direction is chosen by the attribute value —
 * `up` (default), `left`, `right`, `scale` or `fade` — and grids can stagger
 * their children with `style={{ '--es-reveal-i': index }}`.
 *
 * Two things this deliberately does NOT do:
 *
 *  - Hide anything before JavaScript runs. The hidden state is scoped to
 *    `.es-reveal-ready`, a class this hook adds to <body>. If the bundle fails
 *    or the observer is unavailable, every element simply renders as normal
 *    rather than staying invisible forever.
 *  - Animate for people who asked not to. `prefers-reduced-motion: reduce`
 *    skips the whole mechanism and reveals everything immediately.
 *
 * @param {unknown} deps  re-scan when this changes — the site swaps pages by
 *                        state rather than by route, so new nodes appear
 *                        without a remount of the hook's owner.
 */
export default function useScrollReveal(deps) {
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const supported = typeof window.IntersectionObserver === 'function';

    const nodes = Array.from(document.querySelectorAll('.emel-site [data-reveal]'));
    if (!nodes.length) return undefined;

    if (reduced || !supported) {
      // Show everything at once; never leave content stranded.
      nodes.forEach((el) => el.classList.add('is-revealed'));
      return undefined;
    }

    document.body.classList.add('es-reveal-ready');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, {
      // Start slightly before the element reaches the viewport, and don't wait
      // for tall sections to be fully on screen.
      threshold: 0.08,
      rootMargin: '0px 0px -8% 0px',
    });

    nodes.forEach((el) => {
      el.classList.remove('is-revealed');
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [deps]);
}

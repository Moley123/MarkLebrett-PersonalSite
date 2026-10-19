/**
 * Drag-to-modify for a route drawn as a GeoJSON line.
 *
 * Google's DirectionsRenderer gives you this free, but only on its own terms:
 * it owns the line, the handles and the re-routing, and it will happily let a
 * user drag a route straight out of the eruv. Rebuilding it here costs this
 * file, and buys three things the renderer cannot do —
 *
 *   1. the dragged handle turns red the moment it leaves the eruv, before any
 *      request is made;
 *   2. the committed route is checked against the boundary with Turf, so the
 *      page can say "this now strays 240 m outside" instead of silently
 *      accepting it;
 *   3. the handles are real focusable buttons that can be nudged with the
 *      arrow keys, so the whole interaction works without a pointer.
 *      (MapLibre has arrow-key dragging, but only for its own default marker,
 *      so attachKeyboardDrag below provides it for these.)
 *
 * The hook owns only the map-side interaction: markers, the ghost handle and
 * the rubber band. It never routes. Every gesture ends in one `onChange` call
 * with the new trip, and the caller decides what to do about it. All the
 * geometry lives in ./routeEditing, with no map in sight, and is unit-tested
 * there.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Marker } from 'maplibre-gl';
import {
  planGrab, neighboursFor, withViaAt, nextViaId,
} from './routeEditing';
import { featureCollection, lineFeature, upsertGeoJson } from './useMapLibre';

const PREVIEW_ID = 'route-drag-preview';

/** Grabbing should feel the same at any zoom, so the tolerance is in pixels. */
const GRAB_PIXELS = 14;

/** Arrow-key nudges, in pixels, for keyboard dragging. */
const KEY_STEPS = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

function grabToleranceMetres(map) {
  const metresPerPixel = (156543.03392 * Math.cos(map.getCenter().lat * (Math.PI / 180)))
    / 2 ** map.getZoom();
  return Math.max(8, metresPerPixel * GRAB_PIXELS);
}

const ll = (lngLat) => ({ lat: lngLat.lat, lng: lngLat.lng });

/**
 * A focusable handle, so the gesture is reachable without a pointer.
 *
 * MapLibre writes its own `transform` onto a marker's element on every frame,
 * which would clobber any rotation or scale set in CSS — hence handles that
 * are plain circles, and hover states built from shadows rather than
 * transforms.
 */
function handleElement(className, label, text) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.title = label;
  el.setAttribute('aria-label', label);
  el.textContent = text;
  return el;
}

/**
 * Arrow-key dragging for a focused handle: one pixel a press, ten with Shift,
 * committed when the key comes up or focus is lost.
 *
 * MapLibre has this, but only for its own default marker — `_onKeyDown` bails
 * on a custom element — so a handle with a custom element gets it from here
 * instead. Without it the whole feature would be pointer-only.
 *
 * The listeners are attached to the element, which is thrown away when the
 * marker is removed, so there is nothing to unbind.
 */
function attachKeyboardDrag(map, marker, { onDrag, onDragEnd }) {
  const el = marker.getElement();
  let moving = false;

  const commit = () => {
    if (!moving) return;
    moving = false;
    onDragEnd();
  };

  el.addEventListener('keydown', (e) => {
    const step = KEY_STEPS[e.key];
    if (!step || e.altKey || e.ctrlKey || e.metaKey) return;
    // Without stopPropagation the key also reaches MapLibre's own keyboard
    // handler, which pans the map — so the handle would appear to stand still
    // while the world slid past it.
    e.preventDefault();
    e.stopPropagation();
    const by = e.shiftKey ? 10 : 1;
    const at = map.project(marker.getLngLat());
    marker.setLngLat(map.unproject([at.x + step[0] * by, at.y + step[1] * by]));
    moving = true;
    onDrag();
  });
  el.addEventListener('keyup', (e) => { if (KEY_STEPS[e.key]) commit(); });
  el.addEventListener('blur', commit);
}

export default function useRouteDrag({
  map, ready, active, hitLayerId, trip, path, eruv, onChange, onRemoveVia,
  styleEpoch = 0,
}) {
  // Handlers are bound once per activation but must read the current trip, so
  // the live values go through a ref rather than the closure.
  const liveRef = useRef({ trip, path });
  liveRef.current = { trip, path };

  const markersRef = useRef({ origin: null, destination: null, vias: [] });
  const ghostRef = useRef({ marker: null, shown: false });
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  /* ── Rubber band ── */
  const setPreview = useCallback((features) => {
    const m = map.current;
    if (!m) return;
    upsertGeoJson(m, PREVIEW_ID, featureCollection(features), [{
      type: 'line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#93c5fd',
        'line-width': 2,
        'line-dasharray': [1.5, 1.5],
        'line-opacity': 0.85,
      },
    }]);
  }, [map]);

  const bandTo = useCallback((before, pt, after) => {
    setPreview([lineFeature([before, pt, after].filter(Boolean))]);
  }, [setPreview]);

  /* ── Ghost handle ── */
  const showGhost = useCallback((lngLat, variant, outside) => {
    const m = map.current;
    if (!m) return;
    const ghost = ghostRef.current;
    if (!ghost.marker) {
      const el = document.createElement('div');
      el.className = 'zlab-ghost';
      // The pulse lives on an inner node, because MapLibre owns the outer
      // element's transform.
      el.appendChild(document.createElement('span'));
      ghost.marker = new Marker({ element: el, anchor: 'center' });
    }
    ghost.marker.getElement().className = [
      'zlab-ghost',
      `zlab-ghost--${variant}`,
      outside ? 'zlab-ghost--outside' : '',
    ].filter(Boolean).join(' ');
    ghost.marker.setLngLat(lngLat);
    if (!ghost.shown) {
      ghost.marker.addTo(m);
      ghost.shown = true;
    }
  }, [map]);

  const hideGhost = useCallback(() => {
    const ghost = ghostRef.current;
    if (ghost.shown) {
      ghost.marker.remove();
      ghost.shown = false;
    }
  }, []);

  /* ════════════════ Grab anywhere on the line ════════════════ */

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !active || !hitLayerId || !m.getLayer(hitLayerId)) return undefined;

    const canvas = () => m.getCanvas();

    const finish = (commit) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;

      m.off('mousemove', drag.onMove);
      m.off('touchmove', drag.onMove);
      m.dragPan.enable();
      hideGhost();
      setPreview([]);
      canvas().style.cursor = '';
      setDragging(false);

      if (!commit || !drag.moved) return;
      const { trip: t } = liveRef.current;
      if (!t) return;
      const via = drag.plan.kind === 'move'
        ? drag.at
        : { id: nextViaId(), ...drag.at };
      onChange({ ...t, vias: withViaAt(t.vias, drag.plan, via) }, 'line-drag');
    };

    const onDown = (e) => {
      if (dragRef.current) return;
      const touch = e.type === 'touchstart';
      if (!touch && e.originalEvent?.button !== 0) return;
      if (touch && e.points && e.points.length > 1) return; // a pinch, not a drag

      const { trip: t, path: p } = liveRef.current;
      if (!t || !p || p.length < 2) return;

      const plan = planGrab(p, t.vias, ll(e.lngLat), {
        grabToleranceMetres: grabToleranceMetres(m),
      });
      if (!plan) return;

      // Stops the map panning out from under the gesture.
      e.preventDefault();
      m.dragPan.disable();

      const neighbours = neighboursFor(t, plan);

      const onMove = (ev) => {
        const drag = dragRef.current;
        if (!drag) return;
        const pt = ll(ev.lngLat);
        drag.at = pt;
        drag.moved = true;
        showGhost(ev.lngLat, 'drag', !eruv.contains(pt));
        bandTo(neighbours.before, pt, neighbours.after);
      };

      dragRef.current = {
        plan,
        onMove,
        moved: false,
        at: { lat: plan.projected.lat, lng: plan.projected.lng },
      };
      m.on('mousemove', onMove);
      m.on('touchmove', onMove);
      canvas().style.cursor = 'grabbing';
      setDragging(true);
      showGhost([plan.projected.lng, plan.projected.lat], 'drag', false);
      bandTo(neighbours.before, dragRef.current.at, neighbours.after);
    };

    /* Hover: show where a grab would land, so the affordance is discoverable
       rather than something you have to be told about. */
    const onHover = (e) => {
      if (dragRef.current) return;
      const { trip: t, path: p } = liveRef.current;
      if (!t || !p || p.length < 2) return;
      const plan = planGrab(p, t.vias, ll(e.lngLat), {
        grabToleranceMetres: grabToleranceMetres(m),
      });
      // A 'move' plan means a real handle is already sitting there; a second,
      // ghostly one on top of it would only be confusing.
      if (!plan || plan.kind === 'move') {
        hideGhost();
        canvas().style.cursor = plan ? 'grab' : '';
        return;
      }
      canvas().style.cursor = 'grab';
      showGhost([plan.projected.lng, plan.projected.lat], 'hint', false);
    };

    const onLeave = () => {
      if (dragRef.current) return;
      canvas().style.cursor = '';
      hideGhost();
    };

    const onUp = () => finish(true);
    const onAbort = () => finish(false);
    const onKey = (ev) => { if (ev.key === 'Escape') finish(false); };

    m.on('mousemove', hitLayerId, onHover);
    m.on('mouseleave', hitLayerId, onLeave);
    m.on('mousedown', hitLayerId, onDown);
    m.on('touchstart', hitLayerId, onDown);

    // On the window, not the canvas: releasing the pointer over the sidebar or
    // off the edge of the page should still commit rather than hang.
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onAbort);
    window.addEventListener('keydown', onKey);

    return () => {
      finish(false);
      m.off('mousemove', hitLayerId, onHover);
      m.off('mouseleave', hitLayerId, onLeave);
      m.off('mousedown', hitLayerId, onDown);
      m.off('touchstart', hitLayerId, onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onAbort);
      window.removeEventListener('keydown', onKey);
    };
    // `trip` and `path` are read through liveRef, so changing them must not
    // tear the listeners down and rebind them mid-gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // styleEpoch: changing the basemap destroys the hit layer and rebuilds it,
    // so the listeners are rebound against the new one.
  }, [ready, map, active, hitLayerId, styleEpoch, eruv, onChange, bandTo, setPreview, showGhost, hideGhost]);

  /* ════════════════ Endpoint and via handles ════════════════ */

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return undefined;
    const store = markersRef.current;

    const clear = () => {
      ['origin', 'destination'].forEach((key) => {
        if (store[key]) {
          store[key].remove();
          store[key] = null;
        }
      });
      store.vias.forEach((mk) => mk.remove());
      store.vias = [];
    };

    clear();
    if (!active || !trip) {
      setPreview([]);
      hideGhost();
      return undefined;
    }

    const endpointMarker = (key) => {
      const first = key === 'origin';
      const el = handleElement(
        `zlab-pin zlab-pin--${key}`,
        `${first ? 'Start' : 'Destination'} — drag, or use the arrow keys, to move it`,
        first ? 'A' : 'B',
      );
      const marker = new Marker({ element: el, draggable: true, anchor: 'center' })
        .setLngLat([trip[key].lng, trip[key].lat])
        .addTo(m);

      const onDrag = () => {
        const pt = ll(marker.getLngLat());
        const t = liveRef.current.trip;
        const other = first
          ? (t.vias[0] || t.destination)
          : (t.vias[t.vias.length - 1] || t.origin);
        el.classList.toggle('zlab-pin--outside', !eruv.contains(pt));
        bandTo(pt, other, null);
      };
      const onDragEnd = () => {
        setPreview([]);
        el.classList.remove('zlab-pin--outside');
        onChange({ ...liveRef.current.trip, [key]: ll(marker.getLngLat()) }, key);
      };

      marker.on('drag', onDrag);
      marker.on('dragend', onDragEnd);
      attachKeyboardDrag(m, marker, { onDrag, onDragEnd });
      return marker;
    };

    const viaMarker = (via, n) => {
      const el = handleElement(
        'zlab-via', `Stop ${n} — drag to move it, click to remove it`, String(n),
      );
      const marker = new Marker({ element: el, draggable: true, anchor: 'center' })
        .setLngLat([via.lng, via.lat])
        .addTo(m);

      // MapLibre only fires `dragstart` once the handle has actually moved, so
      // this cleanly separates a drag from a click-to-remove.
      let moved = false;

      const onDrag = () => {
        const pt = ll(marker.getLngLat());
        const t = liveRef.current.trip;
        const i = t.vias.findIndex((v) => v.id === via.id);
        el.classList.toggle('zlab-via--outside', !eruv.contains(pt));
        bandTo(t.vias[i - 1] || t.origin, pt, t.vias[i + 1] || t.destination);
      };
      const onDragEnd = () => {
        el.classList.remove('zlab-via--dragging', 'zlab-via--outside');
        setPreview([]);
        const t = liveRef.current.trip;
        const i = t.vias.findIndex((v) => v.id === via.id);
        if (i < 0) return;
        onChange({
          ...t,
          vias: withViaAt(t.vias, { kind: 'move', index: i }, ll(marker.getLngLat())),
        }, 'via');
      };

      marker.on('dragstart', () => {
        moved = true;
        el.classList.add('zlab-via--dragging');
      });
      marker.on('drag', onDrag);
      marker.on('dragend', onDragEnd);
      attachKeyboardDrag(m, marker, { onDrag, onDragEnd });

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (moved) {
          moved = false;
          return;
        }
        onRemoveVia(via.id);
      });

      return marker;
    };

    store.origin = endpointMarker('origin');
    store.destination = endpointMarker('destination');
    store.vias = trip.vias.map((via, i) => viaMarker(via, i + 1));

    return clear;
  }, [ready, map, active, trip, eruv, onChange, onRemoveVia, bandTo, setPreview, hideGhost]);

  return { dragging };
}

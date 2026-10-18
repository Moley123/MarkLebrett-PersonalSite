/**
 * Tests for the drag interaction, against a fake map.
 *
 * MapLibre needs WebGL, which jsdom does not have, so the map and its markers
 * are stubbed. What is actually under test is the part that would otherwise go
 * unverified: which gestures commit, which don't, and what trip each one
 * produces. The geometry it leans on is tested separately in routeEditing.test.js.
 */

import React, { useRef } from 'react';
import { render, act, screen } from '@testing-library/react';
import { Marker as StubMarker } from 'maplibre-gl';
import useRouteDrag from './useRouteDrag';

/* The map itself is a hand-rolled fake: just the handful of methods the hook
   touches, plus a `fire` to dispatch to the listeners it bound. MapLibre's own
   Marker comes from ./testing/maplibreStub.js via Jest's moduleNameMapper. */

function fakeMap() {
  const bound = [];
  const sources = {};
  const canvas = document.createElement('canvas');

  const map = {
    canvas,
    sources,
    getCanvas: () => canvas,
    getZoom: () => 14,
    getCenter: () => ({ lat: 47, lng: 8.5 }),
    getStyle: () => ({ layers: [] }),

    // Crude but sufficient: 1 px = 0.0001° at this fake zoom, which is all the
    // keyboard nudge arithmetic needs.
    project: ({ lat, lng }) => ({ x: lng / 0.0001, y: -lat / 0.0001 }),
    unproject: ([x, y]) => ({ lat: -y * 0.0001, lng: x * 0.0001 }),

    getLayer: (id) => ({ id }),
    getSource: (id) => sources[id],
    addSource: (id, spec) => {
      sources[id] = { data: spec.data, setData(data) { this.data = data; } };
    },
    addLayer: () => {},
    setPaintProperty: () => {},
    dragPan: { enabled: true, enable() { this.enabled = true; }, disable() { this.enabled = false; } },

    on(type, layerOrFn, maybeFn) {
      const layer = maybeFn ? layerOrFn : null;
      bound.push({ type, layer, fn: maybeFn || layerOrFn });
    },
    off(type, layerOrFn, maybeFn) {
      const layer = maybeFn ? layerOrFn : null;
      const fn = maybeFn || layerOrFn;
      const i = bound.findIndex((b) => b.type === type && b.layer === layer && b.fn === fn);
      if (i >= 0) bound.splice(i, 1);
    },

    /** Dispatch to every handler bound for this type and layer. */
    fire(type, layer, event) {
      bound
        .filter((b) => b.type === type && b.layer === layer)
        .map((b) => b.fn)
        .forEach((fn) => fn(event));
    },
    bound,
  };
  return map;
}

/* ── Fixtures ── */

const LNG = 8.5;
const PATH = Array.from({ length: 11 }, (_, i) => ({ lat: 47 + i * 0.001, lng: LNG }));

/** Everything west of 8.55 is "inside", so a drag east of it goes outside. */
const ERUV = { contains: (p) => p.lng < 8.55 };

const TRIP = {
  origin: { lat: 47, lng: LNG },
  destination: { lat: 47.01, lng: LNG },
  vias: [],
};

function Harness({ map, trip, path, onChange, onRemoveVia, active = true }) {
  const mapRef = useRef(map);
  const { dragging } = useRouteDrag({
    map: mapRef,
    ready: true,
    active,
    hitLayerId: 'hit',
    trip,
    path,
    eruv: ERUV,
    onChange,
    onRemoveVia,
  });
  return <span data-testid="dragging">{String(dragging)}</span>;
}

const setup = (overrides = {}) => {
  const map = fakeMap();
  const onChange = jest.fn();
  const onRemoveVia = jest.fn();
  const props = {
    map, trip: TRIP, path: PATH, onChange, onRemoveVia, ...overrides,
  };
  const view = render(<Harness {...props} />);
  return { map, onChange, onRemoveVia, view, props };
};

const mouseDownOnLine = (map, lat, lng) => {
  let prevented = false;
  act(() => {
    map.fire('mousedown', 'hit', {
      type: 'mousedown',
      originalEvent: { button: 0 },
      lngLat: { lat, lng },
      preventDefault: () => { prevented = true; },
    });
  });
  return () => prevented;
};

const moveTo = (map, lat, lng) => act(() => {
  map.fire('mousemove', null, { type: 'mousemove', lngLat: { lat, lng } });
});

const releasePointer = () => act(() => {
  window.dispatchEvent(new MouseEvent('mouseup'));
});

const pressEscape = () => act(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
});

/* MapLibre markers live outside the React tree — the stub appends them to
   document.body, as the real thing appends them to the map container — so
   Testing Library's screen queries cannot reach them. */
/* eslint-disable testing-library/no-node-access */
const handles = (selector) => Array.from(document.querySelectorAll(selector));
const ghost = () => document.querySelector('.zlab-ghost');
/* eslint-enable testing-library/no-node-access */

beforeEach(() => {
  StubMarker.reset();
  document.body.innerHTML = '';
});

/* ════════════════ Handles ════════════════ */

describe('handles', () => {
  it('puts an A and a B on the endpoints', () => {
    setup();
    const pins = handles('.zlab-pin');
    expect(pins.map((el) => el.textContent)).toEqual(['A', 'B']);
    expect(pins[0]).toHaveClass('zlab-pin--origin');
    expect(pins[1]).toHaveClass('zlab-pin--destination');
  });

  it('puts a numbered handle on every stop', () => {
    setup({
      trip: {
        ...TRIP,
        vias: [{ id: 'a', lat: 47.003, lng: LNG }, { id: 'b', lat: 47.007, lng: LNG }],
      },
    });
    expect(handles('.zlab-via').map((el) => el.textContent)).toEqual(['1', '2']);
  });

  it('makes every handle a real focusable button', () => {
    setup({ trip: { ...TRIP, vias: [{ id: 'a', lat: 47.005, lng: LNG }] } });
    handles('.zlab-pin, .zlab-via').forEach((el) => {
      expect(el.tagName).toBe('BUTTON');
      expect(el.getAttribute('aria-label')).toBeTruthy();
    });
  });

  it('draws no handles while inactive', () => {
    setup({ active: false });
    expect(handles('.zlab-pin, .zlab-via')).toHaveLength(0);
  });

  it('removes its handles when it goes inactive', () => {
    const { view, props } = setup();
    expect(handles('.zlab-pin')).toHaveLength(2);
    view.rerender(<Harness {...props} active={false} />);
    expect(handles('.zlab-pin')).toHaveLength(0);
  });
});

/* ════════════════ Grabbing the line ════════════════ */

describe('grabbing the line', () => {
  it('adds a stop where the line was dragged to', () => {
    const { map, onChange } = setup();

    const wasPrevented = mouseDownOnLine(map, 47.005, LNG);
    expect(wasPrevented()).toBe(true);
    expect(map.dragPan.enabled).toBe(false); // the map must not pan under the gesture
    expect(screen.getByTestId('dragging')).toHaveTextContent('true');

    moveTo(map, 47.005, 8.504);
    releasePointer();

    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, reason] = onChange.mock.calls[0];
    expect(reason).toBe('line-drag');
    expect(next.vias).toHaveLength(1);
    expect(next.vias[0]).toMatchObject({ lat: 47.005, lng: 8.504 });
    expect(next.vias[0].id).toMatch(/^via-/);
    expect(map.dragPan.enabled).toBe(true);
    expect(screen.getByTestId('dragging')).toHaveTextContent('false');
  });

  it('inserts the new stop in walking order, not at the end', () => {
    const vias = [
      { id: 'a', lat: 47.002, lng: LNG },
      { id: 'b', lat: 47.008, lng: LNG },
    ];
    const { map, onChange } = setup({ trip: { ...TRIP, vias } });

    mouseDownOnLine(map, 47.005, LNG);
    moveTo(map, 47.005, 8.504);
    releasePointer();

    expect(onChange.mock.calls[0][0].vias.map((v) => v.id))
      .toEqual(['a', expect.stringMatching(/^via-/), 'b']);
  });

  it('moves a stop that is already there instead of stacking another on it', () => {
    const vias = [{ id: 'a', lat: 47.005, lng: LNG }];
    const { map, onChange } = setup({ trip: { ...TRIP, vias } });

    mouseDownOnLine(map, 47.00505, LNG);
    moveTo(map, 47.0051, 8.503);
    releasePointer();

    const next = onChange.mock.calls[0][0];
    expect(next.vias).toHaveLength(1);
    expect(next.vias[0].id).toBe('a');
    expect(next.vias[0].lng).toBeCloseTo(8.503, 6);
  });

  it('ignores a grab nowhere near the line', () => {
    const { map, onChange } = setup();
    // ~0.05° of longitude is roughly 3.8 km away.
    const wasPrevented = mouseDownOnLine(map, 47.005, 8.55);
    expect(wasPrevented()).toBe(false);
    expect(screen.getByTestId('dragging')).toHaveTextContent('false');
    releasePointer();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores a right-click', () => {
    const { map, onChange } = setup();
    act(() => {
      map.fire('mousedown', 'hit', {
        type: 'mousedown',
        originalEvent: { button: 2 },
        lngLat: { lat: 47.005, lng: LNG },
        preventDefault: () => {},
      });
    });
    releasePointer();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores a two-finger touch, which is a pinch', () => {
    const { map, onChange } = setup();
    act(() => {
      map.fire('touchstart', 'hit', {
        type: 'touchstart',
        points: [{}, {}],
        lngLat: { lat: 47.005, lng: LNG },
        preventDefault: () => {},
      });
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits a one-finger touch drag', () => {
    const { map, onChange } = setup();
    act(() => {
      map.fire('touchstart', 'hit', {
        type: 'touchstart',
        points: [{}],
        lngLat: { lat: 47.005, lng: LNG },
        preventDefault: () => {},
      });
    });
    act(() => {
      map.fire('touchmove', null, { type: 'touchmove', lngLat: { lat: 47.005, lng: 8.504 } });
    });
    act(() => { window.dispatchEvent(new Event('touchend')); });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].vias[0]).toMatchObject({ lat: 47.005, lng: 8.504 });
  });

  it('does nothing on a press that never moved — that is a click, not a drag', () => {
    const { map, onChange } = setup();
    mouseDownOnLine(map, 47.005, LNG);
    releasePointer();
    expect(onChange).not.toHaveBeenCalled();
    expect(map.dragPan.enabled).toBe(true);
  });

  it('abandons the drag on Escape', () => {
    const { map, onChange } = setup();
    mouseDownOnLine(map, 47.005, LNG);
    moveTo(map, 47.005, 8.504);
    pressEscape();

    expect(onChange).not.toHaveBeenCalled();
    expect(map.dragPan.enabled).toBe(true);
    expect(screen.getByTestId('dragging')).toHaveTextContent('false');

    // A later release must not resurrect the abandoned gesture.
    releasePointer();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops listening when it goes inactive mid-gesture', () => {
    const { map, onChange, view, props } = setup();
    mouseDownOnLine(map, 47.005, LNG);
    moveTo(map, 47.005, 8.504);
    // rerender inside act: the gesture is mid-flight, and the teardown it
    // triggers updates state.
    // eslint-disable-next-line testing-library/no-unnecessary-act
    act(() => { view.rerender(<Harness {...props} active={false} />); });
    releasePointer();
    expect(onChange).not.toHaveBeenCalled();
    expect(map.dragPan.enabled).toBe(true);
  });
});

/* ════════════════ Live feedback ════════════════ */

describe('live feedback', () => {
  it('shows a ghost handle where a grab would land', () => {
    const { map } = setup();
    act(() => {
      map.fire('mousemove', 'hit', { type: 'mousemove', lngLat: { lat: 47.005, lng: 8.5001 } });
    });
    expect(ghost()).toHaveClass('zlab-ghost--hint');
    expect(map.canvas.style.cursor).toBe('grab');
  });

  it('hides the ghost and the cursor hint on the way out', () => {
    const { map } = setup();
    act(() => {
      map.fire('mousemove', 'hit', { type: 'mousemove', lngLat: { lat: 47.005, lng: 8.5001 } });
    });
    act(() => { map.fire('mouseleave', 'hit', {}); });
    expect(ghost()).toBeNull();
    expect(map.canvas.style.cursor).toBe('');
  });

  it('turns the handle red the moment the drag leaves the Eruv', () => {
    const { map } = setup();
    mouseDownOnLine(map, 47.005, LNG);

    moveTo(map, 47.005, 8.52); // still inside
    expect(ghost()).not.toHaveClass('zlab-ghost--outside');

    moveTo(map, 47.005, 8.56); // outside
    expect(ghost()).toHaveClass('zlab-ghost--outside');

    moveTo(map, 47.005, 8.52); // and back again
    expect(ghost()).not.toHaveClass('zlab-ghost--outside');
  });

  it('draws a rubber band between the stops either side of the drag', () => {
    const vias = [{ id: 'a', lat: 47.002, lng: LNG }, { id: 'b', lat: 47.008, lng: LNG }];
    const { map } = setup({ trip: { ...TRIP, vias } });

    mouseDownOnLine(map, 47.005, LNG);
    moveTo(map, 47.005, 8.504);

    const band = map.sources['route-drag-preview'].data.features[0];
    expect(band.geometry.coordinates).toEqual([
      [LNG, 47.002],   // the stop before
      [8.504, 47.005], // the handle
      [LNG, 47.008],   // the stop after
    ]);
  });

  it('clears the rubber band once the gesture is over', () => {
    const { map } = setup();
    mouseDownOnLine(map, 47.005, LNG);
    moveTo(map, 47.005, 8.504);
    releasePointer();
    expect(map.sources['route-drag-preview'].data.features).toEqual([]);
  });
});

/* ════════════════ Dragging the handles ════════════════ */

describe('dragging a stop handle', () => {
  const vias = [{ id: 'a', lat: 47.005, lng: LNG }];

  const viaMarker = () => StubMarker.instances.find(
    (m) => m.element.classList.contains('zlab-via'),
  );

  it('commits the new position, keeping the stop and its order', () => {
    const { onChange } = setup({
      trip: {
        ...TRIP,
        vias: [...vias, { id: 'b', lat: 47.008, lng: LNG }],
      },
    });
    const marker = viaMarker();
    act(() => {
      marker.fire('dragstart');
      marker.setLngLat([8.506, 47.0055]);
      marker.fire('drag');
      marker.fire('dragend');
    });

    const [next, reason] = onChange.mock.calls[0];
    expect(reason).toBe('via');
    expect(next.vias.map((v) => v.id)).toEqual(['a', 'b']);
    expect(next.vias[0]).toMatchObject({ id: 'a', lat: 47.0055, lng: 8.506 });
  });

  it('flags the handle while it is outside the Eruv', () => {
    setup({ trip: { ...TRIP, vias } });
    const marker = viaMarker();
    act(() => {
      marker.fire('dragstart');
      marker.setLngLat([8.56, 47.005]);
      marker.fire('drag');
    });
    expect(marker.element).toHaveClass('zlab-via--outside');

    act(() => {
      marker.setLngLat([8.5, 47.005]);
      marker.fire('drag');
    });
    expect(marker.element).not.toHaveClass('zlab-via--outside');
  });

  it('removes the stop when its handle is clicked', () => {
    const { onRemoveVia } = setup({ trip: { ...TRIP, vias } });
    act(() => { viaMarker().element.click(); });
    expect(onRemoveVia).toHaveBeenCalledWith('a');
  });

  it('does not remove the stop on the click that ends a drag', () => {
    const { onRemoveVia, onChange } = setup({ trip: { ...TRIP, vias } });
    const marker = viaMarker();
    act(() => {
      marker.fire('dragstart');
      marker.setLngLat([8.506, 47.005]);
      marker.fire('drag');
      marker.fire('dragend');
      marker.element.click();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onRemoveVia).not.toHaveBeenCalled();
  });
});

describe('dragging an endpoint', () => {
  const pinMarker = (kind) => StubMarker.instances.find(
    (m) => m.element.classList.contains(`zlab-pin--${kind}`),
  );

  it('commits a new start', () => {
    const { onChange } = setup();
    const marker = pinMarker('origin');
    act(() => {
      marker.setLngLat([8.502, 47.0005]);
      marker.fire('drag');
      marker.fire('dragend');
    });
    const [next, reason] = onChange.mock.calls[0];
    expect(reason).toBe('origin');
    expect(next.origin).toEqual({ lat: 47.0005, lng: 8.502 });
    expect(next.destination).toEqual(TRIP.destination);
  });

  it('commits a new destination', () => {
    const { onChange } = setup();
    const marker = pinMarker('destination');
    act(() => {
      marker.setLngLat([8.502, 47.02]);
      marker.fire('drag');
      marker.fire('dragend');
    });
    expect(onChange.mock.calls[0][1]).toBe('destination');
    expect(onChange.mock.calls[0][0].destination).toEqual({ lat: 47.02, lng: 8.502 });
  });

  it('flags an endpoint dragged outside the Eruv', () => {
    setup();
    const marker = pinMarker('origin');
    act(() => {
      marker.setLngLat([8.6, 47]);
      marker.fire('drag');
    });
    expect(marker.element).toHaveClass('zlab-pin--outside');
  });
});

describe('keyboard dragging', () => {
  const press = (el, key, init = {}) => {
    act(() => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
    });
  };
  const release = (el, key) => act(() => {
    el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
  });

  const pin = () => StubMarker.instances.find(
    (m) => m.element.classList.contains('zlab-pin--origin'),
  );

  it('nudges a handle one pixel an arrow press and commits on key up', () => {
    const { onChange } = setup();
    const marker = pin();

    press(marker.element, 'ArrowRight');
    expect(onChange).not.toHaveBeenCalled();     // not until the key comes up
    expect(marker.getLngLat().lng).toBeCloseTo(LNG + 0.0001, 8);

    release(marker.element, 'ArrowRight');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].origin.lng).toBeCloseTo(LNG + 0.0001, 8);
  });

  it('moves ten pixels with Shift held', () => {
    setup();
    const marker = pin();
    press(marker.element, 'ArrowRight', { shiftKey: true });
    expect(marker.getLngLat().lng).toBeCloseTo(LNG + 0.001, 8);
  });

  it('accumulates presses into one edit', () => {
    const { onChange } = setup();
    const marker = pin();
    press(marker.element, 'ArrowUp');
    press(marker.element, 'ArrowUp');
    press(marker.element, 'ArrowUp');
    release(marker.element, 'ArrowUp');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].origin.lat).toBeCloseTo(47 + 0.0003, 8);
  });

  it('commits if focus is lost mid-nudge', () => {
    const { onChange } = setup();
    const marker = pin();
    press(marker.element, 'ArrowRight');
    act(() => { marker.element.dispatchEvent(new FocusEvent('blur')); });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ignores keys that are not arrows, and arrows with a modifier', () => {
    const { onChange } = setup();
    const marker = pin();
    const before = marker.getLngLat();

    press(marker.element, 'a');
    press(marker.element, 'ArrowRight', { metaKey: true });
    press(marker.element, 'ArrowRight', { ctrlKey: true });
    release(marker.element, 'ArrowRight');

    expect(marker.getLngLat()).toEqual(before);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('works on a stop handle too', () => {
    const { onChange } = setup({
      trip: { ...TRIP, vias: [{ id: 'a', lat: 47.005, lng: LNG }] },
    });
    const marker = StubMarker.instances.find((m) => m.element.classList.contains('zlab-via'));
    press(marker.element, 'ArrowLeft');
    release(marker.element, 'ArrowLeft');
    expect(onChange.mock.calls[0][0].vias[0]).toMatchObject({ id: 'a' });
    expect(onChange.mock.calls[0][0].vias[0].lng).toBeCloseTo(LNG - 0.0001, 8);
  });
});

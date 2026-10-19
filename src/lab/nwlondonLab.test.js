import {
  withTesters, unionEruv, firstContaining, nearCrossingPoint, crossingValid,
  makeRouteContext, makeCheckLocation,
} from './nwlondonLab';
import { ALL_ERUVIM, EXTRA_LBD_NAMES } from '../data/nwlondonEruvim';
import { CROSSING_POINTS } from '../data/nwlondon_data';

/**
 * Two overlapping squares and a third that touches neither:
 *
 *        lng 0 ─────── 2 ── 3 ─────── 5
 *   lat 2  ┌───── A ──┬────┐
 *          │          │ AB │── B ─────┐
 *   lat 0  └──────────┴────┘          │     C sits far away, at lat 10
 *                     └───────────────┘
 *
 * A spans lng 0..3, B spans lng 2..5, so they overlap between lng 2 and 3.
 * A crossing point sits in that overlap at (1, 2.5).
 */
const square = (lng0, lng1, lat0 = 0, lat1 = 2) => [
  { lat: lat0, lng: lng0 }, { lat: lat0, lng: lng1 }, { lat: lat1, lng: lng1 }, { lat: lat1, lng: lng0 },
];
const [A, B, C] = withTesters([
  { name: 'A', containmentPath: square(0, 3) },
  { name: 'B', containmentPath: square(2, 5) },
  { name: 'C', containmentPath: square(0, 1, 10, 11) },
]);
const CROSSING = [{ name: 'X', path: [{ lat: 1, lng: 2.5 }] }];
const line = (from, to, n = 50) => Array.from({ length: n + 1 }, (_, i) => ({
  lat: from.lat + ((to.lat - from.lat) * i) / n,
  lng: from.lng + ((to.lng - from.lng) * i) / n,
}));

describe('withTesters', () => {
  it('keeps order and drops eruvim without a usable boundary', () => {
    const out = withTesters([
      { name: 'one', containmentPath: square(0, 1) },
      { name: 'none', containmentPath: [] },
      { name: 'two', containmentPath: square(0, 1) },
    ]);
    expect(out.map((e) => e.name)).toEqual(['one', 'two']);
    expect(out[0].tester.contains({ lat: 1, lng: 0.5 })).toBe(true);
  });
});

describe('unionEruv', () => {
  const u = unionEruv([A, B]);

  it('contains a point in either eruv', () => {
    expect(u.contains({ lat: 1, lng: 0.5 })).toBe(true);   // A only
    expect(u.contains({ lat: 1, lng: 4.5 })).toBe(true);   // B only
    expect(u.contains({ lat: 1, lng: 9 })).toBe(false);
  });

  it('has the same shape as a single eruv', () => {
    expect(u.containsAll([{ lat: 1, lng: 0.5 }, { lat: 1, lng: 4.5 }])).toBe(true);
    expect(u.firstOutside([{ lat: 1, lng: 0.5 }, { lat: 1, lng: 9 }])).toEqual({ lat: 1, lng: 9 });
    expect(u.bounds).toEqual({ minLat: 0, maxLat: 2, minLng: 0, maxLng: 5 });
  });
});

describe('firstContaining', () => {
  it('answers with the earliest eruv in the list', () => {
    expect(firstContaining({ lat: 1, lng: 2.5 }, [A, B])).toBe(A);
    expect(firstContaining({ lat: 1, lng: 2.5 }, [B, A])).toBe(B);
    expect(firstContaining({ lat: 1, lng: 9 }, [A, B])).toBeNull();
  });
});

describe('nearCrossingPoint', () => {
  it('is true within the radius and false beyond it', () => {
    expect(nearCrossingPoint({ lat: 1, lng: 2.5 }, CROSSING)).toBe(true);
    // ~0.0005° of latitude is about 56 m
    expect(nearCrossingPoint({ lat: 1.0005, lng: 2.5 }, CROSSING)).toBe(true);
    expect(nearCrossingPoint({ lat: 1.5, lng: 2.5 }, CROSSING)).toBe(false);
  });
});

describe('crossingValid', () => {
  // With A listed first, first-match flips from A to B at A's eastern edge
  // (lng 3) — where the overlap ends.
  it('accepts a route that stays in one eruv', () => {
    expect(crossingValid(line({ lat: 1, lng: 0.5 }, { lat: 1, lng: 1.5 }), [A, B], CROSSING)).toBe(true);
  });

  it('rejects a route that leaves every eruv', () => {
    expect(crossingValid(line({ lat: 1, lng: 4 }, { lat: 1, lng: 9 }), [A, B], CROSSING)).toBe(false);
  });

  it('rejects a change of eruv away from a crossing point', () => {
    // Along lat 0.2, far from the crossing at lat 1.
    expect(crossingValid(line({ lat: 0.2, lng: 0.5 }, { lat: 0.2, lng: 4.5 }), [A, B], CROSSING)).toBe(false);
  });

  it('accepts a change of eruv at a crossing point', () => {
    // A crossing right where first-match flips, on lat 1 at lng 3. The line
    // needs points every ~44 m (0.0004°) to land within the 100 m radius —
    // these toy squares are hundreds of kilometres across.
    const atFlip = [{ name: 'Y', path: [{ lat: 1, lng: 3 }] }];
    expect(crossingValid(line({ lat: 1, lng: 0.5 }, { lat: 1, lng: 4.5 }, 10000), [A, B], atFlip)).toBe(true);
  });
});

describe('makeRouteContext', () => {
  it('asks for at least one eruv to be on', () => {
    expect(makeRouteContext([], false, CROSSING)({ origin: {}, destination: {} }).error).toMatch(/at least one/);
  });

  it('names the endpoint that is outside', () => {
    const ctx = makeRouteContext([A, B], false, CROSSING);
    expect(ctx({ origin: { lat: 1, lng: 9 }, destination: { lat: 1, lng: 0.5 } }).error).toMatch(/start point/);
    expect(ctx({ origin: { lat: 1, lng: 0.5 }, destination: { lat: 1, lng: 9 } }).error).toMatch(/destination/);
    expect(ctx({ origin: { lat: 1, lng: 9 }, destination: { lat: 1, lng: 9 } }).error).toMatch(/Both/);
  });

  describe('strict mode', () => {
    const ctx = makeRouteContext([A, B, C], false, CROSSING);

    it('holds a route to the eruv both ends are in', () => {
      const r = ctx({ origin: { lat: 1, lng: 0.5 }, destination: { lat: 1, lng: 1.5 } });
      expect(r.eruv).toBe(A.tester);
      expect(r.validate).toBeUndefined();
    });

    it('refuses ends in different eruvim, naming them', () => {
      const r = ctx({ origin: { lat: 1, lng: 0.5 }, destination: { lat: 1, lng: 4.5 } });
      expect(r.error).toMatch(/Strict mode: A and B/);
    });

    it('finds the shared eruv even when an endpoint is first matched elsewhere', () => {
      // Origin in the A/B overlap — first match A — destination in B only.
      // The live page refused this as "A to B". Both are in B, so it's fine.
      const r = ctx({ origin: { lat: 1, lng: 2.5 }, destination: { lat: 1, lng: 4.5 } });
      expect(r.error).toBeUndefined();
      expect(r.eruv).toBe(B.tester);
    });
  });

  describe('crossing mode', () => {
    const ctx = makeRouteContext([A, B], true, CROSSING);
    const r = ctx({ origin: { lat: 1, lng: 0.5 }, destination: { lat: 1, lng: 4.5 } });

    it('spans the active eruvim', () => {
      expect(r.eruv.contains({ lat: 1, lng: 0.5 })).toBe(true);
      expect(r.eruv.contains({ lat: 1, lng: 4.5 })).toBe(true);
    });

    it('judges routes by the crossing rules', () => {
      expect(r.validate(line({ lat: 0.2, lng: 0.5 }, { lat: 0.2, lng: 4.5 }))).toBe(false);
      expect(r.invalidMessage).toMatch(/crossing point/);
    });

    it('offers crossing points as detour waypoints', () => {
      expect(r.waypoints).toContainEqual({ lat: 1, lng: 2.5 });
    });
  });
});

describe('makeCheckLocation', () => {
  it('reports joint membership in list order', () => {
    expect(makeCheckLocation([A, B])({ lat: 1, lng: 2.5 }))
      .toEqual({ inside: true, message: 'Inside A and B — this address is covered by both.' });
  });

  it('only counts eruvim that are switched on', () => {
    expect(makeCheckLocation([B])({ lat: 1, lng: 2.5 }).message).toBe('Inside B!');
  });

  it('says so when outside everything', () => {
    expect(makeCheckLocation([A, B])({ lat: 1, lng: 9 }))
      .toEqual({ inside: false, message: 'Outside active Eruvin bounds.' });
  });
});

/* ── Against the real data ── */

describe('the real NW London list', () => {
  it('ends with the KLBD extras, South Hampstead last', () => {
    const names = ALL_ERUVIM.map((e) => e.name);
    expect(names.slice(-EXTRA_LBD_NAMES.length)).toEqual(EXTRA_LBD_NAMES);
    expect(names[names.length - 1]).toBe('South Hampstead Eruv');
  });

  it('has a usable boundary for every eruv', () => {
    expect(withTesters(ALL_ERUVIM)).toHaveLength(ALL_ERUVIM.length);
  });

  // The middle of the Edgware eruv's extent. (Edgware station itself, at
  // 51.6137, -0.2750, sits on the boundary's southern edge — a poor test
  // point either way.)
  const EDGWARE = { lat: 51.6218, lng: -0.2688 };

  it('places a point in the middle of the Edgware eruv in it', () => {
    const live = withTesters(ALL_ERUVIM);
    expect(makeCheckLocation(live)(EDGWARE).message).toMatch(/Edgware/);
  });

  it('has crossing points to offer as waypoints', () => {
    const live = withTesters(ALL_ERUVIM);
    const r = makeRouteContext(live, true, CROSSING_POINTS)({
      origin: EDGWARE, destination: EDGWARE,
    });
    expect(r.waypoints.length).toBeGreaterThan(CROSSING_POINTS.length);
  });
});

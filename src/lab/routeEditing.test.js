import {
  projectOntoRoute,
  routeLengthMetres,
  viaPositions,
  insertionIndexFor,
  planGrab,
  withViaAt,
  withoutVia,
  neighboursFor,
  splitByContainment,
  outsideMetres,
  formatMetres,
  GRAB_TOLERANCE_M,
} from './routeEditing';
import { createEruv, interiorGrid } from './eruvGeometry';
import ERUV_BOUNDARY from '../data/eruv_boundary';
import ERUV_POLYGONS from '../data/eruv_polygons';

/**
 * A due-north path makes the arithmetic checkable by hand: Turf's spherical
 * earth puts one degree of latitude at 111,195 m, so 0.001° is 111.2 m.
 */
const DEG_M = 111195.08;
const LNG = 8.5;
const north = (n, step = 0.001, from = 47) => (
  Array.from({ length: n }, (_, i) => ({ lat: from + i * step, lng: LNG }))
);

const PATH = north(11); // 47.000 … 47.010, ~1112 m long

describe('projectOntoRoute', () => {
  it('rejects paths and points it cannot use', () => {
    expect(projectOntoRoute([], { lat: 47, lng: 8.5 })).toBeNull();
    expect(projectOntoRoute([{ lat: 47, lng: 8.5 }], { lat: 47, lng: 8.5 })).toBeNull();
    expect(projectOntoRoute(PATH, null)).toBeNull();
    expect(projectOntoRoute(PATH, { lat: NaN, lng: 8.5 })).toBeNull();
  });

  it('snaps a point beside the line onto it', () => {
    // 0.002° of longitude east of the line at latitude 47 ≈ 152 m.
    const offset = { lat: 47.005, lng: LNG + 0.002 };
    const p = projectOntoRoute(PATH, offset);

    expect(p.lng).toBeCloseTo(LNG, 6);
    expect(p.lat).toBeCloseTo(47.005, 6);
    expect(p.distanceToLine).toBeGreaterThan(140);
    expect(p.distanceToLine).toBeLessThan(165);
  });

  it('measures distance along the line from its start', () => {
    expect(projectOntoRoute(PATH, { lat: 47.0, lng: LNG }).distanceAlong).toBeCloseTo(0, 3);
    expect(projectOntoRoute(PATH, { lat: 47.005, lng: LNG }).distanceAlong)
      .toBeCloseTo(5 * 0.001 * DEG_M, 0);
    expect(projectOntoRoute(PATH, { lat: 47.01, lng: LNG }).distanceAlong)
      .toBeCloseTo(10 * 0.001 * DEG_M, 0);
  });

  it('reports which segment the point landed on', () => {
    // Between the 4th and 5th vertices.
    expect(projectOntoRoute(PATH, { lat: 47.0035, lng: LNG }).segmentIndex).toBe(3);
  });
});

describe('routeLengthMetres', () => {
  it('measures a path', () => {
    expect(routeLengthMetres(PATH)).toBeCloseTo(0.01 * DEG_M, 0);
  });

  it('is zero for a path too short to have length', () => {
    expect(routeLengthMetres([])).toBe(0);
    expect(routeLengthMetres([{ lat: 47, lng: 8.5 }])).toBe(0);
  });
});

describe('viaPositions', () => {
  it('places each via along the path', () => {
    const vias = [{ lat: 47.002, lng: LNG }, { lat: 47.007, lng: LNG }];
    const [a, b] = viaPositions(PATH, vias);
    expect(a).toBeCloseTo(0.002 * DEG_M, 0);
    expect(b).toBeCloseTo(0.007 * DEG_M, 0);
  });

  it('never goes backwards when the route doubles back on itself', () => {
    // North to 47.010, then back south to 47.005. Latitude 47.006 is on the
    // line twice; projection finds the earlier crossing, which on its own
    // would put the second via before the first.
    const doubled = [...north(11), ...north(6, -0.001, 47.009)];
    const vias = [{ lat: 47.009, lng: LNG }, { lat: 47.006, lng: LNG }];

    const raw = vias.map((v) => projectOntoRoute(doubled, v).distanceAlong);
    expect(raw[1]).toBeLessThan(raw[0]); // the problem…

    const positions = viaPositions(doubled, vias);
    expect(positions[1]).toBeGreaterThanOrEqual(positions[0]); // …and the fix
  });

  it('returns an empty list for no vias', () => {
    expect(viaPositions(PATH)).toEqual([]);
  });
});

describe('insertionIndexFor', () => {
  it('finds the slot between existing stops', () => {
    const positions = [100, 500, 900];
    expect(insertionIndexFor(positions, 50)).toBe(0);
    expect(insertionIndexFor(positions, 300)).toBe(1);
    expect(insertionIndexFor(positions, 700)).toBe(2);
    expect(insertionIndexFor(positions, 1200)).toBe(3);
  });

  it('puts a tie after the existing stop', () => {
    expect(insertionIndexFor([100, 500], 500)).toBe(2);
  });

  it('handles an empty list', () => {
    expect(insertionIndexFor([], 400)).toBe(0);
  });
});

describe('planGrab', () => {
  it('ignores a grab too far from the line', () => {
    // ~0.01° of longitude at latitude 47 is roughly 760 m.
    expect(planGrab(PATH, [], { lat: 47.005, lng: LNG + 0.01 })).toBeNull();
  });

  it('accepts a grab within tolerance', () => {
    const plan = planGrab(PATH, [], { lat: 47.005, lng: LNG + 0.0005 });
    expect(plan).not.toBeNull();
    expect(plan.projected.distanceToLine).toBeLessThan(GRAB_TOLERANCE_M);
  });

  it('inserts the first via at index 0', () => {
    const plan = planGrab(PATH, [], { lat: 47.005, lng: LNG });
    expect(plan.kind).toBe('insert');
    expect(plan.index).toBe(0);
  });

  it('inserts in the right place among existing vias', () => {
    const vias = [
      { id: 'a', lat: 47.002, lng: LNG },
      { id: 'b', lat: 47.008, lng: LNG },
    ];
    expect(planGrab(PATH, vias, { lat: 47.001, lng: LNG })).toMatchObject({ kind: 'insert', index: 0 });
    expect(planGrab(PATH, vias, { lat: 47.005, lng: LNG })).toMatchObject({ kind: 'insert', index: 1 });
    expect(planGrab(PATH, vias, { lat: 47.0095, lng: LNG })).toMatchObject({ kind: 'insert', index: 2 });
  });

  it('moves an existing via rather than stacking a new one on it', () => {
    const vias = [{ id: 'a', lat: 47.005, lng: LNG }];
    // 0.0001° ≈ 11 m along the line, well inside the merge distance.
    const plan = planGrab(PATH, vias, { lat: 47.0051, lng: LNG });
    expect(plan.kind).toBe('move');
    expect(plan.index).toBe(0);
  });

  it('treats a grab just beyond the merge distance as a new via', () => {
    const vias = [{ id: 'a', lat: 47.005, lng: LNG }];
    // 0.0005° ≈ 56 m along the line, beyond the 35 m merge distance.
    expect(planGrab(PATH, vias, { lat: 47.0055, lng: LNG }).kind).toBe('insert');
  });

  it('honours an overridden tolerance', () => {
    const far = { lat: 47.005, lng: LNG + 0.01 };
    expect(planGrab(PATH, [], far, { grabToleranceMetres: 2000 })).not.toBeNull();
  });
});

describe('withViaAt / withoutVia', () => {
  const vias = [{ id: 'a', lat: 1, lng: 1 }, { id: 'b', lat: 2, lng: 2 }];

  it('inserts without mutating the original', () => {
    const next = withViaAt(vias, { kind: 'insert', index: 1 }, { id: 'c', lat: 9, lng: 9 });
    expect(next.map((v) => v.id)).toEqual(['a', 'c', 'b']);
    expect(vias).toHaveLength(2);
  });

  it('moves a via, keeping its identity', () => {
    const next = withViaAt(vias, { kind: 'move', index: 0 }, { lat: 9, lng: 9 });
    expect(next[0]).toEqual({ id: 'a', lat: 9, lng: 9 });
    expect(next[1]).toBe(vias[1]);
  });

  it('removes by id', () => {
    expect(withoutVia(vias, 'a').map((v) => v.id)).toEqual(['b']);
    expect(withoutVia(vias, 'nope')).toHaveLength(2);
  });
});

describe('neighboursFor', () => {
  const trip = {
    origin: { lat: 0, lng: 0 },
    destination: { lat: 10, lng: 10 },
    vias: [{ id: 'a', lat: 2, lng: 2 }, { id: 'b', lat: 6, lng: 6 }],
  };

  it('brackets an insert with the surrounding stops', () => {
    expect(neighboursFor(trip, { kind: 'insert', index: 1 }))
      .toEqual({ before: trip.vias[0], after: trip.vias[1] });
  });

  it('falls back to the endpoints at either end', () => {
    expect(neighboursFor(trip, { kind: 'insert', index: 0 }).before).toBe(trip.origin);
    expect(neighboursFor(trip, { kind: 'insert', index: 2 }).after).toBe(trip.destination);
  });

  it('skips the via being moved', () => {
    expect(neighboursFor(trip, { kind: 'move', index: 0 }))
      .toEqual({ before: trip.origin, after: trip.vias[1] });
    expect(neighboursFor(trip, { kind: 'move', index: 1 }))
      .toEqual({ before: trip.vias[0], after: trip.destination });
  });
});

describe('splitByContainment', () => {
  const halfway = { contains: (p) => p.lat < 47.0045 };

  it('returns nothing for a path too short to draw', () => {
    expect(splitByContainment([], halfway)).toEqual([]);
    expect(splitByContainment([{ lat: 47, lng: LNG }], halfway)).toEqual([]);
  });

  it('is a single run when the whole path is inside', () => {
    const runs = splitByContainment(PATH, { contains: () => true });
    expect(runs).toHaveLength(1);
    expect(runs[0].inside).toBe(true);
    expect(runs[0].points).toHaveLength(PATH.length);
  });

  it('splits at the crossing', () => {
    const runs = splitByContainment(PATH, halfway);
    expect(runs.map((r) => r.inside)).toEqual([true, false]);
    expect(runs[0].points[0]).toEqual(PATH[0]);
    expect(runs[1].points[runs[1].points.length - 1]).toEqual(PATH[PATH.length - 1]);
  });

  it('repeats the crossing point so the drawn lines join up', () => {
    const runs = splitByContainment(PATH, halfway);
    const endOfFirst = runs[0].points[runs[0].points.length - 1];
    expect(runs[1].points[0]).toEqual(endOfFirst);
  });

  it('handles a path that leaves and comes back', () => {
    const eruv = { contains: (p) => p.lat < 47.0035 || p.lat > 47.0065 };
    expect(splitByContainment(PATH, eruv).map((r) => r.inside)).toEqual([true, false, true]);
  });
});

describe('outsideMetres', () => {
  it('is zero for a route wholly inside', () => {
    expect(outsideMetres(PATH, { contains: () => true })).toBe(0);
  });

  it('measures the straying part, from the crossing point', () => {
    // Points at 47.005 and above are outside; the run starts at 47.004
    // because the crossing point is repeated, so 0.006° ≈ 667 m.
    const metres = outsideMetres(PATH, { contains: (p) => p.lat < 47.0045 });
    expect(metres).toBeCloseTo(0.006 * DEG_M, 0);
  });

  it('adds up multiple excursions', () => {
    const eruv = { contains: (p) => p.lat < 47.0025 || (p.lat > 47.0045 && p.lat < 47.0065) };
    expect(outsideMetres(PATH, eruv)).toBeGreaterThan(outsideMetres(PATH, { contains: (p) => p.lat < 47.0025 }) / 2);
  });
});

describe('formatMetres', () => {
  it('uses metres below a kilometre and kilometres above', () => {
    expect(formatMetres(0)).toBe('0 m');
    expect(formatMetres(480.4)).toBe('480 m');
    expect(formatMetres(999)).toBe('999 m');
    expect(formatMetres(1000)).toBe('1.0 km');
    expect(formatMetres(1640)).toBe('1.6 km');
  });
});

/**
 * Against the real Zurich boundary rather than a toy predicate: whatever the
 * eruv's shape, the split must cover the whole path and label every run
 * correctly.
 */
describe('splitByContainment on the Zurich eruv', () => {
  const eruv = createEruv(ERUV_BOUNDARY, ERUV_POLYGONS);
  const grid = interiorGrid(eruv, 20);

  // A straight line between two interior points, which for a boundary this
  // concave is very likely to pass outside — exactly the case that matters.
  const a = grid[0];
  const b = grid[grid.length - 1];
  const path = Array.from({ length: 200 }, (_, i) => {
    const t = i / 199;
    return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  });

  const runs = splitByContainment(path, eruv);

  it('produces at least one run', () => {
    expect(runs.length).toBeGreaterThan(0);
  });

  it('labels every run correctly except at its shared endpoints', () => {
    runs.forEach((run) => {
      // The first and last points of a run are crossing points carried over
      // from the neighbouring run, so only the interior is guaranteed.
      run.points.slice(1, -1).forEach((pt) => {
        expect(eruv.contains(pt)).toBe(run.inside);
      });
    });
  });

  it('starts at the start of the path and ends at its end', () => {
    expect(runs[0].points[0]).toEqual(path[0]);
    const last = runs[runs.length - 1].points;
    expect(last[last.length - 1]).toEqual(path[path.length - 1]);
  });

  it('accounts for the whole path length', () => {
    const covered = runs.reduce((sum, r) => sum + routeLengthMetres(r.points), 0);
    const overlap = (runs.length - 1) * 0; // shared points have zero length
    expect(covered - overlap).toBeCloseTo(routeLengthMetres(path), 3);
  });

  it('reports a sane straying distance', () => {
    const outside = outsideMetres(path, eruv);
    expect(outside).toBeGreaterThanOrEqual(0);
    expect(outside).toBeLessThanOrEqual(routeLengthMetres(path) + 1);
  });
});

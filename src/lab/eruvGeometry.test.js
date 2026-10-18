import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { polygon as turfPolygon, point as turfPoint } from '@turf/helpers';
import ERUV_BOUNDARY from '../data/eruv_boundary';
import ERUV_POLYGONS from '../data/eruv_polygons';
import { createEruv, distanceMetres, interiorGrid } from './eruvGeometry';

/**
 * The containment logic has never been testable before: the live page calls
 * `google.maps.geometry.poly.containsLocation`, which needs a browser with the
 * Maps API loaded. These run against the real Zurich boundary in plain Node.
 */

const eruv = createEruv(ERUV_BOUNDARY, ERUV_POLYGONS);

/**
 * A point genuinely inside a zone.
 *
 * The mean of the vertices is NOT reliable here: two of the sixteen zones are
 * concave enough that their vertex-mean falls outside the shape. Sample the
 * bounding box instead and keep the first point the polygon actually contains.
 */
function interiorPointOf(pts) {
  const ring = pts.map((p) => [p.lng, p.lat]);
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
    ring.push([...ring[0]]);
  }
  const poly = turfPolygon([ring]);
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const [lo, hi] = [Math.min(...lats), Math.max(...lats)];
  const [lw, hw] = [Math.min(...lngs), Math.max(...lngs)];
  const G = 40;
  for (let i = 1; i < G; i += 1) {
    for (let j = 1; j < G; j += 1) {
      const pt = { lat: lo + (hi - lo) * (i / G), lng: lw + (hw - lw) * (j / G) };
      if (booleanPointInPolygon(turfPoint([pt.lng, pt.lat]), poly)) return pt;
    }
  }
  return null;
}

// One point genuinely inside each exclusion zone (תל המתלקט). Each sits inside
// the outer boundary but must be reported OUTSIDE the eruv.
const exclusionInteriors = ERUV_POLYGONS.map((z) => interiorPointOf(z.paths[0]));

describe('createEruv', () => {
  it('loads the real Zurich boundary and all its exclusion zones', () => {
    expect(ERUV_BOUNDARY.length).toBeGreaterThan(1000);
    expect(eruv.exclusionCount).toBe(ERUV_POLYGONS.length);
    expect(eruv.exclusionCount).toBe(16);
  });

  it('reports a point well inside the boundary as inside', () => {
    // Centre of the boundary's bounding box, nudged onto a known interior point.
    const inside = interiorGrid(eruv, 12)[0];
    expect(inside).toBeDefined();
    expect(eruv.contains(inside)).toBe(true);
  });

  it('reports points far outside as outside', () => {
    [
      { lat: 47.3769, lng: 8.5417 - 1 },   // a degree west of Zurich
      { lat: 51.5074, lng: -0.1278 },      // London
      { lat: 0, lng: 0 },                  // null island
    ].forEach((pt) => expect(eruv.contains(pt)).toBe(false));
  });

  it('found an interior point for every exclusion zone', () => {
    expect(exclusionInteriors.filter(Boolean)).toHaveLength(ERUV_POLYGONS.length);
  });

  it('rejects every exclusion zone, despite them being inside the boundary', () => {
    // This is the bug fixed earlier in the project: a location inside a
    // תל המתלקט cut-out was being reported as "Inside Eruv".
    const wronglyInside = exclusionInteriors.filter((c) => eruv.contains(c));
    expect(wronglyInside).toHaveLength(0);
  });

  it('places every exclusion zone inside the outer boundary', () => {
    // Without this, the test above could pass for the wrong reason — a zone
    // outside the boundary would be rejected by the boundary check alone.
    const outerOnly = createEruv(ERUV_BOUNDARY, []);
    exclusionInteriors.forEach((c) => expect(outerOnly.contains(c)).toBe(true));
  });

  it('handles missing and malformed input without throwing', () => {
    expect(eruv.contains(null)).toBe(false);
    expect(eruv.contains(undefined)).toBe(false);
    expect(eruv.contains({})).toBe(false);
    expect(eruv.contains({ lat: NaN, lng: 8.5 })).toBe(false);
    expect(eruv.contains({ lat: 47.37, lng: Infinity })).toBe(false);
  });

  it('works with no exclusion zones supplied', () => {
    const bare = createEruv(ERUV_BOUNDARY);
    expect(bare.exclusionCount).toBe(0);
    expect(typeof bare.contains({ lat: 47.37, lng: 8.54 })).toBe('boolean');
  });

  it('exposes bounds that actually contain the boundary', () => {
    ERUV_BOUNDARY.forEach((p) => {
      expect(p.lat).toBeGreaterThanOrEqual(eruv.bounds.minLat);
      expect(p.lat).toBeLessThanOrEqual(eruv.bounds.maxLat);
      expect(p.lng).toBeGreaterThanOrEqual(eruv.bounds.minLng);
      expect(p.lng).toBeLessThanOrEqual(eruv.bounds.maxLng);
    });
  });
});

describe('containsAll / firstOutside', () => {
  const inside = interiorGrid(eruv, 12).slice(0, 5);
  const outside = { lat: 47.3769, lng: 7.5 };

  it('accepts a path entirely inside', () => {
    expect(eruv.containsAll(inside)).toBe(true);
    expect(eruv.firstOutside(inside)).toBeNull();
  });

  it('rejects a path that leaves the eruv', () => {
    const straying = [...inside, outside];
    expect(eruv.containsAll(straying)).toBe(false);
  });

  it('identifies where a path first leaves', () => {
    const straying = [...inside, outside, ...inside];
    expect(eruv.firstOutside(straying)).toEqual(outside);
  });

  it('treats an empty path as inside', () => {
    expect(eruv.containsAll([])).toBe(true);
  });
});

describe('interiorGrid', () => {
  it('returns points, all of which are inside the eruv', () => {
    const pts = interiorGrid(eruv, 16);
    expect(pts.length).toBeGreaterThan(20);
    pts.forEach((p) => expect(eruv.contains(p)).toBe(true));
  });

  it('finds more candidates at a finer resolution', () => {
    expect(interiorGrid(eruv, 24).length).toBeGreaterThan(interiorGrid(eruv, 8).length);
  });
});

describe('distanceMetres', () => {
  it('is zero for the same point', () => {
    expect(distanceMetres({ lat: 47.37, lng: 8.54 }, { lat: 47.37, lng: 8.54 })).toBe(0);
  });

  it('matches a known separation', () => {
    // One degree of latitude is ~111.2 km anywhere on the globe.
    const d = distanceMetres({ lat: 47, lng: 8.5 }, { lat: 48, lng: 8.5 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it('is symmetric', () => {
    const a = { lat: 47.37, lng: 8.54 };
    const b = { lat: 47.41, lng: 8.51 };
    expect(distanceMetres(a, b)).toBeCloseTo(distanceMetres(b, a), 6);
  });
});

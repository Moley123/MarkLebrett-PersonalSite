/**
 * Eruv geometry — pure functions, no Google Maps.
 *
 * This replaces the `google.maps.geometry.poly.containsLocation` calls the
 * live page uses. The point isn't just to drop a dependency: the Google
 * version can only run inside a browser with the Maps API loaded, which is
 * why the containment logic — the thing that actually answers "is this
 * address inside the eruv?" — has never had a test. These functions take
 * plain `{lat, lng}` objects and run anywhere, including Node and CI.
 *
 * A location counts as inside when it is within the outer boundary AND
 * outside every exclusion zone (the תל המתלקט cut-outs).
 */

import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { polygon as turfPolygon, point as turfPoint } from '@turf/helpers';

/** GeoJSON wants [lng, lat] and a closed ring; our data is {lat, lng}. */
function toRing(points) {
  const ring = points.map((p) => [p.lng, p.lat]);
  const [first] = ring;
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
}

/** Axis-aligned bounds, used as a cheap reject before the full test. */
function bounds(points) {
  let minLat = Infinity; let maxLat = -Infinity;
  let minLng = Infinity; let maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

const inBounds = (pt, b) =>
  pt.lat >= b.minLat && pt.lat <= b.maxLat && pt.lng >= b.minLng && pt.lng <= b.maxLng;

/**
 * Build a reusable tester from an outer boundary and its exclusion zones.
 *
 * The GeoJSON conversion and the bounding boxes are computed once here rather
 * than per call — the live page rebuilds 17 `google.maps.Polygon` objects on
 * every single containment check, including once per point of a decoded route
 * polyline.
 *
 * @param {Array<{lat:number,lng:number}>} boundary  outer ring
 * @param {Array<{paths:Array}>} [exclusions]        cut-out polygons
 */
export function createEruv(boundary, exclusions = []) {
  const outer = turfPolygon([toRing(boundary)]);
  const outerBounds = bounds(boundary);

  const zones = exclusions
    .map((z) => (Array.isArray(z?.paths) ? z.paths[0] : z))
    .filter((pts) => Array.isArray(pts) && pts.length > 2)
    .map((pts) => ({ poly: turfPolygon([toRing(pts)]), bounds: bounds(pts) }));

  /** Is this point inside the boundary and outside every exclusion zone? */
  const contains = (pt) => {
    if (!pt || !Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) return false;
    if (!inBounds(pt, outerBounds)) return false;

    const gj = turfPoint([pt.lng, pt.lat]);
    if (!booleanPointInPolygon(gj, outer)) return false;

    for (const zone of zones) {
      // Exclusion zones are small, so the bounds check rejects almost all
      // points before the polygon test runs.
      if (inBounds(pt, zone.bounds) && booleanPointInPolygon(gj, zone.poly)) return false;
    }
    return true;
  };

  /** Every point of a path must be inside. */
  const containsAll = (points) => points.every(contains);

  /** First point of a path that falls outside, or null. */
  const firstOutside = (points) => points.find((p) => !contains(p)) || null;

  return {
    contains,
    containsAll,
    firstOutside,
    bounds: outerBounds,
    exclusionCount: zones.length,
  };
}

/**
 * Candidate waypoints on a grid inside the boundary.
 *
 * Used by the route search to steer a path back inside the eruv.
 *
 * @param {object} eruv  result of createEruv
 * @param {number} steps grid resolution per axis
 */
export function interiorGrid(eruv, steps = 20) {
  const { minLat, maxLat, minLng, maxLng } = eruv.bounds;
  const out = [];
  for (let i = 0; i <= steps; i += 1) {
    for (let j = 0; j <= steps; j += 1) {
      const pt = {
        lat: minLat + (maxLat - minLat) * (i / steps),
        lng: minLng + (maxLng - minLng) * (j / steps),
      };
      if (eruv.contains(pt)) out.push(pt);
    }
  }
  return out;
}

/** Great-circle distance in metres. Replaces computeDistanceBetween. */
export function distanceMetres(a, b) {
  const R = 6371008.8;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

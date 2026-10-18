/**
 * Route editing geometry.
 *
 * Everything needed to work out what a drag on a route line *means*, with no
 * reference to a map, a DOM node or React. Google's DirectionsRenderer does
 * this internally and gives you no say in it; doing it here is what lets the
 * lab page validate a dragged route against the eruv before committing to it.
 *
 * The model is deliberately small. A trip is an origin, a destination and an
 * ordered list of via points. Google returns a path through them. Dragging the
 * line either moves an existing via or inserts a new one, and the only hard
 * question is *where* in the order a new via belongs — answered by projecting
 * the grab point onto the path and comparing distances along it.
 *
 * All distances in and out of this module are metres.
 */

import nearestPointOnLine from '@turf/nearest-point-on-line';
import turfLength from '@turf/length';
import { lineString, point as turfPoint } from '@turf/helpers';

const KM = 1000;

/** How far from the line a grab can land and still count, by default. */
export const GRAB_TOLERANCE_M = 60;

/**
 * A grab this close along the line to an existing via moves that via instead
 * of inserting a second one beside it. Without this, grabbing a stop you can
 * plainly see would silently stack a duplicate on top of it.
 */
export const VIA_MERGE_M = 35;

const isPoint = (p) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/**
 * Vias are identified rather than compared by position, so that moving one
 * doesn't look like deleting it and adding another. One counter for the whole
 * app keeps ids unique however a via came to exist.
 */
let viaSeq = 0;
export const nextViaId = () => `via-${(viaSeq += 1)}`;

/** `{lat,lng}[]` → a Turf LineString. GeoJSON is `[lng, lat]`. */
export const asLine = (path) => lineString(path.map((p) => [p.lng, p.lat]));

/** Total length of a path in metres. */
export function routeLengthMetres(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;
  return turfLength(asLine(path)) * KM;
}

/**
 * The point on `path` closest to `pt`.
 *
 * @returns {{lat:number,lng:number,segmentIndex:number,distanceAlong:number,distanceToLine:number}|null}
 *   `distanceAlong` is metres from the start of the path, `distanceToLine` the
 *   metres between `pt` and the path. Null if either input is unusable.
 */
export function projectOntoRoute(path, pt) {
  if (!Array.isArray(path) || path.length < 2 || !isPoint(pt)) return null;

  const snapped = nearestPointOnLine(asLine(path), turfPoint([pt.lng, pt.lat]));
  const [lng, lat] = snapped.geometry.coordinates;
  const props = snapped.properties;

  // Turf 7.4 renamed these; the old names still work but are deprecated, and
  // reading both means this survives either side of the change.
  return {
    lat,
    lng,
    segmentIndex: props.segmentIndex ?? props.index,
    distanceAlong: (props.totalDistance ?? props.location) * KM,
    distanceToLine: (props.pointDistance ?? props.dist) * KM,
  };
}

/**
 * Where each via sits along the path, in metres from the start.
 *
 * Google snaps waypoints to the nearest routable road, so a via is rarely
 * exactly on the returned path — projecting it finds its place anyway.
 *
 * The result is forced non-decreasing. A route that doubles back on itself can
 * otherwise project a later via onto an earlier stretch of line, which would
 * reorder the user's stops behind their back.
 */
export function viaPositions(path, vias = []) {
  let floor = 0;
  return vias.map((via) => {
    const projected = projectOntoRoute(path, via);
    const d = projected ? Math.max(projected.distanceAlong, floor) : floor;
    floor = d;
    return d;
  });
}

/**
 * The index a new via belongs at, given the existing vias' positions along the
 * path and the new one's. Ties go after the existing via, which is what you
 * want when dragging away from a stop you just placed.
 */
export function insertionIndexFor(positions, distanceAlong) {
  let i = 0;
  while (i < positions.length && positions[i] <= distanceAlong) i += 1;
  return i;
}

/**
 * Interpret a grab on the route line.
 *
 * @returns {{kind:'move'|'insert', index:number, projected:object, positions:number[]}|null}
 *   Null when the grab is too far from the line to be meaningful.
 */
export function planGrab(path, vias = [], pt, opts = {}) {
  const {
    grabToleranceMetres = GRAB_TOLERANCE_M,
    viaMergeMetres = VIA_MERGE_M,
  } = opts;

  const projected = projectOntoRoute(path, pt);
  if (!projected || projected.distanceToLine > grabToleranceMetres) return null;

  const positions = viaPositions(path, vias);

  let nearest = -1;
  let nearestGap = Infinity;
  positions.forEach((d, i) => {
    const gap = Math.abs(d - projected.distanceAlong);
    if (gap < nearestGap) {
      nearestGap = gap;
      nearest = i;
    }
  });

  if (nearest >= 0 && nearestGap <= viaMergeMetres) {
    return { kind: 'move', index: nearest, projected, positions };
  }
  return {
    kind: 'insert',
    index: insertionIndexFor(positions, projected.distanceAlong),
    projected,
    positions,
  };
}

/**
 * Apply a plan, returning a new via list. `via` supplies the destination
 * coordinates and, for an insert, its id.
 */
export function withViaAt(vias, plan, via) {
  const next = [...vias];
  if (plan.kind === 'move') {
    next[plan.index] = { ...next[plan.index], lat: via.lat, lng: via.lng };
    return next;
  }
  next.splice(plan.index, 0, via);
  return next;
}

/** A new via list without the via carrying `id`. */
export const withoutVia = (vias, id) => vias.filter((v) => v.id !== id);

/**
 * The two fixed points a dragged handle sits between — used to draw the
 * rubber band, so the user can see which leg of the trip they are bending.
 */
export function neighboursFor({ origin, destination, vias = [] }, plan) {
  const after = plan.kind === 'move' ? plan.index + 1 : plan.index;
  return {
    before: vias[plan.index - 1] || origin,
    after: vias[after] || destination,
  };
}

/**
 * Split a path into consecutive runs that are inside or outside the eruv.
 *
 * Each run after the first repeats its predecessor's last point, so the drawn
 * lines join up instead of leaving a gap at every crossing. Runs of fewer than
 * two points are dropped — they cannot be drawn as a line.
 *
 * @param {{lat:number,lng:number}[]} path
 * @param {{contains:function}} eruv
 * @returns {{inside:boolean, points:{lat:number,lng:number}[]}[]}
 */
export function splitByContainment(path, eruv) {
  if (!Array.isArray(path) || path.length < 2) return [];

  const runs = [];
  let current = null;

  path.forEach((pt, i) => {
    const inside = eruv.contains(pt);
    if (!current || current.inside !== inside) {
      current = { inside, points: i > 0 ? [path[i - 1], pt] : [pt] };
      runs.push(current);
    } else {
      current.points.push(pt);
    }
  });

  return runs.filter((run) => run.points.length >= 2);
}

/**
 * How much of the path lies outside the eruv, in metres. Reported to the user
 * so "it strays" comes with a sense of scale — 20 m of pavement and 600 m
 * through a park are not the same problem.
 */
export function outsideMetres(path, eruv) {
  return splitByContainment(path, eruv)
    .filter((run) => !run.inside)
    .reduce((total, run) => total + routeLengthMetres(run.points), 0);
}

/** 480 → "480 m"; 1640 → "1.6 km". */
export const formatMetres = (m) => (
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
);

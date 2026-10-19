/**
 * NW London lab — the rules for a network of eruvim, with no map in sight.
 *
 * The lab engine (./EruvLab.js) only ever asks two questions: "where must a
 * route between these two points stay, and how is it judged?" and "what is
 * this address in?". For one eruv the answers are trivial. For NW London they
 * depend on which eruvim are switched on and whether crossing between them is
 * allowed, and they are worked out here — as plain functions, so they can be
 * unit-tested without Google or MapLibre.
 *
 * Ported from src/components/NWLondonMap.js, with Turf in place of Google's
 * geometry library. One deliberate difference, in strict mode:
 *
 *   The live page asks which eruv each point is in, takes the FIRST match,
 *   and rejects any route where that answer changes. Where eruvim overlap,
 *   the first match can change while the route is still inside the eruv it
 *   started in — and an origin and destination that are both in, say, NW
 *   London can be refused as "different eruvim" because one of them also
 *   sits in an earlier-listed neighbour. Here, strict mode looks for an eruv
 *   containing BOTH endpoints and holds the route to that eruv.
 *
 * Crossing mode keeps the live semantics exactly: first match per point, and
 * a change of eruv is allowed only within 100 m of an official crossing point.
 */

import { createEruv, distanceMetres, interiorGrid } from './eruvGeometry';
import { membershipMessage } from '../data/eruvMembership';

/** Within this distance of a crossing point, a change of eruv is allowed. */
export const CROSSING_RADIUS_M = 100;

/**
 * Attach a point-in-polygon tester to each eruv that has a usable boundary.
 * Order is preserved — it matters (see ../data/nwlondonEruvim.js).
 */
export function withTesters(eruvim) {
  return eruvim
    .filter((e) => Array.isArray(e.containmentPath) && e.containmentPath.length > 2)
    .map((e) => ({ ...e, tester: createEruv(e.containmentPath) }));
}

/**
 * Several eruvim as one region: inside it means inside any of them. Has the
 * same shape as createEruv()'s result, so the engine can't tell the
 * difference — which is the point.
 */
export function unionEruv(list) {
  const contains = (pt) => list.some((e) => e.tester.contains(pt));
  const b = list.reduce((acc, e) => ({
    minLat: Math.min(acc.minLat, e.tester.bounds.minLat),
    maxLat: Math.max(acc.maxLat, e.tester.bounds.maxLat),
    minLng: Math.min(acc.minLng, e.tester.bounds.minLng),
    maxLng: Math.max(acc.maxLng, e.tester.bounds.maxLng),
  }), { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity });
  return {
    contains,
    containsAll: (points) => points.every(contains),
    firstOutside: (points) => points.find((p) => !contains(p)) || null,
    bounds: b,
  };
}

/** The first eruv in list order containing the point, or null. */
export function firstContaining(pt, list) {
  return list.find((e) => e.tester.contains(pt)) || null;
}

export function nearCrossingPoint(pt, crossingPoints, radius = CROSSING_RADIUS_M) {
  return crossingPoints.some((cp) => cp.path.some((q) => distanceMetres(pt, q) < radius));
}

/**
 * Does a route obey the crossing rules? Every point inside some eruv, and the
 * eruv it is in (first match) changing only near a crossing point.
 */
export function crossingValid(points, list, crossingPoints) {
  let current = null;
  for (const pt of points) {
    const occupying = firstContaining(pt, list);
    if (!occupying) return false;
    if (current === null) { current = occupying; continue; }
    if (occupying !== current) {
      if (!nearCrossingPoint(pt, crossingPoints)) return false;
      current = occupying;
    }
  }
  return true;
}

/**
 * Build the route-context function the engine calls.
 *
 * @param {Array}   active          eruvim switched on, with testers, in order
 * @param {boolean} allowCrossing
 * @param {Array}   crossingPoints
 */
export function makeRouteContext(active, allowCrossing, crossingPoints) {
  return ({ origin, destination }) => {
    if (!active.length) return { error: 'Switch on at least one eruv in Layer Toggles.' };

    const atOrigin = active.filter((e) => e.tester.contains(origin));
    const atDest = active.filter((e) => e.tester.contains(destination));
    if (!atOrigin.length && !atDest.length) {
      return { error: 'Both the start and end points are outside the active Eruvin.' };
    }
    if (!atOrigin.length) return { error: 'The start point is outside the active Eruvin.' };
    if (!atDest.length) return { error: 'The destination is outside the active Eruvin.' };

    if (!allowCrossing) {
      const shared = atOrigin.find((e) => atDest.includes(e));
      if (shared) return { eruv: shared.tester, label: shared.name };
      return {
        error: `Strict mode: ${atOrigin[0].name} and ${atDest[0].name} are different eruvim. `
          + 'Tick "Allow crossing" to route between them.',
      };
    }

    const region = unionEruv(active);
    let waypoints = null;
    return {
      eruv: region,
      validate: (points) => crossingValid(points, active, crossingPoints),
      invalidMessage: 'This route moves between eruvim away from an official crossing point. '
        + 'Drag it to cross at one of the yellow crossings.',
      // The detour search tries interior points near where the route strays —
      // and, as on the live page, the middle of each crossing point, which is
      // often exactly the detour needed. Worked out only if a detour is.
      get waypoints() {
        if (!waypoints) {
          waypoints = [
            ...interiorGrid(region, 20),
            ...crossingPoints.map((cp) => cp.path[Math.floor(cp.path.length / 2)]),
          ];
        }
        return waypoints;
      },
    };
  };
}

/** Build the location-check function: every active eruv the point is in. */
export function makeCheckLocation(active) {
  return (pt) => {
    const message = membershipMessage(active.filter((e) => e.tester.contains(pt)).map((e) => e.name));
    return message
      ? { inside: true, message }
      : { inside: false, message: 'Outside active Eruvin bounds.' };
  };
}

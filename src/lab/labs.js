/**
 * Configuration for the single-eruv lab pages.
 *
 * Everything that differs between labs lives here; the engine in ./EruvLab.js
 * is shared. Each config is built once at module load and never changes, so
 * it is safe to depend on in effects.
 *
 * Zoom levels are one lower than the live pages': MapLibre's vector tiles are
 * 512px where Google's are 256px, so the same zoom number shows twice the
 * detail and half the area. Google 13 and MapLibre 12 frame the same view.
 */

import ERUV_BOUNDARY from '../data/eruv_boundary';
import ERUV_SEGMENTS from '../data/eruv_segments';
import ERUV_POLYGONS from '../data/eruv_polygons';
import { GIBRALTAR_ERUV } from '../data/gibraltar_data';
import { GIBRALTAR_ERUV_NOTES } from '../data/gibraltar_notes';
import { GG_ERUV } from '../data/gg_eruv';
import { createEruv } from './eruvGeometry';
import { featureCollection, lineFeature, polygonFeature } from './useMapLibre';

/* ══════════════════ Zürich ══════════════════ */

export const ZURICH_LAB = {
  id: 'zurich',
  livePath: '/zurich-eiruv',
  docTitle: 'LAB · Zurich Eruv Route Planner',
  heading: '🕍 Zurich Eiruv Route Planner',
  printTitle: 'Zurich Eiruv — Walking Route',
  subtitle: 'Check if an address is within the Eiruv, or plan a walking route that stays inside the boundary.',
  checkIntro: 'Enter an address to verify whether it falls within the Zürich Eiruv boundary.',
  placeholders: { check: 'Search an address in Zürich…' },
  autocompleteOptions: { componentRestrictions: { country: 'ch' } },

  center: { lat: 47.376, lng: 8.541 },
  zoom: 12,

  eruv: createEruv(ERUV_BOUNDARY, ERUV_POLYGONS),
  mapLayers: [
    {
      id: 'eruv-fill',
      data: polygonFeature(ERUV_BOUNDARY),
      layers: [{ type: 'fill', paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.07 } }],
    },
    {
      id: 'eruv-exclusions',
      data: featureCollection(ERUV_POLYGONS.map((p) => polygonFeature(p.paths[0]))),
      layers: [
        { type: 'fill', paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.22 } },
        { type: 'line', paint: { 'line-color': '#ef4444', 'line-width': 2 } },
      ],
    },
    {
      id: 'eruv-segments',
      data: featureCollection(ERUV_SEGMENTS.map((seg) => lineFeature(seg))),
      layers: [{ type: 'line', paint: { 'line-color': '#111111', 'line-width': 3 } }],
    },
  ],
};

/* ══════════════════ Gibraltar ══════════════════ */

const GIB = GIBRALTAR_ERUV[0];

export const GIBRALTAR_LAB = {
  id: 'gibraltar',
  livePath: '/gibraltareruv',
  docTitle: 'LAB · Gibraltar Eruv',
  heading: 'Gibraltar Eruv Route Planner',
  printTitle: 'Gibraltar Eruv — Walking Route',
  subtitle: 'Check locations against the Gibraltar Eruv boundary and view important halachic boundary notes.',
  checkIntro: 'Enter an address to check if it falls inside the Gibraltar Eruv.',
  placeholders: { check: 'Search address, postcode…', origin: 'Start location', destination: 'End location' },
  // The live page doesn't restrict search to Gibraltar, so neither does this.
  autocompleteOptions: {},

  center: { lat: 36.14, lng: -5.353 },
  zoom: 13,

  eruv: createEruv(GIB.containmentPath),
  mapLayers: [
    {
      // Named like Zurich's so the browser tests can check either lab the
      // same way.
      id: 'eruv-fill',
      data: featureCollection(GIB.polygonPaths.map((ring) => polygonFeature(ring))),
      layers: [
        { type: 'fill', paint: { 'fill-color': GIB.color, 'fill-opacity': 0.08 } },
        { type: 'line', paint: { 'line-color': GIB.color, 'line-width': 2.5 } },
      ],
    },
  ],
  notes: GIBRALTAR_ERUV_NOTES,
};

/* ══════════════════ Golders Green (embed) ══════════════════
   Not a lab copy of a page here: the map for the Golders Green Eruv's own
   website, shown inside it. The boundary line comes from the KML; the ring is
   the closed version of it used for containment, drawn only as a faint fill. */

export const GG_EMBED = {
  id: 'gg-embed',
  livePath: '/',
  docTitle: 'Golders Green Eruv Map',
  heading: 'Golders Green Eruv',
  printTitle: 'Golders Green Eruv — Walking Route',
  subtitle: '',
  checkIntro: 'Enter an address to check whether it is inside the Golders Green Eruv.',
  placeholders: {
    check: 'e.g. Golders Green Road, NW11',
    origin: 'Start address',
    destination: 'Destination',
  },
  autocompleteOptions: { componentRestrictions: { country: 'gb' } },

  // The middle of the eruv's extent. Google zoom 14, one lower here.
  center: { lat: 51.5757, lng: -0.2053 },
  zoom: 13,
  // It sits partway down a long page: scrolling past it mustn't zoom it.
  cooperativeGestures: true,

  eruv: createEruv(GG_ERUV.containmentPath),
  mapLayers: [
    {
      id: 'eruv-fill',
      data: polygonFeature(GG_ERUV.containmentPath),
      layers: [{ type: 'fill', paint: { 'fill-color': GG_ERUV.color, 'fill-opacity': 0.1 } }],
    },
    {
      id: 'eruv-segments',
      data: featureCollection(GG_ERUV.rawSegments.filter((seg) => seg.length > 1).map((seg) => lineFeature(seg))),
      layers: [{ type: 'line', paint: { 'line-color': GG_ERUV.color, 'line-width': 3 } }],
    },
  ],
};

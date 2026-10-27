/**
 * Work in progress: the lab copies of the eruv pages and the Golders Green
 * previews.
 *
 * One list, read by both the router (src/App.js) and the Beta & Experiments
 * page linked from the bottom of the portal, so a path can't change in one
 * place and not the other. They are linked openly now; the pages themselves
 * still send noindex and are disallowed in robots.txt, so they stay out of
 * search results.
 *
 * `external` marks a static file in public/ rather than a React route: it
 * has to be a plain link, since the router would treat it as an unknown path.
 */

export const PATHS = {
  zurichLab: '/lab-x490i98i_lRc',
  gibraltarLab: '/lab-9gUGkgMiK7st',
  nwLondonLab: '/lab-m5B-BoBsnHAm',
  ggMap: '/ggeruv-map',
  // The address the GG map first had; kept so earlier links still work.
  ggMapLegacy: '/lab-ySNFAd2xhWM1',
  ggPreview: '/ggeruv-preview-j4_jGaMKNQfr.html',
};

export const EXPERIMENTS = [
  {
    title: 'Zurich Eiruv: Lab',
    path: PATHS.zurichLab,
    badge: 'Lab',
    description: 'The Zurich route planner rebuilt on open-source maps, with routes you can drag to reshape and undo.',
    live: { label: 'Live version', path: '/zurich-eiruv' },
  },
  {
    title: 'NW London Eiruvim: Lab',
    path: PATHS.nwLondonLab,
    badge: 'Lab',
    description: 'All the North West London eiruvim on open-source maps, with joint-eruv checks and crossing-point routing.',
    live: { label: 'Live version', path: '/nwlondon-eiruv' },
  },
  {
    title: 'Gibraltar Eruv: Lab',
    path: PATHS.gibraltarLab,
    badge: 'Lab',
    description: 'The Gibraltar route planner on open-source maps, with draggable routes and the halachic boundary notes.',
    live: { label: 'Live version', path: '/gibraltareruv' },
  },
  {
    title: 'Golders Green Eruv Map',
    path: PATHS.ggMap,
    badge: 'Beta',
    description: 'An interactive map for the Golders Green Eruv: check an address or plan a route, on OpenStreetMap or Google Maps.',
  },
  {
    title: 'ggeruv.org Preview',
    path: PATHS.ggPreview,
    external: true,
    badge: 'Preview',
    description: "A mock-up of the Golders Green Eruv's website with the interactive map in place, prepared for the eruv committee.",
  },
];

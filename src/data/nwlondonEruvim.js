/**
 * The NW London eruvim, in the order every page should treat them.
 *
 * Shared by the live /nwlondon-eiruv page and its lab copy, so the two can't
 * drift apart when the data files are regenerated. The order is load-bearing:
 * it is the order of the layer list, and the order in which "which eruv is
 * this point in?" is answered.
 */
import { NWLONDON_ERUVIM } from './nwlondon_data';
import { NEW_ERUVIM } from './new_eruvim';

// Every eruv in new_eruvim.js is a KLBD (London Beis Din) boundary. Listing
// them explicitly rather than spreading NEW_ERUVIM keeps the order — and so
// the layer list — stable when the data file is regenerated.
// South Hampstead is listed LAST deliberately. Its boundary cannot be closed
// from the KLBD KML (its two open ends are 4,530m apart with no connecting
// coordinates), so the stored ring is unreliable and overlaps its neighbours.
// First-match lookups return the earliest eruv in this list, so keeping it
// last means the verified boundaries win wherever they disagree.
export const EXTRA_LBD_NAMES = [
  'Brondesbury Park Eruv',
  "St John's Wood Eruv",
  'Chigwell Eruv',
  'South Hampstead Eruv',
];

const EXTRA_LBD_ERUVIM = EXTRA_LBD_NAMES
  .map((name) => NEW_ERUVIM.find((e) => e.name === name))
  .filter(Boolean)
  .map((e) => ({
    ...e,
    authority: 'LBD',
    isPrototype: false,
    containmentPath: e.containmentPath || [],
    rawSegments: e.rawSegments || [],
  }));

export const ALL_ERUVIM = [...NWLONDON_ERUVIM, ...EXTRA_LBD_ERUVIM];

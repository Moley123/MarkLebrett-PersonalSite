import { GG_ERUV } from './gg_eruv';
import { NWLONDON_ERUVIM } from './nwlondon_data';

// gg_eruv.js is a copy of one entry of nwlondon_data.js, so the GG embed can
// load it without the rest. Both are written by process_nwlondon_kml.js.
it('matches the Golders Green entry in the NW London data', () => {
  expect(GG_ERUV).toEqual(NWLONDON_ERUVIM.find((e) => e.name === 'Golders Green Eruv'));
});

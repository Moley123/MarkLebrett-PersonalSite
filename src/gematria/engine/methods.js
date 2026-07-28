/**
 * The gematria methods.
 *
 * Every method is a pure `(text) => number` so they can be tested in isolation
 * and mapped over freely. `METHODS` is the ordered, display-ready registry the
 * UI renders from — adding a method here is all that's needed for it to appear
 * everywhere (calculator, comparison mode, search).
 */

import {
  ACHBI, ALBAM, ATBASH, MILUI, MILUI_SPELLING, ORDINAL, SOFIT, STANDARD,
  base, normalise,
} from './letters';

const letters = (text) => normalise(text).split('').filter(Boolean);

const sumBy = (text, fn) => letters(text).reduce((n, c) => n + fn(c), 0);

/** Digital root: repeatedly sum the decimal digits until one remains. */
export function digitalRoot(n) {
  let value = Math.abs(Math.trunc(n));
  while (value > 9) {
    value = String(value).split('').reduce((a, d) => a + Number(d), 0);
  }
  return value;
}

// ── Core methods ───────────────────────────────────────────────────────────

/** Mispar Hechrachi — the standard absolute value. */
export const hechrachi = (text) => sumBy(text, (c) => STANDARD[base(c)] || 0);

/** Mispar Gadol — final letters take 500–900. */
export const gadol = (text) =>
  sumBy(text, (c) => SOFIT[c] || STANDARD[base(c)] || 0);

/** Mispar Katan — each letter reduced to a single digit (400 → 4). */
export const katan = (text) =>
  sumBy(text, (c) => {
    const v = STANDARD[base(c)] || 0;
    return v === 0 ? 0 : digitalRoot(v);
  });

/** Mispar Katan Mispari — the digital root of the standard value. */
export const katanMispari = (text) => digitalRoot(hechrachi(text));

/** Mispar Siduri — ordinal position in the alphabet, 1–22. */
export const siduri = (text) => sumBy(text, (c) => ORDINAL[base(c)] || 0);

/** Mispar Kolel — standard value plus one for the word itself. */
export const kolel = (text) => {
  const value = hechrachi(text);
  return value === 0 ? 0 : value + 1;
};

/** Mispar HaMerubah HaPrati — each letter squared, then summed. */
export const perati = (text) =>
  sumBy(text, (c) => (STANDARD[base(c)] || 0) ** 2);

/** Mispar Meshulash — each letter cubed, then summed. */
export const meshulash = (text) =>
  sumBy(text, (c) => (STANDARD[base(c)] || 0) ** 3);

/** Mispar HaKlali — the standard value of the whole word, squared. */
export const haKlali = (text) => hechrachi(text) ** 2;

/**
 * Mispar Bone'eh — "building" value. Each letter is added to a running total
 * and every intermediate total is itself summed:
 *   בית → ב + (ב+י) + (ב+י+ת)
 */
export const boneeh = (text) => {
  let running = 0;
  let total = 0;
  letters(text).forEach((c) => {
    running += STANDARD[base(c)] || 0;
    total += running;
  });
  return total;
};

/** Mispar Milui — the value of each letter's spelled-out name. */
export const milui = (text) => sumBy(text, (c) => MILUI[base(c)] || 0);

/** Mispar Ne'elam — the "hidden" part: Milui minus the letter itself. */
export const neelam = (text) => milui(text) - hechrachi(text);

// ── Substitution ciphers ───────────────────────────────────────────────────

const cipher = (table) => (text) =>
  sumBy(text, (c) => STANDARD[table[base(c)]] || 0);

/** AtBash — א↔ת, ב↔ש, … */
export const atbash = cipher(ATBASH);

/** AlBam — א↔ל, ב↔מ, … */
export const albam = cipher(ALBAM);

/** Achbi — each half of the alphabet reversed within itself. */
export const achbi = cipher(ACHBI);

/** Return the ciphered *text* (not the value) — used to show the working. */
export const applyCipher = (table, text) =>
  normalise(text).split('').map((c) => table[base(c)] || c).join('');

// ── Registry ───────────────────────────────────────────────────────────────

/**
 * `primary: true` methods are the ones shown by default and offered as search
 * targets. The rest live behind "show all methods".
 */
export const METHODS = [
  {
    key: 'hechrachi',
    name: 'Mispar Hechrachi',
    short: 'Standard',
    hebrew: 'מספר הכרחי',
    fn: hechrachi,
    primary: true,
    searchable: true,
    description: 'The standard value. Each letter takes its usual number, א=1 through ת=400.',
  },
  {
    key: 'gadol',
    name: 'Mispar Gadol',
    short: 'Large',
    hebrew: 'מספר גדול',
    fn: gadol,
    primary: true,
    description: 'Final letters continue the count: ך=500, ם=600, ן=700, ף=800, ץ=900.',
  },
  {
    key: 'siduri',
    name: 'Mispar Siduri',
    short: 'Ordinal',
    hebrew: 'מספר סידורי',
    fn: siduri,
    primary: true,
    description: 'Each letter counts as its position in the alphabet, from 1 to 22.',
  },
  {
    key: 'katan',
    name: 'Mispar Katan',
    short: 'Reduced',
    hebrew: 'מספר קטן',
    fn: katan,
    primary: true,
    description: 'Trailing zeros are dropped from each letter, so ק=1, ר=2, ש=3, ת=4.',
  },
  {
    key: 'katanMispari',
    name: 'Mispar Katan Mispari',
    short: 'Digital root',
    hebrew: 'מספר קטן מספרי',
    fn: katanMispari,
    primary: true,
    description: 'The standard value reduced to a single digit by summing its digits.',
  },
  {
    key: 'kolel',
    name: 'Mispar Kolel',
    short: '+1',
    hebrew: 'מספר כולל',
    fn: kolel,
    primary: true,
    description: 'The standard value plus one, counting the word itself as a unit.',
  },
  {
    key: 'milui',
    name: 'Mispar Milui',
    short: 'Filling',
    hebrew: 'מספר מילוי',
    fn: milui,
    description: "Each letter's name is spelled out and valued, e.g. א becomes אלף = 111.",
  },
  {
    key: 'neelam',
    name: "Mispar Ne'elam",
    short: 'Hidden',
    hebrew: 'מספר נעלם',
    fn: neelam,
    description: 'The filling minus the letter itself — the part of the name left unsaid.',
  },
  {
    key: 'perati',
    name: 'Mispar HaMerubah HaPrati',
    short: 'Squared',
    hebrew: 'מספר המרובע הפרטי',
    fn: perati,
    description: 'Each letter squared, then totalled.',
  },
  {
    key: 'haKlali',
    name: 'Mispar HaKlali',
    short: 'Total²',
    hebrew: 'מספר הכללי',
    fn: haKlali,
    description: 'The standard value of the whole word, squared.',
  },
  {
    key: 'meshulash',
    name: 'Mispar Meshulash',
    short: 'Cubed',
    hebrew: 'מספר משולש',
    fn: meshulash,
    description: 'Each letter cubed, then totalled.',
  },
  {
    key: 'boneeh',
    name: "Mispar Bone'eh",
    short: 'Building',
    hebrew: 'מספר בונה',
    fn: boneeh,
    description: 'A running total that accumulates as the word is built letter by letter.',
  },
  {
    key: 'atbash',
    name: 'AtBash',
    short: 'AtBash',
    hebrew: 'אתב״ש',
    fn: atbash,
    cipher: ATBASH,
    description: 'The alphabet reversed: א↔ת, ב↔ש, and so on.',
  },
  {
    key: 'albam',
    name: 'AlBam',
    short: 'AlBam',
    hebrew: 'אלב״ם',
    fn: albam,
    cipher: ALBAM,
    description: 'The alphabet halved and swapped: א↔ל, ב↔מ, and so on.',
  },
  {
    key: 'achbi',
    name: 'Achbi',
    short: 'Achbi',
    hebrew: 'אכב״י',
    fn: achbi,
    cipher: ACHBI,
    description: 'Each half of the alphabet reversed within itself: א↔כ, ל↔ת.',
  },
];

export const METHODS_BY_KEY = Object.fromEntries(METHODS.map((m) => [m.key, m]));

export const PRIMARY_METHODS = METHODS.filter((m) => m.primary);

/** Compute every method at once. Returns `{ [key]: value }`. */
export function calculateAll(text) {
  const out = {};
  METHODS.forEach((m) => {
    out[m.key] = m.fn(text);
  });
  return out;
}

/**
 * Per-letter breakdown for the "show your working" panel.
 * Returns one row per Hebrew letter in the input.
 */
export function letterBreakdown(text) {
  return normalise(text).split('').map((letter) => {
    const b = base(letter);
    return {
      letter,
      base: b,
      isFinal: b !== letter,
      standard: STANDARD[b] || 0,
      sofit: SOFIT[letter] || STANDARD[b] || 0,
      ordinal: ORDINAL[b] || 0,
      milui: MILUI[b] || 0,
      milyiSpelling: MILUI_SPELLING[b] || '',
      atbash: ATBASH[b] || '',
    };
  });
}

/** The default method used everywhere a single number is implied. */
export const DEFAULT_METHOD = 'hechrachi';

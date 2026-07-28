/**
 * Temurah — systematic letter-substitution tables.
 *
 * The three ciphers already used for gematria values (AtBash, AlBam, Achbi)
 * live in letters.js; this module adds the remaining classical tables and
 * exposes them as *text* transforms, so the transformed word can be read and
 * looked up rather than only scored.
 */

import { ACHBI, ALBAM, ALPHABET, ATBASH, FINALS, normaliseWords } from './letters';

/** Avgad — each letter becomes the next one, ת wrapping back to א. */
export const AVGAD = ALPHABET.reduce((map, letter, i) => {
  map[letter] = ALPHABET[(i + 1) % ALPHABET.length];
  return map;
}, {});

/** Atbach — the inverse of Avgad: each letter becomes the previous one. */
export const ATBACH = ALPHABET.reduce((map, letter, i) => {
  map[letter] = ALPHABET[(i - 1 + ALPHABET.length) % ALPHABET.length];
  return map;
}, {});

/**
 * Ayak Bachar (אי״ק בכ״ר) — the 27 letters, finals included, laid out in three
 * rows of nine (units, tens, hundreds). Each letter cycles down its column:
 * א → י → ק → א.
 */
const AYAK_ROWS = [
  ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'],
  ['י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'],
  ['ק', 'ר', 'ש', 'ת', 'ך', 'ם', 'ן', 'ף', 'ץ'],
];

export const AYAK_BACHAR = (() => {
  const map = {};
  for (let col = 0; col < 9; col += 1) {
    for (let row = 0; row < 3; row += 1) {
      map[AYAK_ROWS[row][col]] = AYAK_ROWS[(row + 1) % 3][col];
    }
  }
  return map;
})();

/**
 * The registry the UI renders from.
 *
 * `foldFinals` says whether a final form should be normalised to its base
 * letter before lookup. Ayak Bachar is the exception — finals are meaningful
 * members of its third row, so folding them would corrupt the table.
 */
export const TEMURAH_TABLES = [
  {
    key: 'atbash',
    name: 'AtBash',
    hebrew: 'אתב״ש',
    table: ATBASH,
    foldFinals: true,
    description: 'The alphabet reversed — א↔ת, ב↔ש. The best known of the ciphers; Jeremiah uses it to write בבל as ששך.',
  },
  {
    key: 'albam',
    name: 'AlBam',
    hebrew: 'אלב״ם',
    table: ALBAM,
    foldFinals: true,
    description: 'The alphabet halved and the halves swapped — א↔ל, ב↔מ.',
  },
  {
    key: 'achbi',
    name: 'Achbi',
    hebrew: 'אכב״י',
    table: ACHBI,
    foldFinals: true,
    description: 'Each half reversed within itself — א↔כ, ל↔ת.',
  },
  {
    key: 'avgad',
    name: 'Avgad',
    hebrew: 'אבג״ד',
    table: AVGAD,
    foldFinals: true,
    description: 'Each letter steps forward one place, ת wrapping round to א.',
  },
  {
    key: 'atbach',
    name: 'Atbach',
    hebrew: 'אתב״ח',
    table: ATBACH,
    foldFinals: true,
    description: 'Each letter steps back one place — the reverse of Avgad.',
  },
  {
    key: 'ayakBachar',
    name: 'Ayak Bachar',
    hebrew: 'אי״ק בכ״ר',
    table: AYAK_BACHAR,
    foldFinals: false,
    description: 'All 27 letters in three rows of nine; each cycles down its column — א → י → ק.',
  },
];

/** Base letter → its final form, for words that end in one. */
const TO_FINAL = Object.entries(FINALS).reduce((map, [final, plain]) => {
  map[plain] = final;
  return map;
}, {});

/**
 * Put final letter forms where Hebrew orthography expects them: at the end of
 * a word and nowhere else.
 *
 * Two things need fixing after a substitution. A table keyed on base letters
 * leaves מ at the end of a word where ם belongs. And Ayak Bachar maps *onto*
 * final forms — its third row is ק ר ש ת ך ם ן ף ץ — so it can legitimately
 * produce ן in the middle of a word, which no Hebrew reader would accept.
 * Folding mid-word finals back to their base leaves the gematria untouched,
 * since Hechrachi scores ן and נ identically.
 */
export function applyFinalForms(text) {
  return text
    .split(' ')
    .map((word) => {
      if (!word) return word;
      const body = word
        .slice(0, -1)
        .split('')
        .map((ch) => FINALS[ch] || ch)
        .join('');
      const last = word[word.length - 1];
      return body + (TO_FINAL[last] || last);
    })
    .join(' ');
}

/** Apply a table to text, preserving word boundaries. */
export function applyTemurah(text, { table, foldFinals = true }) {
  const swapped = normaliseWords(text)
    .split('')
    .map((ch) => {
      if (ch === ' ') return ' ';
      const key = foldFinals ? FINALS[ch] || ch : ch;
      return table[key] || ch;
    })
    .join('');
  return applyFinalForms(swapped);
}

/** Every table applied at once, ready for rendering. */
export function allTemurot(text) {
  const source = normaliseWords(text);
  if (!source) return [];
  return TEMURAH_TABLES.map((entry) => ({
    ...entry,
    result: applyTemurah(source, entry),
  }));
}

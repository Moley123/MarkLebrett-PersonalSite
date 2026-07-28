/**
 * Hebrew letter tables shared by every gematria method.
 *
 * Kept separate from the methods themselves so the cipher tables can be
 * inspected and unit-tested independently of the arithmetic.
 */

// The 22 letters in alphabetical order. Finals are handled by folding them
// back onto their base letter before any table lookup.
export const ALPHABET = [
  'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ',
  'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת',
];

export const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

/** Mispar Hechrachi — the standard values. Finals share their base value. */
export const STANDARD = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
  'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90,
  'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
};

/** Mispar Gadol — final forms continue the sequence 500–900. */
export const SOFIT = { 'ך': 500, 'ם': 600, 'ן': 700, 'ף': 800, 'ץ': 900 };

/** Mispar Siduri — ordinal position, 1–22. */
export const ORDINAL = ALPHABET.reduce((acc, letter, i) => {
  acc[letter] = i + 1;
  return acc;
}, {});

/**
 * Milui — the gematria of each letter's own name.
 *
 * Several letters have more than one accepted spelling (ה as הא/הה/הי,
 * ו as ויו/וו/ואו, ת as תו/תיו). These are the most commonly cited forms;
 * the spelling is exposed alongside the value so the UI can show its working.
 */
export const MILUI_SPELLING = {
  'א': 'אלף', 'ב': 'בית', 'ג': 'גימל', 'ד': 'דלת', 'ה': 'הא',
  'ו': 'ויו', 'ז': 'זין', 'ח': 'חית', 'ט': 'טית', 'י': 'יוד',
  'כ': 'כף', 'ל': 'למד', 'מ': 'מם', 'נ': 'נון', 'ס': 'סמך',
  'ע': 'עין', 'פ': 'פה', 'צ': 'צדי', 'ק': 'קוף', 'ר': 'ריש',
  'ש': 'שין', 'ת': 'תו',
};

// Letter names end in final forms (אלף, כף, מם, סמך), which have no entry in
// STANDARD — fold them onto their base letter before looking the value up.
const sumStandard = (word) =>
  word.split('').reduce((n, c) => n + (STANDARD[FINALS[c] || c] || 0), 0);

export const MILUI = Object.fromEntries(
  Object.entries(MILUI_SPELLING).map(([letter, name]) => [letter, sumStandard(name)]),
);

// ── Substitution ciphers ───────────────────────────────────────────────────

/** Build a symmetric cipher by pairing a list of letters first-to-last. */
function reversePairs(letters) {
  const map = {};
  letters.forEach((letter, i) => {
    map[letter] = letters[letters.length - 1 - i];
  });
  return map;
}

/** AtBash — א↔ת, ב↔ש, … the whole alphabet reversed. */
export const ATBASH = reversePairs(ALPHABET);

/** AlBam — the alphabet split in half, then the halves swapped: א↔ל, ב↔מ, … */
export const ALBAM = (() => {
  const map = {};
  const half = ALPHABET.length / 2; // 11
  for (let i = 0; i < half; i += 1) {
    const a = ALPHABET[i];
    const b = ALPHABET[i + half];
    map[a] = b;
    map[b] = a;
  }
  return map;
})();

/** Achbi — each half of the alphabet reversed within itself: א↔כ, ל↔ת, … */
export const ACHBI = (() => {
  const half = ALPHABET.length / 2;
  return {
    ...reversePairs(ALPHABET.slice(0, half)),
    ...reversePairs(ALPHABET.slice(half)),
  };
})();

// ── Normalisation ──────────────────────────────────────────────────────────

const NIKUD = /[֑-ׇ]/g;
const NON_HEBREW = /[^א-ת]/g;

/** Strip vowels, cantillation, punctuation and Latin text. */
export function normalise(text) {
  if (!text) return '';
  return String(text)
    .replace(/־/g, ' ') // maqaf → space
    .replace(NIKUD, '')
    .replace(NON_HEBREW, '');
}

/** Same as {@link normalise} but keeps word boundaries. */
export function normaliseWords(text) {
  if (!text) return '';
  return String(text)
    .replace(/־/g, ' ')
    .replace(NIKUD, '')
    .replace(/[^א-ת\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fold a final form onto its base letter. */
export const base = (letter) => FINALS[letter] || letter;

/** True when the string contains at least one Hebrew letter. */
export const hasHebrew = (text) => /[א-ת]/.test(text || '');

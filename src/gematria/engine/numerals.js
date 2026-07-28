/**
 * Conversion between integers and Hebrew numerals (gematria notation).
 *
 * 613 → תרי״ג,  5785 → תשפ״ה,  15 → ט״ו
 *
 * Two conventions are respected:
 *  - 15 and 16 are written ט״ו / ט״ז rather than י״ה / י״ו, which would spell
 *    divine names.
 *  - Gershayim (״) go before the final letter of a multi-letter numeral; a
 *    single letter takes a geresh (׳).
 */

const HUNDREDS = [
  ['ת', 400], ['ש', 300], ['ר', 200], ['ק', 100],
];
const TENS = [
  ['צ', 90], ['פ', 80], ['ע', 70], ['ס', 60], ['נ', 50],
  ['מ', 40], ['ל', 30], ['כ', 20], ['י', 10],
];
const ONES = [
  ['ט', 9], ['ח', 8], ['ז', 7], ['ו', 6], ['ה', 5],
  ['ד', 4], ['ג', 3], ['ב', 2], ['א', 1],
];

const VALUES = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
  'י': 10, 'כ': 20, 'ל': 30, 'מ': 40, 'נ': 50, 'ס': 60, 'ע': 70, 'פ': 80, 'צ': 90,
  'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400,
  'ך': 20, 'ם': 40, 'ן': 50, 'ף': 80, 'ץ': 90,
};

export const GERESH = '׳';
export const GERSHAYIM = '״';

/**
 * Render an integer as Hebrew letters.
 *
 * @param {number} n            positive integer
 * @param {object} [opts]
 * @param {boolean} [opts.marks=true]      add geresh / gershayim
 * @param {boolean} [opts.thousands=true]  render 1000s as a separate group
 */
export function toHebrewNumeral(n, opts = {}) {
  const { marks = true, thousands = true } = opts;
  let value = Math.trunc(n);
  if (!Number.isFinite(value) || value <= 0) return '';

  let out = '';

  if (thousands && value >= 1000) {
    const thousandsPart = Math.floor(value / 1000);
    value %= 1000;
    // Thousands are written as their own numeral followed by a geresh.
    out += toHebrewNumeral(thousandsPart, { marks: false, thousands: true }) + GERESH;
    if (value === 0) return out;
  }

  while (value >= 100) {
    const remaining = value;
    const [letter, amount] = HUNDREDS.find(([, a]) => a <= remaining);
    out += letter;
    value -= amount;
  }

  // ט״ו / ט״ז rather than the divine-name spellings.
  if (value === 15 || value === 16) {
    out += value === 15 ? 'טו' : 'טז';
    value = 0;
  }

  if (value >= 10) {
    const [letter, amount] = TENS.find(([, a]) => a <= value);
    out += letter;
    value -= amount;
  }

  if (value > 0) {
    const [letter] = ONES.find(([, a]) => a <= value);
    out += letter;
  }

  if (!marks) return out;
  const body = out.replace(new RegExp(`${GERESH}$`), '');
  if (out.length === 1) return out + GERESH;
  if (body.length < 2) return out;
  // Gershayim before the last letter of the final group.
  const cut = out.lastIndexOf(GERESH) + 1;
  const head = out.slice(0, cut);
  const tail = out.slice(cut);
  if (tail.length < 2) return out;
  return head + tail.slice(0, -1) + GERSHAYIM + tail.slice(-1);
}

/**
 * Parse Hebrew numeral text back to an integer.
 * Returns `null` when the input holds no Hebrew letters.
 */
export function fromHebrewNumeral(text) {
  if (!text) return null;
  const letters = String(text).replace(/[^א-ת]/g, '');
  if (!letters) return null;
  return letters.split('').reduce((sum, c) => sum + (VALUES[c] || 0), 0);
}

/** True when the string looks like a numeral rather than a word (has ״ or ׳). */
export function looksLikeNumeral(text) {
  return typeof text === 'string' && /[׳״'"]/.test(text) && /[א-ת]/.test(text);
}

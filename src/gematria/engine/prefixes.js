/**
 * Hebrew grammatical prefixes accepted when matching a word.
 *
 * Mirrors `VALID_PREFIXES` in backend_tools/sefaria_clean.py — the two must
 * agree or the Trend Tracker and the Word Race will report different counts
 * for the same word. The old frontend list omitted ה entirely, which
 * under-counted every definite noun in the Torah.
 */
export const VALID_PREFIXES = [
  // single letters
  'ו', 'ה', 'ב', 'כ', 'ל', 'מ', 'ש',
  // vav + X
  'וה', 'וב', 'וכ', 'ול', 'ומ', 'וש',
  // she + X
  'שב', 'שה', 'שכ', 'של', 'שמ',
  // preposition + definite article
  'בה', 'כה', 'לה', 'מה',
  // misc compounds
  'כש', 'מש', 'בש', 'ובה', 'ולה', 'וכה', 'ומה',
];

const PREFIX_SET = new Set(VALID_PREFIXES);

/**
 * Does `word` match `target`, optionally allowing a grammatical prefix?
 */
export function matchesWord(word, target, allowPrefixes) {
  if (word === target) return true;
  if (!allowPrefixes || word.length <= target.length) return false;
  if (!word.endsWith(target)) return false;
  return PREFIX_SET.has(word.slice(0, word.length - target.length));
}

/**
 * Anagrams (tzeruf) — rearrangements of a word's letters.
 *
 * The useful question isn't "list all 5,040 permutations" but "which of these
 * rearrangements are actually words in the Torah?". Every permutation of a word
 * has the *same* gematria value, so the answer falls straight out of the value
 * index: fetch the one bucket the word already belongs to and keep the entries
 * whose letters are a rearrangement of the input. No permutation generation and
 * no extra network requests.
 */

import { base, normalise } from './letters';

/** Order-independent signature of a word's letters, finals folded. */
export function letterKey(text) {
  return normalise(text)
    .split('')
    .map(base)
    .sort()
    .join('');
}

/** How many *distinct* orderings the letters admit: n! / ∏(count!) */
export function permutationCount(text) {
  const letters = normalise(text).split('').map(base);
  if (letters.length === 0) return 0;

  const counts = {};
  letters.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });

  const factorial = (n) => {
    let out = 1;
    for (let i = 2; i <= n; i += 1) out *= i;
    return out;
  };

  return Object.values(counts).reduce(
    (total, n) => total / factorial(n),
    factorial(letters.length),
  );
}

/**
 * Distinct permutations, capped.
 *
 * A seven-letter word already has 5,040 orderings and an eight-letter word
 * 40,320, so the cap is a hard requirement rather than a nicety. The caller is
 * told how many were withheld so the UI never implies it showed everything.
 */
export function permutations(text, limit = 500) {
  const letters = normalise(text).split('').map(base).sort();
  if (letters.length === 0 || letters.length > 9) {
    return { items: [], total: permutationCount(text), truncated: true };
  }

  const out = [];
  const used = new Array(letters.length).fill(false);
  const current = [];

  const walk = () => {
    if (out.length >= limit) return;
    if (current.length === letters.length) {
      out.push(current.join(''));
      return;
    }
    for (let i = 0; i < letters.length; i += 1) {
      if (used[i]) continue;
      // Skip duplicate letters at the same depth so each ordering appears once.
      if (i > 0 && letters[i] === letters[i - 1] && !used[i - 1]) continue;
      used[i] = true;
      current.push(letters[i]);
      walk();
      current.pop();
      used[i] = false;
      if (out.length >= limit) return;
    }
  };

  walk();
  const total = permutationCount(text);
  return { items: out, total, truncated: total > out.length };
}

/**
 * Pick the real Torah anagrams out of an already-fetched value bucket.
 *
 * @param {string} text            the word being explored
 * @param {object} bucket          the result of `lookup(value)`
 * @param {boolean} [includeSelf]  keep the word itself in the results
 */
export function anagramsIn(text, bucket, includeSelf = false) {
  const key = letterKey(text);
  const self = normalise(text);
  if (!key || !bucket) return [];

  return bucket.phrases
    .filter((p) => letterKey(p.phrase) === key)
    .filter((p) => includeSelf || normalise(p.phrase) !== self)
    .sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase));
}

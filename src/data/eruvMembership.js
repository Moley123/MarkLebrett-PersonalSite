/**
 * Which eruvim an address belongs to.
 *
 * The NW London eruvim genuinely overlap — Golders Green and NW London share
 * territory, and Brondesbury Park forms part of its neighbours' boundaries —
 * so "which eruv is this address in?" can have more than one right answer.
 * The page used to report the first match and stop, which quietly hid the
 * other.
 *
 * The point-in-polygon test itself needs a live Google map, so it stays in the
 * component. Everything here is about what to do with the resulting list, and
 * is therefore testable on its own.
 */

/**
 * Eruvim whose stored boundary is known to be unreliable.
 *
 * South Hampstead's ring cannot be closed from the KLBD KML — its two open
 * ends are 4,530 m apart with no connecting coordinates — so the stored
 * polygon overlaps its neighbours in places where the real eruv does not.
 *
 * The page's single-match behaviour used to paper over this by listing South
 * Hampstead last, so a verified boundary always won. Reporting every match
 * would undo that and start claiming addresses are in South Hampstead when
 * they are really only in Brondesbury Park. Hence the explicit rule below.
 */
export const UNRELIABLE_BOUNDARIES = ["South Hampstead Eruv"];

/**
 * Decide what to report from the raw list of matches.
 *
 * A single match is reported as-is, whatever its provenance — if the only
 * boundary containing an address is the unreliable one, saying so is better
 * than saying nothing. It is only dropped when a trustworthy boundary also
 * matches and would otherwise be presented as joint.
 *
 * @param {string[]} names matches, in the page's layer order
 * @returns {string[]} the names worth showing, order preserved
 */
export function resolveMembership(names, unreliable = UNRELIABLE_BOUNDARIES) {
  if (!Array.isArray(names) || names.length <= 1) return names || [];
  const trusted = names.filter((name) => !unreliable.includes(name));
  return trusted.length ? trusted : names;
}

/** `['A']` → `"A"`; `['A','B']` → `"A and B"`; `['A','B','C']` → `"A, B and C"`. */
export function describeMembership(names) {
  if (!Array.isArray(names) || !names.length) return '';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The sentence shown under the address box.
 *
 * Being in two eruvim at once is the interesting case and the one the user
 * asked to see, so it is called out rather than just listed.
 */
export function membershipMessage(names) {
  const shown = resolveMembership(names);
  if (!shown.length) return null;
  if (shown.length === 1) return `Inside ${shown[0]}!`;
  return `Inside ${describeMembership(shown)} — this address is covered by ${
    shown.length === 2 ? 'both' : 'all ' + shown.length
  }.`;
}

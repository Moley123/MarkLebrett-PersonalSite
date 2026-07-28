/**
 * Search hook — turns a target value (plus filters) into ranked results.
 *
 * Owns the debounce, the loading/error states and the Parsha filtering, so the
 * components stay presentational.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { lookup } from './index';
import { PARSHAS } from '../../utils/parshas';
import { isRefInParsha } from '../../utils/filter';

const DEBOUNCE_MS = 220;

export const IDLE = 'idle';
export const LOADING = 'loading';
export const READY = 'ready';
export const ERROR = 'error';

/**
 * @param {number|number[]} values  target value, or several for Colel mode
 * @param {object} options
 * @param {string} [options.parsha='All']
 * @param {boolean} [options.singleWordsOnly=false]
 * @param {boolean} [options.enabled=true]
 */
export function useSearch(values, { parsha = 'All', singleWordsOnly = false, enabled = true } = {}) {
  const [state, setState] = useState({ status: IDLE, results: [], error: null });
  const requestId = useRef(0);

  const targets = Array.isArray(values) ? values : [values];
  const key = `${targets.join(',')}|${parsha}|${singleWordsOnly}|${enabled}`;

  const run = useCallback(async () => {
    const id = requestId.current + 1;
    requestId.current = id;

    const wanted = targets.filter((v) => Number.isFinite(v) && v > 0);
    if (!enabled || wanted.length === 0) {
      setState({ status: IDLE, results: [], error: null });
      return;
    }

    setState((s) => ({ ...s, status: LOADING, error: null }));

    try {
      const buckets = await Promise.all(wanted.map(lookup));
      if (requestId.current !== id) return; // superseded

      const parshaRange = parsha === 'All' ? null : PARSHAS.find((p) => p.name === parsha);
      const inParsha = (ref) => !parshaRange || isRefInParsha(ref, parshaRange);

      const results = buckets.map((bucket) => {
        let phrases = bucket.phrases;
        if (singleWordsOnly) phrases = phrases.filter((p) => p.words === 1);
        if (parshaRange) {
          phrases = phrases
            .map((p) => {
              const occurrences = p.occurrences.filter((v) => inParsha(v.ref));
              return { ...p, occurrences, count: occurrences.length };
            })
            .filter((p) => p.count > 0);
        }

        let verses = singleWordsOnly ? [] : bucket.verses;
        if (parshaRange) verses = verses.filter((v) => inParsha(v.ref));

        return {
          value: bucket.value,
          phrases,
          verses,
          total: phrases.length + verses.length,
        };
      });

      setState({ status: READY, results, error: null });
    } catch (err) {
      if (requestId.current !== id) return;
      setState({ status: ERROR, results: [], error: err });
    }
    // `targets` is rebuilt each render; `key` is the stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const timer = setTimeout(run, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [run]);

  return { ...state, retry: run };
}

/**
 * "Structure match" results — Parshiyot whose verse count equals the value.
 * Cheap, synchronous, and independent of the index.
 */
export function parshaStatsFor(value) {
  if (!Number.isFinite(value) || value <= 0) return [];
  return PARSHAS.filter((p) => p.verse_count === value).map((p) => ({
    name: p.name,
    verseCount: p.verse_count,
    book: p.book,
  }));
}

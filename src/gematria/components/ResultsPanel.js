import React, { useMemo, useState } from 'react';
import Pagination from './Pagination';
import { ERROR, LOADING, READY, parshaStatsFor } from '../data/useSearch';
import { BOOKS_HE } from '../data';
import { normalise } from '../engine/letters';

const PER_PAGE = 12;

/** Sefaria's canonical ref form is dotted: "Genesis 1:1" → "Genesis.1.1". */
export function sefariaUrl(ref) {
  return `https://www.sefaria.org/${encodeURIComponent(ref.replace(/[\s:]/g, '.'))}`;
}

/**
 * Highlight `phrase` inside a pointed Hebrew verse.
 *
 * The verse carries nikud and cantillation but the phrase does not, so a plain
 * `indexOf` never matches. Walk the verse building a nikud-free projection and
 * map the hit back to the original character offsets.
 */
export function highlightPhrase(verseHe, phrase) {
  const needle = normalise(phrase);
  if (!needle || !verseHe) return [{ text: verseHe, match: false }];

  const positions = [];
  let stripped = '';
  for (let i = 0; i < verseHe.length; i += 1) {
    const ch = verseHe[i];
    if (/[א-ת]/.test(ch)) {
      stripped += ch;
      positions.push(i);
    }
  }

  const at = stripped.indexOf(needle);
  if (at === -1) return [{ text: verseHe, match: false }];

  const start = positions[at];
  const end = positions[at + needle.length - 1] + 1;
  // Pull any trailing marks that belong to the last matched letter.
  let stop = end;
  while (stop < verseHe.length && /[֑-ׇ]/.test(verseHe[stop])) stop += 1;

  return [
    { text: verseHe.slice(0, start), match: false },
    { text: verseHe.slice(start, stop), match: true },
    { text: verseHe.slice(stop), match: false },
  ].filter((part) => part.text);
}

const HebrewVerse = ({ verse, phrase }) => (
  <p className="gem-result-he-verse" dir="rtl" lang="he">
    {highlightPhrase(verse.he, phrase).map((part, i) =>
      part.match ? (
        // eslint-disable-next-line react/no-array-index-key
        <mark key={i} className="gem-mark">{part.text}</mark>
      ) : (
        // eslint-disable-next-line react/no-array-index-key
        <React.Fragment key={i}>{part.text}</React.Fragment>
      ),
    )}
  </p>
);

const RefLinks = ({ occurrences, limit = 8 }) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? occurrences : occurrences.slice(0, limit);
  return (
    <div className="gem-refs">
      {shown.map((v) => (
        <a key={v.ref} className="gem-ref" href={sefariaUrl(v.ref)} target="_blank" rel="noreferrer">
          {v.ref}
        </a>
      ))}
      {occurrences.length > limit && (
        <button
          type="button"
          className="gem-ref"
          style={{ cursor: 'pointer', background: 'transparent' }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'show fewer' : `+${occurrences.length - limit} more`}
        </button>
      )}
    </div>
  );
};

const ResultsPanel = ({ status, results, error, retry, value, methodName }) => {
  const [page, setPage] = useState(1);
  const [activeValue, setActiveValue] = useState(null);

  const current = useMemo(() => {
    if (!results.length) return null;
    return results.find((r) => r.value === activeValue) || results[0];
  }, [results, activeValue]);

  const stats = useMemo(() => parshaStatsFor(current?.value), [current]);

  // A flat, ranked list: structure matches, then whole verses, then phrases.
  const rows = useMemo(() => {
    if (!current) return [];
    return [
      ...stats.map((s) => ({ kind: 'stat', key: `stat-${s.name}`, stat: s })),
      ...current.verses.map((v) => ({ kind: 'verse', key: `verse-${v.ref}`, verse: v })),
      ...current.phrases.map((p) => ({ kind: 'phrase', key: `phrase-${p.phrase}`, phrase: p })),
    ];
  }, [current, stats]);

  const totalPages = Math.ceil(rows.length / PER_PAGE);
  const safePage = Math.min(page, Math.max(totalPages, 1));
  const pageRows = rows.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  if (status === ERROR) {
    return (
      <div className="gem-panel">
        <div className="gem-alert gem-alert--error" role="alert">
          <span aria-hidden="true">⚠</span>
          <div>
            <strong>Couldn&apos;t load the Torah index.</strong>
            <div style={{ marginTop: '0.3rem', opacity: 0.85 }}>
              {error?.message || 'The data files may still be deploying.'}
            </div>
            <button type="button" className="gem-btn" onClick={retry}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === LOADING) {
    return (
      <div className="gem-panel">
        <div className="gem-loading">
          <div className="gem-spinner" />
          <p>Searching the Torah…</p>
        </div>
      </div>
    );
  }

  if (status !== READY || !current) return null;

  return (
    <section className="gem-panel" aria-live="polite">
      <div className="gem-results-head">
        <h2>
          {rows.length.toLocaleString()} match{rows.length === 1 ? '' : 'es'} for {current.value}
        </h2>
        <span className="gem-chip gem-chip--blue">{methodName}</span>
      </div>

      {results.length > 1 && (
        <div className="gem-tabs" role="tablist" aria-label="Colel values">
          {results.map((r) => (
            <button
              key={r.value}
              type="button"
              role="tab"
              aria-selected={r.value === current.value}
              className={`gem-tab${r.value === current.value ? ' active' : ''}`}
              onClick={() => { setActiveValue(r.value); setPage(1); }}
            >
              {r.value === value ? `Value ${r.value}` : r.value}
              <span className="gem-tab-count">{r.total}</span>
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="gem-empty">
          Nothing in the Chumash carries this value. Try turning on ±1 (Colel), or
          widening the Parsha filter.
        </p>
      ) : (
        <>
          {pageRows.map((row) => {
            if (row.kind === 'stat') {
              return (
                <article key={row.key} className="gem-result gem-result--stat">
                  <div className="gem-result-phrase">פרשת {row.stat.name}</div>
                  <div className="gem-result-body">
                    <span className="gem-result-badge gem-badge--stat">Structure match</span>
                    <p className="gem-result-en">
                      Parshat {row.stat.name} ({BOOKS_HE[row.stat.book]}) contains exactly{' '}
                      {row.stat.verseCount} verses.
                    </p>
                  </div>
                </article>
              );
            }

            if (row.kind === 'verse') {
              return (
                <article key={row.key} className="gem-result gem-result--verse">
                  <div>
                    <span className="gem-result-badge gem-badge--verse">Whole verse</span>
                    <div className="gem-refs">
                      <a className="gem-ref" href={sefariaUrl(row.verse.ref)} target="_blank" rel="noreferrer">
                        {row.verse.ref}
                      </a>
                    </div>
                  </div>
                  <div className="gem-result-body">
                    <HebrewVerse verse={row.verse} phrase="" />
                    {row.verse.en && <p className="gem-result-en">{row.verse.en}</p>}
                    {row.verse.footnotes?.map((note) => (
                      <p key={note} className="gem-footnote">{note}</p>
                    ))}
                  </div>
                </article>
              );
            }

            const { phrase } = row;
            const first = phrase.occurrences[0];
            return (
              <article key={row.key} className="gem-result">
                <div className="gem-result-phrase" dir="rtl" lang="he">{phrase.phrase}</div>
                <div className="gem-result-body">
                  <RefLinks occurrences={phrase.occurrences} />
                  {first && <HebrewVerse verse={first} phrase={phrase.phrase} />}
                  {first?.en && <p className="gem-result-en">{first.en}</p>}
                  <p className="gem-result-meta">
                    {phrase.words === 1 ? 'Single word' : `${phrase.words} words`}
                    {' · '}
                    {phrase.count} occurrence{phrase.count === 1 ? '' : 's'}
                  </p>
                </div>
              </article>
            );
          })}

          <Pagination
            page={safePage}
            totalPages={totalPages}
            onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            itemLabel="Results"
          />
        </>
      )}
    </section>
  );
};

export default ResultsPanel;

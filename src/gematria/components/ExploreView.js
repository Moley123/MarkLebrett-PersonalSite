import React, { useEffect, useMemo, useRef, useState } from 'react';
import HebrewKeyboard from './HebrewKeyboard';
import { sefariaUrl } from './ResultsPanel';
import { anagramsIn, permutations } from '../engine/anagrams';
import { allTemurot } from '../engine/temurah';
import { hechrachi } from '../engine/methods';
import { hasHebrew, normaliseWords } from '../engine/letters';
import { toHebrewNumeral } from '../engine/numerals';
import { loadVocabByInitial, lookup } from '../data';

const TABS = [
  { key: 'anagrams', label: 'Anagrams', icon: '🔀' },
  { key: 'temurah', label: 'Temurah', icon: '🔄' },
  { key: 'notarikon', label: 'Notarikon', icon: '🔡' },
];

const SUGGESTIONS_PER_LETTER = 6;

const ExploreView = ({ onSearchValue }) => {
  const [tab, setTab] = useState('anagrams');
  const [text, setText] = useState('');
  const [bucket, setBucket] = useState(null);
  const [vocab, setVocab] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [showAllPerms, setShowAllPerms] = useState(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const clean = normaliseWords(text);
  const singleWord = clean && !clean.includes(' ');
  const value = hechrachi(clean);

  // ── Anagrams: one bucket fetch, since every ordering shares the value ────
  useEffect(() => {
    if (tab !== 'anagrams' || !singleWord || value <= 0) return undefined;
    let cancelled = false;
    setStatus('loading');
    setError(null);
    lookup(value)
      .then((result) => {
        if (cancelled || !mounted.current) return;
        setBucket(result);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled || !mounted.current) return;
        setError(err);
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [tab, singleWord, value]);

  // ── Notarikon needs the Torah vocabulary ────────────────────────────────
  useEffect(() => {
    if (tab !== 'notarikon' || vocab) return undefined;
    let cancelled = false;
    setStatus('loading');
    setError(null);
    loadVocabByInitial()
      .then((data) => {
        if (cancelled || !mounted.current) return;
        setVocab(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled || !mounted.current) return;
        setError(err);
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [tab, vocab]);

  useEffect(() => { setShowAllPerms(false); }, [text]);

  const realAnagrams = useMemo(
    () => (bucket && singleWord ? anagramsIn(clean, bucket) : []),
    [bucket, clean, singleWord],
  );

  const perms = useMemo(
    () => (singleWord ? permutations(clean, showAllPerms ? 2000 : 60) : null),
    [clean, singleWord, showAllPerms],
  );

  const temurot = useMemo(() => allTemurot(clean), [clean]);

  const notarikon = useMemo(() => {
    if (!vocab || !clean) return [];
    return clean.replace(/\s/g, '').split('').map((letter, i) => ({
      letter,
      position: i,
      options: (vocab[letter] || []).slice(0, SUGGESTIONS_PER_LETTER),
    }));
  }, [vocab, clean]);

  const handleKey = (char) => {
    setText((v) => (char === 'BACKSPACE' ? v.slice(0, -1) : v + char));
  };

  const busy = status === 'loading';

  return (
    <>
      <section className="gem-panel">
        <h2 className="gem-panel-title">🧭 Explore</h2>
        <p className="gem-panel-sub">
          Three classical ways of reading a word beyond its value: rearranging its
          letters, substituting them, and expanding them.
        </p>

        <div className="gem-field">
          <label className="gem-label" htmlFor="gem-explore">Hebrew word or phrase</label>
          <input
            id="gem-explore"
            className="gem-input gem-input--lg gem-input--hebrew"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="שלום"
            dir="rtl"
            lang="he"
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        <HebrewKeyboard onKeyPress={handleKey} label="Hebrew keyboard for the explorer" />

        {value > 0 && (
          <div className="gem-chips" style={{ marginTop: '1rem' }}>
            <span className="gem-chip gem-chip--blue">Value {value}</span>
            <span className="gem-chip gem-chip--blue">{toHebrewNumeral(value)}</span>
            <button
              type="button"
              className="gem-chip"
              style={{ cursor: 'pointer' }}
              onClick={() => onSearchValue(value)}
            >
              Search {value} →
            </button>
          </div>
        )}
      </section>

      <section className="gem-panel">
        <div className="gem-tabs" role="tablist" aria-label="Explore modes">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`gem-tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span aria-hidden="true">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {!hasHebrew(text) && (
          <p className="gem-empty">Enter a Hebrew word to begin.</p>
        )}

        {status === 'error' && (
          <div className="gem-alert gem-alert--error" role="alert">
            <span aria-hidden="true">⚠</span>
            <div>
              <strong>Couldn&apos;t load the Torah data.</strong>
              <div style={{ marginTop: '0.3rem', opacity: 0.85 }}>{error?.message}</div>
            </div>
          </div>
        )}

        {/* ── Anagrams ── */}
        {tab === 'anagrams' && hasHebrew(text) && (
          <>
            {!singleWord ? (
              <p className="gem-empty">Anagrams work on a single word — remove the spaces.</p>
            ) : (
              <>
                <p className="gem-panel-sub">
                  Every rearrangement of these letters has the same value ({value}), so
                  the real ones are found by scanning that value&apos;s entries in the
                  Chumash.
                </p>

                {busy && <div className="gem-loading"><div className="gem-spinner" /></div>}

                {status === 'ready' && (
                  <>
                    <h3 className="gem-panel-title" style={{ fontSize: '0.9rem' }}>
                      Found in the Chumash
                    </h3>
                    {realAnagrams.length === 0 ? (
                      <p className="gem-empty">
                        No other arrangement of these letters appears in the Five Books.
                      </p>
                    ) : (
                      realAnagrams.map((a) => (
                        <article key={a.phrase} className="gem-result">
                          <div className="gem-result-phrase" dir="rtl" lang="he">{a.phrase}</div>
                          <div className="gem-result-body">
                            <div className="gem-refs">
                              {a.occurrences.slice(0, 6).map((v) => (
                                <a
                                  key={v.ref}
                                  className="gem-ref"
                                  href={sefariaUrl(v.ref)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {v.ref}
                                </a>
                              ))}
                            </div>
                            {a.occurrences[0]?.en && (
                              <p className="gem-result-en">{a.occurrences[0].en}</p>
                            )}
                            <p className="gem-result-meta">
                              {a.count} occurrence{a.count === 1 ? '' : 's'}
                            </p>
                          </div>
                        </article>
                      ))
                    )}
                  </>
                )}

                {perms && perms.items.length > 0 && (
                  <>
                    <h3 className="gem-panel-title" style={{ fontSize: '0.9rem', marginTop: '1.5rem' }}>
                      All arrangements
                    </h3>
                    <p className="gem-panel-sub">
                      {perms.total.toLocaleString()} distinct ordering
                      {perms.total === 1 ? '' : 's'}
                      {perms.truncated && ` — showing the first ${perms.items.length}`}.
                    </p>
                    <div className="gem-chips">
                      {perms.items.map((p) => (
                        <span
                          key={p}
                          className={`gem-chip${p === clean ? ' gem-chip--blue' : ''}`}
                          dir="rtl"
                          lang="he"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    {perms.truncated && !showAllPerms && perms.total <= 2000 && (
                      <button
                        type="button"
                        className="gem-btn"
                        style={{ marginTop: '0.85rem' }}
                        onClick={() => setShowAllPerms(true)}
                      >
                        Show all {perms.total.toLocaleString()}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── Temurah ── */}
        {tab === 'temurah' && hasHebrew(text) && (
          <>
            <p className="gem-panel-sub">
              Each table swaps every letter for another by a fixed rule. The value of
              the result is often the point.
            </p>
            <div className="gem-table-wrap">
              <table className="gem-table">
                <thead>
                  <tr>
                    <th scope="col">Table</th>
                    <th scope="col">Result</th>
                    <th scope="col">Value</th>
                    <th scope="col"> </th>
                  </tr>
                </thead>
                <tbody>
                  {temurot.map((t) => {
                    const v = hechrachi(t.result);
                    return (
                      <tr key={t.key}>
                        <th scope="row" style={{ fontWeight: 600, color: 'var(--text-dim)' }}>
                          {t.name}
                          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 400 }}>
                            {t.hebrew}
                          </div>
                        </th>
                        <td className="gem-cell-he">{t.result}</td>
                        <td>{v}</td>
                        <td>
                          {v > 0 && (
                            <button
                              type="button"
                              className="gem-ref"
                              style={{ cursor: 'pointer' }}
                              onClick={() => onSearchValue(v)}
                            >
                              search
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="gem-stack" style={{ marginTop: '1rem' }}>
              {temurot.map((t) => (
                <p key={t.key} className="gem-result-meta" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  <strong style={{ color: 'var(--text-dim)' }}>{t.name}</strong> — {t.description}
                </p>
              ))}
            </div>
          </>
        )}

        {/* ── Notarikon ── */}
        {tab === 'notarikon' && hasHebrew(text) && (
          <>
            <p className="gem-panel-sub">
              Read each letter as the opening of another word. These are the most
              frequent Chumash words beginning with each letter.
            </p>

            {busy && <div className="gem-loading"><div className="gem-spinner" /></div>}

            {status === 'ready' && notarikon.map((row) => (
              <article key={`${row.letter}-${row.position}`} className="gem-result">
                <div className="gem-result-phrase" dir="rtl" lang="he">{row.letter}</div>
                <div className="gem-result-body">
                  {row.options.length === 0 ? (
                    <p className="gem-result-en">No Chumash word begins with this letter.</p>
                  ) : (
                    <div className="gem-chips">
                      {row.options.map((o) => (
                        <a
                          key={o.word}
                          className="gem-chip gem-chip--blue"
                          href={sefariaUrl(o.ref)}
                          target="_blank"
                          rel="noreferrer"
                          dir="rtl"
                          lang="he"
                          title={`${o.count} occurrences — first at ${o.ref}`}
                        >
                          {o.word}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </>
        )}
      </section>
    </>
  );
};

export default ExploreView;

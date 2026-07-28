import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import HebrewKeyboard from './HebrewKeyboard';
import Pagination from './Pagination';
import { sefariaUrl } from './ResultsPanel';
import { BOOKS, BOOKS_HE, loadVerses } from '../data';
import { matchesWord } from '../engine/prefixes';
import { normaliseWords } from '../engine/letters';

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7'];
const SAMPLE_RATE = 50;
const PER_PAGE = 12;
const DEBOUNCE_MS = 300;

const TrendsView = () => {
  const [verses, setVerses] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [inputs, setInputs] = useState(['']);
  const [debounced, setDebounced] = useState(['']);
  const [activeIndex, setActiveIndex] = useState(0);
  const [usePrefixes, setUsePrefixes] = useState(true);
  const [page, setPage] = useState(1);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const load = () => {
    setStatus('loading');
    setError(null);
    loadVerses()
      .then((data) => {
        if (!mounted.current) return;
        setVerses(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (!mounted.current) return;
        setError(err);
        setStatus('error');
      });
  };

  useEffect(load, []);

  // Scanning ~5,800 verses per word on every keystroke made typing stutter.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(inputs), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputs]);

  /** Plain (unpointed) word lists, computed once per dataset. */
  const wordLists = useMemo(
    () => (verses ? verses.map((v) => normaliseWords(v.he).split(' ')) : null),
    [verses],
  );

  const { chartData, matches } = useMemo(() => {
    const words = debounced.map((w) => normaliseWords(w)).filter(Boolean);
    if (!verses || !wordLists || words.length === 0) return { chartData: [], matches: [] };

    const counts = Object.fromEntries(words.map((w) => [w, 0]));
    const found = [];
    const points = [];

    verses.forEach((verse, i) => {
      const verseWords = wordLists[i];
      words.forEach((target) => {
        let hits = 0;
        verseWords.forEach((w) => {
          if (matchesWord(w, target, usePrefixes)) hits += 1;
        });
        if (hits > 0) {
          counts[target] += hits;
          found.push({ verse, word: target, count: hits });
        }
      });

      if (i % SAMPLE_RATE === 0 || i === verses.length - 1) {
        points.push({ name: verse.ref, book: verse.book, ...counts });
      }
    });

    found.sort((a, b) => a.verse.index - b.verse.index);
    return { chartData: points, matches: found };
  }, [verses, wordLists, debounced, usePrefixes]);

  useEffect(() => { setPage(1); }, [debounced, usePrefixes]);

  const byBook = useMemo(() => {
    const stats = Object.fromEntries(BOOKS.map((b) => [b, 0]));
    matches.forEach((m) => { stats[m.verse.book] += m.count; });
    return stats;
  }, [matches]);

  const total = matches.reduce((n, m) => n + m.count, 0);
  const totalPages = Math.ceil(matches.length / PER_PAGE);
  const pageRows = matches.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const setInput = (i, value) => setInputs((v) => v.map((w, j) => (j === i ? value : w)));

  const handleKey = (char) => {
    setInputs((v) => v.map((w, j) => {
      if (j !== activeIndex) return w;
      return char === 'BACKSPACE' ? w.slice(0, -1) : w + char;
    }));
  };

  const downloadCSV = () => {
    const rows = matches.map((m) => [
      m.verse.ref, m.verse.book, m.word, m.count,
      `"${(m.verse.he || '').replace(/"/g, '""')}"`,
      `"${(m.verse.en || '').replace(/"/g, '""')}"`,
    ]);
    const csv = `﻿${[
      ['Reference', 'Book', 'Word', 'Occurrences', 'Hebrew', 'English'].join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `gematria-trends-${debounced.filter(Boolean).join('-') || 'export'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (status === 'error') {
    return (
      <div className="gem-panel">
        <div className="gem-alert gem-alert--error" role="alert">
          <span aria-hidden="true">⚠</span>
          <div>
            <strong>Couldn&apos;t load the Torah text.</strong>
            <div style={{ marginTop: '0.3rem', opacity: 0.85 }}>{error?.message}</div>
            <button type="button" className="gem-btn" onClick={load}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="gem-panel">
        <div className="gem-loading">
          <div className="gem-spinner" />
          <p>Loading the Torah text…</p>
        </div>
      </div>
    );
  }

  const activeWords = debounced.map((w) => normaliseWords(w)).filter(Boolean);

  return (
    <>
      <section className="gem-panel">
        <h2 className="gem-panel-title">📈 Trend Tracker</h2>
        <p className="gem-panel-sub">
          Track how often a word appears as the Torah progresses. Compare up to five
          words at once.
        </p>

        <div className="gem-compare-grid">
          {inputs.map((word, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div className="gem-field" key={i}>
              <label className="gem-label" htmlFor={`gem-trend-${i}`}>
                Word {i + 1}
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => setInputs((v) => v.filter((_, j) => j !== i))}
                    style={{
                      background: 'none', border: 'none', color: 'var(--red)',
                      cursor: 'pointer', float: 'right', fontWeight: 700,
                    }}
                    aria-label={`Remove word ${i + 1}`}
                  >
                    ×
                  </button>
                )}
              </label>
              <input
                id={`gem-trend-${i}`}
                className="gem-input gem-input--hebrew"
                value={word}
                onChange={(e) => setInput(i, e.target.value)}
                onFocus={() => setActiveIndex(i)}
                placeholder="משה"
                dir="rtl"
                lang="he"
              />
            </div>
          ))}
        </div>

        <div className="gem-toggles">
          {inputs.length < COLORS.length && (
            <button type="button" className="gem-btn" onClick={() => setInputs((v) => [...v, ''])}>
              + Compare another
            </button>
          )}
          <label className={`gem-toggle${usePrefixes ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={usePrefixes}
              onChange={(e) => setUsePrefixes(e.target.checked)}
            />
            Include prefixes (ו, ה, ב, כ, ל, מ, ש…)
          </label>
        </div>

        <HebrewKeyboard onKeyPress={handleKey} label="Hebrew keyboard for the trend tracker" />

        {activeWords.length > 0 && (
          <div className="gem-chart">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="name" tick={false} stroke="#475569" />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} stroke="#475569" />
                <Tooltip
                  contentStyle={{
                    background: '#0d1117',
                    border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: 10,
                    color: '#e2e8f0',
                  }}
                  labelFormatter={(label) => `Up to ${label}`}
                  formatter={(v, name) => [v, `${name} (running total)`]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {activeWords.map((word, i) => (
                  <Line
                    key={word}
                    type="monotone"
                    dataKey={word}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {matches.length > 0 && (
        <>
          <section className="gem-panel">
            <h2 className="gem-panel-title">📊 Breakdown by book</h2>
            <div className="gem-value-hero" style={{ marginBottom: '1rem' }}>
              <div>
                <div className="gem-value-caption">Total appearances</div>
                <div className="gem-value-number">{total}</div>
              </div>
            </div>
            <div className="gem-table-wrap">
              <table className="gem-table">
                <thead>
                  <tr><th scope="col">Book</th><th scope="col">Count</th></tr>
                </thead>
                <tbody>
                  {BOOKS.map((book) => (
                    <tr key={book}>
                      <th scope="row" style={{ fontWeight: 600, color: 'var(--text-dim)' }}>
                        {BOOKS_HE[book]}
                      </th>
                      <td>{byBook[book]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="gem-panel">
            <div className="gem-results-head">
              <h2>{matches.length.toLocaleString()} verses</h2>
              <button type="button" className="gem-btn" onClick={downloadCSV}>
                📥 Download CSV
              </button>
            </div>

            {pageRows.map((m) => (
              <article key={`${m.verse.ref}-${m.word}`} className="gem-result">
                <div>
                  <div className="gem-refs">
                    <a className="gem-ref" href={sefariaUrl(m.verse.ref)} target="_blank" rel="noreferrer">
                      {m.verse.ref}
                    </a>
                  </div>
                  {m.count > 1 && <p className="gem-result-meta">{m.count}×</p>}
                </div>
                <div className="gem-result-body">
                  <p className="gem-result-he-verse" dir="rtl" lang="he">{m.verse.he}</p>
                  {m.verse.en && <p className="gem-result-en">{m.verse.en}</p>}
                </div>
              </article>
            ))}

            <Pagination page={page} totalPages={totalPages} onChange={setPage} itemLabel="Verses" />
          </section>
        </>
      )}
    </>
  );
};

export default TrendsView;

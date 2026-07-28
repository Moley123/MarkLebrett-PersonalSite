import React, { useMemo, useState } from 'react';
import HebrewKeyboard from './HebrewKeyboard';
import { METHODS, calculateAll } from '../engine/methods';
import { toHebrewNumeral } from '../engine/numerals';

/**
 * Side-by-side comparison across every method.
 *
 * This is the actual research workflow the old tool couldn't express: put two
 * or more words next to each other and see which systems make them equal.
 * Matching cells are highlighted automatically.
 */
const CompareView = () => {
  const [words, setWords] = useState(['', '']);
  const [activeIndex, setActiveIndex] = useState(0);

  const filled = words.map((w) => w.trim()).filter(Boolean);
  const columns = useMemo(
    () => words.map((w) => ({ word: w, values: calculateAll(w) })),
    [words],
  );

  // A method "matches" when every non-empty word shares the same value.
  const matches = useMemo(() => {
    const out = {};
    if (filled.length < 2) return out;
    METHODS.forEach((m) => {
      const vals = columns.filter((c) => c.word.trim()).map((c) => c.values[m.key]);
      out[m.key] = vals.every((v) => v === vals[0] && v > 0);
    });
    return out;
  }, [columns, filled.length]);

  const matchCount = Object.values(matches).filter(Boolean).length;

  const setWord = (i, value) => setWords((ws) => ws.map((w, j) => (j === i ? value : w)));

  const handleKey = (char) => {
    setWords((ws) => ws.map((w, j) => {
      if (j !== activeIndex) return w;
      return char === 'BACKSPACE' ? w.slice(0, -1) : w + char;
    }));
  };

  return (
    <>
      <section className="gem-panel">
        <h2 className="gem-panel-title">⚖️ Compare words</h2>
        <p className="gem-panel-sub">
          Enter two or more words to see every method side by side. Any method where
          they come out equal is highlighted.
        </p>

        <div className="gem-compare-grid">
          {words.map((word, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div className="gem-field" key={i}>
              <label className="gem-label" htmlFor={`gem-compare-${i}`}>
                Word {i + 1}
              </label>
              <input
                id={`gem-compare-${i}`}
                className="gem-input gem-input--hebrew"
                value={word}
                onChange={(e) => setWord(i, e.target.value)}
                onFocus={() => setActiveIndex(i)}
                placeholder="עברית"
                dir="rtl"
                lang="he"
              />
            </div>
          ))}
        </div>

        <div className="gem-btn-row">
          {words.length < 4 && (
            <button type="button" className="gem-btn" onClick={() => setWords((w) => [...w, ''])}>
              + Add word
            </button>
          )}
          {words.length > 2 && (
            <button
              type="button"
              className="gem-btn"
              onClick={() => setWords((w) => w.slice(0, -1))}
            >
              − Remove last
            </button>
          )}
        </div>

        <HebrewKeyboard onKeyPress={handleKey} label="Hebrew keyboard for comparison" />

        {filled.length >= 2 && (
          <p className="gem-match-note">
            {matchCount > 0
              ? `✓ These words match under ${matchCount} method${matchCount === 1 ? '' : 's'}.`
              : 'No method makes these words equal.'}
          </p>
        )}
      </section>

      {filled.length > 0 && (
        <section className="gem-panel">
          <h2 className="gem-panel-title">Method breakdown</h2>
          <div className="gem-table-wrap">
            <table className="gem-table">
              <thead>
                <tr>
                  <th scope="col">Method</th>
                  {words.map((word, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <th scope="col" key={i} className="gem-cell-he">
                      {word || `Word ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METHODS.map((method) => (
                  <tr key={method.key}>
                    <th scope="row" style={{ fontWeight: 600, color: 'var(--text-dim)' }}>
                      {method.name}
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 400 }}>
                        {method.hebrew}
                      </div>
                    </th>
                    {columns.map((col, i) => (
                      <td
                        // eslint-disable-next-line react/no-array-index-key
                        key={i}
                        className={matches[method.key] ? 'gem-cell-match' : undefined}
                      >
                        {col.values[method.key] || '—'}
                        {method.key === 'hechrachi' && col.values[method.key] > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', direction: 'rtl' }}>
                            {toHebrewNumeral(col.values[method.key])}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
};

export default CompareView;

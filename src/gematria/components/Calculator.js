import React, { useMemo } from 'react';
import HebrewKeyboard from './HebrewKeyboard';
import MethodGrid from './MethodGrid';
import ResultsPanel from './ResultsPanel';
import { METHODS_BY_KEY, acronyms } from '../engine/methods';
import { toHebrewNumeral } from '../engine/numerals';
import { hasHebrew } from '../engine/letters';
import { useSearch } from '../data/useSearch';
import { PARSHAS } from '../../utils/parshas';
import commonDb from '../../data/common_gematria.json';

const SUGGESTIONS = [
  { icon: '🔢', title: 'Search by number', body: 'What carries the value 613?', q: '613' },
  { icon: '📖', title: 'Search by word', body: 'What else equals תורה?', q: 'תורה' },
  { icon: '✨', title: 'A famous equivalence', body: 'Why does אחד relate to אהבה?', q: 'אהבה' },
];

const Calculator = ({
  text, onTextChange, method, onMethodChange, value,
  searchEnabled, onSearchEnabledChange,
  colel, onColelChange,
  singleWords, onSingleWordsChange,
  parsha, onParshaChange,
}) => {
  const methodDef = METHODS_BY_KEY[method];

  const targets = useMemo(
    () => (colel ? [value, value - 1, value + 1] : [value]),
    [colel, value],
  );

  const { status, results, error, retry } = useSearch(targets, {
    parsha,
    singleWordsOnly: singleWords,
    enabled: searchEnabled && value > 0,
  });

  const acro = useMemo(() => acronyms(text), [text]);

  const commonMatches = useMemo(
    () => (value > 0 ? commonDb[String(value)] || [] : []),
    [value],
  );

  const handleKey = (char) => {
    onTextChange(char === 'BACKSPACE' ? text.slice(0, -1) : text + char);
  };

  const showKeyboard = !/^\d+$/.test(text.trim());

  return (
    <>
      <section className="gem-panel">
        <div className="gem-field">
          <label className="gem-label" htmlFor="gem-input">
            Hebrew text, a number, or a Hebrew numeral
          </label>
          <input
            id="gem-input"
            className={`gem-input gem-input--lg${hasHebrew(text) || !text ? ' gem-input--hebrew' : ''}`}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="תורה"
            dir="auto"
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        {showKeyboard && <HebrewKeyboard onKeyPress={handleKey} />}

        <div className="gem-value-hero">
          <div>
            <div className="gem-value-caption">{methodDef?.short || 'Value'}</div>
            <div className="gem-value-number">{value}</div>
          </div>
          {value > 0 && (
            <div className="gem-value-numeral">
              {toHebrewNumeral(value)}
              <small>In letters</small>
            </div>
          )}
        </div>

        {/* The method grid is only meaningful for actual Hebrew — a typed
            number or numeral has one value, not fifteen. */}
        {hasHebrew(text) && (
          <MethodGrid text={text} activeMethod={method} onSelectMethod={onMethodChange} />
        )}
      </section>

      {!text && (
        <section className="gem-panel">
          <h2 className="gem-panel-title">Start here</h2>
          <div className="gem-suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.q}
                type="button"
                className="gem-suggestion"
                onClick={() => { onTextChange(s.q); onSearchEnabledChange(true); }}
              >
                <span className="gem-suggestion-icon" aria-hidden="true">{s.icon}</span>
                <span>
                  <strong>{s.title}</strong>
                  <p>{s.body}</p>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {acro && (
        <section className="gem-panel">
          <h2 className="gem-panel-title">🔤 Acronyms</h2>
          <p className="gem-panel-sub">
            The first and last letters of each of the {acro.words} words, read as
            words in their own right.
          </p>
          <div className="gem-compare-grid">
            {[
              { label: 'Roshei teivot', hint: 'first letters', data: acro.roshei },
              { label: 'Sofei teivot', hint: 'last letters', data: acro.sofei },
            ].map(({ label, hint, data }) => (
              <div key={label} className="gem-value-hero" style={{ marginTop: 0 }}>
                <div>
                  <div className="gem-value-caption">{label} · {hint}</div>
                  <div style={{ fontSize: '1.9rem', fontWeight: 700, direction: 'rtl' }}>
                    {data.letters}
                  </div>
                </div>
                <div>
                  <div className="gem-value-caption">Value</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#93c5fd' }}>
                    {data.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {commonMatches.length > 0 && (
        <section className="gem-panel">
          <h2 className="gem-panel-title">💡 {value} is also</h2>
          <div className="gem-chips">
            {commonMatches.map((match) => (
              <span key={match} className="gem-chip">{match}</span>
            ))}
          </div>
        </section>
      )}

      {value > 0 && (
        <section className="gem-panel">
          <h2 className="gem-panel-title">Search the Chumash</h2>
          <p className="gem-panel-sub">
            Every word and phrase of up to three words in the Five Books, indexed by value.
          </p>

          <div className="gem-toggles">
            <label className={`gem-toggle${searchEnabled ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={searchEnabled}
                onChange={(e) => onSearchEnabledChange(e.target.checked)}
              />
              Search the text
            </label>

            <label className={`gem-toggle${colel ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={colel}
                onChange={(e) => onColelChange(e.target.checked)}
                disabled={!searchEnabled}
              />
              ±1 (Colel)
            </label>

            <label className={`gem-toggle${singleWords ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={singleWords}
                onChange={(e) => onSingleWordsChange(e.target.checked)}
                disabled={!searchEnabled}
              />
              Single words only
            </label>

            <select
              className="gem-select"
              value={parsha}
              onChange={(e) => onParshaChange(e.target.value)}
              disabled={!searchEnabled}
              aria-label="Filter by Parsha"
            >
              <option value="All">Entire Torah</option>
              {PARSHAS.map((p) => (
                <option key={p.name} value={p.name}>Parshat {p.name}</option>
              ))}
            </select>
          </div>
        </section>
      )}

      {searchEnabled && value > 0 && (
        <ResultsPanel
          status={status}
          results={results}
          error={error}
          retry={retry}
          value={value}
          methodName={methodDef?.name || 'Standard'}
          parsha={parsha}
        />
      )}
    </>
  );
};

export default Calculator;

import React, { useMemo, useState } from 'react';
import HebrewKeyboard from './HebrewKeyboard';
import ResultsPanel from './ResultsPanel';
import { METHODS_BY_KEY } from '../engine/methods';
import { toHebrewNumeral } from '../engine/numerals';
import { useSearch } from '../data/useSearch';

/**
 * Bridge / wedding calculator: given a base (names) and a target (a phrase like
 * מזל טוב), find words whose value closes the gap.
 */
const BridgeView = ({ method }) => {
  const [base, setBase] = useState('');
  const [target, setTarget] = useState('');
  const [activeField, setActiveField] = useState('base');
  const [singleWords, setSingleWords] = useState(true);

  const methodDef = METHODS_BY_KEY[method] || METHODS_BY_KEY.hechrachi;
  const baseValue = methodDef.fn(base);
  const targetValue = methodDef.fn(target);
  const gap = Math.abs(targetValue - baseValue);
  const ready = baseValue > 0 && targetValue > 0 && gap > 0;

  const { status, results, error, retry } = useSearch(useMemo(() => [gap], [gap]), {
    singleWordsOnly: singleWords,
    enabled: ready,
  });

  const handleKey = (char) => {
    const apply = (v) => (char === 'BACKSPACE' ? v.slice(0, -1) : v + char);
    if (activeField === 'base') setBase(apply); else setTarget(apply);
  };

  return (
    <>
      <section className="gem-panel">
        <h2 className="gem-panel-title">💍 Bridge calculator</h2>
        <p className="gem-panel-sub">
          Enter the names you are starting from and the phrase you want to reach.
          We&apos;ll find the words that close the gap between them.
        </p>

        <div className="gem-compare-grid">
          <div className="gem-field">
            <label className="gem-label" htmlFor="gem-bridge-base">
              1. Names (base) {activeField === 'base' && '●'}
            </label>
            <input
              id="gem-bridge-base"
              className="gem-input gem-input--hebrew"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              onFocus={() => setActiveField('base')}
              placeholder="משה חנה"
              dir="rtl"
              lang="he"
            />
            <span className="gem-result-meta">{baseValue}</span>
          </div>

          <div className="gem-field">
            <label className="gem-label" htmlFor="gem-bridge-target">
              2. Goal (target) {activeField === 'target' && '●'}
            </label>
            <input
              id="gem-bridge-target"
              className="gem-input gem-input--hebrew"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onFocus={() => setActiveField('target')}
              placeholder="מזל טוב"
              dir="rtl"
              lang="he"
            />
            <span className="gem-result-meta">{targetValue}</span>
          </div>
        </div>

        <HebrewKeyboard onKeyPress={handleKey} label="Hebrew keyboard for the bridge calculator" />

        {ready ? (
          <div className="gem-value-hero" style={{ marginTop: '1.25rem' }}>
            <div>
              <div className="gem-value-caption">Gap to bridge</div>
              <div className="gem-value-number">{gap}</div>
            </div>
            <div className="gem-value-numeral">
              {toHebrewNumeral(gap)}
              <small>In letters</small>
            </div>
          </div>
        ) : (
          <p className="gem-empty">Fill in both fields to calculate the bridge.</p>
        )}

        {ready && (
          <div className="gem-toggles">
            <label className={`gem-toggle${singleWords ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={singleWords}
                onChange={(e) => setSingleWords(e.target.checked)}
              />
              Single words only
            </label>
          </div>
        )}
      </section>

      {ready && (
        <ResultsPanel
          status={status}
          results={results}
          error={error}
          retry={retry}
          value={gap}
          methodName={`Bridge · ${methodDef.name}`}
        />
      )}
    </>
  );
};

export default BridgeView;

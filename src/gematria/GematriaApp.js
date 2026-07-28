import React, { Suspense, lazy, useCallback, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';

import Calculator from './components/Calculator';
import CompareView from './components/CompareView';
import BridgeView from './components/BridgeView';
import DateView from './components/DateView';
import { DEFAULT_METHOD, METHODS_BY_KEY } from './engine/methods';
import { fromHebrewNumeral, looksLikeNumeral } from './engine/numerals';
import { prefetch } from './data';
import './GematriaApp.css';

// Trend Tracker and Word Race each pull in Recharts plus their own datasets.
// Splitting them out keeps that weight off everyone who only wants to
// calculate a value.
const TrendsView = lazy(() => import('./components/TrendsView'));
const WordRace = lazy(() => import('./components/WordRace'));

const MODES = [
  { key: 'calc', label: 'Calculator', icon: '🔢' },
  { key: 'compare', label: 'Compare', icon: '⚖️' },
  { key: 'bridge', label: 'Bridge', icon: '💍' },
  { key: 'dates', label: 'Dates', icon: '📅' },
  { key: 'trends', label: 'Trends', icon: '📈' },
  { key: 'race', label: 'Word Race', icon: '🏆' },
];

const DESCRIPTION =
  'Calculate Hebrew gematria across fifteen methods, search every word and '
  + 'phrase of the Chumash by value, compare words side by side, and convert '
  + 'Hebrew dates.';

/** Resolve whatever the user typed into a number. */
export function resolveValue(text, methodKey) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (looksLikeNumeral(trimmed)) return fromHebrewNumeral(trimmed) || 0;
  const method = METHODS_BY_KEY[methodKey] || METHODS_BY_KEY[DEFAULT_METHOD];
  return method.fn(trimmed);
}

const GematriaApp = () => {
  const [params, setParams] = useSearchParams();

  // ── URL is the single source of truth, so every view is shareable ────────
  const mode = MODES.some((m) => m.key === params.get('mode')) ? params.get('mode') : 'calc';
  const text = params.get('q') || '';
  const method = METHODS_BY_KEY[params.get('m')] ? params.get('m') : DEFAULT_METHOD;
  const searchEnabled = params.get('search') !== '0';
  const colel = params.get('colel') === '1';
  const singleWords = params.get('single') === '1';
  const parsha = params.get('parsha') || 'All';

  const value = useMemo(() => resolveValue(text, method), [text, method]);

  const update = useCallback((changes) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([key, val]) => {
        if (val === null || val === undefined || val === '' || val === false) next.delete(key);
        else next.set(key, val === true ? '1' : String(val));
      });
      return next;
    }, { replace: true });
  }, [setParams]);

  const reset = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setParams]);

  const searchValue = useCallback((v) => {
    update({ mode: 'calc', q: String(v), search: null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [update]);

  // Warm the index caches as soon as a value exists.
  useEffect(() => {
    if (searchEnabled && value > 0) prefetch(value);
  }, [value, searchEnabled]);

  // ── Document metadata ───────────────────────────────────────────────────
  useEffect(() => {
    const title = text
      ? `${text} = ${value} | Gematria Explorer`
      : 'Gematria Explorer | Mark Lebrett';
    document.title = title;

    const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#6366f1"/>
      </linearGradient></defs>
      <rect width="32" height="32" rx="7" fill="#080b10"/>
      <text x="5" y="25" font-family="serif" font-size="24" font-weight="700" fill="url(#g)">א</text>
    </svg>`;
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.href = `data:image/svg+xml,${encodeURIComponent(svgFavicon)}`;
    document.head.appendChild(favicon);

    const meta = [
      ['meta[property="og:title"]', title],
      ['meta[property="og:description"]', DESCRIPTION],
      ['meta[property="og:url"]', `https://marklebrett.co.uk/gematria${window.location.search}`],
      ['meta[name="description"]', DESCRIPTION],
      ['meta[name="twitter:title"]', title],
      ['meta[name="twitter:description"]', DESCRIPTION],
    ];
    const previous = meta.map(([selector]) => {
      const el = document.querySelector(selector);
      return [el, el?.getAttribute('content')];
    });
    meta.forEach(([selector, val]) => {
      document.querySelector(selector)?.setAttribute('content', val);
    });

    return () => {
      favicon.remove();
      previous.forEach(([el, val]) => {
        if (el && val != null) el.setAttribute('content', val);
      });
    };
  }, [text, value]);

  const isDirty = params.toString().length > 0;

  return (
    <div className="gem-page">
      <header className="gem-header">
        <Link to="/" className="gem-pill-btn" title="Back to the portal">
          <ArrowLeft size={15} aria-hidden="true" />
          <span>Portal</span>
        </Link>

        <div className="gem-header-text">
          <h1 className="gem-title">Gematria Explorer</h1>
          <p className="gem-subtitle">Calculate · Compare · Discover</p>
        </div>

        {isDirty ? (
          <button type="button" className="gem-pill-btn gem-pill-btn--danger" onClick={reset}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>Reset</span>
          </button>
        ) : (
          <span className="gem-pill-btn" style={{ visibility: 'hidden' }} aria-hidden="true">
            <RotateCcw size={15} />
            <span>Reset</span>
          </span>
        )}
      </header>

      <nav className="gem-nav" aria-label="Tool sections">
        <div className="gem-nav-inner">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`gem-nav-btn${mode === m.key ? ' active' : ''}`}
              onClick={() => update({ mode: m.key === 'calc' ? null : m.key })}
              aria-current={mode === m.key ? 'page' : undefined}
            >
              <span aria-hidden="true">{m.icon}</span> {m.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="gem-main">
        {mode === 'calc' && (
          <Calculator
            text={text}
            onTextChange={(v) => update({ q: v })}
            method={method}
            onMethodChange={(v) => update({ m: v === DEFAULT_METHOD ? null : v })}
            value={value}
            searchEnabled={searchEnabled}
            onSearchEnabledChange={(v) => update({ search: v ? null : '0' })}
            colel={colel}
            onColelChange={(v) => update({ colel: v })}
            singleWords={singleWords}
            onSingleWordsChange={(v) => update({ single: v })}
            parsha={parsha}
            onParshaChange={(v) => update({ parsha: v === 'All' ? null : v })}
          />
        )}

        {mode === 'compare' && <CompareView />}
        {mode === 'bridge' && <BridgeView method={method} />}
        {mode === 'dates' && <DateView onSearchValue={searchValue} />}

        {(mode === 'trends' || mode === 'race') && (
          <Suspense
            fallback={(
              <div className="gem-panel">
                <div className="gem-loading">
                  <div className="gem-spinner" />
                  <p>Loading…</p>
                </div>
              </div>
            )}
          >
            {mode === 'trends' ? <TrendsView /> : <WordRace />}
          </Suspense>
        )}
      </main>
    </div>
  );
};

export default GematriaApp;

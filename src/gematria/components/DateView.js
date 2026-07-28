import React, { useMemo, useState } from 'react';
import { hebrewDateGematria, toHebrewDate } from '../engine/hebrewDate';
import { toHebrewNumeral } from '../engine/numerals';
import { hechrachi } from '../engine/methods';

/**
 * Hebrew date converter and date gematria.
 *
 * The most commonly asked-for thing a gematria tool can do that this one
 * couldn't: "what's my Hebrew birthday, and what does it come to?"
 */
const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DateView = ({ onSearchValue }) => {
  const [date, setDate] = useState(todayISO);
  const [afterSunset, setAfterSunset] = useState(false);
  const [name, setName] = useState('');

  const hebrew = useMemo(() => {
    const [y, m, d] = date.split('-').map(Number);
    if (!y || !m || !d) return null;
    return toHebrewDate(y, m, d, afterSunset);
  }, [date, afterSunset]);

  const gematria = useMemo(() => hebrewDateGematria(hebrew), [hebrew]);
  const nameValue = hechrachi(name);
  const combined = (gematria?.value || 0) + nameValue;

  return (
    <>
      <section className="gem-panel">
        <h2 className="gem-panel-title">📅 Hebrew date</h2>
        <p className="gem-panel-sub">
          Convert any civil date to the Hebrew calendar and see what the written
          date comes to. Hebrew days begin the previous evening, so tick the box
          if the moment you have in mind was after nightfall.
        </p>

        <div className="gem-row">
          <div className="gem-field gem-grow">
            <label className="gem-label" htmlFor="gem-date">Civil date</label>
            <input
              id="gem-date"
              type="date"
              className="gem-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <label className={`gem-toggle${afterSunset ? ' is-on' : ''}`} style={{ marginTop: '1.4rem' }}>
            <input
              type="checkbox"
              checked={afterSunset}
              onChange={(e) => setAfterSunset(e.target.checked)}
            />
            After sunset
          </label>
        </div>

        {hebrew && (
          <div className="gem-value-hero" style={{ marginTop: '1.25rem' }}>
            <div>
              <div className="gem-value-caption">Hebrew date</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{hebrew.formatted}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
                {hebrew.isLeapYear ? 'Leap year (13 months)' : 'Ordinary year (12 months)'}
              </div>
            </div>
            <div className="gem-value-numeral">
              {hebrew.formattedHe}
              <small>Written form</small>
            </div>
          </div>
        )}
      </section>

      {gematria && (
        <section className="gem-panel">
          <h2 className="gem-panel-title">Date gematria</h2>
          <p className="gem-panel-sub">
            The value of the date as it is written in Hebrew — {gematria.text}.
          </p>

          <div className="gem-value-hero">
            <div>
              <div className="gem-value-caption">Value of the date</div>
              <div className="gem-value-number">{gematria.value}</div>
            </div>
            <div className="gem-value-numeral">
              {toHebrewNumeral(gematria.value)}
              <small>In letters</small>
            </div>
          </div>

          <div className="gem-btn-row" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="gem-btn gem-btn--primary"
              onClick={() => onSearchValue(gematria.value)}
            >
              Find words with this value →
            </button>
          </div>

          <div className="gem-field" style={{ marginTop: '1.5rem' }}>
            <label className="gem-label" htmlFor="gem-date-name">
              Add a name (optional)
            </label>
            <input
              id="gem-date-name"
              className="gem-input gem-input--hebrew"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="משה"
              dir="rtl"
              lang="he"
            />
          </div>

          {nameValue > 0 && (
            <div className="gem-chips" style={{ marginTop: '0.85rem' }}>
              <span className="gem-chip gem-chip--blue">Name = {nameValue}</span>
              <span className="gem-chip gem-chip--blue">Date = {gematria.value}</span>
              <span className="gem-chip">Together = {combined}</span>
              <button
                type="button"
                className="gem-chip"
                style={{ cursor: 'pointer' }}
                onClick={() => onSearchValue(combined)}
              >
                Search {combined} →
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
};

export default DateView;

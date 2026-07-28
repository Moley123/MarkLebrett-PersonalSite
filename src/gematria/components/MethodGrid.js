import React, { useMemo, useState } from 'react';
import { METHODS, calculateAll } from '../engine/methods';

/**
 * Every gematria method computed at once.
 *
 * Showing them side by side is the point — the interesting result is usually
 * "these two words match under Siduri even though they differ under Hechrachi",
 * which a one-method-at-a-time dropdown hides.
 */
const MethodGrid = ({ text, activeMethod, onSelectMethod }) => {
  const [showAll, setShowAll] = useState(false);
  const values = useMemo(() => calculateAll(text), [text]);

  const shown = showAll ? METHODS : METHODS.filter((m) => m.primary);
  const hiddenCount = METHODS.length - METHODS.filter((m) => m.primary).length;

  return (
    <div>
      <div className="gem-row" style={{ justifyContent: 'space-between' }}>
        <span className="gem-label">All methods</span>
        <button
          type="button"
          className="gem-btn"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
        >
          {showAll ? 'Show fewer' : `Show all methods (+${hiddenCount})`}
        </button>
      </div>

      <div className="gem-methods">
        {shown.map((method) => {
          const isActive = method.key === activeMethod;
          return (
            <button
              key={method.key}
              type="button"
              className={`gem-method${isActive ? ' is-active' : ''}`}
              onClick={() => onSelectMethod(method.key)}
              title={method.description}
              aria-pressed={isActive}
            >
              <span className="gem-method-name">{method.short}</span>
              <span className="gem-method-value">{values[method.key]}</span>
              <span className="gem-method-he">{method.hebrew}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MethodGrid;

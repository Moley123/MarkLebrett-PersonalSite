import React from 'react';

/**
 * Page control with numbered jumps.
 *
 * The old Prev/Next-only control meant reaching page 200 of 218 took 199
 * clicks. This windows the numbers around the current page and always offers
 * first/last.
 */
function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1] > 1) out.push('…');
    out.push(page);
  });
  return out;
}

const Pagination = ({ page, totalPages, onChange, itemLabel = 'results' }) => {
  if (totalPages <= 1) return null;

  return (
    <nav className="gem-pagination" aria-label={`${itemLabel} pagination`}>
      <button
        type="button"
        className="gem-page-btn"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        ← Prev
      </button>

      {pageNumbers(page, totalPages).map((entry, i) =>
        entry === '…' ? (
          // eslint-disable-next-line react/no-array-index-key
          <span key={`gap-${i}`} className="gem-page-ellipsis" aria-hidden="true">…</span>
        ) : (
          <button
            key={entry}
            type="button"
            className={`gem-page-btn${entry === page ? ' active' : ''}`}
            onClick={() => onChange(entry)}
            aria-current={entry === page ? 'page' : undefined}
            aria-label={`Page ${entry}`}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        className="gem-page-btn"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next →
      </button>
    </nav>
  );
};

export default Pagination;

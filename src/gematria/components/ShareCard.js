import React, { useEffect, useRef, useState } from 'react';
import { drawShareCard, shareCard } from '../share/shareCard';

/**
 * Share controls plus a live preview of the generated card.
 *
 * The preview is the same draw routine the export uses, so what the user sees
 * is exactly what lands on the clipboard.
 */
const ShareCard = ({ data }) => {
  const holder = useRef(null);
  const [state, setState] = useState('idle'); // idle | working | copied | downloaded | error
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || !holder.current) return;
    const canvas = drawShareCard(data, 2);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.borderRadius = '10px';
    canvas.style.display = 'block';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Share card: ${data.text} equals ${data.value}`);
    holder.current.replaceChildren(canvas);
  }, [open, data]);

  useEffect(() => {
    if (state !== 'copied' && state !== 'downloaded') return undefined;
    const timer = setTimeout(() => setState('idle'), 2600);
    return () => clearTimeout(timer);
  }, [state]);

  const onShare = async () => {
    setState('working');
    try {
      const outcome = await shareCard(data, `gematria-${data.value}.png`);
      setState(outcome);
    } catch {
      setState('error');
    }
  };

  const label = {
    idle: '🖼 Share as image',
    working: 'Generating…',
    copied: '✓ Copied to clipboard',
    downloaded: '✓ Image downloaded',
    error: '⚠ Couldn’t generate',
  }[state];

  return (
    <section className="gem-panel">
      <div className="gem-results-head">
        <h2 className="gem-panel-title">Share</h2>
        <div className="gem-btn-row">
          <button
            type="button"
            className="gem-btn"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? 'Hide preview' : 'Preview card'}
          </button>
          <button
            type="button"
            className="gem-btn gem-btn--primary"
            onClick={onShare}
            disabled={state === 'working'}
          >
            {label}
          </button>
        </div>
      </div>

      <p className="gem-panel-sub" style={{ margin: 0 }}>
        Copies a card to your clipboard, ready to paste into WhatsApp or a
        message. Browsers that block image copying will download it instead.
      </p>

      {open && (
        <div
          ref={holder}
          style={{ marginTop: '1rem', border: '1px solid var(--border)', borderRadius: 10 }}
        />
      )}

      <p className="gem-sr-only" aria-live="polite">{label}</p>
    </section>
  );
};

export default ShareCard;

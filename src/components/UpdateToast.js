import React, { useEffect, useState } from 'react';
import { applyUpdate, onUpdateReady } from '../serviceWorkerRegistration';
import './UpdateToast.css';

/**
 * "A new version is available" notice.
 *
 * Shown on every page, so it carries its own styling rather than borrowing
 * any one page's theme. Reloading is left to the person: nobody loses a
 * half-typed search or a route they're in the middle of planning.
 */
const UpdateToast = () => {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => onUpdateReady(() => setVisible(true)), []);

  if (!visible) return null;

  return (
    <div className="update-toast" role="status" aria-live="polite">
      <span>A new version is available.</span>
      <button
        type="button"
        className="update-toast__reload"
        disabled={busy}
        onClick={() => { setBusy(true); applyUpdate(); }}
      >
        {busy ? 'Reloading…' : 'Reload'}
      </button>
      <button
        type="button"
        className="update-toast__dismiss"
        aria-label="Dismiss"
        title="Dismiss — the new version loads next time"
        onClick={() => setVisible(false)}
      >
        ×
      </button>
    </div>
  );
};

export default UpdateToast;

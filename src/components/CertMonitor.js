import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './CertMonitorPage.css';

/* ══════════════════════════════════════════════════════════════
   CT Log sources (browser-accessible, CORS-enabled REST APIs)
   No certstream.calidog.io dependency.
══════════════════════════════════════════════════════════════ */
const CT_LOGS = [
  { host: 'ct.googleapis.com/logs/us1/argon2026h1', name: 'Google Argon 2026h1' },
  { host: 'ct.googleapis.com/logs/eu1/xenon2026h1', name: 'Google Xenon 2026h1' },
  { host: 'ct.googleapis.com/logs/us1/argon2026h2', name: 'Google Argon 2026h2' },
  { host: 'ct.googleapis.com/logs/eu1/xenon2026h2', name: 'Google Xenon 2026h2' },
];
const POLL_INTERVAL_MS = 2000;

/* ── Keyword classification ── */
const CRITICAL_KEYWORDS = [
  'paypal','banking','credential','password','wallet','bitcoin',
  'crypto','coinbase','binance','bank-','-bank','bankof',
];
const WARN_KEYWORDS = [
  'login','signin','sign-in','log-in','secure','verify','verification',
  'account','update','confirm','support','helpdesk','admin',
  'recovery','alert','suspended','unusual','amazon','apple',
  'google','microsoft','netflix','facebook','instagram','payroll',
];

function classify(domain) {
  const d = domain.toLowerCase();
  if (CRITICAL_KEYWORDS.some(k => d.includes(k))) return 'critical';
  if (WARN_KEYWORDS.some(k => d.includes(k)))     return 'warn';
  return 'ok';
}
function badgeLabel(s) {
  return s === 'critical' ? '⚠ HIGH' : s === 'warn' ? '◆ WARN' : '✓ OK';
}
function severityLabel(s) {
  return s === 'critical' ? '⚠ High Risk' : s === 'warn' ? '◆ Suspicious' : '✓ Clean';
}

/* ══════════════════════════════════════════════════════════════
   Browser-compatible DER / CT leaf parsing
══════════════════════════════════════════════════════════════ */
const KNOWN_ISSUERS = [
  ["Let's Encrypt", ["Let's Encrypt", "ISRG"]],
  ['Google Trust',  ['Google Trust Services', 'GTS']],
  ['DigiCert',      ['DigiCert']],
  ['Sectigo',       ['Sectigo', 'Comodo']],
  ['ZeroSSL',       ['ZeroSSL']],
  ['Entrust',       ['Entrust']],
  ['GlobalSign',    ['GlobalSign']],
  ['Amazon',        ['Amazon']],
  ['Buypass',       ['Buypass']],
];

function u16be(buf, i) { return (buf[i] << 8) | buf[i + 1]; }
function u24be(buf, i) { return (buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2]; }
function u64beMs(buf, i) {
  // Read 8-byte big-endian timestamp (in ms). JS loses precision above 53 bits
  // but CT timestamps are well within safe range for years 2024+.
  const hi = ((buf[i] << 24) | (buf[i+1] << 16) | (buf[i+2] << 8) | buf[i+3]) >>> 0;
  const lo = ((buf[i+4] << 24) | (buf[i+5] << 16) | (buf[i+6] << 8) | buf[i+7]) >>> 0;
  return hi * 0x100000000 + lo;
}

function bufToLatin1(buf) {
  // Convert Uint8Array to string without TextDecoder (works on all browsers)
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return s;
}

function detectIssuer(buf) {
  const text = bufToLatin1(buf.subarray(0, Math.min(buf.length, 600)));
  for (const [label, needles] of KNOWN_ISSUERS) {
    if (needles.some(n => text.includes(n))) return label;
  }
  return 'Unknown CA';
}

function extractDomainsFromDer(buf) {
  const domains = new Set();
  let wildcard = false;

  // Scan for ASN.1 context-specific tag 0x82 (dNSName in SubjectAltName)
  for (let i = 0; i < buf.length - 2; i++) {
    if (buf[i] === 0x82) {
      const len = buf[i + 1];
      if (len > 0x7f || i + 2 + len > buf.length) continue;
      let str = '';
      for (let j = 0; j < len; j++) str += String.fromCharCode(buf[i + 2 + j]);
      if (/^[\w\-*.]+\.\w{2,}$/.test(str)) {
        if (str.startsWith('*.')) wildcard = true;
        domains.add(str.startsWith('*.') ? str.slice(2) : str);
      }
    }
  }

  // Regex fallback over raw bytes
  const text = bufToLatin1(buf);
  const re = /([a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const d = m[0].toLowerCase();
    if (d.length > 4 && d.length < 100 && !d.includes('..')) domains.add(d);
  }

  return { domains: [...domains].slice(0, 10), wildcard };
}

function parseLeafInput(base64) {
  try {
    const bin = atob(base64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

    if (buf.length < 15) return null;
    const tsMs      = u64beMs(buf, 2);
    const entryType = u16be(buf, 10);

    let certBuf;
    if (entryType === 0) {          // x509_entry
      const certLen = u24be(buf, 12);
      certBuf = buf.subarray(15, 15 + certLen);
    } else if (entryType === 1) {   // precert_entry
      const certLen = u24be(buf, 44);
      certBuf = buf.subarray(47, 47 + certLen);
    } else return null;

    const { domains, wildcard } = extractDomainsFromDer(certBuf);
    const issuer    = detectIssuer(certBuf);
    const notBefore = new Date(tsMs).toISOString().slice(0, 10);
    return { domains, wildcard, issuer, notBefore };
  } catch { return null; }
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ══════════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════════ */
const MAX_ENTRIES  = 500;
const UI_TICK_MS   = 150;
let idCounter = 0;

const CertMonitor = () => {
  const navigate       = useNavigate();
  const bufferRef      = useRef([]);
  const autoScrollRef  = useRef(true);
  const feedRef        = useRef(null);
  const cursorsRef     = useRef({});
  const logIdxRef      = useRef(0);

  const [entries,      setEntries]     = useState([]);
  const [status,       setStatus]      = useState('connecting');
  const [paused,       setPaused]      = useState(false);
  const [filter,       setFilter]      = useState('');
  const [suspOnly,     setSuspOnly]    = useState(false);
  const [autoScroll,   setAutoScroll]  = useState(true);
  const [stats,        setStats]       = useState({ total: 0, ok: 0, warn: 0, critical: 0 });
  const [selectedCert, setSelectedCert] = useState(null);

  /* ── Title / favicon ── */
  useEffect(() => {
    document.title = 'CertStream Monitor | Mark Lebrett';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" fill="#080b10"/>
      <circle cx="16" cy="16" r="10" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <circle cx="16" cy="16" r="4" fill="#22d3ee">
        <animate attributeName="r" values="3;5;3" dur="1.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite"/>
      </circle>
    </svg>`;
    const fav = document.createElement('link');
    fav.rel = 'icon'; fav.type = 'image/svg+xml';
    fav.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    document.head.appendChild(fav);
    return () => { try { document.head.removeChild(fav); } catch {} };
  }, []);

  /* ── Flush buffer to React state ── */
  const flushBuffer = useCallback(() => {
    if (!bufferRef.current.length) return;
    const incoming = bufferRef.current.splice(0);
    setEntries(prev => {
      const next = [...incoming, ...prev];
      return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
    });
    setStats(prev => {
      let { total, ok, warn, critical } = prev;
      incoming.forEach(e => {
        total++;
        if (e.severity === 'critical') critical++;
        else if (e.severity === 'warn') warn++;
        else ok++;
      });
      return { total, ok, warn, critical };
    });
  }, []);

  useEffect(() => {
    const t = setInterval(flushBuffer, UI_TICK_MS);
    return () => clearInterval(t);
  }, [flushBuffer]);

  /* ── CT Log polling ── */
  useEffect(() => {
    if (paused) { setStatus('paused'); return; }

    let stopped = false;

    async function tick() {
      if (stopped) return;
      const log = CT_LOGS[logIdxRef.current % CT_LOGS.length];
      logIdxRef.current++;

      try {
        const sth      = await fetchJson(`https://${log.host}/ct/v1/get-sth`);
        const treeSize = sth.tree_size;

        if (cursorsRef.current[log.host] === undefined) {
          cursorsRef.current[log.host] = Math.max(0, treeSize - 50);
        }

        const cursor = cursorsRef.current[log.host];
        if (cursor >= treeSize) return;

        const end  = Math.min(cursor + 49, treeSize - 1);
        const data = await fetchJson(
          `https://${log.host}/ct/v1/get-entries?start=${cursor}&end=${end}`
        );
        if (!data.entries?.length) return;

        if (!stopped) setStatus('live');

        data.entries.forEach((entry, i) => {
          if (stopped) return;
          const info = parseLeafInput(entry.leaf_input);
          if (!info || !info.domains.length) return;

          const domain   = info.domains[0];
          const severity = classify(domain);
          const time     = new Date().toTimeString().slice(0, 8);

          bufferRef.current.push({
            id:         ++idCounter,
            time,
            domain,
            severity,
            allDomains: info.domains,
            sans:       info.domains.slice(1),
            issuer:     info.issuer,
            wildcard:   info.wildcard,
            logName:    log.name,
            certIndex:  cursor + i,
            notBefore:  info.notBefore,
          });
        });

        cursorsRef.current[log.host] = end + 1;
      } catch (e) {
        if (!stopped) setStatus('error');
      }
    }

    setStatus('connecting');
    tick();
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [paused]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (autoScrollRef.current && feedRef.current) feedRef.current.scrollTop = 0;
  }, [entries]);

  /* ── Filtered view ── */
  const displayed = entries.filter(e => {
    if (suspOnly && e.severity === 'ok') return false;
    if (filter && !e.domain.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  /* ── Highlight matched text ── */
  const highlight = (text) => {
    if (!filter) return text;
    const idx = text.toLowerCase().indexOf(filter.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="cert-highlight">{text.slice(idx, idx + filter.length)}</mark>
        {text.slice(idx + filter.length)}
      </>
    );
  };

  const toggleAutoScroll = () => {
    const next = !autoScroll;
    setAutoScroll(next);
    autoScrollRef.current = next;
  };

  return (
    <div className="cert-page">

      {/* ── Detail panel ── */}
      <div className={`cert-detail-panel ${selectedCert ? 'open' : ''}`}>
        <div className="cert-detail-panel__header">
          <span className="cert-detail-panel__title">Certificate Detail</span>
          <button
            className="cert-detail-panel__close"
            onClick={() => setSelectedCert(null)}
            aria-label="Close panel"
          >✕</button>
        </div>
        {selectedCert && (
          <div className="cert-detail-panel__body">
            <div>
              <div className={`cert-detail-badge cert-detail-badge--${selectedCert.severity}`}>
                {severityLabel(selectedCert.severity)}
              </div>
              <div className="cert-detail-domain">{selectedCert.domain}</div>
            </div>

            <hr className="cert-detail-divider" />

            <div className="cert-detail-section">
              <div className="cert-detail-label">
                All Covered Domains ({selectedCert.allDomains?.length ?? 1})
              </div>
              <div className="cert-detail-pills">
                {(selectedCert.allDomains ?? [selectedCert.domain]).map(d => (
                  <span key={d} className="cert-detail-pill">{d}</span>
                ))}
              </div>
            </div>

            {selectedCert.wildcard && <>
              <hr className="cert-detail-divider" />
              <div className="cert-detail-section">
                <div className="cert-detail-label">Wildcard</div>
                <span className="cert-detail-pill cert-detail-pill--wc">
                  ★ Covers all subdomains
                </span>
              </div>
            </>}

            <hr className="cert-detail-divider" />

            <div className="cert-detail-section">
              <div className="cert-detail-label">Certificate Authority</div>
              <div className="cert-detail-value">{selectedCert.issuer || '—'}</div>
            </div>

            <div className="cert-detail-section">
              <div className="cert-detail-label">CT Log Source</div>
              <div className="cert-detail-value">{selectedCert.logName || '—'}</div>
            </div>

            {selectedCert.certIndex != null && (
              <div className="cert-detail-section">
                <div className="cert-detail-label">Log Entry Index</div>
                <div className="cert-detail-value">#{selectedCert.certIndex.toLocaleString()}</div>
              </div>
            )}

            {selectedCert.notBefore && (
              <div className="cert-detail-section">
                <div className="cert-detail-label">Issued</div>
                <div className="cert-detail-value">{selectedCert.notBefore}</div>
              </div>
            )}

            <div className="cert-detail-section">
              <div className="cert-detail-label">Observed At</div>
              <div className="cert-detail-value">{selectedCert.time}</div>
            </div>

            <hr className="cert-detail-divider" />

            <div className="cert-detail-section">
              <div className="cert-detail-label">Investigate</div>
              <div className="cert-detail-links">
                <a href={`https://crt.sh/?q=${encodeURIComponent(selectedCert.domain)}`} target="_blank" rel="noopener noreferrer">🔍 Search crt.sh</a>
                <a href={`https://www.virustotal.com/gui/domain/${encodeURIComponent(selectedCert.domain)}`} target="_blank" rel="noopener noreferrer">🛡 VirusTotal</a>
                <a href={`https://www.shodan.io/search?query=${encodeURIComponent(selectedCert.domain)}`} target="_blank" rel="noopener noreferrer">📡 Shodan</a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Top bar ── */}
      <div className="cert-topbar">
        <button className="cert-topbar__back" onClick={() => navigate('/')} aria-label="Back to portal">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Portal
        </button>
        <div className="cert-topbar__title">
          <div>
            <h1>🔐 CertStream Monitor</h1>
            <p>Live Certificate Transparency — Phishing &amp; Brand Abuse Detection</p>
          </div>
        </div>
        <div className={`cert-status cert-status--${status}`}>
          <span className="cert-status__dot"></span>
          {status === 'connecting' && 'Connecting…'}
          {status === 'live'       && 'Live'}
          {status === 'paused'     && 'Paused'}
          {status === 'error'      && 'Retrying…'}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="cert-stats">
        <div className="cert-stat"><span className="cert-stat__label">Total Seen</span><span className="cert-stat__value cert-stat__value--total">{stats.total.toLocaleString()}</span></div>
        <div className="cert-stat"><span className="cert-stat__label">Clean</span><span className="cert-stat__value cert-stat__value--ok">{stats.ok.toLocaleString()}</span></div>
        <div className="cert-stat"><span className="cert-stat__label">Suspicious</span><span className="cert-stat__value cert-stat__value--warn">{stats.warn.toLocaleString()}</span></div>
        <div className="cert-stat"><span className="cert-stat__label">High Risk</span><span className="cert-stat__value cert-stat__value--critical">{stats.critical.toLocaleString()}</span></div>
      </div>

      {/* ── Controls ── */}
      <div className="cert-controls">
        <input className="cert-search" type="text" placeholder="Filter domains…" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter domains" />
        <button className={`cert-btn cert-btn--suspicious ${suspOnly ? 'active' : ''}`} onClick={() => setSuspOnly(p => !p)} aria-pressed={suspOnly}>
          {suspOnly ? '⚠ Suspicious Only' : '⚠ All Domains'}
        </button>
        <button className={`cert-btn ${paused ? 'cert-btn--resume' : 'cert-btn--pause'}`} onClick={() => setPaused(p => !p)}>
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button className="cert-btn cert-btn--clear" onClick={() => { setEntries([]); setStats({ total: 0, ok: 0, warn: 0, critical: 0 }); bufferRef.current = []; setSelectedCert(null); }}>Clear</button>
      </div>

      {/* ── Legend ── */}
      <div className="cert-legend">
        <span className="cert-legend__item"><span className="cert-legend__dot" style={{background:'#4ade80'}}></span>Clean certificate</span>
        <span className="cert-legend__item"><span className="cert-legend__dot" style={{background:'#fb923c'}}></span>Suspicious keyword</span>
        <span className="cert-legend__item"><span className="cert-legend__dot" style={{background:'#f87171'}}></span>High-risk keyword</span>
        <span className="cert-legend__item cert-legend__hint">Click any entry to inspect</span>
      </div>

      {/* ── Feed ── */}
      <div className="cert-feed-wrap">
        <div className="cert-feed" ref={feedRef}>
          {displayed.length === 0 ? (
            <div className="cert-feed__empty">
              <span className="cert-feed__empty-icon">📡</span>
              <span className="cert-feed__empty-text">
                {status === 'connecting' ? 'Connecting to CT logs…' : 'No entries match your filter.'}
              </span>
            </div>
          ) : (
            displayed.map(e => (
              <div
                key={e.id}
                className={`cert-entry cert-entry--${e.severity} ${selectedCert?.id === e.id ? 'cert-entry--active' : ''}`}
                onClick={() => setSelectedCert(selectedCert?.id === e.id ? null : e)}
              >
                <span className="cert-entry__time">{e.time}</span>
                <span className="cert-entry__badge">{badgeLabel(e.severity)}</span>
                <span className="cert-entry__domain">{highlight(e.domain)}</span>
                {e.wildcard && <span className="cert-entry__wc">★WC</span>}
              </div>
            ))
          )}
          <button className={`cert-autoscroll ${autoScroll ? 'on' : ''}`} onClick={toggleAutoScroll} title="Toggle auto-scroll">
            {autoScroll ? '⬆ Auto' : '⬆ Manual'}
          </button>
        </div>
      </div>

    </div>
  );
};

export default CertMonitor;

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './CertMonitorPage.css';

/* ── Keyword lists ── */
const CRITICAL_KEYWORDS = [
  'paypal', 'banking', 'credential', 'password', 'wallet', 'bitcoin',
  'crypto', 'coinbase', 'binance', 'bank-', '-bank', 'bankof',
];
const WARN_KEYWORDS = [
  'login', 'signin', 'sign-in', 'log-in', 'secure', 'verify', 'verification',
  'account', 'update', 'confirm', 'support', 'helpdesk', 'admin',
  'recovery', 'alert', 'suspended', 'unusual', 'amazon', 'apple',
  'google', 'microsoft', 'netflix', 'facebook', 'instagram', 'payroll',
];

function classify(domain) {
  const d = domain.toLowerCase();
  if (CRITICAL_KEYWORDS.some(k => d.includes(k))) return 'critical';
  if (WARN_KEYWORDS.some(k => d.includes(k)))    return 'warn';
  return 'ok';
}

function badgeLabel(severity) {
  if (severity === 'critical') return '⚠ HIGH';
  if (severity === 'warn')     return '◆ WARN';
  return '✓ OK';
}

const MAX_ENTRIES = 500;
const UI_TICK_MS  = 150; // batch UI updates

let idCounter = 0;

const CertMonitor = () => {
  const navigate = useNavigate();
  const wsRef        = useRef(null);
  const bufferRef    = useRef([]);   // pending entries not yet flushed to state
  const autoScrollRef= useRef(true);
  const feedRef      = useRef(null);
  const tickRef      = useRef(null);

  const [entries,      setEntries]      = useState([]);
  const [status,       setStatus]       = useState('connecting'); // connecting|live|paused|error
  const [paused,       setPaused]       = useState(false);
  const [filter,       setFilter]       = useState('');
  const [suspOnly,     setSuspOnly]     = useState(false);
  const [autoScroll,   setAutoScroll]   = useState(true);
  const [stats,        setStats]        = useState({ total: 0, ok: 0, warn: 0, critical: 0 });

  /* ── Title / favicon ── */
  useEffect(() => {
    document.title = 'CertStream Monitor | Mark Lebrett';
    const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" fill="#080b10"/>
      <circle cx="16" cy="16" r="10" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <circle cx="16" cy="16" r="4" fill="#22d3ee">
        <animate attributeName="r" values="3;5;3" dur="1.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite"/>
      </circle>
    </svg>`;
    const favicon = document.createElement('link');
    favicon.rel = 'icon'; favicon.type = 'image/svg+xml';
    favicon.href = 'data:image/svg+xml,' + encodeURIComponent(svgFavicon);
    document.head.appendChild(favicon);
    const metas = [
      { sel: 'meta[property="og:title"]',       val: 'CertStream Monitor | Mark Lebrett' },
      { sel: 'meta[property="og:description"]', val: 'Live SSL/TLS certificate transparency log monitor with phishing keyword detection.' },
      { sel: 'meta[name="twitter:title"]',       val: 'CertStream Monitor | Mark Lebrett' },
    ];
    metas.forEach(({ sel, val }) => { const el = document.querySelector(sel); if (el) el.setAttribute('content', val); });
    return () => { document.head.removeChild(favicon); };
  }, []);

  /* ── Flush buffer to state on a tick ── */
  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0) return;
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

  /* ── WebSocket connection ── */
  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    setStatus('connecting');

    const ws = new WebSocket('wss://certstream.calidog.io/');
    wsRef.current = ws;

    ws.onopen = () => setStatus('live');
    ws.onerror = () => setStatus('error');
    ws.onclose = () => {
      setStatus('error');
      // Retry after 5 s
      setTimeout(() => {
        if (wsRef.current === ws) connect();
      }, 5000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.message_type !== 'certificate_update') return;
        const domains = msg?.data?.leaf_cert?.all_domains;
        if (!domains || domains.length === 0) return;
        const domain = domains[0];
        const severity = classify(domain);
        const now = new Date();
        const time = now.toTimeString().slice(0, 8);
        bufferRef.current.push({ id: ++idCounter, time, domain, severity });
      } catch { /* ignore parse errors */ }
    };
  }, []);

  /* ── Lifecycle: connect on mount ── */
  useEffect(() => {
    connect();
    tickRef.current = setInterval(flushBuffer, UI_TICK_MS);
    return () => {
      clearInterval(tickRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect, flushBuffer]);

  /* ── Pause / resume ── */
  useEffect(() => {
    if (!wsRef.current) return;
    if (paused) {
      wsRef.current.close();
      clearInterval(tickRef.current);
      setStatus('paused');
    } else {
      connect();
      tickRef.current = setInterval(flushBuffer, UI_TICK_MS);
    }
  }, [paused, connect, flushBuffer]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (autoScrollRef.current && feedRef.current) {
      feedRef.current.scrollTop = 0; // new entries prepend, so top = newest
    }
  }, [entries]);

  const toggleAutoScroll = () => {
    const next = !autoScroll;
    setAutoScroll(next);
    autoScrollRef.current = next;
  };

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

  return (
    <div className="cert-page">

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
            <p>Live SSL/TLS Certificate Transparency Log — Phishing &amp; Brand Abuse Detection</p>
          </div>
        </div>

        <div className={`cert-status cert-status--${status}`}>
          <span className="cert-status__dot"></span>
          {status === 'connecting' && 'Connecting…'}
          {status === 'live'       && 'Live'}
          {status === 'paused'     && 'Paused'}
          {status === 'error'      && 'Disconnected — retrying…'}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="cert-stats">
        <div className="cert-stat">
          <span className="cert-stat__label">Total Seen</span>
          <span className="cert-stat__value cert-stat__value--total">{stats.total.toLocaleString()}</span>
        </div>
        <div className="cert-stat">
          <span className="cert-stat__label">Clean</span>
          <span className="cert-stat__value cert-stat__value--ok">{stats.ok.toLocaleString()}</span>
        </div>
        <div className="cert-stat">
          <span className="cert-stat__label">Suspicious</span>
          <span className="cert-stat__value cert-stat__value--warn">{stats.warn.toLocaleString()}</span>
        </div>
        <div className="cert-stat">
          <span className="cert-stat__label">High Risk</span>
          <span className="cert-stat__value cert-stat__value--critical">{stats.critical.toLocaleString()}</span>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="cert-controls">
        <input
          className="cert-search"
          type="text"
          placeholder="Filter domains…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          aria-label="Filter domains"
        />
        <button
          className={`cert-btn cert-btn--suspicious ${suspOnly ? 'active' : ''}`}
          onClick={() => setSuspOnly(p => !p)}
          aria-pressed={suspOnly}
        >
          {suspOnly ? '⚠ Suspicious Only' : '⚠ All Domains'}
        </button>
        <button
          className={`cert-btn ${paused ? 'cert-btn--resume' : 'cert-btn--pause'}`}
          onClick={() => setPaused(p => !p)}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          className="cert-btn cert-btn--clear"
          onClick={() => { setEntries([]); setStats({ total: 0, ok: 0, warn: 0, critical: 0 }); bufferRef.current = []; }}
        >
          Clear
        </button>
        {status === 'error' && (
          <button className="cert-btn" onClick={() => { setPaused(false); connect(); }}>
            ↺ Reconnect
          </button>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="cert-legend">
        <span className="cert-legend__item"><span className="cert-legend__dot" style={{background:'#4ade80'}}></span> Clean certificate</span>
        <span className="cert-legend__item"><span className="cert-legend__dot" style={{background:'#fb923c'}}></span> Suspicious keyword (login, secure, verify…)</span>
        <span className="cert-legend__item"><span className="cert-legend__dot" style={{background:'#f87171'}}></span> High-risk keyword (paypal, banking, wallet, crypto…)</span>
      </div>

      {/* ── Feed ── */}
      <div className="cert-feed-wrap">
        <div className="cert-feed" ref={feedRef}>
          {displayed.length === 0 ? (
            <div className="cert-feed__empty">
              <span className="cert-feed__empty-icon">📡</span>
              <span className="cert-feed__empty-text">
                {status === 'connecting' ? 'Connecting to CertStream…' : 'No entries match your filter.'}
              </span>
            </div>
          ) : (
            displayed.map(e => (
              <div key={e.id} className={`cert-entry cert-entry--${e.severity}`}>
                <span className="cert-entry__time">{e.time}</span>
                <span className="cert-entry__badge">{badgeLabel(e.severity)}</span>
                <span className="cert-entry__domain">{highlight(e.domain)}</span>
              </div>
            ))
          )}
          <button
            className={`cert-autoscroll ${autoScroll ? 'on' : ''}`}
            onClick={toggleAutoScroll}
            title="Toggle auto-scroll to newest"
          >
            {autoScroll ? '⬆ Auto' : '⬆ Manual'}
          </button>
        </div>
      </div>

    </div>
  );
};

export default CertMonitor;

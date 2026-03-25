import React, { useEffect, useRef } from 'react';

/* EmelServicesPage — lifts all 5 animated service sections from the original EmelSolutions.js.
   Wrapped in .emel-page so existing EmelSolutionsPage.css scoping applies. */

const EmelServicesPage = ({ onNavigate }) => {
  const navRef = useRef(null);

  /* ── Scroll reveal ── */
  useEffect(() => {
    const els = document.querySelectorAll('.emel-page .reveal');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  /* ── Neural network canvas ── */
  useEffect(() => {
    const canvas = document.getElementById('neuralCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const LAYER_X = [60, 170, 280, 390, 480];
    const LAYER_COUNTS = [4, 6, 6, 4, 2];
    const COLOURS = { node:'#4f8ef7', nodeAlt:'#7b61ff', nodeOut:'#06d6a0' };
    const nodes = [];
    LAYER_X.forEach((x, li) => {
      const count = LAYER_COUNTS[li], spread = count * 28;
      for (let i = 0; i < count; i++) {
        const y = H/2 - spread/2 + i*(spread/(count-1||1));
        nodes.push({ x, y, layer: li, pulse: Math.random(), pulseDir: 1, pulseSpeed: 0.02+Math.random()*0.03,
          colour: li===LAYER_X.length-1 ? COLOURS.nodeOut : li%2===0 ? COLOURS.node : COLOURS.nodeAlt });
      }
    });
    const connections = [];
    for (let l = 0; l < LAYER_X.length-1; l++) {
      const A = nodes.filter(n=>n.layer===l), B = nodes.filter(n=>n.layer===l+1);
      A.forEach(a => B.forEach(b => connections.push({ a, b, active: Math.random()>0.55 })));
    }
    const pulses = [];
    const spawnPulse = () => {
      const active = connections.filter(c=>c.active);
      if (!active.length) return;
      const conn = active[Math.floor(Math.random()*active.length)];
      pulses.push({ conn, t: 0, speed: 0.008+Math.random()*0.012 });
    };
    for (let i=0;i<8;i++) spawnPulse();
    let frame = 0, animId;
    const draw = () => {
      ctx.clearRect(0,0,W,H);
      connections.forEach(c => {
        ctx.beginPath(); ctx.moveTo(c.a.x,c.a.y); ctx.lineTo(c.b.x,c.b.y);
        ctx.strokeStyle = c.active ? 'rgba(79,142,247,0.7)' : 'rgba(79,142,247,0.18)';
        ctx.lineWidth = c.active ? 1 : 0.5; ctx.stroke();
      });
      for (let i=pulses.length-1;i>=0;i--) {
        const p=pulses[i]; p.t+=p.speed;
        if(p.t>=1){ pulses.splice(i,1); spawnPulse(); continue; }
        const px=p.conn.a.x+(p.conn.b.x-p.conn.a.x)*p.t, py=p.conn.a.y+(p.conn.b.y-p.conn.a.y)*p.t;
        const g=ctx.createRadialGradient(px,py,0,px,py,8);
        g.addColorStop(0,'rgba(79,142,247,0.95)'); g.addColorStop(1,'rgba(79,142,247,0)');
        ctx.beginPath(); ctx.arc(px,py,8,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
        ctx.beginPath(); ctx.arc(px,py,3,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
      }
      nodes.forEach(n => {
        n.pulse+=n.pulseSpeed*n.pulseDir;
        if(n.pulse>=1||n.pulse<=0) n.pulseDir*=-1;
        const glow=6+n.pulse*8;
        const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,glow+4);
        g.addColorStop(0,n.colour+'cc'); g.addColorStop(1,n.colour+'00');
        ctx.beginPath(); ctx.arc(n.x,n.y,glow+4,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x,n.y,5,0,Math.PI*2); ctx.fillStyle=n.colour; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x,n.y,2,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.fill();
      });
      if(frame%90===0) connections.forEach(c=>{ if(Math.random()>0.7) c.active=!c.active; });
      frame++; animId=requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  /* ── WordPress sidebar cycling animation ── */
  useEffect(() => {
    const sequence = [
      { activeMenu:'wpm-plugins',    openSub:true,  highlightSub:0  },
      { activeMenu:'wpm-plugins',    openSub:true,  highlightSub:1  },
      { activeMenu:'wpm-pages',      openSub:false, highlightSub:-1 },
      { activeMenu:'wpm-appearance', openSub:false, highlightSub:-1 },
      { activeMenu:'wpm-plugins',    openSub:true,  highlightSub:0  },
    ];
    let step = 0;
    const applyStep = () => {
      const s = sequence[step % sequence.length];
      document.querySelectorAll('.emel-page .wp-menu-item').forEach(m => m.classList.remove('wp-menu-item--active'));
      const target = document.getElementById(s.activeMenu);
      if (target) target.classList.add('wp-menu-item--active');
      const submenu = document.getElementById('wp-submenu');
      if (submenu) { submenu.style.maxHeight = s.openSub ? '120px' : '0'; submenu.style.opacity = s.openSub ? '1' : '0'; }
      document.querySelectorAll('.emel-page .wp-submenu-item').forEach((si,idx) =>
        si.classList.toggle('wp-submenu-item--highlight', idx === s.highlightSub));
      step++;
    };
    applyStep();
    const interval = setInterval(applyStep, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    /* emel-page scopes existing EmelSolutionsPage.css; .emel-site overrides make sections light */
    <div className="emel-page">
      {/* ── Page hero ── */}
      <div className="es-services-hero">
        <h1>Our Services</h1>
        <p>
          We offer five core service areas designed to help businesses of all sizes leverage
          modern technology — from intelligent automation to reliable infrastructure.
        </p>
      </div>

      <main>
        {/* ── Section 1: AI Automation ── */}
        <section className="service-section reveal" id="ai-automation" aria-labelledby="ai-heading">
          <div className="section-inner">
            <div className="section-tag">AI &amp; Automation</div>
            <h2 className="section-title" id="ai-heading">AI Automation &amp; Workflow Development</h2>
            <div className="section-body">
              <div className="anim-panel">
                <div className="workflow-canvas" aria-label="n8n-style workflow animation" role="img">
                  <svg className="workflow-svg" viewBox="0 0 540 280" xmlns="http://www.w3.org/2000/svg">
                    <path id="conn1" d="M 130 90 C 180 90 190 140 240 140" stroke="#4f8ef7" strokeWidth="2" fill="none" strokeDasharray="6 4" className="wf-conn"/>
                    <path id="conn2" d="M 130 90 C 180 90 190 40  240 40"  stroke="#4f8ef7" strokeWidth="2" fill="none" strokeDasharray="6 4" className="wf-conn"/>
                    <path id="conn3" d="M 320 40  C 370 40  375 90 420 90"  stroke="#7b61ff" strokeWidth="2" fill="none" strokeDasharray="6 4" className="wf-conn wf-conn--delay1"/>
                    <path id="conn4" d="M 320 140 C 370 140 375 90 420 90"  stroke="#7b61ff" strokeWidth="2" fill="none" strokeDasharray="6 4" className="wf-conn wf-conn--delay1"/>
                    <path id="conn5" d="M 500 90  C 540 90  545 200 420 200" stroke="#06d6a0" strokeWidth="2" fill="none" strokeDasharray="6 4" className="wf-conn wf-conn--delay2"/>
                    <circle r="5" fill="#4f8ef7" opacity="0.9"><animateMotion dur="2.4s" repeatCount="indefinite" begin="0s"><mpath href="#conn1"/></animateMotion></circle>
                    <circle r="5" fill="#4f8ef7" opacity="0.9"><animateMotion dur="2.4s" repeatCount="indefinite" begin="0.6s"><mpath href="#conn2"/></animateMotion></circle>
                    <circle r="5" fill="#7b61ff" opacity="0.9"><animateMotion dur="2.2s" repeatCount="indefinite" begin="0.8s"><mpath href="#conn3"/></animateMotion></circle>
                    <circle r="5" fill="#7b61ff" opacity="0.9"><animateMotion dur="2.2s" repeatCount="indefinite" begin="1.2s"><mpath href="#conn4"/></animateMotion></circle>
                    <circle r="5" fill="#06d6a0" opacity="0.9"><animateMotion dur="2.8s" repeatCount="indefinite" begin="1.5s"><mpath href="#conn5"/></animateMotion></circle>
                    <g transform="translate(50,65)">
                      <rect width="80" height="50" rx="10" fill="#1a2744" stroke="#f97316" strokeWidth="2"/>
                      <circle cx="8" cy="8" r="4" fill="#f97316" className="wf-pulse"/>
                      <text x="40" y="20" textAnchor="middle" fill="#f97316" fontSize="9" fontFamily="Inter" fontWeight="600">TRIGGER</text>
                      <text x="40" y="34" textAnchor="middle" fill="#8ca0c8" fontSize="8" fontFamily="Inter">Webhook</text>
                    </g>
                    <g transform="translate(200,15)">
                      <rect width="80" height="50" rx="10" fill="#1a2744" stroke="#4f8ef7" strokeWidth="2"/>
                      <text x="40" y="20" textAnchor="middle" fill="#4f8ef7" fontSize="9" fontFamily="Inter" fontWeight="600">HTTP</text>
                      <text x="40" y="34" textAnchor="middle" fill="#8ca0c8" fontSize="8" fontFamily="Inter">Request</text>
                    </g>
                    <g transform="translate(200,115)">
                      <rect width="80" height="50" rx="10" fill="#1a2744" stroke="#4f8ef7" strokeWidth="2"/>
                      <text x="40" y="20" textAnchor="middle" fill="#4f8ef7" fontSize="9" fontFamily="Inter" fontWeight="600">CODE</text>
                      <text x="40" y="34" textAnchor="middle" fill="#8ca0c8" fontSize="8" fontFamily="Inter">Transform</text>
                    </g>
                    <g transform="translate(380,65)">
                      <rect width="80" height="50" rx="10" fill="#1a2744" stroke="#7b61ff" strokeWidth="2.5"/>
                      <text x="40" y="18" textAnchor="middle" fill="#7b61ff" fontSize="9" fontFamily="Inter" fontWeight="700">AI AGENT</text>
                      <text x="40" y="30" textAnchor="middle" fill="#8ca0c8" fontSize="7.5" fontFamily="Inter">GPT-4o</text>
                      <circle cx="40" cy="42" r="4" fill="#7b61ff" className="wf-pulse-ai"/>
                    </g>
                    <g transform="translate(370,175)">
                      <rect width="100" height="50" rx="10" fill="#0d2a1f" stroke="#06d6a0" strokeWidth="2"/>
                      <text x="50" y="20" textAnchor="middle" fill="#06d6a0" fontSize="9" fontFamily="Inter" fontWeight="600">✓ COMPLETE</text>
                      <text x="50" y="34" textAnchor="middle" fill="#8ca0c8" fontSize="7.5" fontFamily="Inter">Slack Notification</text>
                    </g>
                  </svg>
                </div>
              </div>
              <div className="section-text">
                <p>We design and deploy intelligent automation pipelines that eliminate repetitive tasks and unlock your team's potential. From webhook-triggered multi-step workflows to AI-augmented data processing, our solutions connect your tools seamlessly.</p>
                <p>Using cutting-edge orchestration frameworks, we build workflows that adapt, self-correct, and scale with your business — reducing overhead and accelerating decision-making across every department.</p>
                <ul className="feature-list" aria-label="AI Automation features">
                  <li>Custom n8n &amp; Make workflow design</li>
                  <li>API integration &amp; data transformation</li>
                  <li>LLM-powered decision nodes</li>
                  <li>Real-time monitoring &amp; alerting</li>
                </ul>
                <button className="es-service-quote-link" onClick={() => onNavigate('contact')}>
                  Get a quote for this service →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 2: WordPress ── */}
        <section className="service-section service-section--alt reveal" id="wordpress" aria-labelledby="wp-heading">
          <div className="section-inner">
            <div className="section-tag">Web Development</div>
            <h2 className="section-title" id="wp-heading">WordPress Management &amp; Custom Plugins</h2>
            <div className="section-body section-body--reversed">
              <div className="section-text">
                <p>From bespoke plugin development to full-site management, we bring enterprise-grade reliability to your WordPress platform. Our team handles performance optimisation, security hardening, custom Gutenberg blocks and complex WooCommerce integrations.</p>
                <p>Whether you need a purpose-built plugin to automate a unique business process, or ongoing management to keep your site fast, secure and up to date — we've got you covered.</p>
                <ul className="feature-list" aria-label="WordPress features">
                  <li>Custom plugin development</li>
                  <li>Theme &amp; Gutenberg customisation</li>
                  <li>Security &amp; performance audits</li>
                  <li>WooCommerce &amp; membership integrations</li>
                </ul>
                <button className="es-service-quote-link" onClick={() => onNavigate('contact')}>
                  Get a quote for this service →
                </button>
              </div>
              <div className="anim-panel">
                <div className="wp-mockup" aria-label="WordPress admin interface animation" role="img">
                  <div className="wp-topbar">
                    <span className="wp-logo-icon">W</span>
                    <span className="wp-site-name">My Business Site</span>
                    <span className="wp-topbar-right">+ New</span>
                  </div>
                  <div className="wp-layout">
                    <nav className="wp-sidebar" aria-label="WordPress sidebar simulation">
                      <div className="wp-menu-item" id="wpm-dashboard"><span className="wp-menu-icon">⊞</span><span>Dashboard</span></div>
                      <div className="wp-menu-item wp-menu-item--active" id="wpm-plugins"><span className="wp-menu-icon">🔌</span><span>Plugins</span><span className="wp-caret">›</span></div>
                      <div className="wp-submenu" id="wp-submenu" style={{maxHeight:'120px',opacity:'1'}}>
                        <div className="wp-submenu-item wp-submenu-item--highlight" id="wpsub-installed">Installed Plugins</div>
                        <div className="wp-submenu-item" id="wpsub-add">Add New</div>
                        <div className="wp-submenu-item" id="wpsub-editor">Plugin Editor</div>
                      </div>
                      <div className="wp-menu-item" id="wpm-pages"><span className="wp-menu-icon">📄</span><span>Pages</span></div>
                      <div className="wp-menu-item" id="wpm-appearance"><span className="wp-menu-icon">🎨</span><span>Appearance</span></div>
                      <div className="wp-menu-item" id="wpm-settings"><span className="wp-menu-icon">⚙️</span><span>Settings</span></div>
                    </nav>
                    <div className="wp-content-area">
                      <div className="wp-content-title">Installed Plugins</div>
                      <div className="wp-plugin-row wp-plugin-row--active">
                        <div className="wp-plugin-info"><strong>EMEL Smart Forms</strong><span className="wp-plugin-badge">Active</span></div>
                        <div className="wp-plugin-desc">Custom AI-powered form builder with CRM sync.</div>
                      </div>
                      <div className="wp-plugin-row">
                        <div className="wp-plugin-info"><strong>EMEL SEO Booster</strong><span className="wp-plugin-badge wp-plugin-badge--inactive">Inactive</span></div>
                        <div className="wp-plugin-desc">Automated meta-tags, schema markup &amp; sitemaps.</div>
                      </div>
                      <div className="wp-plugin-row wp-plugin-row--active">
                        <div className="wp-plugin-info"><strong>EMEL WooSync</strong><span className="wp-plugin-badge">Active</span></div>
                        <div className="wp-plugin-desc">Real-time inventory sync with external warehouses.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 3: AI Solutions ── */}
        <section className="service-section reveal" id="ai-solutions" aria-labelledby="ais-heading">
          <div className="section-inner">
            <div className="section-tag">Artificial Intelligence</div>
            <h2 className="section-title" id="ais-heading">AI Solutions</h2>
            <div className="section-body">
              <div className="anim-panel">
                <div className="neural-canvas" aria-label="AI neural network animation" role="img">
                  <canvas id="neuralCanvas" width="480" height="280" aria-hidden="true"></canvas>
                  <div className="neural-label">
                    <span className="nl-chip">GPT-4o</span>
                    <span className="nl-chip">Claude 3.5</span>
                    <span className="nl-chip">Vision AI</span>
                  </div>
                </div>
              </div>
              <div className="section-text">
                <p>We bring the power of large language models and computer vision directly into your operations. From intelligent chatbots and document-processing pipelines to predictive analytics and custom fine-tuned models — our AI solutions are built for real-world impact.</p>
                <p>We work with the latest frontier models (OpenAI, Anthropic, Google Gemini) and open-source alternatives to design solutions that are cost-effective, secure, and deeply integrated with your existing tech stack.</p>
                <ul className="feature-list" aria-label="AI Solutions features">
                  <li>Custom LLM chatbots &amp; assistants</li>
                  <li>Document extraction &amp; classification</li>
                  <li>RAG (Retrieval-Augmented Generation) pipelines</li>
                  <li>AI fine-tuning &amp; model evaluation</li>
                </ul>
                <button className="es-service-quote-link" onClick={() => onNavigate('contact')}>
                  Get a quote for this service →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4: Data Analytics ── */}
        <section className="service-section service-section--alt reveal" id="data-analytics" aria-labelledby="data-heading">
          <div className="section-inner">
            <div className="section-tag">Analytics &amp; Reporting</div>
            <h2 className="section-title" id="data-heading">Data Analytics &amp; Custom Dashboards</h2>
            <div className="section-body section-body--reversed">
              <div className="section-text">
                <p>We transform raw information into actionable intelligence. With robust data pipelines, dynamic reporting platforms, and tailored dashboards (like Grafana and Power BI), we provide total visibility into your operations.</p>
                <p>By breaking down silos, cleaning messy datasets, and automating report generation, we empower you to make data-driven decisions seamlessly and accurately in real-time.</p>
                <ul className="feature-list" aria-label="Data Analytics features">
                  <li>Automated ETL data pipelines</li>
                  <li>Custom Grafana &amp; Power BI dashboards</li>
                  <li>Real-time reporting &amp; alerting</li>
                  <li>Database modeling &amp; warehousing</li>
                </ul>
                <button className="es-service-quote-link" onClick={() => onNavigate('contact')}>
                  Get a quote for this service →
                </button>
              </div>
              <div className="anim-panel">
                <div className="data-canvas" aria-label="Grafana style dashboard animation" role="img">
                  <svg className="data-svg" viewBox="0 0 540 280" xmlns="http://www.w3.org/2000/svg">
                    <rect width="540" height="280" rx="12" fill="#0f172a" />
                    <rect x="0" y="0" width="540" height="30" fill="#1e293b" />
                    <circle cx="20" cy="15" r="4" fill="#ef4444" />
                    <circle cx="35" cy="15" r="4" fill="#eab308" />
                    <circle cx="50" cy="15" r="4" fill="#22c55e" />
                    <text x="70" y="20" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Analytics Portal View</text>
                    <rect x="15" y="45" width="160" height="100" rx="6" fill="#1e293b" stroke="#334155" />
                    <text x="30" y="70" fill="#cbd5e1" fontSize="10" fontFamily="sans-serif">SYSTEM LOAD</text>
                    <text x="30" y="105" fill="#3b82f6" fontSize="26" fontFamily="sans-serif" fontWeight="bold">
                      78%
                      <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                    </text>
                    <polyline points="30,125 60,115 90,130 120,105 150,110" fill="none" stroke="#3b82f6" strokeWidth="2" />
                    <rect x="15" y="155" width="160" height="105" rx="6" fill="#1e293b" stroke="#334155" />
                    <text x="30" y="180" fill="#cbd5e1" fontSize="10" fontFamily="sans-serif">ACTIVE USERS</text>
                    <text x="30" y="215" fill="#10b981" fontSize="26" fontFamily="sans-serif" fontWeight="bold">
                      1,204
                      <animate attributeName="opacity" values="1;0.8;1" dur="3s" repeatCount="indefinite" />
                    </text>
                    <path d="M 30,240 Q 60,210 90,230 T 150,220 V 250 H 30 Z" fill="url(#g-green)" opacity="0.3" />
                    <path d="M 30,240 Q 60,210 90,230 T 150,220" fill="none" stroke="#10b981" strokeWidth="2" />
                    <rect x="190" y="45" width="335" height="215" rx="6" fill="#1e293b" stroke="#334155" />
                    <text x="210" y="70" fill="#cbd5e1" fontSize="10" fontFamily="sans-serif">DATA PIPELINE THROUGHPUT</text>
                    <g transform="translate(210, 85)">
                      <line x1="0" y1="0" x2="295" y2="0" stroke="#334155" strokeWidth="1" strokeDasharray="4 4"/>
                      <line x1="0" y1="40" x2="295" y2="40" stroke="#334155" strokeWidth="1" strokeDasharray="4 4"/>
                      <line x1="0" y1="80" x2="295" y2="80" stroke="#334155" strokeWidth="1" strokeDasharray="4 4"/>
                      <line x1="0" y1="120" x2="295" y2="120" stroke="#334155" strokeWidth="1"/>
                      {[0,1,2,3,4,5,6,7].map(i => (
                        <rect key={i} x={i*35 + 10} y="120" width="15" height="40" fill="#8b5cf6" rx="2">
                          <animate attributeName="y" values={`${120 - (40 + Math.random()*60)};${120 - (20 + Math.random()*80)};${120 - (40 + Math.random()*60)}`} dur={`${2 + Math.random()}s`} repeatCount="indefinite"/>
                          <animate attributeName="height" values={`${40 + Math.random()*60};${20 + Math.random()*80};${40 + Math.random()*60}`} dur={`${2 + Math.random()}s`} repeatCount="indefinite"/>
                        </rect>
                      ))}
                      {[0,1,2,3,4,5,6,7].map(i => (
                        <rect key={`2-${i}`} x={i*35 + 28} y="120" width="15" height="30" fill="#f59e0b" rx="2">
                          <animate attributeName="y" values={`${120 - (30 + Math.random()*50)};${120 - (10 + Math.random()*70)};${120 - (30 + Math.random()*50)}`} dur={`${2.5 + Math.random()}s`} repeatCount="indefinite"/>
                          <animate attributeName="height" values={`${30 + Math.random()*50};${10 + Math.random()*70};${30 + Math.random()*50}`} dur={`${2.5 + Math.random()}s`} repeatCount="indefinite"/>
                        </rect>
                      ))}
                    </g>
                    <defs>
                      <linearGradient id="g-green" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="transparent" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 5: Hardware ── */}
        <section className="service-section reveal" id="hardware" aria-labelledby="hw-heading">
          <div className="section-inner">
            <div className="section-tag">Infrastructure</div>
            <h2 className="section-title" id="hw-heading">Hardware Setup &amp; Troubleshooting</h2>
            <div className="section-body">
              <div className="anim-panel">
                <div className="hw-canvas" aria-label="Circuit board animation" role="img">
                  <svg className="hw-svg" viewBox="0 0 480 280" xmlns="http://www.w3.org/2000/svg">
                    <rect width="480" height="280" rx="16" fill="#0b1a12"/>
                    <g stroke="#0e2918" strokeWidth="1" opacity="0.8">
                      <line x1="0" y1="40" x2="480" y2="40"/><line x1="0" y1="80" x2="480" y2="80"/>
                      <line x1="0" y1="120" x2="480" y2="120"/><line x1="0" y1="160" x2="480" y2="160"/>
                      <line x1="0" y1="200" x2="480" y2="200"/><line x1="0" y1="240" x2="480" y2="240"/>
                      <line x1="60" y1="0" x2="60" y2="280"/><line x1="120" y1="0" x2="120" y2="280"/>
                      <line x1="180" y1="0" x2="180" y2="280"/><line x1="240" y1="0" x2="240" y2="280"/>
                      <line x1="300" y1="0" x2="300" y2="280"/><line x1="360" y1="0" x2="360" y2="280"/>
                      <line x1="420" y1="0" x2="420" y2="280"/>
                    </g>
                    <polyline points="30,140 60,140 60,80 120,80 180,80 180,120 240,120 300,120 300,160 360,160 420,160 420,200" fill="none" stroke="#06d6a0" strokeWidth="2.5" strokeLinecap="round"/>
                    <polyline points="30,200 60,200 60,240 120,240 180,240 180,160 240,160 240,120" fill="none" stroke="#4f8ef7" strokeWidth="2.5" strokeLinecap="round"/>
                    <polyline points="240,80 300,80 300,40 360,40 420,40 420,80 450,80" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
                    <g transform="translate(195,95)">
                      <rect width="90" height="50" rx="4" fill="#0f3020" stroke="#06d6a0" strokeWidth="1.5"/>
                      <text x="45" y="22" textAnchor="middle" fill="#06d6a0" fontSize="8" fontFamily="Inter" fontWeight="700">EMEL-MCU</text>
                      <text x="45" y="36" textAnchor="middle" fill="#4a7c5c" fontSize="7" fontFamily="Inter">Rev 2.4</text>
                      <line x1="0" y1="12" x2="-6" y2="12" stroke="#06d6a0" strokeWidth="1.5"/>
                      <line x1="0" y1="22" x2="-6" y2="22" stroke="#06d6a0" strokeWidth="1.5"/>
                      <line x1="0" y1="32" x2="-6" y2="32" stroke="#06d6a0" strokeWidth="1.5"/>
                      <line x1="90" y1="12" x2="96" y2="12" stroke="#06d6a0" strokeWidth="1.5"/>
                      <line x1="90" y1="22" x2="96" y2="22" stroke="#06d6a0" strokeWidth="1.5"/>
                      <line x1="90" y1="32" x2="96" y2="32" stroke="#06d6a0" strokeWidth="1.5"/>
                    </g>
                    <rect x="350" y="55" width="14" height="22" rx="2" fill="#1a0e02" stroke="#f97316" strokeWidth="1.5"/>
                    <rect x="370" y="55" width="14" height="22" rx="2" fill="#1a0e02" stroke="#f97316" strokeWidth="1.5"/>
                    <rect x="108" y="72" width="20" height="10" rx="3" fill="#1a1220" stroke="#7b61ff" strokeWidth="1.5"/>
                    <rect x="108" y="152" width="20" height="10" rx="3" fill="#1a1220" stroke="#7b61ff" strokeWidth="1.5"/>
                    <circle cx="420" cy="200" r="8" fill="#06d6a0" opacity="0.2">
                      <animate attributeName="opacity" values="0.2;0.9;0.2" dur="1.6s" repeatCount="indefinite"/>
                    </circle>
                    <circle cx="420" cy="200" r="4" fill="#06d6a0">
                      <animate attributeName="opacity" values="0.6;1;0.6" dur="1.6s" repeatCount="indefinite"/>
                    </circle>
                    <circle r="4" fill="#06d6a0" opacity="0.9">
                      <animateMotion dur="3.2s" repeatCount="indefinite" path="M 30,140 60,140 60,80 120,80 180,80 180,120 240,120 300,120 300,160 360,160 420,160 420,200"/>
                    </circle>
                    <circle r="4" fill="#4f8ef7" opacity="0.9">
                      <animateMotion dur="4s" repeatCount="indefinite" begin="1s" path="M 30,200 60,200 60,240 120,240 180,240 180,160 240,160 240,120"/>
                    </circle>
                    <circle r="3" fill="#f97316" opacity="0.9">
                      <animateMotion dur="2.8s" repeatCount="indefinite" begin="0.5s" path="M 240,80 300,80 300,40 360,40 420,40 420,80 450,80"/>
                    </circle>
                  </svg>
                </div>
              </div>
              <div className="section-text">
                <p>Reliable infrastructure is the backbone of any successful technology strategy. Whether you're fitting out a new office, upgrading your server room, or troubleshooting a critical hardware failure — our engineers are on hand to diagnose, resolve, and future-proof your setup.</p>
                <p>From network configuration and workstation deployment to NAS storage and smart-device integration, we handle the physical layer so your team can focus on what matters most.</p>
                <ul className="feature-list" aria-label="Hardware features">
                  <li>Office &amp; home network setup</li>
                  <li>Server &amp; NAS configuration</li>
                  <li>Workstation builds &amp; upgrades</li>
                  <li>Remote &amp; on-site troubleshooting</li>
                </ul>
                <button className="es-service-quote-link" onClick={() => onNavigate('contact')}>
                  Get a quote for this service →
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer CTA ── */}
      <div className="es-services-footer-cta">
        <h2>Not sure which service you need?</h2>
        <p>Get in touch and we'll help you figure out the best approach for your requirements.</p>
        <button className="es-btn-primary" onClick={() => onNavigate('contact')}>
          Talk to Us
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default EmelServicesPage;

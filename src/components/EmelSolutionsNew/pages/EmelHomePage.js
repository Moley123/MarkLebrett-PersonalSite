import React from 'react';

const SERVICES = [
  {
    key: 'ai-auto',
    icon: '⚡',
    iconClass: 'es-card__icon--blue',
    tag: 'AI & Automation',
    title: 'AI Automation & Workflow Development',
    desc: 'Intelligent pipelines that eliminate repetitive tasks — from webhook-triggered workflows to LLM-augmented data processing.',
  },
  {
    key: 'wordpress',
    icon: '🔌',
    iconClass: 'es-card__icon--purple',
    tag: 'Web Development',
    title: 'WordPress Management & Custom Plugins',
    desc: 'Bespoke plugin development, Gutenberg blocks, WooCommerce integrations, and ongoing site management.',
  },
  {
    key: 'ai-solutions',
    icon: '🤖',
    iconClass: 'es-card__icon--blue',
    tag: 'Artificial Intelligence',
    title: 'AI Solutions',
    desc: 'Custom LLM chatbots, RAG pipelines, document processing and fine-tuned models — built for real-world impact.',
  },
  {
    key: 'data',
    icon: '📊',
    iconClass: 'es-card__icon--green',
    tag: 'Analytics',
    title: 'Data Analytics & Custom Dashboards',
    desc: 'ETL pipelines, Grafana and Power BI dashboards, real-time reporting and database warehousing.',
  },
  {
    key: 'hardware',
    icon: '🖥️',
    iconClass: 'es-card__icon--orange',
    tag: 'Infrastructure',
    title: 'Hardware Setup & Troubleshooting',
    desc: 'Network configuration, server and NAS setup, workstation builds, and remote or on-site support.',
  },
];

const WHY = [
  {
    icon: '🎯',
    title: 'Bespoke, not boxed',
    desc: 'Every solution is built specifically for your requirements — no off-the-shelf shortcuts, no unnecessary complexity.',
  },
  {
    icon: '🧠',
    title: 'AI-native approach',
    desc: 'Automation and intelligence are built into every solution from day one, not bolted on after the fact.',
  },
  {
    icon: '🔧',
    title: 'Full-stack delivery',
    desc: 'From infrastructure and backend to frontend and analytics — one point of contact, end-to-end.',
  },
];

const EmelHomePage = ({ onNavigate }) => (
  <>
    {/* ── Hero ── */}
    <section className="es-hero" id="home" aria-label="EMEL Solutions hero">
      <div className="es-hero__content">
        <span className="es-hero__eyebrow">UK-based Technology Consultancy</span>
        <h1 className="es-hero__title">
          Intelligent Technology.<br />
          <span>Seamless Results.</span>
        </h1>
        <p className="es-hero__sub">
          We help businesses automate, integrate, and innovate — from AI-powered workflows to
          infrastructure that just works. Bespoke solutions built for real-world impact.
        </p>
        <div className="es-hero__actions">
          <button className="es-btn-primary" onClick={() => onNavigate('services')}>
            Explore Our Services
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="es-btn-outline" onClick={() => onNavigate('contact')}>
            Get in Touch
          </button>
        </div>
      </div>
    </section>

    {/* ── Stats ── */}
    <div className="es-stats" aria-label="Key statistics">
      <div className="es-stats__inner">
        <div>
          <span className="es-stat__value">5</span>
          <span className="es-stat__label">Core Service Areas</span>
        </div>
        <div>
          <span className="es-stat__value">100%</span>
          <span className="es-stat__label">UK-Based</span>
        </div>
        <div>
          <span className="es-stat__value">AI&#8209;native</span>
          <span className="es-stat__label">Since 2022</span>
        </div>
        <div>
          <span className="es-stat__value">End&#8209;to&#8209;end</span>
          <span className="es-stat__label">Delivery</span>
        </div>
      </div>
    </div>

    {/* ── Services overview ── */}
    <section className="es-services-overview" aria-labelledby="services-heading">
      <div className="es-services-overview__inner">
        <div className="es-section-header">
          <h2 id="services-heading">What We Do</h2>
          <p>From intelligent automation to custom hardware — we cover the full technology stack so you don't have to.</p>
        </div>
        <div className="es-cards-grid">
          {SERVICES.map(s => (
            <button
              key={s.key}
              className="es-card"
              onClick={() => onNavigate('services')}
              aria-label={`Learn more about ${s.title}`}
            >
              <div className={`es-card__icon ${s.iconClass}`} aria-hidden="true">{s.icon}</div>
              <span className="es-card__tag">{s.tag}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <span className="es-card__link">
                Learn more
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>

    {/* ── Why EMEL ── */}
    <section className="es-why" aria-labelledby="why-heading">
      <div className="es-why__inner">
        <div className="es-section-header">
          <h2 id="why-heading">Why EMEL Solutions?</h2>
          <p>We're not an agency — we're a specialist consultancy that works directly with you.</p>
        </div>
        <div className="es-why__grid">
          {WHY.map(w => (
            <div key={w.title} className="es-why-item">
              <div className="es-why-item__icon" aria-hidden="true">{w.icon}</div>
              <h3>{w.title}</h3>
              <p>{w.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── Closing CTA ── */}
    <section className="es-cta-band" aria-label="Call to action">
      <div className="es-cta-band__inner">
        <h2>Ready to transform how your business works?</h2>
        <p>
          Whether you have a specific project in mind or just want to explore the possibilities,
          we'd love to hear from you.
        </p>
        <button className="es-btn-primary" onClick={() => onNavigate('contact')}>
          Start a Conversation
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </section>
  </>
);

export default EmelHomePage;

import React from 'react';

const TECH_STACK = [
  { label: 'n8n',        dotClass: 'es-tech__badge-dot--green'  },
  { label: 'Make',       dotClass: 'es-tech__badge-dot--green'  },
  { label: 'OpenAI',     dotClass: '' },
  { label: 'Anthropic',  dotClass: '' },
  { label: 'WordPress',  dotClass: 'es-tech__badge-dot--purple' },
  { label: 'Grafana',    dotClass: 'es-tech__badge-dot--orange' },
  { label: 'Power BI',   dotClass: 'es-tech__badge-dot--orange' },
  { label: 'React',      dotClass: '' },
  { label: 'Python',     dotClass: '' },
  { label: 'Linux',      dotClass: 'es-tech__badge-dot--green'  },
  { label: 'Docker',     dotClass: 'es-tech__badge-dot--green'  },
  { label: 'PostgreSQL', dotClass: '' },
];

const PROCESS = [
  {
    num: '01',
    title: 'Discover',
    desc: 'We start by understanding your business, goals, and the problem you need solved — no assumptions, no off-the-shelf templates.',
  },
  {
    num: '02',
    title: 'Design',
    desc: 'Architecture, workflow mapping, and technology selection. We present a clear plan before writing a line of code.',
  },
  {
    num: '03',
    title: 'Build',
    desc: "Delivery in sprints with regular check-ins, so you always know what's happening and can steer if priorities change.",
  },
  {
    num: '04',
    title: 'Support',
    desc: "Thorough handover, documentation, and ongoing maintenance options — we don't disappear after go-live.",
  },
];

const EmelAboutPage = ({ onNavigate }) => (
  <>
    {/* ── Hero ── */}
    <div className="es-about-hero">
      <h1>About EMEL Solutions</h1>
      <p>
        Sophisticated technology shouldn't require an enterprise budget.
        We help businesses of all sizes access the tools and expertise that were
        previously out of reach.
      </p>
    </div>

    {/* ── Mission ── */}
    <section className="es-about-mission" aria-labelledby="mission-heading">
      <div className="es-about-mission__inner">
        <div className="es-about-mission__text">
          <h2 id="mission-heading">Who We Are</h2>
          <p>
            EMEL Solutions is a UK-based technology consultancy founded on the belief that
            modern AI, automation, and data tools should be accessible to every organisation —
            not just those with large IT departments or six-figure software budgets.
          </p>
          <p>
            We work with SMEs, growing teams, and ambitious founders to design and deliver
            technology projects that are built to last. From intelligent automation pipelines
            and custom WordPress development to bespoke AI integrations and reliable
            infrastructure — we cover the full stack.
          </p>
          <p>
            When you work with EMEL Solutions, you work directly with the person who builds
            your solution. No account managers, no handoffs, no surprises.
          </p>
        </div>
        <div className="es-about-visual" aria-hidden="true">
          <div className="es-about-hex-wrap">
            <svg viewBox="0 0 260 260" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Outer hex */}
              <polygon points="130,15 220,65 220,165 130,215 40,165 40,65"
                fill="none" stroke="#4f8ef7" strokeWidth="2" opacity="0.35"/>
              {/* Orbiting ring */}
              <g className="es-hex-orbit">
                <circle cx="130" cy="15" r="5" fill="#4f8ef7" opacity="0.7"/>
                <circle cx="220" cy="65" r="4" fill="#7b61ff" opacity="0.6"/>
                <circle cx="220" cy="165" r="4" fill="#06d6a0" opacity="0.6"/>
                <circle cx="130" cy="215" r="5" fill="#4f8ef7" opacity="0.7"/>
                <circle cx="40"  cy="165" r="4" fill="#7b61ff" opacity="0.6"/>
                <circle cx="40"  cy="65"  r="4" fill="#06d6a0" opacity="0.6"/>
              </g>
              {/* Inner hex */}
              <polygon points="130,55 175,80 175,130 130,155 85,130 85,80"
                fill="none" stroke="#7b61ff" strokeWidth="1.5" opacity="0.5"/>
              {/* Second orbit */}
              <g className="es-hex-orbit-2">
                <circle cx="130" cy="55"  r="3.5" fill="#7b61ff" opacity="0.8"/>
                <circle cx="175" cy="80"  r="3"   fill="#4f8ef7" opacity="0.7"/>
                <circle cx="175" cy="130" r="3"   fill="#06d6a0" opacity="0.7"/>
                <circle cx="130" cy="155" r="3.5" fill="#7b61ff" opacity="0.8"/>
                <circle cx="85"  cy="130" r="3"   fill="#4f8ef7" opacity="0.7"/>
                <circle cx="85"  cy="80"  r="3"   fill="#06d6a0" opacity="0.7"/>
              </g>
              {/* Centre */}
              <circle cx="130" cy="115" r="28" fill="rgba(79,142,247,0.08)" stroke="#4f8ef7" strokeWidth="1.5"/>
              <text x="130" y="108" textAnchor="middle" fontFamily="Space Grotesk, sans-serif"
                fontSize="18" fontWeight="700" fill="#4f8ef7">EMEL</text>
              <text x="130" y="126" textAnchor="middle" fontFamily="Inter, sans-serif"
                fontSize="7" fill="#7cb3ff" letterSpacing="3">SOLUTIONS</text>
            </svg>
          </div>
        </div>
      </div>
    </section>

    {/* ── Founder ── */}
    <section className="es-founder" aria-labelledby="founder-heading">
      <div className="es-founder__inner">
        <div className="es-section-header">
          <h2 id="founder-heading">The Founder</h2>
        </div>
        <div className="es-founder__card">
          <div className="es-founder__avatar" aria-hidden="true">ML</div>
          <div className="es-founder__info">
            <h3>Mark Lebrett</h3>
            <span className="es-founder__title">Founder &amp; Lead Consultant</span>
            <p className="es-founder__bio">
              Mark is a software developer and AI practitioner based in the UK, with experience
              spanning full-stack development, intelligent automation, and infrastructure engineering.
              He founded EMEL Solutions to bring enterprise-grade technology to businesses that
              wouldn't otherwise have access to it — working directly with every client, on every
              project, from first call to final delivery.
            </p>
            <div className="es-founder__links">
              <a
                href="https://www.linkedin.com/in/mark-l-5baa48160/"
                target="_blank"
                rel="noopener noreferrer"
                className="es-founder__link"
                aria-label="Mark Lebrett on LinkedIn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
                  <circle cx="4" cy="4" r="2"/>
                </svg>
                LinkedIn
              </a>
              <a
                href="https://github.com/Moley123"
                target="_blank"
                rel="noopener noreferrer"
                className="es-founder__link"
                aria-label="Mark Lebrett on GitHub"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/>
                </svg>
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* ── Process ── */}
    <section className="es-process" aria-labelledby="process-heading">
      <div className="es-process__inner">
        <div className="es-section-header">
          <h2 id="process-heading">Our Process</h2>
          <p>A straightforward approach that keeps you informed and in control at every stage.</p>
        </div>
        <div className="es-timeline">
          {PROCESS.map(step => (
            <div key={step.num} className="es-timeline-step">
              <div className="es-timeline-step__num" aria-hidden="true">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ── Tech stack ── */}
    <section className="es-tech" aria-labelledby="tech-heading">
      <div className="es-tech__inner">
        <div className="es-section-header">
          <h2 id="tech-heading">Technologies We Work With</h2>
          <p>We choose the right tool for each job — not the most fashionable one.</p>
        </div>
        <div className="es-tech__grid">
          {TECH_STACK.map(t => (
            <span key={t.label} className="es-tech__badge">
              <span className={`es-tech__badge-dot ${t.dotClass}`} aria-hidden="true"></span>
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </section>

    {/* ── CTA ── */}
    <section className="es-cta-band" aria-label="Get in touch">
      <div className="es-cta-band__inner">
        <h2>Want to work together?</h2>
        <p>We'd love to hear about your project. Get in touch and let's see what we can build.</p>
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

export default EmelAboutPage;

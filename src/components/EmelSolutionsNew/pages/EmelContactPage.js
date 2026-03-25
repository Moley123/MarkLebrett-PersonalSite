import React, { useState } from 'react';

const INITIAL_FORM = {
  name: '', email: '', company: '', service: '', message: '', budget: '',
};

const SERVICES_OPTIONS = [
  'AI Automation & Workflow Development',
  'WordPress Management & Custom Plugins',
  'AI Solutions',
  'Data Analytics & Custom Dashboards',
  'Hardware Setup & Troubleshooting',
  'General Enquiry',
];

const BUDGET_OPTIONS = [
  'Under £1,000',
  '£1,000 – £5,000',
  '£5,000 – £20,000',
  '£20,000+',
  'Prefer not to say',
];

const validate = (form) => {
  const errors = {};
  if (!form.name.trim())    errors.name = 'Please enter your name.';
  if (!form.email.trim())   errors.email = 'Please enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Please enter a valid email address.';
  if (!form.message.trim()) errors.message = 'Please include a message.';
  else if (form.message.trim().length < 20) errors.message = 'Message must be at least 20 characters.';
  return errors;
};

const EmelContactPage = () => {
  const [form, setForm]     = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | success | error

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(errs => { const next = { ...errs }; delete next[name]; return next; });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setStatus('sending');

    /* ── mailto fallback ──
       TODO: Replace this block with a real POST to /api/contact or a Formspree endpoint:
         fetch('https://formspree.io/f/YOUR_FORM_ID', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(form),
         }).then(res => res.ok ? setStatus('success') : setStatus('error'))
           .catch(() => setStatus('error'));
    */
    const subject = encodeURIComponent(`EMEL Solutions Enquiry${form.service ? ` — ${form.service}` : ''}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}${form.company ? `\nCompany: ${form.company}` : ''}` +
      `${form.service ? `\nService: ${form.service}` : ''}${form.budget ? `\nBudget: ${form.budget}` : ''}` +
      `\n\nMessage:\n${form.message}`
    );
    window.location.href = `mailto:mark@lebrett.com?subject=${subject}&body=${body}`;
    setStatus('success');
  };

  return (
    <>
      {/* ── Hero ── */}
      <div className="es-contact-hero">
        <h1>Let's Work Together</h1>
        <p>
          Have a project in mind, want to explore the possibilities, or just need some advice?
          Drop us a message and we'll get back to you within one business day.
        </p>
      </div>

      {/* ── Body ── */}
      <div className="es-contact-body">
        <div className="es-contact-body__inner">

          {/* ── Form ── */}
          <div>
            {status === 'success' ? (
              <div className="es-form-success" role="alert">
                <span className="es-form-success__icon" aria-hidden="true">✓</span>
                <h3>Message received!</h3>
                <p>Your email client should have opened with a pre-filled message. We'll be in touch within one business day.</p>
              </div>
            ) : (
              <form className="es-form" onSubmit={handleSubmit} noValidate aria-label="Contact form">
                <div className="es-form-row">
                  <div className={`es-form-field${errors.name ? ' has-error' : ''}`}>
                    <label htmlFor="cf-name">Name</label>
                    <input
                      id="cf-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Jane Smith"
                      value={form.name}
                      onChange={handleChange}
                      aria-required="true"
                      aria-describedby={errors.name ? 'cf-name-err' : undefined}
                    />
                    {errors.name && <span id="cf-name-err" className="es-form-field__error" role="alert">⚠ {errors.name}</span>}
                  </div>
                  <div className={`es-form-field${errors.email ? ' has-error' : ''}`}>
                    <label htmlFor="cf-email">Email</label>
                    <input
                      id="cf-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="jane@company.com"
                      value={form.email}
                      onChange={handleChange}
                      aria-required="true"
                      aria-describedby={errors.email ? 'cf-email-err' : undefined}
                    />
                    {errors.email && <span id="cf-email-err" className="es-form-field__error" role="alert">⚠ {errors.email}</span>}
                  </div>
                </div>

                <div className="es-form-row">
                  <div className="es-form-field">
                    <label htmlFor="cf-company">Company <span className="optional">(optional)</span></label>
                    <input
                      id="cf-company"
                      name="company"
                      type="text"
                      autoComplete="organization"
                      placeholder="Acme Ltd"
                      value={form.company}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="es-form-field">
                    <label htmlFor="cf-service">Service Interest <span className="optional">(optional)</span></label>
                    <select id="cf-service" name="service" value={form.service} onChange={handleChange}>
                      <option value="">Select a service…</option>
                      {SERVICES_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className={`es-form-field${errors.message ? ' has-error' : ''}`}>
                  <label htmlFor="cf-message">Message</label>
                  <textarea
                    id="cf-message"
                    name="message"
                    placeholder="Tell us about your project or question…"
                    value={form.message}
                    onChange={handleChange}
                    aria-required="true"
                    aria-describedby={errors.message ? 'cf-message-err' : undefined}
                  />
                  {errors.message && <span id="cf-message-err" className="es-form-field__error" role="alert">⚠ {errors.message}</span>}
                </div>

                <div className="es-form-field">
                  <label htmlFor="cf-budget">Approximate Budget <span className="optional">(optional)</span></label>
                  <select id="cf-budget" name="budget" value={form.budget} onChange={handleChange}>
                    <option value="">Prefer not to say…</option>
                    {BUDGET_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <button
                  type="submit"
                  className="es-form-submit"
                  disabled={status === 'sending'}
                  aria-busy={status === 'sending'}
                >
                  {status === 'sending' ? 'Opening email client…' : (
                    <>
                      Send Message
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/>
                        <path d="M2 7l10 7 10-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* ── Aside ── */}
          <div className="es-contact-aside">
            <div className="es-status-badge" aria-label="Availability status">
              <span className="es-status-dot" aria-hidden="true"></span>
              Currently accepting projects
            </div>

            <div className="es-contact-info-card">
              <h3>Contact Details</h3>
              <div className="es-contact-detail">
                <div className="es-contact-detail__icon" aria-hidden="true">✉</div>
                <div className="es-contact-detail__text">
                  <strong>Email</strong>
                  <a href="mailto:mark@lebrett.com">mark@lebrett.com</a>
                </div>
              </div>
              <div className="es-contact-detail">
                <div className="es-contact-detail__icon" aria-hidden="true">📍</div>
                <div className="es-contact-detail__text">
                  <strong>Location</strong>
                  <span>UK-based, available worldwide</span>
                </div>
              </div>
              <div className="es-contact-detail">
                <div className="es-contact-detail__icon" aria-hidden="true">⏱</div>
                <div className="es-contact-detail__text">
                  <strong>Response Time</strong>
                  <span>Within 1 business day</span>
                </div>
              </div>
            </div>

            <div className="es-contact-info-card">
              <h3>What happens next?</h3>
              <div className="es-contact-detail">
                <div className="es-contact-detail__icon" aria-hidden="true">1</div>
                <div className="es-contact-detail__text">
                  <strong>We review your message</strong>
                  <span>Usually within a few hours during business days</span>
                </div>
              </div>
              <div className="es-contact-detail">
                <div className="es-contact-detail__icon" aria-hidden="true">2</div>
                <div className="es-contact-detail__text">
                  <strong>Discovery call</strong>
                  <span>A short call to understand your requirements in detail</span>
                </div>
              </div>
              <div className="es-contact-detail">
                <div className="es-contact-detail__icon" aria-hidden="true">3</div>
                <div className="es-contact-detail__text">
                  <strong>Proposal &amp; timeline</strong>
                  <span>A clear, fixed-price proposal with no hidden costs</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EmelContactPage;

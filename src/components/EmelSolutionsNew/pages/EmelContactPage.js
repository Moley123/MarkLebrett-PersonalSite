import React from 'react';

const EmelContactPage = () => (
  <>
    {/* ── Hero ── */}
    <div className="es-contact-hero">
      <h1>Let's Work Together</h1>
      <p>
        Have a project in mind, want to explore the possibilities, or just need some advice?
        Get in touch and we'll respond within one business day.
      </p>
    </div>

    {/* ── Body ── */}
    <div className="es-contact-body">
      <div className="es-contact-body__inner">

        {/* ── Email CTA ── */}
        <div className="es-contact-email-panel">
          <p>The best way to reach us is by email. Click below to start a conversation:</p>
          <a
            className="es-contact-mailto-btn"
            href="mailto:mark@lebrett.com?subject=EMEL%20Solutions%20Enquiry"
            aria-label="Email EMEL Solutions"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M2 7l10 7 10-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            mark@lebrett.com
          </a>
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

export default EmelContactPage;

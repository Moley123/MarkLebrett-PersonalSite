import React from 'react';

const FooterLogoSVG = () => (
  <svg viewBox="0 0 180 44" fill="none" xmlns="http://www.w3.org/2000/svg" width="148" aria-label="EMEL Solutions">
    <polygon points="20,4 32,11 32,25 20,32 8,25 8,11" fill="none" stroke="#4f8ef7" strokeWidth="2"/>
    <circle cx="20" cy="18" r="3.5" fill="#4f8ef7"/>
    <text x="42" y="24" fontFamily="Space Grotesk, sans-serif" fontSize="20" fontWeight="700" fill="white">EMEL</text>
    <text x="43" y="36" fontFamily="Inter, sans-serif" fontSize="7" fill="#7cb3ff" letterSpacing="3">SOLUTIONS</text>
  </svg>
);

const EmelSiteFooter = ({ onNavigate }) => {
  const year = new Date().getFullYear();

  return (
    <footer className="es-footer">
      <div className="es-footer__inner">
        {/* Brand */}
        <div className="es-footer__brand">
          <FooterLogoSVG />
          <p>
            Intelligent technology solutions for modern businesses — from AI automation
            and custom development to data analytics and infrastructure.
          </p>
        </div>

        {/* Services */}
        <div className="es-footer__col">
          <h4>Services</h4>
          <ul>
            <li><button onClick={() => onNavigate('services')}>AI Automation</button></li>
            <li><button onClick={() => onNavigate('services')}>WordPress Development</button></li>
            <li><button onClick={() => onNavigate('services')}>AI Solutions</button></li>
            <li><button onClick={() => onNavigate('services')}>Data Analytics</button></li>
            <li><button onClick={() => onNavigate('services')}>Hardware &amp; Infrastructure</button></li>
          </ul>
        </div>

        {/* Company */}
        <div className="es-footer__col">
          <h4>Company</h4>
          <ul>
            <li><button onClick={() => onNavigate('home')}>Home</button></li>
            <li><button onClick={() => onNavigate('about')}>About</button></li>
            <li><button onClick={() => onNavigate('contact')}>Contact</button></li>
          </ul>
        </div>

        {/* Contact */}
        <div className="es-footer__col">
          <h4>Get in Touch</h4>
          <ul>
            <li><a href="mailto:mark@lebrett.com">mark@lebrett.com</a></li>
            <li><a href="https://www.linkedin.com/in/mark-l-5baa48160/" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
            <li><a href="https://github.com/Moley123" target="_blank" rel="noopener noreferrer">GitHub</a></li>
          </ul>
        </div>
      </div>

      <div className="es-footer__bottom" style={{ maxWidth: 'var(--es-max-w)', margin: '0 auto' }}>
        <span>&copy; {year} EMEL Solutions. All rights reserved.</span>
        <a href="mailto:mark@lebrett.com" style={{ color: '#94a3b8', fontSize: '0.8rem', textDecoration: 'none' }}>mark@lebrett.com</a>
      </div>
    </footer>
  );
};

export default EmelSiteFooter;

import React, { useState, useEffect } from 'react';

const LogoSVG = () => (
  <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36" aria-hidden="true">
    <polygon points="22,3 38,12 38,30 22,39 6,30 6,12" fill="none" stroke="#4f8ef7" strokeWidth="2.2"/>
    <polygon points="22,12 31,17 31,27 22,32 13,27 13,17" fill="none" stroke="#7cb3ff" strokeWidth="1.2" opacity="0.5"/>
    <circle cx="22" cy="3"  r="2.2" fill="#4f8ef7"/>
    <circle cx="38" cy="12" r="2.2" fill="#4f8ef7"/>
    <circle cx="38" cy="30" r="2.2" fill="#4f8ef7"/>
    <circle cx="22" cy="39" r="2.2" fill="#4f8ef7"/>
    <circle cx="6"  cy="30" r="2.2" fill="#4f8ef7"/>
    <circle cx="6"  cy="12" r="2.2" fill="#4f8ef7"/>
    <circle cx="22" cy="21" r="4"   fill="#4f8ef7" opacity="0.85"/>
  </svg>
);

const NAV_LINKS = [
  { key: 'home',     label: 'Home' },
  { key: 'services', label: 'Services' },
  { key: 'about',    label: 'About' },
  { key: 'contact',  label: 'Contact' },
];

const EmelSiteHeader = ({ currentPage, onNavigate }) => {
  const [scrolled, setScrolled]       = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNav = (key) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  return (
    <header className={`es-header${scrolled ? ' es-header--scrolled' : ''}`}>
      <div className="es-header__inner">
        {/* Logo */}
        <button
          className="es-header__logo"
          onClick={() => handleNav('home')}
          aria-label="EMEL Solutions — go to home"
        >
          <LogoSVG />
          EMEL <span className="es-header__logo-sub">Solutions</span>
        </button>

        {/* Desktop nav */}
        <nav className="es-header__nav" aria-label="Main navigation">
          {NAV_LINKS.map(link => (
            <button
              key={link.key}
              className={`es-header__nav-link${currentPage === link.key ? ' active' : ''}`}
              onClick={() => handleNav(link.key)}
              aria-current={currentPage === link.key ? 'page' : undefined}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="es-header__right">
          <button
            className="es-header__cta"
            onClick={() => handleNav('contact')}
          >
            Get a Quote
          </button>
          <button
            className={`es-header__hamburger${mobileOpen ? ' open' : ''}`}
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="es-header__drawer" role="dialog" aria-label="Mobile navigation">
          {NAV_LINKS.map(link => (
            <button
              key={link.key}
              className={`es-header__drawer-link${currentPage === link.key ? ' active' : ''}`}
              onClick={() => handleNav(link.key)}
              aria-current={currentPage === link.key ? 'page' : undefined}
            >
              {link.label}
            </button>
          ))}
          <button
            className="es-header__drawer-cta"
            onClick={() => handleNav('contact')}
          >
            Get a Quote
          </button>
        </div>
      )}
    </header>
  );
};

export default EmelSiteHeader;

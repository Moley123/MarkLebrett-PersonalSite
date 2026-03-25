import React, { useState, useEffect } from 'react';
import '../EmelSolutionsPage.css';
import './EmelSiteStyles.css';
import EmelSiteHeader from './EmelSiteHeader';
import EmelSiteFooter from './EmelSiteFooter';
import EmelHomePage    from './pages/EmelHomePage';
import EmelServicesPage from './pages/EmelServicesPage';
import EmelAboutPage   from './pages/EmelAboutPage';
import EmelContactPage from './pages/EmelContactPage';

const EmelSolutionsNew = () => {
  const [currentPage, setCurrentPage] = useState('home');

  /* ── Per-page document title ── */
  useEffect(() => {
    const titles = {
      home:     'EMEL Solutions — Intelligent Technology. Seamless Results.',
      services: 'EMEL Solutions | Services',
      about:    'EMEL Solutions | About',
      contact:  'EMEL Solutions | Contact',
    };
    document.title = titles[currentPage] || titles.home;
  }, [currentPage]);

  /* ── Scroll to top on page change ── */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  /* ── Favicon & OG tags (set once on mount) ── */
  useEffect(() => {
    const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" fill="#0a0f1e"/>
      <polygon points="16,3 26,8.5 26,19.5 16,25 6,19.5 6,8.5" fill="none" stroke="#4f8ef7" stroke-width="1.8"/>
      <circle cx="16" cy="14" r="3.5" fill="#4f8ef7"/>
      <circle cx="16" cy="3"  r="1.5" fill="#4f8ef7"/>
      <circle cx="26" cy="8.5"  r="1.5" fill="#4f8ef7"/>
      <circle cx="26" cy="19.5" r="1.5" fill="#4f8ef7"/>
      <circle cx="16" cy="25" r="1.5" fill="#4f8ef7"/>
      <circle cx="6"  cy="19.5" r="1.5" fill="#4f8ef7"/>
      <circle cx="6"  cy="8.5"  r="1.5" fill="#4f8ef7"/>
    </svg>`;
    const favicon = document.createElement('link');
    favicon.rel = 'icon'; favicon.type = 'image/svg+xml';
    favicon.href = 'data:image/svg+xml,' + encodeURIComponent(svgFavicon);
    document.head.appendChild(favicon);

    const metas = [
      { sel: 'meta[property="og:title"]',       val: 'EMEL Solutions — Intelligent Technology. Seamless Results.' },
      { sel: 'meta[property="og:description"]', val: 'Expert AI automation, WordPress development, bespoke AI solutions and hardware setup for modern businesses. UK-based.' },
      { sel: 'meta[property="og:url"]',          val: 'https://marklebrett.co.uk/emelsolutions' },
      { sel: 'meta[name="description"]',         val: 'EMEL Solutions — expert AI automation, WordPress development, bespoke AI solutions and hardware setup for modern businesses.' },
      { sel: 'meta[name="twitter:title"]',       val: 'EMEL Solutions — Intelligent Technology. Seamless Results.' },
      { sel: 'meta[name="twitter:description"]', val: 'Expert AI automation, WordPress development, bespoke AI solutions and hardware setup for modern businesses. UK-based.' },
    ];
    metas.forEach(({ sel, val }) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute('content', val);
    });

    return () => { document.head.removeChild(favicon); };
  }, []);

  return (
    <div className="emel-site">
      <EmelSiteHeader currentPage={currentPage} onNavigate={setCurrentPage} />

      <main id="main-content">
        {currentPage === 'home'     && <EmelHomePage    onNavigate={setCurrentPage} />}
        {currentPage === 'services' && <EmelServicesPage onNavigate={setCurrentPage} />}
        {currentPage === 'about'    && <EmelAboutPage   onNavigate={setCurrentPage} />}
        {currentPage === 'contact'  && <EmelContactPage />}
      </main>

      <EmelSiteFooter onNavigate={setCurrentPage} />
    </div>
  );
};

export default EmelSolutionsNew;

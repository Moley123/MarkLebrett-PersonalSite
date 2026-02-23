import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Users, ArrowRight, Lock, Linkedin, Github, Zap, Shield, Clock } from 'lucide-react';

const LandingPage = () => {
  const [location, setLocation] = useState('Earth');
  const [visitorCount, setVisitorCount] = useState('...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ── Page title ──
    document.title = 'Mark Lebrett | Portal';

    // ── Favicon: ML monogram in blue/emerald ──
    const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#60a5fa"/>
          <stop offset="100%" stop-color="#34d399"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="#111827"/>
      <text x="4" y="22" font-family="system-ui,sans-serif" font-size="16" font-weight="800" fill="url(#g)">ML</text>
    </svg>`;
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.href = 'data:image/svg+xml,' + encodeURIComponent(svgFavicon);
    document.head.appendChild(favicon);

    // ── OG / Twitter meta tags (dynamic update for client-side nav) ──
    const metaUpdates = [
      { sel: 'meta[property="og:title"]',       attr: 'content', val: 'Mark Lebrett | Portal' },
      { sel: 'meta[property="og:description"]', attr: 'content', val: 'The personal portal of Mark Lebrett — explore tools including the Gematria Explorer, EMEL Solutions, and more.' },
      { sel: 'meta[property="og:url"]',          attr: 'content', val: 'https://marklebrett.co.uk/' },
      { sel: 'meta[name="description"]',         attr: 'content', val: 'The personal portal of Mark Lebrett — explore tools including the Gematria Explorer, EMEL Solutions, and more.' },
      { sel: 'meta[name="twitter:title"]',       attr: 'content', val: 'Mark Lebrett | Portal' },
      { sel: 'meta[name="twitter:description"]', attr: 'content', val: 'The personal portal of Mark Lebrett — explore tools including the Gematria Explorer, EMEL Solutions, and more.' },
    ];
    metaUpdates.forEach(({ sel, attr, val }) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute(attr, val);
    });

    return () => {
      document.head.removeChild(favicon);
    };
  }, []);

  useEffect(() => {
    // 1. Fetch User Location
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if(data.city && data.country_name) {
          setLocation(`${data.city}, ${data.country_name}`);
        } else {
          setLocation('Earth'); // Fallback if data is not as expected
        }
        setLoading(false);
      })
      .catch((err) => {
          console.error("Location API failed:", err);
          setLocation('Earth'); // Fallback on error
          setLoading(false);
      });
  }, []);

  useEffect(() => {
    // 2. VISITOR COUNTER
    const namespace = 'marklebrett-portal';
    const key = 'homepage';
    const hasVisited = localStorage.getItem('hasVisitedSite');

    // Define the URL based on whether they have visited before
    // If NEW visitor -> use '/up' to count them. 
    // If RETURNING -> use base URL to just read the number.
    const url = !hasVisited 
        ? `https://api.counterapi.dev/v1/${namespace}/${key}/up`
        : `https://api.counterapi.dev/v1/${namespace}/${key}/`;

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
            // If the server returns an error (like 400 or 429), throw it so we see it
            const text = await res.text();
            throw new Error(`API Error: ${res.status} ${text}`);
        }
        return res.json();
      })
      .then(data => {
        console.log("Counter API Success:", data); // <--- LOG SUCCESS
        setVisitorCount(data.count);
        
        // If this was a successful 'count up', save the flag
        if (!hasVisited) {
            localStorage.setItem('hasVisitedSite', 'true');
        }
      })
      .catch((err) => {
        console.error("Counter API Failed:", err); // <--- LOG ERROR
        setVisitorCount("Error"); // Show text instead of fake number
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-black text-white font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Title & meta are set dynamically in useEffect for correct OG preview support */}

      {/* HERO SECTION */}
      <div className="flex flex-col items-center justify-center pt-24 px-4 text-center">
        <div className={`transition-all duration-1000 ${loading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
            <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            Welcome, Visitor.
            </h1>
            <p className="text-xl md:text-2xl text-blue-200 flex items-center justify-center gap-2">
            <MapPin className="w-5 h-5" /> 
            Detected location: <span className="font-semibold text-white">{location}</span>
            </p>
        </div>

        {/* VISITOR COUNT BADGE */}
        <div className="mt-8 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-2 rounded-full flex items-center gap-3 shadow-lg">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium tracking-wide">
                UNIQUE VISITORS: <span className="text-emerald-400 font-mono font-bold">{visitorCount}</span>
            </span>
        </div>

        {/* SOCIAL LINKS */}
        <div className="flex justify-center gap-6 mt-8">
            <a href="https://www.linkedin.com/in/mark-l-5baa48160/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500 transition-colors duration-200">
                <Linkedin size={28} />
            </a>
            <a href="https://github.com/Moley123" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-200 transition-colors duration-200">
                <Github size={28} />
            </a>
        </div>
      </div>

      {/* ═══════════ FEATURED: EMEL SOLUTIONS ═══════════ */}
      <div className="max-w-6xl mx-auto px-4 pt-20 pb-6">
        <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-5">Business</p>
        <Link to="/emelsolutions" className="group relative block">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-violet-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-10 hover:-translate-y-1 transition-transform duration-300 flex flex-col md:flex-row md:items-center gap-8">
            <div className="flex-shrink-0 w-16 h-16 bg-violet-500/20 rounded-xl flex items-center justify-center text-violet-400 group-hover:text-white group-hover:bg-violet-600 transition-colors">
              <Zap className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-3xl font-bold mb-2 text-gray-100">EMEL Solutions</h3>
              <p className="text-gray-400 max-w-2xl">
                AI automation, WordPress management, hardware setup &amp; bespoke technology services for modern businesses.
              </p>
            </div>
            <div className="flex items-center text-violet-400 font-semibold group-hover:translate-x-2 transition-transform flex-shrink-0">
              Visit Site <ArrowRight className="ml-2 w-5 h-5" />
            </div>
          </div>
        </Link>
      </div>

      {/* ═══════════ PROJECTS & TOOLS GRID ═══════════ */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <div className="flex items-center gap-4 mb-5">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-500">Projects &amp; Tools</p>
          <div className="flex-1 h-px bg-gray-800"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Gematria */}
          <Link to="/gematria" className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:-translate-y-2 transition-transform duration-300 h-full flex flex-col">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-6 text-blue-400 group-hover:text-white group-hover:bg-blue-600 transition-colors">
                      <span className="text-2xl font-bold">א</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-gray-100">Gematria Tool</h3>
                  <p className="text-gray-400 mb-8 flex-grow">
                      Advanced Torah text analysis, trend tracking, and word occurrence races.
                  </p>
                  <div className="flex items-center text-blue-400 font-semibold group-hover:translate-x-2 transition-transform">
                      Launch App <ArrowRight className="ml-2 w-4 h-4" />
                  </div>
              </div>
          </Link>

          {/* CertStream Monitor */}
          <Link to="/certmonitor" className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:-translate-y-2 transition-transform duration-300 h-full flex flex-col">
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-6 text-cyan-400 group-hover:text-white group-hover:bg-cyan-600 transition-colors">
                      <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-gray-100">CertStream Monitor</h3>
                  <p className="text-gray-400 mb-8 flex-grow">
                      Live SSL/TLS certificate transparency feed with real-time phishing &amp; brand-abuse detection.
                  </p>
                  <div className="flex items-center text-cyan-400 font-semibold group-hover:translate-x-2 transition-transform">
                      Launch App <ArrowRight className="ml-2 w-4 h-4" />
                  </div>
              </div>
          </Link>

          {/* Prayer Times — external link */}
          <a href="https://davening-times.netlify.app/" target="_blank" rel="noopener noreferrer" className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:-translate-y-2 transition-transform duration-300 h-full flex flex-col">
                  <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mb-6 text-orange-400 group-hover:text-white group-hover:bg-orange-500 transition-colors">
                      <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-gray-100">Prayer Times</h3>
                  <p className="text-gray-400 mb-8 flex-grow">
                      Live Halacha zmanim and congregation davening schedule for Machzike Hadath, with mobile &amp; landscape views.
                  </p>
                  <div className="flex items-center text-orange-400 font-semibold group-hover:translate-x-2 transition-transform">
                      Open App <ArrowRight className="ml-2 w-4 h-4" />
                  </div>
              </div>
          </a>

          {/* Coming Soon */}
          <div className="relative group grayscale opacity-50 hover:opacity-70 transition-opacity cursor-not-allowed">
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 h-full flex flex-col border-dashed">
                  <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center mb-6">
                      <Lock className="w-6 h-6 text-gray-600" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-gray-600 blur-sm select-none">Lorem Ipsum</h3>
                  <p className="text-gray-700 mb-8 flex-grow blur-[2px] select-none text-sm">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                  </p>
                  <div className="mt-auto inline-flex px-3 py-1 rounded-full bg-gray-800 text-xs font-bold text-gray-600 uppercase tracking-widest w-fit">
                      Coming Soon
                  </div>
              </div>
          </div>

        </div>
      </div>

      {/* FOOTER */}
      <footer className="text-center text-gray-600 py-10">
        <p>&copy; {new Date().getFullYear()} EMEL Solutions - Mark Lebrett. All systems operational.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Users, ArrowRight, Lock, Linkedin, Github } from 'lucide-react';

const LandingPage = () => {
  const [location, setLocation] = useState('Earth');
  const [visitorCount, setVisitorCount] = useState('...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set the favicon for the landing page
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = '/globe.png';
    document.head.appendChild(favicon);

    // Cleanup function to remove the favicon when the component unmounts
    return () => {
      document.head.removeChild(favicon);
    };
  }, []);

  useEffect(() => {
    // 1. Fetch User Location
    fetch('http://ip-api.com/json/') // Using ip-api.com as an alternative
      .then(res => res.json())
      .then(data => {
        if(data.status === 'success') { // Check status for ip-api.com
          setLocation(`${data.city}, ${data.country}`);
        }
        setLoading(false);
      })
      .catch((err) => {
          console.error("Location API failed:", err);
          setLoading(false);
      });

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
      
      <title>Mark Lebrett | Portal</title>
      <meta name="description" content="Welcome to the personal portal of Mark Lebrett. Explore projects, tools, and insights." />

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

      {/* APPS GRID */}
      <div className="max-w-6xl mx-auto px-4 py-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* APP 1: GEMATRIA (ACTIVE) */}
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

        {/* APP 2: COMING SOON (BLURRED) */}
        <div className="relative group grayscale opacity-60 hover:opacity-80 transition-opacity cursor-not-allowed">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 h-full flex flex-col border-dashed">
                <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center mb-6">
                    <Lock className="w-6 h-6 text-gray-500" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-gray-500 blur-sm select-none">Bible Code</h3>
                <p className="text-gray-600 mb-8 flex-grow blur-[2px] select-none">
                    Search for equidistant letter sequences and hidden patterns in the text.
                </p>
                <div className="mt-auto inline-flex px-3 py-1 rounded-full bg-gray-800 text-xs font-bold text-gray-500 uppercase tracking-widest w-fit">
                    Coming Soon
                </div>
            </div>
        </div>

        {/* APP 3: COMING SOON (BLURRED) */}
        <div className="relative group grayscale opacity-60 hover:opacity-80 transition-opacity cursor-not-allowed">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 h-full flex flex-col border-dashed">
                <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center mb-6">
                    <Lock className="w-6 h-6 text-gray-500" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-gray-500 blur-sm select-none">Notarikon</h3>
                <p className="text-gray-600 mb-8 flex-grow blur-[2px] select-none">
                    Acronym generator and reverse lookup for initials and final letters.
                </p>
                <div className="mt-auto inline-flex px-3 py-1 rounded-full bg-gray-800 text-xs font-bold text-gray-500 uppercase tracking-widest w-fit">
                    Coming Soon
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
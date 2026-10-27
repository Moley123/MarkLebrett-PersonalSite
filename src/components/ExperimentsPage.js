import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FlaskConical } from 'lucide-react';
import { EXPERIMENTS } from '../experiments';

const BADGE_STYLES = {
  Lab: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Beta: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Preview: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

/* The card's main link covers the whole card (its ::after is stretched over
   it), so the card is one click target; the "Live version" link sits above
   that layer. Static files in public/ need a plain <a>: the router doesn't
   know them. */
const MainLink = ({ item, children }) => {
  // No transform on the link itself: it would become the containing block
  // for its ::after, shrinking the click area to the link while hovered.
  const className = 'flex items-center text-amber-300 font-semibold after:absolute after:inset-0 after:content-[""]';
  return item.external
    ? <a href={item.path} className={className}>{children}</a>
    : <Link to={item.path} className={className}>{children}</Link>;
};

const ExperimentsPage = () => {
  useEffect(() => {
    document.title = 'Beta & Experiments | Mark Lebrett';
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-black text-white font-sans selection:bg-blue-500 selection:text-white">
      <div className="max-w-5xl mx-auto px-4 pt-10 pb-16">

        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Portal
        </Link>

        <header className="mt-10 mb-10">
          <div className="w-14 h-14 bg-amber-500/15 rounded-xl flex items-center justify-center text-amber-300 mb-6">
            <FlaskConical className="w-7 h-7" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-orange-400">
            Beta &amp; Experiments
          </h1>
          <p className="text-gray-300 max-w-2xl">
            Labs, previews and work in progress: where new ideas get tried before they reach the main tools.
            Expect rough edges. Things here may change, move or break.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {EXPERIMENTS.map((item) => (
            <div
              key={item.path}
              className="group relative bg-gray-900/90 border border-gray-800 hover:border-amber-500/40 rounded-2xl p-6 flex flex-col transition-colors"
            >
              <span className={`self-start text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border mb-4 ${BADGE_STYLES[item.badge]}`}>
                {item.badge}
              </span>
              <h2 className="text-xl font-bold text-gray-100 mb-2">{item.title}</h2>
              <p className="text-gray-400 text-sm mb-6 flex-grow">{item.description}</p>
              <div className="flex items-center justify-between gap-4">
                <MainLink item={item}>
                  Open <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </MainLink>
                {item.live && (
                  <Link to={item.live.path} className="relative z-10 text-sm text-gray-500 hover:text-gray-200 transition-colors">
                    {item.live.label}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="text-center text-gray-600 py-10">
        <p>&copy; {new Date().getFullYear()} EMEL Solutions - Mark Lebrett.</p>
      </footer>
    </div>
  );
};

export default ExperimentsPage;

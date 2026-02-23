import React, { useState, useEffect } from 'react';
import { Bot, Wrench, Globe, LayoutDashboard, Code, Lightbulb, TrendingUp, Cpu } from 'lucide-react';

const EmelSolutions = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      if (offset > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Placeholder for the business logo - user needs to provide an actual logo
  const BusinessLogo = () => (
    <div className="text-4xl font-bold text-white">EMEL Solutions</div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-black text-white font-sans">
      <title>EMEL Solutions</title>
      <meta name="description" content="Innovative AI, WordPress, and IT Solutions by EMEL Solutions." />

      {/* Banner with Business Logo */}
      <header className="py-8 bg-gray-900 shadow-lg text-center">
        <BusinessLogo />
      </header>

      {/* Liquid-glass style navigation bar */}
      <nav className={`sticky top-0 z-50 flex justify-center py-4 transition-all duration-300 ${scrolled ? 'backdrop-blur-md bg-white/10' : 'bg-transparent'}`}>
        <div className="max-w-md w-full flex justify-around items-center px-6 py-3 rounded-full border border-white/20 shadow-xl" style={{ backdropFilter: 'blur(10px)' }}>
          <a href="#ai-automation" className="text-white hover:text-blue-300 transition-colors duration-200 text-sm font-medium">AI Automation</a>
          <a href="#wordpress" className="text-white hover:text-blue-300 transition-colors duration-200 text-sm font-medium">WordPress</a>
          <a href="#ai-solutions" className="text-white hover:text-blue-300 transition-colors duration-200 text-sm font-medium">AI Solutions</a>
          <a href="#hardware" className="text-white hover:text-blue-300 transition-colors duration-200 text-sm font-medium">Hardware</a>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-16">

        {/* Section 1: AI Automation and Workflow Development */}
        <section id="ai-automation" className="mb-24 flex flex-col md:flex-row items-center gap-8 bg-gray-800/50 p-8 rounded-lg shadow-lg">
          <div className="md:w-1/2">
            <h2 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">AI Automation & Workflow Development</h2>
            <p className="text-gray-300 text-lg mb-4">
              Streamline your operations and boost efficiency with intelligent AI-powered automation. We design and implement robust workflows tailored to your business needs, integrating seamlessly with your existing systems.
            </p>
            <p className="text-gray-400">
              Leverage the power of automation to eliminate repetitive tasks, reduce human error, and free up your team to focus on strategic initiatives. Our solutions are built for scalability and performance.
            </p>
          </div>
          <div className="md:w-1/2 flex justify-center items-center p-4 bg-gray-900 rounded-md">
            {/* Placeholder for n8n style workflow GIF */}
            <Bot className="w-32 h-32 text-blue-400 animate-pulse" />
          </div>
        </section>

        {/* Section 2: WordPress Management and Custom Plugins */}
        <section id="wordpress" className="mb-24 flex flex-col md:flex-row-reverse items-center gap-8 bg-gray-800/50 p-8 rounded-lg shadow-lg">
          <div className="md:w-1/2">
            <h2 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">WordPress Management & Custom Plugins</h2>
            <p className="text-gray-300 text-lg mb-4">
              Ensure your WordPress website is always performing at its best with our comprehensive management services. From security updates to performance optimization, we handle it all.
            </p>
            <p className="text-gray-400">
              Need specific functionality? Our expert developers create custom WordPress plugins designed to extend your site's capabilities and perfectly match your unique business requirements.
            </p>
          </div>
          <div className="md:w-1/2 flex justify-center items-center p-4 bg-gray-900 rounded-md">
            {/* Placeholder for WordPress admin animation */}
            <LayoutDashboard className="w-32 h-32 text-purple-400 animate-bounce" />
          </div>
        </section>

        {/* Section 3: AI Solutions */}
        <section id="ai-solutions" className="mb-24 flex flex-col md:flex-row items-center gap-8 bg-gray-800/50 p-8 rounded-lg shadow-lg">
          <div className="md:w-1/2">
            <h2 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-400">Cutting-Edge AI Solutions</h2>
            <p className="text-gray-300 text-lg mb-4">
              Unlock new possibilities with bespoke Artificial Intelligence solutions. From machine learning models to natural language processing, we integrate AI to solve complex business challenges.
            </p>
            <p className="text-gray-400">
              Transform data into actionable insights, automate decision-making, and create intelligent systems that give your business a competitive edge.
            </p>
          </div>
          <div className="md:w-1/2 flex justify-center items-center p-4 bg-gray-900 rounded-md">
            {/* Placeholder for generic AI animation */}
            <Lightbulb className="w-32 h-32 text-green-400 animate-spin" />
          </div>
        </section>

        {/* Section 4: Hardware Setup and Troubleshooting */}
        <section id="hardware" className="mb-24 flex flex-col md:flex-row-reverse items-center gap-8 bg-gray-800/50 p-8 rounded-lg shadow-lg">
          <div className="md:w-1/2">
            <h2 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400">Hardware Setup & Troubleshooting</h2>
            <p className="text-gray-300 text-lg mb-4">
              Reliable IT infrastructure is the backbone of any successful business. We provide expert hardware setup, configuration, and proactive troubleshooting to keep your systems running smoothly.
            </p>
            <p className="text-gray-400">
              Minimize downtime and maximize productivity with our on-demand support and maintenance services for all your office and enterprise hardware needs.
            </p>
          </div>
          <div className="md:w-1/2 flex justify-center items-center p-4 bg-gray-900 rounded-md">
            {/* Placeholder for computer repair animation */}
            <Wrench className="w-32 h-32 text-red-400 animate-pulse" />
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="text-center text-gray-600 py-10 border-t border-gray-800">
        <p>&copy; {new Date().getFullYear()} EMEL Solutions. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default EmelSolutions;

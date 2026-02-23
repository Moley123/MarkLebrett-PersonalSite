import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { getGematria } from './utils/gematria';
import { PARSHAS } from './utils/parshas';
import { isRefInParsha } from './utils/filter';
import commonDb from './data/common_gematria.json';
import HebrewKeyboard from './utils/HebrewKeyboard';
import TrendsView from './utils/TrendsView'; // Ensure this file exists
import WordRace from './utils/WordRace';     // Ensure this file exists
import './App.css'; 

const GematriaApp = () => {
  // --- STATE ---
  const navigate = useNavigate();

  useEffect(() => {
    // Gematria favicon: Hebrew letter Alef in blue/indigo
    const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#6366f1"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="#f8fafc"/>
      <text x="4" y="25" font-family="serif" font-size="24" font-weight="700" fill="url(#g)">א</text>
    </svg>`;
    const favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.href = 'data:image/svg+xml,' + encodeURIComponent(svgFavicon);
    document.head.appendChild(favicon);

    return () => {
      document.head.removeChild(favicon);
    };
  }, []);

  // 1. Navigation & Modes
  const [viewMode, setViewMode] = useState("search"); // 'search', 'trends', 'race'
  
  // 2. Calculator Inputs
  const [inputText, setInputText] = useState("");
  const [gematriaValue, setGematriaValue] = useState(0);
  
  // 3. Search Configuration
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [selectedParsha, setSelectedParsha] = useState("All");
  const [isColelMode, setIsColelMode] = useState(false);
  const [isSingleWordMode, setIsSingleWordMode] = useState(false);

  // 4. Matcher/Bridge Mode State
  const [isMatcherMode, setIsMatcherMode] = useState(false);
  const [matcherTarget, setMatcherTarget] = useState("");
  const [matcherTargetValue, setMatcherTargetValue] = useState(0);
  
  // 5. UI Focus Tracking
  const [activeField, setActiveField] = useState('main'); // 'main' or 'target'

  // 6. Data
  const [indexData, setIndexData] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoadingDB, setIsLoadingDB] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // 7. Tab & Pagination State
  const [activeTabValue, setActiveTabValue] = useState(0); 
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10; 

  // --- EFFECTS ---

  // A. Calculate Gematria (Main Input)
  useEffect(() => {
    const calc = (str) => /^\d+$/.test(str) ? parseInt(str, 10) : getGematria(str);
    setGematriaValue(calc(inputText));
  }, [inputText]);

  // B. Calculate Matcher Target (Target Input)
  useEffect(() => {
    const calc = (str) => /^\d+$/.test(str) ? parseInt(str, 10) : getGematria(str);
    setMatcherTargetValue(calc(matcherTarget));
  }, [matcherTarget]);

// C. Lazy Load DB
  useEffect(() => {
    if ((isSearchMode || isMatcherMode || viewMode === 'trends') && !indexData) {
      setIsLoadingDB(true);
      
      // FIX: Use process.env.PUBLIC_URL to ensure we look in the right folder
      // whether we are on localhost or marklebrett.co.uk/gematria-explorer
      fetch('/torah_index.json')
        .then(response => {
           // Check if the response is actually valid JSON
           const contentType = response.headers.get("content-type");
           if (!response.ok || (contentType && contentType.indexOf("application/json") === -1)) {
               throw new Error("File not found or invalid format");
           }
           return response.json();
        })
        .then((data) => {
          setIndexData(data);
          setIsLoadingDB(false);
        })
        .catch((err) => {
          console.error("Failed to load DB:", err);
          setIsLoadingDB(false);
        });
    }
  }, [isSearchMode, isMatcherMode, viewMode, indexData]);

  // D. Search Logic (The Core)
  useEffect(() => {
    // Only run search logic if we are in 'search' view and have data
    if (viewMode !== 'search') return;

    setCurrentPage(1);
    
    let searchValues = [];
    
    // 1. Determine what numbers we are looking for
    if (isMatcherMode) {
        const diff = Math.abs(matcherTargetValue - gematriaValue);
        if (diff > 0) {
            searchValues = [diff];
            setActiveTabValue(diff);
        } else {
            setSearchResults([]); 
            return;
        }
    } else {
        // Standard Mode
        if (gematriaValue === 0 && !inputText) {
            setSearchResults([]);
            return;
        }
        
        searchValues = isColelMode 
            ? [gematriaValue, gematriaValue - 1, gematriaValue + 1] 
            : [gematriaValue];
        setActiveTabValue(gematriaValue);
    }

    if ((!isSearchMode && !isMatcherMode) || !indexData || searchValues[0] === 0) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    const timer = setTimeout(() => {
      let combinedResults = [];

      searchValues.forEach(targetVal => {
        if (targetVal <= 0) return; 

        // A. FIND STANDARD MATCHES FROM DB
        const matches = indexData[String(targetVal)] || [];
        
        // Filter standard matches
        const filteredMatches = matches.filter(item => {
             if (isSingleWordMode) {
                 if (item.isVerse) return false;
                 if (item.phrase.includes(' ')) return false;
             }
             return true;
        });

        const matchesWithMeta = filteredMatches.map(item => ({
          ...item,
          actualValue: targetVal, 
          isExact: targetVal === (isMatcherMode ? Math.abs(matcherTargetValue - gematriaValue) : gematriaValue),
          type: 'standard'
        }));

        // B. FIND PARSHA STATS MATCHES
        // (Only relevant in Standard Search usually)
        let parshaMatches = [];
        if (!isMatcherMode) {
            const matchingParshas = PARSHAS.filter(p => p.verse_count === targetVal);
            parshaMatches = matchingParshas.map(p => ({
                phrase: `Parshat ${p.name}`,
                ref: "Torah Stats",
                context_en: `This Parsha contains exactly ${p.verse_count} verses.`,
                actualValue: targetVal,
                isExact: true,
                type: 'stat', 
                isVerse: false
            }));
        }

        combinedResults = [...combinedResults, ...parshaMatches, ...matchesWithMeta];
      });

      // Filter by Parsha (Standard search only)
      if (selectedParsha !== "All" && !isMatcherMode) {
        const parshaRange = PARSHAS.find(p => p.name === selectedParsha);
        if (parshaRange) {
          combinedResults = combinedResults.filter(item => 
            item.type === 'stat' || isRefInParsha(item.ref, parshaRange)
          );
        }
      }

      setSearchResults(combinedResults);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [gematriaValue, isSearchMode, isMatcherMode, matcherTargetValue, selectedParsha, indexData, isColelMode, isSingleWordMode, viewMode, inputText]);

  // E. Common Matches (Did You Know?)
  const commonMatches = useMemo(() => {
    if (gematriaValue === 0) return [];
    return commonDb[String(gematriaValue)] || [];
  }, [gematriaValue]);

  // --- HELPERS ---

  // Pagination Slice
  const currentTabResults = useMemo(() => {
    return searchResults.filter(r => r.actualValue === activeTabValue);
  }, [searchResults, activeTabValue]);

  const totalPages = Math.ceil(currentTabResults.length / ITEMS_PER_PAGE);
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return currentTabResults.slice(start, start + ITEMS_PER_PAGE);
  }, [currentTabResults, currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const handleKeyboardPress = (char) => {
    if (activeField === 'main') {
        if (char === "BACKSPACE") setInputText(prev => prev.slice(0, -1));
        else setInputText(prev => prev + char);
    } else {
        if (char === "BACKSPACE") setMatcherTarget(prev => prev.slice(0, -1));
        else setMatcherTarget(prev => prev + char);
    }
  };

  const getCountForValue = (val) => searchResults.filter(r => r.actualValue === val).length;

  const triggerSearch = (text) => {
    setInputText(text);
    setIsSearchMode(true);
    setIsMatcherMode(false);
    setActiveField('main');
    setViewMode('search'); // Switch to calculator view
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

// 2. RENAME existing "goHome" to "handleReset"
  const handleReset = () => {
    setInputText("");
    setMatcherTarget("");
    setIsSearchMode(false);
    setIsMatcherMode(false);
    setSearchResults([]);
    setActiveField('main');
    setSelectedParsha("All");
    setViewMode("search");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentParshaObj = PARSHAS.find(p => p.name === selectedParsha);
  const parshaInfo = currentParshaObj && currentParshaObj.name !== "All" 
    ? `In ${currentParshaObj.name} (${currentParshaObj.verse_count} verses)`
    : "In Entire Torah";

  return (
    <div className="app-container">

      <title>Gematria Explorer</title>
      <meta name="description" content="Calculate Hebrew Gematria instantly. Search the Torah index, analyze phrases, and discover hidden numerical connections." />

      {/* HEADER SECTION */}
      <header className="relative flex items-center justify-center p-4 bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 mb-6 sticky top-0 z-50">
        
        {/* BUTTON 1: Back to Portal (Styled) */}
        <button 
          onClick={() => navigate('/')} 
          className="absolute left-4 group flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:border-blue-300 hover:text-blue-600 hover:shadow-md transition-all duration-200"
          title="Back to Landing Page"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="hidden md:inline">Portal</span>
        </button>

        {/* Title (Center) */}
        <div className="text-center group cursor-pointer" onClick={handleReset}>
            <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 m-0">
            Gematria Explorer
            </h1>
            <p className="text-xs font-semibold text-gray-400 tracking-wider uppercase mt-1">
              Calculate &bull; Discover &bull; Search
            </p>
        </div>

        {/* BUTTON 2: Reset (Styled) */}
        {(inputText ||
          matcherTarget ||
          isMatcherMode ||
          viewMode !== "search") && (
          <button 
            onClick={handleReset} 
            className="absolute right-4 group flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-full hover:border-red-300 hover:text-red-500 hover:shadow-md transition-all duration-200"
            title="Reset Calculator"
          >
            <RotateCcw className="w-4 h-4 transition-transform group-hover:-rotate-180 duration-500" />
            <span className="hidden md:inline">Reset</span>
          </button>
        )}
      </header>

      <div className="main-content">
        {/* MODERN NAV TABS */}
        <div className="w-full flex justify-center mb-8">
          <div className="nav-container">
            <button
              onClick={() => setViewMode("search")}
              className={`nav-btn ${viewMode === "search" ? "active" : ""}`}
            >
              <span>🔍</span> Calculator
            </button>

            <button
              onClick={() => setViewMode("trends")}
              className={`nav-btn ${viewMode === "trends" ? "active" : ""}`}
            >
              <span>📈</span> Trend Tracker
            </button>

            <button
              onClick={() => setViewMode("race")}
              className={`nav-btn ${viewMode === "race" ? "active" : ""}`}
            >
              <span>🏆</span> Word Race
            </button>
          </div>
        </div>

        {/* ======================= */}
        {/* VIEW 1: TRENDS     */}
        {/* ======================= */}
        {viewMode === "trends" && <TrendsView indexData={indexData} />}

        {/* ======================= */}
        {/* VIEW 2: RACE       */}
        {/* ======================= */}
        {viewMode === "race" && <WordRace />}

        {/* ======================= */}
        {/* VIEW 3: CALCULATOR   */}
        {/* ======================= */}
        {viewMode === "search" && (
          <>
            {/* MATCH MAKER MODE */}
            {isMatcherMode && (
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg mb-4">
                <h2 className="text-purple-800 font-bold flex items-center gap-2">
                  💍 Wedding / Bridge Calculator
                </h2>
                <p className="text-sm text-purple-600 mb-4">
                  Enter the Names (Base) and your Goal (Target). We will find
                  the words to bridge the gap.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label
                      className={`text-xs font-bold uppercase ${
                        activeField === "main"
                          ? "text-blue-600"
                          : "text-gray-500"
                      }`}
                    >
                      1. Names (Base) {activeField === "main" && "●"}
                    </label>
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onFocus={() => setActiveField("main")}
                      className={`w-full border p-2 rounded text-right text-lg ${
                        activeField === "main"
                          ? "ring-2 ring-blue-200 border-blue-400"
                          : ""
                      }`}
                      placeholder="e.g. משה חנה"
                    />
                    <div className="text-right text-sm font-bold text-gray-400 mt-1">
                      {gematriaValue}
                    </div>
                  </div>
                  <div>
                    <label
                      className={`text-xs font-bold uppercase ${
                        activeField === "target"
                          ? "text-blue-600"
                          : "text-gray-500"
                      }`}
                    >
                      2. Goal (Target) {activeField === "target" && "●"}
                    </label>
                    <input
                      type="text"
                      value={matcherTarget}
                      onChange={(e) => setMatcherTarget(e.target.value)}
                      onFocus={() => setActiveField("target")}
                      className={`w-full border p-2 rounded text-right text-lg ${
                        activeField === "target"
                          ? "ring-2 ring-blue-200 border-blue-400"
                          : ""
                      }`}
                      placeholder="e.g. מזל טוב"
                    />
                    <div className="text-right text-sm font-bold text-gray-400 mt-1">
                      {matcherTargetValue}
                    </div>
                  </div>
                </div>

                <div className="mt-2">
                  <HebrewKeyboard onKeyPress={handleKeyboardPress} />
                </div>

                <div className="mt-4 text-center">
                  {gematriaValue > 0 && matcherTargetValue > 0 ? (
                    <div className="bg-white p-3 rounded border border-purple-100 shadow-sm">
                      <span className="text-gray-500">Gap to Bridge:</span>
                      <div className="text-3xl font-bold text-purple-600 my-1">
                        {Math.abs(matcherTargetValue - gematriaValue)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm italic">
                      Enter both fields to calculate the bridge...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STANDARD CALCULATOR */}
            {!isMatcherMode && (
              <>
                <div className="input-group">
                  <label>Enter Hebrew Text OR Number:</label>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onFocus={() => setActiveField("main")}
                    placeholder="Type 'תורה' or '613'..."
                    dir="auto"
                    className="input-field"
                  />
                  {!/^\d+$/.test(inputText) && (
                    <HebrewKeyboard onKeyPress={handleKeyboardPress} />
                  )}
                </div>

                <div className="value-box">
                  <span className="label">Value</span>
                  <div className="value-number">{gematriaValue}</div>
                </div>
              </>
            )}

            {/* DASHBOARD SUGGESTIONS */}
            {!inputText && !matcherTarget && !isMatcherMode && (
              <div className="dashboard-grid">
                <h3 className="w-full text-lg font-bold text-gray-700 mb-2">
                  Try a search:
                </h3>
                <button
                  onClick={() => triggerSearch("613")}
                  className="dash-card"
                >
                  <span className="icon">🔢</span>
                  <div className="text">
                    <strong>Number Search</strong>
                    <p>What words have a gematria of 613?</p>
                  </div>
                </button>
                <button
                  onClick={() => triggerSearch("תורה")}
                  className="dash-card"
                >
                  <span className="icon">📖</span>
                  <div className="text">
                    <strong>Word Match</strong>
                    <p>What has the same gematria as תורה?</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsMatcherMode(true);
                    setInputText("");
                    setActiveField("main");
                  }}
                  className="dash-card ring-2 ring-purple-100 bg-purple-50"
                >
                  <span className="icon">💍</span>
                  <div className="text text-purple-900">
                    <strong>Wedding Matcher</strong>
                    <p>Find the "bridge word" between names and Mazel Tov!</p>
                  </div>
                </button>
              </div>
            )}

            {/* COMMON MATCHES */}
            {!isMatcherMode && inputText && commonMatches.length > 0 && (
              <div className="common-matches">
                <h3>💡 Did you know?</h3>
                <p>
                  <strong>{gematriaValue}</strong> is also:
                </p>
                <div className="tags">
                  {commonMatches.map((match, idx) => (
                    <span key={idx} className="tag">
                      {match}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <hr />

            {/* CONTROLS */}
            <div className="search-controls-wrapper">
              <div className="search-controls">
                {!isMatcherMode && (
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={isSearchMode}
                      onChange={(e) => setIsSearchMode(e.target.checked)}
                    />
                    Search in Sefaria
                  </label>
                )}

                <select
                  value={selectedParsha}
                  onChange={(e) => setSelectedParsha(e.target.value)}
                  className="parsha-select"
                >
                  <option value="All">Entire Torah</option>
                  {PARSHAS.map((p) => (
                    <option key={p.name} value={p.name}>
                      Parshat {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {(isSearchMode || isMatcherMode) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {!isMatcherMode && (
                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isColelMode}
                          onChange={(e) => setIsColelMode(e.target.checked)}
                        />
                        <span>±1 (Colel)</span>
                      </label>
                    </div>
                  )}

                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSingleWordMode}
                        onChange={(e) => setIsSingleWordMode(e.target.checked)}
                      />
                      <span>Single Words Only</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* RESULTS AREA */}
            {(isSearchMode ||
              (isMatcherMode &&
                gematriaValue > 0 &&
                matcherTargetValue > 0)) && (
              <div className="results-area">
                {isLoadingDB && (
                  <div className="status">Loading Database...</div>
                )}
                {!isLoadingDB && isSearching && (
                  <div className="status">Searching...</div>
                )}

                {!isLoadingDB && !isSearching && searchResults.length >= 0 && (
                  <>
                    <div className="mb-4 flex items-center justify-between px-2">
                      <h2 className="text-xl font-bold text-gray-800">
                        {isMatcherMode
                          ? "Bridge Suggestions"
                          : `Results for ${gematriaValue}`}
                      </h2>
                      <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                        {parshaInfo}
                      </span>
                    </div>

                    {!isMatcherMode && (
                      <div className="tabs-container">
                        <button
                          className={`tab-button ${
                            activeTabValue === gematriaValue ? "active" : ""
                          }`}
                          onClick={() => {
                            setActiveTabValue(gematriaValue);
                            setCurrentPage(1);
                          }}
                        >
                          Value {gematriaValue}
                          <span className="tab-count">
                            {getCountForValue(gematriaValue)}
                          </span>
                        </button>
                        {isColelMode && (
                          <>
                            <button
                              className={`tab-button ${
                                activeTabValue === gematriaValue - 1
                                  ? "active"
                                  : ""
                              }`}
                              onClick={() => {
                                setActiveTabValue(gematriaValue - 1);
                                setCurrentPage(1);
                              }}
                            >
                              {gematriaValue - 1}
                              <span className="tab-count">
                                {getCountForValue(gematriaValue - 1)}
                              </span>
                            </button>
                            <button
                              className={`tab-button ${
                                activeTabValue === gematriaValue + 1
                                  ? "active"
                                  : ""
                              }`}
                              onClick={() => {
                                setActiveTabValue(gematriaValue + 1);
                                setCurrentPage(1);
                              }}
                            >
                              {gematriaValue + 1}
                              <span className="tab-count">
                                {getCountForValue(gematriaValue + 1)}
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    <div className="table-container">
                      {currentTabResults.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          {isMatcherMode
                            ? "No words found to bridge this exact gap."
                            : "No matches found."}
                        </div>
                      ) : (
                        <>
                          <table className="results-table">
                            <thead>
                              <tr>
                                <th className="text-right">Phrase (Heb)</th>
                                <th>Reference</th>
                                <th>English Context</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedResults.map((result, idx) => (
                                <tr
                                  key={idx}
                                  className={
                                    result.isVerse
                                      ? "bg-blue-50"
                                      : result.type === "stat"
                                      ? "bg-yellow-50"
                                      : ""
                                  }
                                >
                                  <td
                                    className={`col-phrase ${
                                      result.isVerse ? "verse-match" : ""
                                    }`}
                                  >
                                    {result.type === "stat" ? (
                                      <div className="flex flex-col items-end text-yellow-800">
                                        <span className="stat-label">
                                          STRUCTURE MATCH
                                        </span>
                                        {result.phrase}
                                      </div>
                                    ) : result.isVerse ? (
                                      <div className="flex flex-col items-end">
                                        <span className="verse-label">
                                          WHOLE VERSE
                                        </span>
                                        <span className="block mt-1">
                                          {result.original_he}
                                        </span>
                                      </div>
                                    ) : (
                                      result.phrase
                                    )}
                                  </td>
                                  <td className="col-ref">
                                    {result.type === "stat" ? (
                                      <span className="font-bold text-yellow-700">
                                        Torah Stats
                                      </span>
                                    ) : (
                                      <a
                                        href={`https://www.sefaria.org/${result.ref}`}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {result.ref}
                                      </a>
                                    )}
                                  </td>
                                  <td className="col-context">
                                    {result.type === "stat" && (
                                      <span className="text-2xl mr-2">📊</span>
                                    )}
                                    {result.context_en}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {totalPages > 1 && (
                            <div className="pagination-controls">
                              <button
                                className="page-btn"
                                disabled={currentPage === 1}
                                onClick={() =>
                                  handlePageChange(currentPage - 1)
                                }
                              >
                                Previous
                              </button>
                              <span className="page-info">
                                Page {currentPage} of {totalPages}
                              </span>
                              <button
                                className="page-btn"
                                disabled={currentPage === totalPages}
                                onClick={() =>
                                  handlePageChange(currentPage + 1)
                                }
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GematriaApp;
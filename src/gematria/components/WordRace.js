import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import raceData from '../../data/race_data.json';

const COLORS = [
  '#3b82f6', '#60a5fa', '#93c5fd', '#a855f7', '#c084fc',
  '#ef4444', '#f87171', '#fca5a5', '#f59e0b', '#fbbf24',
  '#22c55e', '#4ade80', '#86efac', '#06b6d4', '#22d3ee',
  '#ec4899', '#f472b6', '#8b5cf6', '#a78bfa', '#14b8a6',
];

const SPEEDS = [
  { label: '0.5×', ms: 500 },
  { label: '1×', ms: 250 },
  { label: '2×', ms: 120 },
  { label: '4×', ms: 60 },
];

const WordRace = () => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [usePrefixes, setUsePrefixes] = useState(true);
  const [speed, setSpeed] = useState(1);
  const timer = useRef(null);

  useEffect(() => {
    if (!playing) return undefined;
    timer.current = setInterval(() => {
      setFrame((prev) => {
        if (prev >= raceData.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, SPEEDS[speed].ms);
    return () => clearInterval(timer.current);
  }, [playing, speed]);

  const current = raceData[frame];
  const dataKey = usePrefixes ? 'prefix' : 'exact';

  const displayData = useMemo(
    () => [...current.data].sort((a, b) => b[dataKey] - a[dataKey]).slice(0, 20),
    [current, dataKey],
  );

  const atEnd = frame >= raceData.length - 1;

  return (
    <section className="gem-panel">
      <div className="gem-results-head">
        <h2 className="gem-panel-title">🏆 Torah Word Race</h2>
        <span className="gem-chip gem-chip--blue">{current.label}</span>
      </div>
      <p className="gem-panel-sub">
        The twenty most frequent words of the Chumash, racing chapter by chapter.
      </p>

      <div className="gem-toggles">
        <label className={`gem-toggle${usePrefixes ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={usePrefixes}
            onChange={(e) => setUsePrefixes(e.target.checked)}
          />
          Include prefixes
        </label>
        <div className="gem-btn-row" role="group" aria-label="Playback speed">
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              className={`gem-page-btn${i === speed ? ' active' : ''}`}
              onClick={() => setSpeed(i)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="gem-chart gem-chart--tall">
        <ResponsiveContainer>
          <BarChart
            layout="vertical"
            data={displayData}
            margin={{ top: 8, right: 28, left: 56, bottom: 16 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.12)" />
            <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 12, fill: '#64748b' }} stroke="#475569" />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              interval={0}
              tick={{ fontSize: 15, fill: '#e2e8f0', fontWeight: 600 }}
              stroke="#475569"
              isAnimationActive={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(59,130,246,0.06)' }}
              contentStyle={{
                background: '#0d1117',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: 10,
                color: '#e2e8f0',
              }}
              formatter={(v) => [v, usePrefixes ? 'With prefixes' : 'Exact matches']}
            />
            <Bar
              dataKey={dataKey}
              radius={[0, 5, 5, 0]}
              barSize={19}
              animationDuration={SPEEDS[speed].ms}
              animationEasing="linear"
            >
              {displayData.map((entry, i) => (
                <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="gem-row" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="gem-btn gem-btn--primary"
          onClick={() => {
            if (atEnd) setFrame(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? '⏸ Pause' : atEnd ? '↻ Replay' : '▶ Play'}
        </button>
        <input
          type="range"
          className="gem-grow"
          min="0"
          max={raceData.length - 1}
          value={frame}
          onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }}
          style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
          aria-label="Scrub through the race"
        />
        <span className="gem-result-meta" style={{ margin: 0, minWidth: 90, textAlign: 'right' }}>
          {frame + 1} / {raceData.length}
        </span>
      </div>
    </section>
  );
};

export default WordRace;

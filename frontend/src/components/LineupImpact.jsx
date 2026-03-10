import { useState, useEffect, useRef } from 'react';
import LineupTable from './LineupTable';

const TEAMS = [
  'ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW',
  'HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK',
  'OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS',
];

export default function LineupImpact({ season = '2025-26' }) {
  const [team,           setTeam          ] = useState('ATL');
  const [minMinutes,     setMinMinutes    ] = useState(20);
  const [apiMinMinutes,  setApiMinMinutes ] = useState(20);
  const [sortBy,         setSortBy        ] = useState('net_rating');
  const [sortDir,        setSortDir       ] = useState('desc');
  const [lineups,        setLineups       ] = useState([]);
  const [loading,        setLoading       ] = useState(false);
  const [error,          setError         ] = useState(null);
  const debounceRef = useRef(null);

  // Debounce slider → only hit the API 400ms after the user stops dragging
  function handleSlider(val) {
    setMinMinutes(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setApiMinMinutes(val), 400);
  }

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`http://localhost:8000/teams/${team}/lineups?` + new URLSearchParams({
      season,
      min_minutes: apiMinMinutes,
      sort_by: sortBy,
      limit: 20,
    }), { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch lineups for ${team}`);
        return res.json();
      })
      .then(data => { if (!cancelled) setLineups(data.lineups); })
      .catch(err => { if (!cancelled && err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; controller.abort(); };
  }, [team, season, apiMinMinutes, sortBy]);

  function handleSort(field) {
    if (field === sortBy) {
      // Toggle direction on same column
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  }

  return (
    <div>
      {/* ── Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
        {/* Team selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Team
          </label>
          <select
            value={team}
            onChange={e => setTeam(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-light)',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 15,
              fontFamily: 'inherit',
              cursor: 'pointer',
              colorScheme: 'dark',
              outline: 'none',
            }}
          >
            {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Min minutes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Min Minutes Together
            </label>
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: 'var(--accent)',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid var(--border-light)',
              borderRadius: 5,
              padding: '1px 7px',
            }}>
              {minMinutes}+
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            step={5}
            value={minMinutes}
            onChange={e => handleSlider(Number(e.target.value))}
            style={{ width: 260, height: 6, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 260, lineHeight: 1.5 }}>
            {minMinutes === 0
              ? 'Showing all lineups — includes small samples'
              : minMinutes < 20
              ? 'Low threshold — may include noisy stats'
              : minMinutes < 60
              ? 'Good balance of sample size vs. variety'
              : 'High threshold — only proven rotations'}
          </span>
        </div>

        {/* Season badge */}
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          {season} Season
        </div>
      </div>

      {/* ── Heading ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
          {team} — 5-Man Lineups
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Sorted by {sortBy.replace(/_/g, ' ')} · Min {minMinutes} min
        </p>
      </div>

      {/* ── States ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div className="spinner" />
        </div>
      )}

      {!loading && error && (
        <div style={{
          background: 'rgba(248,113,113,0.1)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 8,
          padding: '12px 16px',
          color: '#F87171',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <LineupTable lineups={lineups} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
      )}
    </div>
  );
}

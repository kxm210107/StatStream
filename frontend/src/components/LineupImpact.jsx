import { useState, useEffect, useCallback } from 'react';
import { getTeamLineups } from '../api';
import LineupTable from './LineupTable';

const TEAMS = [
  'ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW',
  'HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK',
  'OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS',
];

export default function LineupImpact({ season = '2025-26' }) {
  const [team,       setTeam      ] = useState('ATL');
  const [minMinutes, setMinMinutes] = useState(20);
  const [sortBy,     setSortBy    ] = useState('net_rating');
  const [lineups,    setLineups   ] = useState([]);
  const [loading,    setLoading   ] = useState(false);
  const [error,      setError     ] = useState(null);

  const loadLineups = useCallback(() => {
    setLoading(true);
    setError(null);
    getTeamLineups(team, { season, minMinutes, sortBy })
      .then(data => setLineups(data.lineups))
      .catch(err  => setError(err.message))
      .finally(()  => setLoading(false));
  }, [team, season, minMinutes, sortBy]);

  useEffect(() => { loadLineups(); }, [loadLineups]);

  function handleSort(field) {
    setSortBy(field);
  }

  return (
    <div>
      {/* ── Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        {/* Team selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
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
              padding: '6px 12px',
              fontSize: 13,
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Min Minutes
          </label>
          <input
            type="number"
            min={0}
            max={500}
            step={10}
            value={minMinutes}
            onChange={e => setMinMinutes(Number(e.target.value))}
            style={{
              width: 80,
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-light)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              colorScheme: 'dark',
              outline: 'none',
            }}
          />
        </div>

        {/* Season badge */}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          {season} Season
        </div>
      </div>

      {/* ── Heading ── */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
          {team} — 5-Man Lineups
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
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
        <LineupTable lineups={lineups} sortBy={sortBy} onSort={handleSort} />
      )}
    </div>
  );
}

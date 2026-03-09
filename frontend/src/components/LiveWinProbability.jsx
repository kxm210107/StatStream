// frontend/src/components/LiveWinProbability.jsx
import { useState, useEffect, useRef } from 'react';
import LiveGameCard from './LiveGameCard';
import { getLiveGamesWithProbabilities, getUpcomingGames } from '../api';

const POLL_INTERVAL_MS = 25_000;

export default function LiveWinProbability() {
  const [games,          setGames         ] = useState([]);
  const [upcoming,       setUpcoming      ] = useState([]);
  const [loading,        setLoading       ] = useState(true);
  const [upcomingLoading,setUpcomingLoading] = useState(true);
  const [error,          setError         ] = useState(null);
  const [upcomingError,  setUpcomingError  ] = useState(null);
  const [lastUpdated,    setLastUpdated   ] = useState(null);
  const [selectedId,     setSelectedId    ] = useState(null);
  const [teamFilter,     setTeamFilter    ] = useState('ALL');
  const intervalRef = useRef(null);

  const fetchGames = async () => {
    try {
      const data = await getLiveGamesWithProbabilities();
      setGames(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError('Could not fetch live game data. Retrying…');
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcoming = async () => {
    try {
      const data = await getUpcomingGames();
      setUpcoming(data);
      setUpcomingError(null);
    } catch (e) {
      setUpcomingError('Could not fetch upcoming games.');
    } finally {
      setUpcomingLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
    fetchUpcoming();
    intervalRef.current = setInterval(fetchGames, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Build sorted list of unique team abbreviations for the filter dropdown
  const teamOptions = ['ALL', ...Array.from(
    new Set(upcoming.flatMap(g => [g.home_team.abbr, g.away_team.abbr]))
  ).sort()];

  const filteredUpcoming = teamFilter === 'ALL'
    ? upcoming
    : upcoming.filter(g => g.home_team.abbr === teamFilter || g.away_team.abbr === teamFilter);

  return (
    <div>
      {/* ── Live section header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 26,
            color: 'var(--text-primary)', letterSpacing: '0.05em',
            textTransform: 'uppercase', margin: 0,
          }}>
            Live Win Probability
          </h2>
          {lastUpdated && (
            <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4, letterSpacing: '0.06em' }}>
              Updated {lastUpdated.toLocaleTimeString()} · refreshes every 25s
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#4ADE80', boxShadow: '0 0 6px #4ADE80',
            animation: 'pulse 2s ease infinite', display: 'inline-block',
          }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#4ADE80', textTransform: 'uppercase' }}>
            Live
          </span>
        </div>
      </div>

      {/* ── Live games ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 13, letterSpacing: '0.06em' }}>Fetching live games…</p>
        </div>
      )}
      {!loading && error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10, padding: '18px 22px', color: 'var(--red)', fontSize: 13,
        }}>
          {error}
        </div>
      )}
      {!loading && !error && games.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🏀</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, letterSpacing: '0.06em' }}>
            No games live right now.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 6, letterSpacing: '0.06em' }}>
            Check back during game time. Page refreshes automatically.
          </p>
        </div>
      )}
      {!loading && games.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}>
          {games.map(game => (
            <LiveGameCard
              key={game.game_id}
              game={game}
              selected={selectedId === game.game_id}
              onClick={() => setSelectedId(id => id === game.game_id ? null : game.game_id)}
            />
          ))}
        </div>
      )}

      {/* ── Upcoming section ── */}
      <div style={{ marginTop: 48 }}>
        {/* Upcoming header + filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 22,
            color: 'var(--text-primary)', letterSpacing: '0.05em',
            textTransform: 'uppercase', margin: 0,
          }}>
            Upcoming Games
          </h2>

          {!upcomingLoading && upcoming.length > 0 && (
            <select
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                padding: '6px 10px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {teamOptions.map(t => (
                <option key={t} value={t}>{t === 'ALL' ? 'All Teams' : t}</option>
              ))}
            </select>
          )}
        </div>

        {/* Upcoming loading */}
        {upcomingLoading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, letterSpacing: '0.06em' }}>Fetching schedule…</p>
          </div>
        )}

        {/* Upcoming error */}
        {!upcomingLoading && upcomingError && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10, padding: '18px 22px', color: 'var(--red)', fontSize: 13,
          }}>
            {upcomingError}
          </div>
        )}

        {/* Upcoming empty state */}
        {!upcomingLoading && !upcomingError && filteredUpcoming.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, letterSpacing: '0.06em' }}>
              {teamFilter === 'ALL' ? 'No upcoming games in the next 7 days.' : `No upcoming games for ${teamFilter}.`}
            </p>
          </div>
        )}

        {/* Upcoming game grid */}
        {!upcomingLoading && !upcomingError && filteredUpcoming.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}>
            {filteredUpcoming.map(game => (
              <LiveGameCard
                key={game.game_id}
                game={game}
                selected={false}
                onClick={() => {}}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

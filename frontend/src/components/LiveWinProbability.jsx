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
  const [historyVersion, setHistoryVersion] = useState(0);
  const intervalRef = useRef(null);
  const historyRef  = useRef({});

  const fetchGames = async () => {
    try {
      const data = await getLiveGamesWithProbabilities();
      setGames(data);
      setLastUpdated(new Date());
      setError(null);
      let updated = false;
      data.forEach(game => {
        if (game.status !== 'Upcoming' && game.home_team.win_probability != null) {
          if (!historyRef.current[game.game_id]) {
            historyRef.current[game.game_id] = [];
          }
          historyRef.current[game.game_id].push({
            time: Date.now(),
            homeProb: game.home_team.win_probability,
          });
          if (historyRef.current[game.game_id].length > 200) {
            historyRef.current[game.game_id] = historyRef.current[game.game_id].slice(-200);
          }
          updated = true;
        }
      });
      if (updated) setHistoryVersion(v => v + 1);
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {games.map(game => (
            <LiveGameCard
              key={game.game_id}
              game={game}
              selected={selectedId === game.game_id}
              onClick={() => setSelectedId(id => id === game.game_id ? null : game.game_id)}
              history={historyRef.current[game.game_id] ?? []}
            />
          ))}
        </div>
      )}

      {/* ── Upcoming section ── */}
      <div style={{ marginTop: 48 }}>
        {/* Upcoming header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 22,
            color: 'var(--text-primary)', letterSpacing: '0.05em',
            textTransform: 'uppercase', margin: 0,
          }}>
            Upcoming Games
          </h2>
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
        {!upcomingLoading && !upcomingError && upcoming.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, letterSpacing: '0.06em' }}>
              No games tomorrow.
            </p>
          </div>
        )}

        {/* Upcoming game list */}
        {!upcomingLoading && !upcomingError && upcoming.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map(game => (
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

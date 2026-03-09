// frontend/src/components/LiveWinProbability.jsx
import { useState, useEffect, useRef } from 'react';
import LiveGameCard from './LiveGameCard';
import { getLiveGamesWithProbabilities } from '../api';

const POLL_INTERVAL_MS = 25_000;

export default function LiveWinProbability() {
  const [games,        setGames       ] = useState([]);
  const [loading,      setLoading     ] = useState(true);
  const [error,        setError       ] = useState(null);
  const [lastUpdated,  setLastUpdated ] = useState(null);
  const [selectedId,   setSelectedId  ] = useState(null);
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

  useEffect(() => {
    fetchGames();
    intervalRef.current = setInterval(fetchGames, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div>
      {/* Header */}
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

        {/* Live pulse indicator */}
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

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 13, letterSpacing: '0.06em' }}>Fetching live games…</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10, padding: '18px 22px', color: 'var(--red)', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Empty state */}
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

      {/* Game grid */}
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
    </div>
  );
}

import { useState, useEffect } from 'react';
import PlayerTable  from './components/PlayerTable';
import TopScorers   from './components/TopScorers';
import PlayerSearch from './components/PlayerSearch';
import TeamComparer from './components/TeamComparer';
import { fetchSeasons } from './api';

const TABS = [
  { id: 'Roster',       label: '🏀 Roster'        },
  { id: 'Top Scorers',  label: '📊 Top Scorers'   },
  { id: 'Team Search',  label: '🔍 Team Search'   },
  { id: 'Team Comparer',label: '⚡ Team Comparer'  },
];

export default function App() {
  const [activeTab,    setActiveTab   ] = useState('Roster');
  const [seasons,      setSeasons     ] = useState([]);
  const [activeSeason, setActiveSeason] = useState('2024-25');

  // Fetch available seasons on mount
  useEffect(() => {
    fetchSeasons()
      .then(data => {
        if (data.length > 0) {
          setSeasons(data);
          setActiveSeason(data[0]);   // newest season first
        }
      })
      .catch(() => {
        // DB not yet populated — keep default 2024-25
        setSeasons(['2024-25']);
      });
  }, []);

  return (
    <div style={{ padding: '32px 40px', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <h1 style={{
            fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px',
            background: 'linear-gradient(90deg, #00D4FF 0%, #7C3AED 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: 0,
          }}>
            StatStream
          </h1>

          {/* Season dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={activeSeason}
              onChange={e => setActiveSeason(e.target.value)}
              style={{
                background: 'rgba(0,212,255,0.10)',
                color: '#00D4FF',
                border: '1px solid rgba(0,212,255,0.30)',
                borderRadius: 20,
                padding: '3px 28px 3px 10px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                fontFamily: 'inherit',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                colorScheme: 'dark',
                outline: 'none',
              }}
            >
              {seasons.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {/* custom chevron */}
            <span style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none', color: '#00D4FF', fontSize: 8,
            }}>▼</span>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 14 }}>
          NBA Analytics Dashboard
        </p>
      </header>

      {/* ── Tab Navigation ── */}
      <nav style={{
        display: 'flex', gap: 6, marginBottom: 24,
        background: 'rgba(11, 16, 32, 0.7)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid var(--border-light)',
        borderRadius: 12, padding: 5,
        width: 'fit-content',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}>
        {TABS.map(({ id, label }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                fontFamily: 'inherit',
                transition: 'all 0.18s ease',
                background: active ? '#00D4FF' : 'transparent',
                color:      active ? '#000'    : 'var(--text-secondary)',
                boxShadow:  active ? '0 2px 8px rgba(0,212,255,0.35)' : 'none',
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {/* ── Content Panel ── */}
      <main style={{
        background: 'rgba(11, 16, 32, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 16,
        border: '1px solid var(--border-light)',
        padding: 28,
        minHeight: 400,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        <div className="fade-in" key={activeTab + activeSeason}>
          {activeTab === 'Roster'        && <PlayerTable  season={activeSeason} />}
          {activeTab === 'Top Scorers'   && <TopScorers   season={activeSeason} />}
          {activeTab === 'Team Search'   && <PlayerSearch season={activeSeason} />}
          {activeTab === 'Team Comparer' && <TeamComparer season={activeSeason} />}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-muted)', fontSize: 12 }}>
        Data via NBA Stats API · Built with React + FastAPI
      </footer>

    </div>
  );
}

import { useState, useEffect } from 'react';
import { LayoutGrid, Trophy, Search, Zap, Award, Activity, BarChart2, User } from 'lucide-react';
import PlayerTable            from './components/PlayerTable';
import TopScorers             from './components/TopScorers';
import PlayerSearch           from './components/PlayerSearch';
import TeamComparer           from './components/TeamComparer';
import PlayoffSimulator       from './components/PlayoffSimulator';
import PlayoffBracket         from './components/PlayoffBracket';
import { TubelightNavbar }    from './components/ui/TubelightNavbar';
import LiveWinProbability from './components/LiveWinProbability';
import LineupImpact from './components/LineupImpact';
import Account from './components/Account';
import AuthGate from './components/AuthGate';
import { fetchSeasons }       from './api';
import logoSrc                from './assets/logo.png';
import { useAuth } from './context/AuthContext';

// ── Tab definitions ───────────────────────────────────────────────────────────
// Icons are pre-rendered elements; TubelightNavbar renders them as-is.
const TABS = [
  { id: 'Team Search',    label: 'Team Search',    icon: <Search     size={16} strokeWidth={2.5} /> },
  { id: 'Live',           label: 'Live',            icon: <Activity   size={16} strokeWidth={2.5} /> },
  { id: 'Lineups',        label: 'Lineups',         icon: <BarChart2  size={16} strokeWidth={2.5} /> },
  { id: 'Roster',         label: 'Roster',          icon: <LayoutGrid size={16} strokeWidth={2.5} /> },
  { id: 'Top Scorers',    label: 'Top Scorers',     icon: <Trophy     size={16} strokeWidth={2.5} /> },
  { id: 'Team Comparer',  label: 'Team Comparer',   icon: <Zap        size={16} strokeWidth={2.5} /> },
  { id: 'Playoffs',       label: 'Playoffs',        icon: <Award      size={16} strokeWidth={2.5} /> },
  { id: 'Account',        label: 'Account',         icon: <User       size={16} strokeWidth={2.5} /> },
];

export default function App() {
  const [activeTab,         setActiveTab        ] = useState('Team Search');
  const [seasons,           setSeasons          ] = useState([]);
  const [activeSeason,      setActiveSeason     ] = useState(null);
  const [liveSelectedGameId, setLiveSelectedGameId] = useState(null);
  const { favoriteTeam, setFavoriteTeam } = useAuth();

  function goLive(gameId) {
    setLiveSelectedGameId(gameId);
    setActiveTab('Live');
  }

  useEffect(() => {
    fetchSeasons()
      .then(data => {
        if (data.length > 0) {
          setSeasons(data);
          setActiveSeason(data[0]);
        }
      })
      .catch(() => {
        setSeasons(['2025-26', '2024-25']);
        setActiveSeason('2025-26');
      });
  }, []);

  return (
    /*
     * Top padding (88px) pushes content below the fixed TubelightNavbar
     * dock (≈ 56px pill + 20px paddingTop + ~12px breathing room).
     */
    <div style={{ padding: '160px 40px 32px', minHeight: '100vh' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #4ADE80; }
          50% { opacity: 0.5; box-shadow: 0 0 12px #4ADE80; }
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          {/* Left: title + badge + dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {/* Brand mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 38, fontWeight: 400, letterSpacing: '0.06em',
              color: '#F0F4FB',
              margin: 0,
              lineHeight: 1,
              textTransform: 'uppercase',
            }}>
              StatStream
            </h1>
          </div>

          {/* NBA badge */}
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.2em',
            color: 'var(--accent)', border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 4, padding: '3px 8px', textTransform: 'uppercase',
            background: 'rgba(255,255,255,0.06)',
          }}>
            NBA Analytics
          </span>

          {/* Season dropdown */}
          <div style={{ position: 'relative', marginLeft: 4 }}>
            <select
              value={activeSeason}
              onChange={e => setActiveSeason(e.target.value)}
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: 20,
                padding: '4px 28px 4px 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                fontFamily: 'inherit',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                colorScheme: 'dark',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
            >
              {seasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{
              position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 8,
            }}>▼</span>
          </div>
          </div> {/* end left group */}


        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-sans)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: '#4ADE80',
            boxShadow: '0 0 6px #4ADE80',
            animation: 'pulse 2s ease infinite',
          }} />
          Live NBA data · {activeSeason} Season
        </p>
      </header>

      {/* ── S Logo — fixed top-left corner ── */}
      <img
        src={logoSrc}
        alt="StatStream logo"
        style={{
          position: 'fixed', top: 0, left: 18, zIndex: 51,
          width: 180, height: 180, objectFit: 'contain',
        }}
      />

      {/* ── Content Panel ── */}
      <main style={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        border: '1px solid var(--border-light)',
        borderTop: '2px solid rgba(255,255,255,0.15)',
        padding: 28,
        minHeight: 400,
        boxShadow: '0 0 0 1px rgba(255,255,255,0.02) inset, 0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div className="fade-in" key={activeTab + activeSeason}>
          {!activeSeason && <div className="spinner" />}
          {activeSeason && activeTab === 'Roster'        && <PlayerTable      season={activeSeason} />}
          {activeSeason && activeTab === 'Top Scorers'   && <TopScorers       season={activeSeason} />}
          {activeSeason && activeTab === 'Team Search'   && <PlayerSearch     season={activeSeason} onGoLive={goLive} favoriteTeam={favoriteTeam} />}
          {activeSeason && activeTab === 'Team Comparer' && (
            <AuthGate>
              <TeamComparer season={activeSeason} />
            </AuthGate>
          )}
          {activeTab === 'Live'    && <LiveWinProbability initialSelectedGameId={liveSelectedGameId} favoriteTeam={favoriteTeam} />}
          {activeSeason && activeTab === 'Lineups'   && <LineupImpact    season={activeSeason} />}
          {activeSeason && activeTab === 'Playoffs'  && (
            <AuthGate>
              <PlayoffSimulator season={activeSeason} />
            </AuthGate>
          )}
          {activeTab === 'Account' && (
            <Account
              onOpenMyTeam={() => {
                setActiveTab('Team Search');
              }}
              onFavoriteTeamChanged={setFavoriteTeam}
            />
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.05em' }}>
        Data via NBA Stats API · Built with React + FastAPI · {new Date().getFullYear()}
      </footer>


      {/* ── Tubelight Navbar — fixed floating dock at bottom ── */}
      <TubelightNavbar
        items={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

    </div>
  );
}

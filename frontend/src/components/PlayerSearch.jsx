import { useState, useRef, useEffect } from 'react';
import { fetchPlayersByTeam, fetchTeamDashboard, fetchTeamSchedule } from '../api';
import TeamDashboard from './TeamDashboard';
import { getTeamLogoUrl } from '../utils/teamLogos';

const NBA_TEAMS = [
  { abbr: 'ATL', name: 'Atlanta Hawks'            },
  { abbr: 'BOS', name: 'Boston Celtics'           },
  { abbr: 'BKN', name: 'Brooklyn Nets'            },
  { abbr: 'CHA', name: 'Charlotte Hornets'        },
  { abbr: 'CHI', name: 'Chicago Bulls'            },
  { abbr: 'CLE', name: 'Cleveland Cavaliers'      },
  { abbr: 'DAL', name: 'Dallas Mavericks'         },
  { abbr: 'DEN', name: 'Denver Nuggets'           },
  { abbr: 'DET', name: 'Detroit Pistons'          },
  { abbr: 'GSW', name: 'Golden State Warriors'    },
  { abbr: 'HOU', name: 'Houston Rockets'          },
  { abbr: 'IND', name: 'Indiana Pacers'           },
  { abbr: 'LAC', name: 'LA Clippers'              },
  { abbr: 'LAL', name: 'Los Angeles Lakers'       },
  { abbr: 'MEM', name: 'Memphis Grizzlies'        },
  { abbr: 'MIA', name: 'Miami Heat'               },
  { abbr: 'MIL', name: 'Milwaukee Bucks'          },
  { abbr: 'MIN', name: 'Minnesota Timberwolves'   },
  { abbr: 'NOP', name: 'New Orleans Pelicans'     },
  { abbr: 'NYK', name: 'New York Knicks'          },
  { abbr: 'OKC', name: 'Oklahoma City Thunder'    },
  { abbr: 'ORL', name: 'Orlando Magic'            },
  { abbr: 'PHI', name: 'Philadelphia 76ers'       },
  { abbr: 'PHX', name: 'Phoenix Suns'             },
  { abbr: 'POR', name: 'Portland Trail Blazers'   },
  { abbr: 'SAC', name: 'Sacramento Kings'         },
  { abbr: 'SAS', name: 'San Antonio Spurs'        },
  { abbr: 'TOR', name: 'Toronto Raptors'          },
  { abbr: 'UTA', name: 'Utah Jazz'                },
  { abbr: 'WAS', name: 'Washington Wizards'       },
];

export default function PlayerSearch({ season = '2024-25' }) {
  const [query,     setQuery    ] = useState('');
  const [open,      setOpen     ] = useState(false);
  const [loading,   setLoading  ] = useState(false);
  const [error,     setError    ] = useState(null);
  const [teamAbbr,  setTeamAbbr ] = useState('');
  const [teamName,  setTeamName ] = useState('');
  const [players,   setPlayers  ] = useState([]);
  const [dashData,  setDashData ] = useState(null);
  const [schedule,  setSchedule ] = useState([]);
  const [schedLoading, setSchedLoading] = useState(false);

  const wrapRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset on season change
  useEffect(() => {
    setPlayers([]);
    setDashData(null);
    setSchedule([]);
    setError(null);
    setTeamAbbr('');
    setTeamName('');
    setQuery('');
  }, [season]);

  const filtered = NBA_TEAMS.filter(t =>
    t.abbr.includes(query.toUpperCase()) ||
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  async function search(abbr, fullName) {
    setOpen(false);
    setQuery(abbr);
    setTeamAbbr(abbr);
    setTeamName(fullName);
    setLoading(true);
    setError(null);
    setPlayers([]);
    setDashData(null);
    setSchedule([]);
    try {
      const [rosterData, dash] = await Promise.all([
        fetchPlayersByTeam(abbr, season),
        fetchTeamDashboard(abbr, season),
      ]);
      setPlayers(rosterData);
      setDashData(dash);
      // Fetch schedule separately — it's slow (ScoreboardV2 loops up to 14 days)
      setSchedLoading(true);
      fetchTeamSchedule(abbr)
        .then(sched => setSchedule(sched))
        .catch(() => {})
        .finally(() => setSchedLoading(false));
    } catch {
      setError(`Could not load dashboard for "${fullName}" in ${season}.`);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && filtered.length > 0) search(filtered[0].abbr, filtered[0].name);
    if (e.key === 'Escape') setOpen(false);
  }

  const hasDashboard = !loading && !error && dashData;

  return (
    <div>
      {/* Header */}
      {!hasDashboard && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Team Dashboard
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
            Pick a team to see their full dashboard
          </p>
        </div>
      )}

      {/* Search bar — always visible */}
      <div ref={wrapRef} style={{ position: 'relative', maxWidth: 440, marginBottom: hasDashboard ? 24 : 28 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none', color: 'var(--text-muted)', display: 'flex',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              className="ss-input"
              placeholder="Search team name or abbreviation..."
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              style={{ paddingLeft: 38 }}
            />
          </div>
          <button
            className="ss-btn"
            onClick={() => filtered.length > 0 && search(filtered[0].abbr, filtered[0].name)}
          >
            Search
          </button>
        </div>

        {/* Dropdown */}
        {open && filtered.length > 0 && (
          <div className="slide-down" style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
            width: '100%', zIndex: 50,
            background: 'var(--bg-card-2)',
            border: '1px solid var(--border-bright)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden', maxHeight: 280, overflowY: 'auto',
          }}>
            {filtered.map((t, i) => (
              <div
                key={t.abbr}
                onMouseDown={() => search(t.abbr, t.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {getTeamLogoUrl(t.abbr) && (
                  <img src={getTeamLogoUrl(t.abbr)} alt={t.abbr} width={22} height={22}
                    style={{ objectFit: 'contain', flexShrink: 0 }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
                <span style={{
                  background: 'var(--bg-hover)', border: '1px solid var(--border-bright)',
                  borderRadius: 6, padding: '2px 7px',
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                  color: 'var(--text-secondary)', flexShrink: 0, minWidth: 38, textAlign: 'center',
                }}>
                  {t.abbr}
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 14 }}>
                  {t.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* States */}
      {loading && <div className="spinner" />}

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Dashboard */}
      {hasDashboard && (
        <TeamDashboard
          teamAbbr={teamAbbr}
          teamName={teamName}
          dashData={dashData}
          players={players}
          schedule={schedule}
          schedLoading={schedLoading}
        />
      )}

      {/* Empty state */}
      {!loading && !error && !dashData && (
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
            No team selected
          </p>
          <p style={{ fontSize: 13 }}>Use the search above to explore any NBA team</p>
        </div>
      )}
    </div>
  );
}

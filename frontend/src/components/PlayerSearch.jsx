import { useState, useRef, useEffect } from 'react';
import { fetchPlayersByTeam } from '../api';
import DisplayCards from './DisplayCards';

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
  const [query,    setQuery   ] = useState('');
  const [open,     setOpen    ] = useState(false);
  const [players,  setPlayers ] = useState([]);
  const [loading,  setLoading ] = useState(false);
  const [error,    setError   ] = useState(null);
  const [teamLabel, setTeamLabel] = useState('');

  const wrapRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = NBA_TEAMS.filter(t =>
    t.abbr.includes(query.toUpperCase()) ||
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  // Clear results when season changes
  useEffect(() => {
    setPlayers([]);
    setError(null);
    setTeamLabel('');
    setQuery('');
  }, [season]);

  async function search(abbr, fullName) {
    setOpen(false);
    setQuery(abbr);
    setTeamLabel(fullName);
    setLoading(true);
    setError(null);
    setPlayers([]);
    try {
      const data = await fetchPlayersByTeam(abbr, season);
      setPlayers(data);
    } catch {
      setError(`No roster data found for "${fullName}" in ${season}.`);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && filtered.length > 0) {
      search(filtered[0].abbr, filtered[0].name);
    }
    if (e.key === 'Escape') setOpen(false);
  }

  const sorted = [...players].sort((a, b) => b.pts_per_game - a.pts_per_game);

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Team Roster Search
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
          Pick a team to see their full player stats
        </p>
      </div>

      {/* ── Dropdown search ── */}
      <div ref={wrapRef} style={{ position: 'relative', maxWidth: 440, marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 15, pointerEvents: 'none', color: 'var(--text-muted)',
            }}>🏀</span>
            <input
              className="ss-input"
              placeholder="Search team name or abbreviation…"
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

        {/* Dropdown list */}
        {open && filtered.length > 0 && (
          <div className="slide-down" style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
            width: '100%', zIndex: 50,
            background: 'var(--bg-card-2)',
            border: '1px solid var(--border-bright)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
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
                <span style={{
                  background: 'rgba(0,212,255,0.1)',
                  color: 'var(--cyan)', border: '1px solid rgba(0,212,255,0.2)',
                  borderRadius: 6, padding: '2px 7px',
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                  flexShrink: 0, minWidth: 38, textAlign: 'center',
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

      {/* ── States ── */}
      {loading && <div className="spinner" />}

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Results ── */}
      {!loading && sorted.length > 0 && (
        <div>
          {/* Result header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              {teamLabel}
            </h3>
            <span style={{
              background: 'rgba(0,212,255,0.08)', color: 'var(--cyan)',
              border: '1px solid rgba(0,212,255,0.18)',
              borderRadius: 20, padding: '3px 11px', fontSize: 12, fontWeight: 700,
            }}>
              {sorted.length} players
            </span>
          </div>

          {/* Player cards grid — powered by DisplayCards */}
          <DisplayCards
            players={sorted}
            variant="grid"
            showRank={true}
            showTeam={false}
            stats={['pts', 'reb', 'ast']}
          />
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏀</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
            No team selected
          </p>
          <p style={{ fontSize: 13 }}>Use the search above to explore any NBA roster</p>
        </div>
      )}
    </div>
  );
}

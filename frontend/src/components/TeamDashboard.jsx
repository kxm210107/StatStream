import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Trophy, Activity, Shield, BarChart2 } from 'lucide-react';
import { getTeamLogoUrl, getPlayerHeadshotUrl } from '../utils/teamLogos';

// ── Small primitives ──────────────────────────────────────────────────────────

function TeamLogo({ abbr, size = 32 }) {
  const url = getTeamLogoUrl(abbr);
  if (!url) return (
    <span style={{
      width: size, height: size, borderRadius: 4,
      background: 'var(--bg-hover)', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, color: 'var(--text-muted)', flexShrink: 0,
    }}>{abbr?.slice(0, 3)}</span>
  );
  return (
    <img src={url} alt={abbr} width={size} height={size}
      style={{ objectFit: 'contain', flexShrink: 0 }}
      onError={e => { e.target.style.display = 'none'; }}
    />
  );
}

function PlayerHeadshot({ playerId, name, size = 32 }) {
  const [err, setErr] = useState(false);
  if (!playerId || err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'var(--bg-hover)', border: '1px solid var(--border-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 700, color: 'var(--text-muted)',
      }}>
        {name?.split(' ').map(w => w[0]).join('').slice(0, 2)}
      </div>
    );
  }
  return (
    <img
      src={getPlayerHeadshotUrl(playerId)}
      alt={name}
      width={size} height={size}
      style={{ borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', flexShrink: 0 }}
      onError={() => setErr(true)}
    />
  );
}

// ── Stat card (top row) ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, trend, icon }) {
  const trendUp = trend > 0;
  return (
    <div style={{
      background: 'var(--bg-card-2)',
      border: '1px solid var(--border-light)',
      borderRadius: 12, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 6,
      flex: 1, minWidth: 140,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          color: 'var(--text-muted)', textTransform: 'uppercase',
        }}>{label}</span>
        {icon && <span style={{ color: 'var(--text-muted)', opacity: 0.5, display: 'flex' }}>{icon}</span>}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 900, color: 'var(--text-primary)',
        fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', lineHeight: 1,
      }}>
        {value}
      </div>
      {(sub || trend != null) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {trend != null && (
            <span style={{ fontSize: 11, fontWeight: 700, color: trendUp ? '#4ADE80' : '#F87171' }}>
              {trendUp ? '+' : ''}{trend}
            </span>
          )}
          {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

// ── Performance Chart ──────────────────────────────────────────────────────────

function PerformanceChart({ gameLog }) {
  const data = [...gameLog].reverse().map((g, i) => ({
    game: i + 1,
    pts: g.pts,
    opp_pts: g.opp_pts,
  }));

  return (
    <div style={{
      background: 'var(--bg-card-2)', border: '1px solid var(--border-light)',
      borderRadius: 12, padding: '18px 20px',
    }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
        Offensive Performance
      </p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginBottom: 14 }}>
        Points scored over last {gameLog.length} games
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="ptsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="game" tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            tickLine={false} axisLine={false} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card-2)', border: '1px solid var(--border-bright)',
              borderRadius: 8, fontSize: 12, color: 'var(--text-primary)',
            }}
            formatter={(v, name) => [v, name === 'pts' ? 'Team PTS' : 'Opp PTS']}
            labelFormatter={l => `Game ${l}`}
          />
          <Area type="monotone" dataKey="pts" stroke="#3B82F6" strokeWidth={2}
            fill="url(#ptsGrad)" dot={false} activeDot={{ r: 4, fill: '#3B82F6' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Roster Stats Table ──────────────────────────────────────────────────────────

function RosterStatsTable({ players }) {
  const sorted = [...players].sort((a, b) => b.pts_per_game - a.pts_per_game);

  return (
    <div style={{
      background: 'var(--bg-card-2)', border: '1px solid var(--border-light)',
      borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '18px 20px 12px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Roster Stats
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          Season averages per game
        </p>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 52px 52px 52px',
        padding: '6px 20px', borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
          letterSpacing: '0.08em', textTransform: 'uppercase' }}>PLAYER</span>
        {['PTS', 'REB', 'AST'].map(s => (
          <span key={s} style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'right',
          }}>{s}</span>
        ))}
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 260 }}>
        {sorted.map((p, i) => (
          <div key={p.player_id ?? i} style={{
            display: 'grid', gridTemplateColumns: '1fr 52px 52px 52px',
            alignItems: 'center', padding: '8px 20px',
            borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <PlayerHeadshot playerId={p.player_id} name={p.player_name} size={32} />
              <div style={{ minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.player_name}
                </p>
                {p.position && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {p.position}
                  </span>
                )}
              </div>
            </div>
            <span className="stat-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--stat-pts)', textAlign: 'right' }}>
              {p.pts_per_game?.toFixed(1)}
            </span>
            <span className="stat-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--stat-reb)', textAlign: 'right' }}>
              {p.reb_per_game?.toFixed(1)}
            </span>
            <span className="stat-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--stat-ast)', textAlign: 'right' }}>
              {p.ast_per_game?.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NBA team full names ────────────────────────────────────────────────────────

const NBA_TEAM_NAMES = {
  ATL:'Atlanta Hawks',BOS:'Boston Celtics',BKN:'Brooklyn Nets',CHA:'Charlotte Hornets',
  CHI:'Chicago Bulls',CLE:'Cleveland Cavaliers',DAL:'Dallas Mavericks',DEN:'Denver Nuggets',
  DET:'Detroit Pistons',GSW:'Golden State Warriors',HOU:'Houston Rockets',IND:'Indiana Pacers',
  LAC:'LA Clippers',LAL:'Los Angeles Lakers',MEM:'Memphis Grizzlies',MIA:'Miami Heat',
  MIL:'Milwaukee Bucks',MIN:'Minnesota Timberwolves',NOP:'New Orleans Pelicans',NYK:'New York Knicks',
  OKC:'Oklahoma City Thunder',ORL:'Orlando Magic',PHI:'Philadelphia 76ers',PHX:'Phoenix Suns',
  POR:'Portland Trail Blazers',SAC:'Sacramento Kings',SAS:'San Antonio Spurs',TOR:'Toronto Raptors',
  UTA:'Utah Jazz',WAS:'Washington Wizards',
};

// ── Upcoming Schedule ──────────────────────────────────────────────────────────

function ScheduleRow({ game, teamAbbr, isLast }) {
  const opp = game.opponent;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      {/* Searched team always left */}
      <TeamLogo abbr={teamAbbr} size={28} />
      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', flexShrink: 0 }}>
        VS
      </span>
      {/* Opponent always right */}
      <TeamLogo abbr={opp} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {NBA_TEAM_NAMES[opp] || opp}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
          {game.date}{game.time ? ` · ${game.time}` : ''} · {game.home ? 'Home' : 'Away'}
        </p>
      </div>
    </div>
  );
}

function UpcomingSchedule({ games, teamAbbr, loading, liveGame, onGoLive }) {
  return (
    <div style={{
      background: 'var(--bg-card-2)', border: '1px solid var(--border-light)',
      borderRadius: 12, padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Upcoming Schedule
        </p>
        {games.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Next {games.length} games</span>
        )}
      </div>

      {/* Live game banner */}
      {liveGame && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 8, padding: '10px 12px', marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: '#EF4444', boxShadow: '0 0 6px #EF4444',
              animation: 'pulse 2s ease infinite', flexShrink: 0,
            }} />
            <TeamLogo abbr={teamAbbr} size={22} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>vs</span>
            <TeamLogo abbr={liveGame.opponent} size={22} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', letterSpacing: '0.08em' }}>
              LIVE NOW
            </span>
          </div>
          <button
            onClick={() => onGoLive?.(liveGame.game_id)}
            style={{
              background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6,
              padding: '5px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
              cursor: 'pointer', textTransform: 'uppercase',
            }}
          >
            Watch Live →
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--text-muted)', fontSize: 12 }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid var(--border-light)', borderTopColor: 'var(--accent)',
            animation: 'spin 0.75s linear infinite', flexShrink: 0,
          }} />
          Loading schedule...
        </div>
      ) : games.length === 0
        ? <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>No upcoming games found</p>
        : games.map((g, i) => (
            <ScheduleRow key={i} game={g} teamAbbr={teamAbbr} isLast={i === games.length - 1} />
          ))
      }
    </div>
  );
}

// ── Recent Results ──────────────────────────────────────────────────────────────

function ResultRow({ game, isLast }) {
  const win = game.wl === 'W';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
        background: win ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
        border: `1px solid ${win ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color: win ? '#4ADE80' : '#F87171',
      }}>{game.wl}</div>
      <TeamLogo abbr={game.opponent} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {NBA_TEAM_NAMES[game.opponent] || game.opponent}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
          {game.home ? 'Home' : 'Away'} · {game.date}
        </p>
      </div>
      <span className="stat-num" style={{
        fontSize: 13, fontWeight: 800, flexShrink: 0,
        color: win ? '#4ADE80' : '#F87171',
      }}>
        {game.pts}–{game.opp_pts}
      </span>
    </div>
  );
}

function RecentResults({ games }) {
  const recent = games.slice(0, 5);
  return (
    <div style={{
      background: 'var(--bg-card-2)', border: '1px solid var(--border-light)',
      borderRadius: 12, padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Recent Results
        </p>
        {recent.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Last {recent.length} games</span>
        )}
      </div>
      {recent.length === 0
        ? <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>No results yet</p>
        : recent.map((g, i) => (
            <ResultRow key={i} game={g} isLast={i === recent.length - 1} />
          ))
      }
    </div>
  );
}

// ── Main exported component ────────────────────────────────────────────────────

export default function TeamDashboard({ teamAbbr, teamName, dashData, players, schedule = [], schedLoading = false, liveGame = null, onGoLive }) {
  const { stats, game_log } = dashData;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Team header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <TeamLogo abbr={teamAbbr} size={48} />
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>
            {teamName}
          </h2>
          {stats && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {stats.record} · {stats.plus_minus >= 0 ? '+' : ''}{stats.plus_minus} point differential
            </p>
          )}
        </div>
      </div>

      {/* Stat cards */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard label="Win-Loss Record" value={stats.record} sub={`${stats.wins} wins this season`}
            icon={<Trophy size={14} strokeWidth={2} />} />
          <StatCard label="Points Per Game" value={stats.ppg} sub="Team avg" trend={stats.plus_minus}
            icon={<Activity size={14} strokeWidth={2} />} />
          <StatCard label="Defensive Rating" value={stats.opp_ppg} sub="Opp PPG · lower is better"
            icon={<Shield size={14} strokeWidth={2} />} />
          <StatCard
            label="AST / TO Ratio"
            value={stats.ast_to_ratio.toFixed(2)}
            sub={`${stats.ast_per_game} AST · ${stats.tov_per_game} TOV`}
            icon={<BarChart2 size={14} strokeWidth={2} />}
          />
        </div>
      )}

      {/* Chart + Roster (two-column) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {game_log.length > 0
          ? <PerformanceChart gameLog={game_log} />
          : <div style={{
              background: 'var(--bg-card-2)', border: '1px solid var(--border-light)',
              borderRadius: 12, padding: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 13,
            }}>No game data available</div>
        }
        {players.length > 0
          ? <RosterStatsTable players={players} />
          : <div style={{
              background: 'var(--bg-card-2)', border: '1px solid var(--border-light)',
              borderRadius: 12, padding: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 13,
            }}>No roster data</div>
        }
      </div>

      {/* Schedule + Results (two-column) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <UpcomingSchedule games={schedule} teamAbbr={teamAbbr} loading={schedLoading} liveGame={liveGame} onGoLive={onGoLive} />
        <RecentResults games={game_log} />
      </div>
    </div>
  );
}

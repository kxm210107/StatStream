import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getPlayerHeadshotUrl, getTeamLogoUrl, getTeamColor } from '../utils/teamLogos';
import { fetchPlayerGameLog } from '../api';

// ── Headshot with initials fallback ───────────────────────────────────────────

function PlayerHeadshot({ playerId, playerName, teamColor, size = 72 }) {
  const [err, setErr] = useState(false);

  const initials = playerName
    ? playerName.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  if (!playerId || err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: teamColor,
        border: `2px solid ${teamColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.3, fontWeight: 800, color: '#fff',
      }}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={getPlayerHeadshotUrl(playerId)}
      alt={playerName}
      width={size} height={size}
      style={{
        borderRadius: '50%',
        objectFit: 'cover',
        objectPosition: 'top',
        flexShrink: 0,
        border: `2px solid ${teamColor}`,
      }}
      onError={() => setErr(true)}
    />
  );
}

// ── Stat bubble ───────────────────────────────────────────────────────────────

function StatBubble({ label, value, color, isWinner = false }) {
  return (
    <div style={{
      textAlign: 'center', flex: 1,
      borderRadius: 8,
      background: isWinner ? 'rgba(74,222,128,0.07)' : 'transparent',
      padding: '6px 2px',
      transition: 'background 0.2s',
    }}>
      <div style={{
        fontSize: 22, fontWeight: 900,
        fontFamily: 'var(--font-mono)',
        color,
        lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
      }}>
        {value?.toFixed(1) ?? '—'}
        {isWinner && (
          <span style={{ fontSize: 9, color: '#4ADE80', lineHeight: 1, marginTop: -8, marginLeft: 1 }}>▲</span>
        )}
      </div>
      <div style={{
        fontSize: 10, fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: isWinner ? '#4ADE80' : 'var(--text-muted)', marginTop: 4,
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Shooting split row ────────────────────────────────────────────────────────

function ShootingBar({ label, pct, color }) {
  const valid = pct != null && !isNaN(pct);
  const fillPct = valid ? Math.min(pct * 100, 100) : 0;
  const displayVal = valid ? `${(pct * 100).toFixed(1)}%` : '—';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: 36, fontSize: 11, fontWeight: 700,
        color: 'var(--text-muted)', textTransform: 'uppercase',
        letterSpacing: '0.06em', flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: 6,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          width: `${fillPct.toFixed(1)}%`,
          height: '100%',
          background: color,
          borderRadius: 4,
        }} />
      </div>
      <span style={{
        width: 48, fontSize: 12, fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-primary)', textAlign: 'right', flexShrink: 0,
      }}>
        {displayVal}
      </span>
    </div>
  );
}

// ── Vertical separator ────────────────────────────────────────────────────────

function VSep() {
  return (
    <div style={{
      width: 1, alignSelf: 'stretch',
      background: 'rgba(255,255,255,0.1)',
      flexShrink: 0,
    }} />
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      color: 'var(--text-muted)', margin: '0 0 10px 0',
    }}>
      {children}
    </p>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <hr style={{
      border: 'none',
      borderTop: '1px solid var(--border-light)',
      margin: '16px 0',
    }} />
  );
}

// ── Game log table ────────────────────────────────────────────────────────────

function GameLogTable({ gameLog, loading }) {
  if (loading) return <div className="spinner" />;
  if (!gameLog || gameLog.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
        No recent games available
      </p>
    );
  }

  // Detect if FG% is already in 0–100 range or 0–1 range
  const maxFgPct = Math.max(...gameLog.map(g => g.fg_pct ?? 0));
  const fgMultiplier = maxFgPct < 2 ? 100 : 1;

  const cols = ['Date', 'Matchup', 'W/L', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG%'];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        fontSize: 12, tableLayout: 'auto',
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
            {cols.map(col => (
              <th key={col} style={{
                padding: '4px 8px', textAlign: col === 'Date' || col === 'Matchup' ? 'left' : 'right',
                fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gameLog.map((g, i) => {
            const win = g.result === 'W';
            const fgDisplay = g.fg_pct != null
              ? `${(g.fg_pct * fgMultiplier).toFixed(1)}%`
              : '—';
            return (
              <tr key={i} style={{
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                borderBottom: i < gameLog.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <td style={{ padding: '6px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {g.date ?? '—'}
                </td>
                <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {g.opponent ?? '—'}
                </td>
                <td style={{
                  padding: '6px 8px', textAlign: 'right',
                  fontWeight: 800, fontFamily: 'var(--font-mono)',
                  color: win ? '#4ADE80' : '#F87171',
                }}>
                  {g.result ?? '—'}
                </td>
                {[g.pts, g.reb, g.ast, g.stl, g.blk].map((val, j) => (
                  <td key={j} style={{
                    padding: '6px 8px', textAlign: 'right',
                    fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}>
                    {val ?? '—'}
                  </td>
                ))}
                <td style={{
                  padding: '6px 8px', textAlign: 'right',
                  fontFamily: 'var(--font-mono)', fontWeight: 600,
                  color: 'var(--text-muted)',
                }}>
                  {fgDisplay}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Custom tooltip for bar chart ──────────────────────────────────────────────

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'var(--bg-card-2)', border: '1px solid var(--border-light)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    }}>
      <span style={{ color: d.color, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
        {d.name}
      </span>
      <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginLeft: 8, fontWeight: 700 }}>
        {d.value?.toFixed(1)}
      </span>
    </div>
  );
}

// ── Winner helper ─────────────────────────────────────────────────────────────

function isWinnerStat(myVal, theirVal, lowerIsBetter = false) {
  if (myVal == null || theirVal == null) return false;
  if (myVal === theirVal) return false;
  return lowerIsBetter ? myVal < theirVal : myVal > theirVal;
}

// ── Main PlayerCard ───────────────────────────────────────────────────────────

export default function PlayerCard({ player, season, onRemove, comparePlayer = null }) {
  const [gameLog, setGameLog] = useState([]);
  const [gameLogLoading, setGameLogLoading] = useState(true);

  useEffect(() => {
    if (!player?.player_id) {
      setGameLogLoading(false);
      return;
    }
    setGameLogLoading(true);
    fetchPlayerGameLog(player.player_id, season)
      .then(data => setGameLog(Array.isArray(data) ? data : []))
      .catch(() => setGameLog([]))
      .finally(() => setGameLogLoading(false));
  }, [player?.player_id, season]);

  const teamColor = getTeamColor(player.team);
  const teamLogoUrl = getTeamLogoUrl(player.team);

  const chartData = [
    { name: 'PTS', value: player.pts_per_game ?? 0, color: '#F0F4FB' },
    { name: 'REB', value: player.reb_per_game ?? 0, color: '#F0F4FB' },
    { name: 'AST', value: player.ast_per_game ?? 0, color: '#F0F4FB' },
    { name: 'BLK', value: player.blk_per_game ?? 0, color: '#F0F4FB' },
    { name: 'STL', value: player.stl_per_game ?? 0, color: '#F0F4FB' },
  ];

  return (
    <div style={{
      background: 'var(--bg-card-2)',
      border: '1px solid var(--border-light)',
      borderRadius: 16,
      padding: 24,
      position: 'relative',
    }}>

      {/* ── X button ── */}
      <button
        onClick={onRemove}
        style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid var(--border-light)',
          borderRadius: 6, color: 'var(--text-muted)',
          width: 28, height: 28, cursor: 'pointer',
          fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-label="Remove player card"
      >
        ✕
      </button>

      {/* ── Header: headshot + name + team + position ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingRight: 40 }}>
        <PlayerHeadshot
          playerId={player.player_id}
          playerName={player.player_name}
          teamColor={teamColor}
          size={72}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 20, fontWeight: 800,
            color: 'var(--text-primary)',
            lineHeight: 1.1, marginBottom: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {player.player_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Team logo */}
            {teamLogoUrl && (
              <img
                src={teamLogoUrl}
                alt={player.team}
                width={28} height={28}
                style={{ objectFit: 'contain', flexShrink: 0 }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            )}
            {/* Team badge */}
            {player.team && (
              <span style={{
                fontSize: 10, fontWeight: 800,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                background: `${teamColor}22`,
                border: `1px solid ${teamColor}55`,
                borderRadius: 5, padding: '2px 7px',
                color: teamColor,
              }}>
                {player.team}
              </span>
            )}
            {/* Position badge */}
            {player.position && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-light)',
                borderRadius: 5, padding: '2px 7px',
              }}>
                {player.position}
              </span>
            )}
          </div>
        </div>
      </div>

      <Divider />

      {/* ── Core stats row — 6 bubbles ── */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
        <StatBubble label="PTS" value={player.pts_per_game} color="var(--text-primary)"
          isWinner={comparePlayer ? isWinnerStat(player.pts_per_game, comparePlayer.pts_per_game) : false} />
        <VSep />
        <StatBubble label="REB" value={player.reb_per_game} color="var(--text-primary)"
          isWinner={comparePlayer ? isWinnerStat(player.reb_per_game, comparePlayer.reb_per_game) : false} />
        <VSep />
        <StatBubble label="AST" value={player.ast_per_game} color="var(--text-primary)"
          isWinner={comparePlayer ? isWinnerStat(player.ast_per_game, comparePlayer.ast_per_game) : false} />
        <VSep />
        <StatBubble label="BLK" value={player.blk_per_game} color="var(--text-primary)"
          isWinner={comparePlayer ? isWinnerStat(player.blk_per_game, comparePlayer.blk_per_game) : false} />
        <VSep />
        <StatBubble label="STL" value={player.stl_per_game} color="var(--text-primary)"
          isWinner={comparePlayer ? isWinnerStat(player.stl_per_game, comparePlayer.stl_per_game) : false} />
        <VSep />
        <StatBubble label="TOV" value={player.tov_per_game} color="var(--text-primary)"
          isWinner={comparePlayer ? isWinnerStat(player.tov_per_game, comparePlayer.tov_per_game, true) : false} />
      </div>

      <Divider />

      {/* ── Shooting splits ── */}
      <SectionLabel>Shooting Splits</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ShootingBar label="FG%" pct={player.fg_pct} color="var(--accent)" />
        <ShootingBar label="3P%" pct={player.fg3_pct} color="var(--accent)" />
        <ShootingBar label="FT%" pct={player.ft_pct} color="var(--accent)" />
      </div>

      <Divider />

      {/* ── Advanced stats pills ── */}
      <SectionLabel>Advanced</SectionLabel>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          {
            label: 'TS%',
            value: player.ts_pct != null
              ? `${(player.ts_pct * 100).toFixed(1)}%`
              : '—',
          },
          {
            label: 'NET RTG',
            value: player.net_rating != null
              ? player.net_rating.toFixed(1)
              : '—',
          },
          {
            label: '+/-',
            value: player.plus_minus != null
              ? (player.plus_minus > 0
                  ? `+${player.plus_minus.toFixed(1)}`
                  : player.plus_minus.toFixed(1))
              : '—',
          },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-light)',
            borderRadius: 8, padding: '6px 12px',
            fontSize: 13, display: 'flex', alignItems: 'center',
          }}>
            <span style={{
              color: 'var(--text-muted)', fontSize: 10,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginRight: 6,
            }}>
              {label}
            </span>
            <span style={{
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
            }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      <Divider />

      {/* ── Bar chart — hidden in comparison mode (grouped chart shown above instead) ── */}
      {!comparePlayer && (
        <>
          <SectionLabel>Season Stats Chart</SectionLabel>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <Divider />
        </>
      )}

      {/* ── Recent game log ── */}
      <SectionLabel>Recent Games</SectionLabel>
      <GameLogTable gameLog={gameLog} loading={gameLogLoading} />

    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { fetchTopScorers } from '../api';
import DisplayCards from './DisplayCards';
import { getPlayerHeadshotUrl } from '../utils/teamLogos';

const STAT_CONFIG = [
  { key: 'pts', label: 'PTS', color: 'var(--stat-pts)', bg: 'rgba(238,242,249,0.06)', border: 'rgba(238,242,249,0.12)' },
  { key: 'reb', label: 'REB', color: 'var(--stat-reb)', bg: 'rgba(143,165,190,0.08)', border: 'rgba(143,165,190,0.15)' },
  { key: 'ast', label: 'AST', color: 'var(--stat-ast)', bg: 'rgba(90,122,149,0.08)',  border: 'rgba(90,122,149,0.15)'  },
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'var(--bg-card-2)', border: '1px solid var(--border-light)',
      borderRadius: 10, padding: '10px 14px', fontSize: 13,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)', fontSize: 13 }}>
        {d.fullName}
      </p>
      {STAT_CONFIG.map(({ key, label, color }) => (
        <p key={key} style={{ color, margin: '2px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, width: 26 }}>{label}</span>
          <strong style={{ fontSize: 14 }}>{d[key]?.toFixed(1)}</strong>
        </p>
      ))}
    </div>
  );
};

export default function TopScorers({ season = '2024-25' }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTopScorers(10, season)
      .then(data => setPlayers(data))
      .finally(() => setLoading(false));
  }, [season]);

  if (loading) return <div className="spinner" />;

  const chartData = players.map(p => ({
    name:     p.player_name.split(' ').slice(-1)[0],
    fullName: p.player_name,
    pts:      p.pts_per_game,
    reb:      p.reb_per_game,
    ast:      p.ast_per_game,
  }));

  const leader = players[0];
  const maxPts = players[0]?.pts_per_game ?? 1;
  const maxReb = Math.max(...players.map(p => p.reb_per_game)) || 1;
  const maxAst = Math.max(...players.map(p => p.ast_per_game)) || 1;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            Top 10 Scorers
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
            Points per game — {season} Season
          </p>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--text-muted)', border: '1px solid var(--border-bright)',
          borderRadius: 6, padding: '4px 10px',
        }}>
          Click any row to expand
        </span>
      </div>

      {/* ── Scoring leader banner ── */}
      {leader && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          background: 'var(--bg-card-2)',
          border: '1px solid var(--border-light)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 14, padding: '0 20px 0 0',
          marginBottom: 28, overflow: 'hidden',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.02) inset',
        }}>
          {/* Headshot */}
          <div style={{
            width: 80, height: 80, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-card-2) 100%)',
            display: 'flex', alignItems: 'flex-end', overflow: 'hidden',
          }}>
            <img
              src={getPlayerHeadshotUrl(leader.player_id)}
              alt={leader.player_name}
              style={{ width: '100%', height: 'auto', objectFit: 'cover', objectPosition: 'top', marginBottom: -4 }}
              onError={e => { e.target.style.display = 'none'; }}
            />
          </div>
          <div>
            <p style={{
              fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0,
            }}>Scoring Leader</p>
            <p style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', margin: '2px 0 0' }}>
              {leader.player_name}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>{leader.team}</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
            {STAT_CONFIG.map(({ key, label, color, bg, border }) => (
              <div key={key} style={{
                textAlign: 'center',
                background: bg, border: `1px solid ${border}`,
                borderRadius: 10, padding: '8px 14px', minWidth: 60,
              }}>
                <p style={{ fontSize: 24, fontWeight: 900, color, margin: 0, lineHeight: 1, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
                  {leader[key === 'pts' ? 'pts_per_game' : key === 'reb' ? 'reb_per_game' : 'ast_per_game']?.toFixed(1)}
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '4px 0 0', fontWeight: 700, letterSpacing: '0.08em' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bar chart ── */}
      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={chartData} margin={{ top: 22, right: 8, left: -18, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false} tickLine={false}
            domain={[0, 'dataMax + 5']}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <defs>
            <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#EEF2F9" />
              <stop offset="100%" stopColor="#8FA5BE" />
            </linearGradient>
            <linearGradient id="midGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#8FA5BE" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3E5370" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <Bar dataKey="pts" radius={[6, 6, 0, 0]} maxBarSize={46}>
            <LabelList
              dataKey="pts"
              position="top"
              formatter={v => v?.toFixed(1)}
              style={{ fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 700 }}
            />
            {chartData.map((_, i) => (
              <Cell
                key={i}
                fill={i === 0 ? 'url(#topGrad)' : i < 3 ? 'url(#midGrad)' : '#1A2236'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* ── Rankings list — powered by DisplayCards ── */}
      <div style={{ marginTop: 28 }}>
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12,
        }}>
          Rankings · Click any row to expand stats
        </p>
        <DisplayCards
          players={players}
          variant="stack"
          showRank={true}
          showTeam={true}
          stats={['pts', 'reb', 'ast']}
          maxStats={{ pts: maxPts, reb: maxReb, ast: maxAst }}
        />
      </div>
    </div>
  );
}

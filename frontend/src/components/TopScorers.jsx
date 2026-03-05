import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { fetchTopScorers } from '../api';
import DisplayCards from './DisplayCards';

const STAT_CONFIG = [
  { key: 'pts', label: 'PTS', color: 'var(--cyan)',   bg: 'rgba(0,212,255,0.1)',   border: 'rgba(0,212,255,0.25)'   },
  { key: 'reb', label: 'REB', color: 'var(--green)',  bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)'  },
  { key: 'ast', label: 'AST', color: 'var(--orange)', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)'  },
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#0F1829', border: '1px solid var(--border-bright)',
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
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Top 10 Scorers
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
          Points per game — {season} Season · Click any card to expand
        </p>
      </div>

      {/* ── Scoring leader banner ── */}
      {leader && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          background: 'linear-gradient(135deg, rgba(0,212,255,0.07) 0%, rgba(124,58,237,0.07) 100%)',
          border: '1px solid rgba(0,212,255,0.22)',
          borderRadius: 14, padding: '16px 20px', marginBottom: 28,
          boxShadow: '0 0 30px rgba(0,212,255,0.05)',
        }}>
          <span style={{ fontSize: 30 }}>👑</span>
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
                <p style={{ fontSize: 24, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>
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
            tick={{ fill: '#A8C4DF', fontSize: 12, fontWeight: 500 }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tick={{ fill: '#7A9AB8', fontSize: 11 }}
            axisLine={false} tickLine={false}
            domain={[0, 'dataMax + 5']}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <defs>
            <linearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#00D4FF" />
              <stop offset="100%" stopColor="#5B21B6" />
            </linearGradient>
            <linearGradient id="midGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#00D4FF" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#1e3a5f" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <Bar dataKey="pts" radius={[6, 6, 0, 0]} maxBarSize={46}>
            <LabelList
              dataKey="pts"
              position="top"
              formatter={v => v?.toFixed(1)}
              style={{ fill: '#B0CDE8', fontSize: 10, fontWeight: 700 }}
            />
            {chartData.map((_, i) => (
              <Cell
                key={i}
                fill={i === 0 ? 'url(#topGrad)' : i < 3 ? 'url(#midGrad)' : '#1C2A40'}
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

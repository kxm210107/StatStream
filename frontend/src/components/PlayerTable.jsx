import { useState, useEffect } from 'react';
import { fetchAllPlayers } from '../api';

const TH = ({ children, align = 'left' }) => (
  <th style={{
    padding: '10px 16px',
    textAlign: align,
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  }}>
    {children}
  </th>
);

const TD = ({ children, align = 'left', style = {} }) => (
  <td style={{
    padding: '11px 16px',
    textAlign: align,
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
    ...style,
  }}>
    {children}
  </td>
);

export default function PlayerTable({ season = '2024-25' }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState(null);
  const [search,  setSearch ] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAllPlayers(season)
      .then(data => setPlayers(data))
      .catch(err  => setError(err.message))
      .finally(()  => setLoading(false));
  }, [season]);

  const filtered = players.filter(p =>
    p.player_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="spinner" />;

  if (error) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--red)' }}>
      ⚠️ {error}
    </div>
  );

  return (
    <div>
      {/* ── Search bar + count ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none', fontSize: 14,
          }}>🔍</span>
          <input
            className="ss-input"
            placeholder="Search player..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <span style={{
          color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap',
        }}>
          {filtered.length} player{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {[['PTS','cyan'],['REB','green'],['AST','orange']].map(([label, color]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${color})`, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-card)' }}>
            <tr>
              <TH>#</TH>
              <TH>Player</TH>
              <TH>Team</TH>
              <TH align="right">PTS</TH>
              <TH align="right">REB</TH>
              <TH align="right">AST</TH>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No players found
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => (
                <tr
                  key={p.player_id}
                  style={{ transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <TD style={{ color: 'var(--text-muted)', width: 40 }}>{i + 1}</TD>
                  <TD>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.player_name}
                    </span>
                  </TD>
                  <TD>
                    <span style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '2px 8px', fontSize: 12,
                      fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-secondary)',
                    }}>
                      {p.team}
                    </span>
                  </TD>
                  <TD align="right" style={{ fontWeight: 700, color: 'var(--cyan)' }}>
                    {p.pts_per_game?.toFixed(1)}
                  </TD>
                  <TD align="right" style={{ fontWeight: 700, color: 'var(--green)' }}>
                    {p.reb_per_game?.toFixed(1)}
                  </TD>
                  <TD align="right" style={{ fontWeight: 700, color: 'var(--orange)' }}>
                    {p.ast_per_game?.toFixed(1)}
                  </TD>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { fetchAllPlayers } from '../api';
import { getTeamLogoUrl } from '../utils/teamLogos';

const ROSTER_LIMIT = 50;

// Sortable columns config: key → display label + alignment
const COLUMNS = [
  { key: '#',            label: '#',      align: 'left'  },
  { key: 'player_name', label: 'Player',  align: 'left'  },
  { key: 'position',    label: 'Pos',     align: 'left'  },
  { key: 'team',        label: 'Team',    align: 'left'  },
  { key: 'pts_per_game',label: 'PTS',     align: 'right' },
  { key: 'reb_per_game',label: 'REB',     align: 'right' },
  { key: 'ast_per_game',label: 'AST',     align: 'right' },
];

const STAT_COLORS = {
  pts_per_game: 'var(--text-primary)',
  reb_per_game: 'var(--text-primary)',
  ast_per_game: 'var(--text-primary)',
};

const LEGEND = [
  ['PTS', 'var(--text-primary)'],
  ['REB', 'var(--text-primary)'],
  ['AST', 'var(--text-primary)'],
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SortArrow({ direction }) {
  return (
    <span style={{
      marginLeft: 4,
      color: 'var(--text-primary)',
      fontSize: 10,
      verticalAlign: 'middle',
      lineHeight: 1,
    }}>
      {direction === 'asc' ? '▲' : '▼'}
    </span>
  );
}

function TH({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key;
  const [hovered, setHovered] = useState(false);

  return (
    <th
      onClick={() => col.key !== '#' && onSort(col.key)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '11px 16px',
        textAlign: col.align,
        color: active || hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        fontWeight: 800,
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        whiteSpace: 'nowrap',
        cursor: col.key !== '#' ? 'pointer' : 'default',
        userSelect: 'none',
        transition: 'color 0.15s ease',
      }}
    >
      {col.label}
      {active && <SortArrow direction={sortDir} />}
    </th>
  );
}

const TD = ({ children, align = 'left', style = {} }) => (
  <td style={{
    padding: '11px 16px',
    textAlign: align,
    borderBottom: '1px solid rgba(255,255,255,0.035)',
    fontSize: 13,
    ...style,
  }}>
    {children}
  </td>
);

function TeamCell({ abbr }) {
  const url = getTeamLogoUrl(abbr);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      {url && (
        <img
          src={url}
          alt={abbr}
          width={24}
          height={24}
          style={{ objectFit: 'contain', flexShrink: 0 }}
          onError={e => { e.target.style.display = 'none'; }}
        />
      )}
      <span style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.08em',
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 4,
        padding: '2px 6px',
        color: 'var(--text-secondary)',
      }}>
        {abbr}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlayerTable({ season = '2024-25', onPlayerClick = null, hideSearch = false }) {
  const [players,  setPlayers ] = useState([]);
  const [loading,  setLoading ] = useState(true);
  const [error,    setError   ] = useState(null);
  const [search,   setSearch  ] = useState('');
  const [sortKey,  setSortKey ] = useState('pts_per_game');
  const [sortDir,  setSortDir ] = useState('desc');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAllPlayers(season)
      .then(data => {
        // Top 50 scorers in the league for the roster view
        const top50 = [...data]
          .sort((a, b) => (b.pts_per_game ?? 0) - (a.pts_per_game ?? 0))
          .slice(0, ROSTER_LIMIT);
        setPlayers(top50);
      })
      .catch(err => setError(err.message))
      .finally(()  => setLoading(false));
  }, [season]);

  // Sort handler — toggles direction if same key, resets to desc on new key
  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = players
    .filter(p => p.player_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === '#' || sortKey === 'player_name' || sortKey === 'position' || sortKey === 'team') {
        const aVal = sortKey === '#' ? 0 : (a[sortKey] ?? '');
        const bVal = sortKey === '#' ? 0 : (b[sortKey] ?? '');
        return sortDir === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }
      const aNum = a[sortKey] ?? 0;
      const bNum = b[sortKey] ?? 0;
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    });

  if (loading) return <div className="spinner" />;

  if (error) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--red)' }}>
      {error}
    </div>
  );

  return (
    <div>
      {/* ── Search bar + count ── */}
      {!hideSearch && <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none', fontSize: 14,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input
            className="ss-input"
            placeholder="Search top 50 players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {filtered.length} / {ROSTER_LIMIT} players
        </span>
      </div>}

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {LEGEND.map(([label, color]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>

      {/* ── Table ── */}
      <div style={{
        overflowX: 'auto',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(30,44,66,0.8)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'rgba(8,11,18,0.9)' }}>
            <tr>
              {COLUMNS.map(col => (
                <TH
                  key={col.key}
                  col={col}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{
                  textAlign: 'center', padding: 40,
                  color: 'var(--text-muted)', background: '#0A0D16',
                }}>
                  No players found
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => {
                const isEven = i % 2 === 0;
                return (
                  <tr
                    key={p.player_id}
                    onClick={() => onPlayerClick && onPlayerClick(p)}
                    style={{
                      background: isEven ? 'rgba(255,255,255,0.012)' : 'transparent',
                      transition: 'background 0.15s ease',
                      cursor: onPlayerClick ? 'pointer' : 'default',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = isEven ? 'rgba(255,255,255,0.012)' : 'transparent'}
                  >
                    {/* Rank */}
                    <TD style={{
                      color: i === 0 ? '#3B82F6' : 'var(--text-muted)',
                      width: 40,
                      fontWeight: i === 0 ? 800 : 400,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                    }}>
                      {i + 1}
                    </TD>

                    {/* Player name */}
                    <TD>
                      <span style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: 'var(--text-primary)',
                      }}>
                        {p.player_name}
                      </span>
                    </TD>

                    {/* Position */}
                    <TD>
                      {p.position ? (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          color: 'var(--text-muted)',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 4,
                          padding: '2px 6px',
                        }}>
                          {p.position}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </TD>

                    {/* Team */}
                    <TD>
                      <TeamCell abbr={p.team} />
                    </TD>

                    {/* PTS */}
                    <TD align="right" style={{
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {p.pts_per_game?.toFixed(1)}
                    </TD>

                    {/* REB */}
                    <TD align="right" style={{
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {p.reb_per_game?.toFixed(1)}
                    </TD>

                    {/* AST */}
                    <TD align="right" style={{
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {p.ast_per_game?.toFixed(1)}
                    </TD>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

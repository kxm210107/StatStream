// frontend/src/components/RosterPanel.jsx
import { getTeamColor } from '../utils/teamLogos';

const COLS = [
  { label: '#',   key: 'jersey',  align: 'left',  width: 28 },
  { label: 'Player', key: 'name', align: 'left',  flex: 1   },
  { label: 'Pos', key: 'position',align: 'center',width: 36 },
  { label: 'Min', key: 'min',     align: 'center',width: 48 },
  { label: 'Pts', key: 'pts',     align: 'center',width: 36 },
  { label: 'Reb', key: 'reb',     align: 'center',width: 36 },
  { label: 'Ast', key: 'ast',     align: 'center',width: 36 },
  { label: 'Stl', key: 'stl',     align: 'center',width: 36 },
  { label: 'Blk', key: 'blk',     align: 'center',width: 36 },
  { label: 'FG',  key: 'fg',      align: 'center',width: 64 },
  { label: '3P',  key: 'fg3',     align: 'center',width: 52 },
  { label: 'FT',  key: 'ft',      align: 'center',width: 52 },
  { label: 'TO',  key: 'to',      align: 'center',width: 36 },
];

function playerRow(p) {
  return {
    ...p,
    fg:  `${p.fgm}/${p.fga}`,
    fg3: `${p.fg3m}/${p.fg3a}`,
    ft:  `${p.ftm}/${p.fta}`,
  };
}

function TeamTable({ players, abbr }) {
  const color = getTeamColor(abbr);
  if (!players || players.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>
        No player data
      </div>
    );
  }
  const rows = players.map(playerRow);

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: color || 'var(--text-primary)',
        marginBottom: 8,
      }}>
        {abbr}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          fontSize: 12, fontFamily: 'var(--font-mono)',
        }}>
          <thead>
            <tr>
              {COLS.map(col => (
                <th key={col.key} style={{
                  padding: '6px 8px',
                  textAlign: col.align,
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--border-light)',
                  whiteSpace: 'nowrap',
                  width: col.width,
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={`${p.name}_${p.jersey}_${i}`} style={{
                borderBottom: '1px solid var(--border-light)',
                opacity: p.min === '--' || p.min === '00:00' ? 0.4 : 1,
              }}>
                {COLS.map(col => (
                  <td key={col.key} style={{
                    padding: '7px 8px',
                    textAlign: col.align,
                    color: col.key === 'name'
                      ? (p.starter ? 'var(--text-primary)' : 'var(--text-secondary)')
                      : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    fontWeight: col.key === 'name' && p.starter ? 500 : 400,
                  }}>
                    {p[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RosterPanel({ homePlayers, awayPlayers, homeAbbr, awayAbbr }) {
  if (!homePlayers && !awayPlayers) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
        Roster stats unavailable
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <TeamTable players={awayPlayers} abbr={awayAbbr} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <TeamTable players={homePlayers} abbr={homeAbbr} />
      </div>
    </div>
  );
}

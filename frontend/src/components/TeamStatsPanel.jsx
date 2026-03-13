// frontend/src/components/TeamStatsPanel.jsx
import { getTeamColor } from '../utils/teamLogos';

function fmt(made, att, pct) {
  return `${made}/${att} (${pct}%)`;
}

const ROWS = [
  { label: 'FG',  key: 'shooting_fg'  },
  { label: '3PT', key: 'shooting_3pt' },
  { label: 'FT',  key: 'shooting_ft'  },
  { label: 'REB', key: 'reb'  },
  { label: 'AST', key: 'ast'  },
  { label: 'STL', key: 'stl'  },
  { label: 'BLK', key: 'blk'  },
  { label: 'TO',  key: 'to'   },
  { label: 'PTS', key: 'pts'  },
];

function buildRows(s) {
  return {
    shooting_fg:  fmt(s.fgm, s.fga, s.fg_pct),
    shooting_3pt: fmt(s.fg3m, s.fg3a, s.fg3_pct),
    shooting_ft:  fmt(s.ftm, s.fta, s.ft_pct),
    reb: s.reb,
    ast: s.ast,
    stl: s.stl,
    blk: s.blk,
    to:  s.to,
    pts: s.pts,
  };
}

export default function TeamStatsPanel({ homeStats, awayStats, homeAbbr, awayAbbr }) {
  if (!homeStats || !awayStats) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
        Stats unavailable
      </div>
    );
  }

  const homeRows = buildRows(homeStats);
  const awayRows = buildRows(awayStats);
  const homeColor = getTeamColor(homeAbbr);
  const awayColor = getTeamColor(awayAbbr);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        fontSize: 13, fontFamily: 'var(--font-mono)',
      }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, color: awayColor || 'var(--text-primary)', textAlign: 'left' }}>
              {awayAbbr}
            </th>
            <th style={{ ...thStyle, color: 'var(--text-muted)', textAlign: 'center', width: 60 }}>
              —
            </th>
            <th style={{ ...thStyle, color: homeColor || 'var(--text-primary)', textAlign: 'right' }}>
              {homeAbbr}
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ label, key }) => (
            <tr key={key} style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--text-primary)' }}>
                {awayRows[key]}
              </td>
              <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)',
                fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {label}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-primary)' }}>
                {homeRows[key]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  padding: '8px 12px',
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border-light)',
};

const tdStyle = {
  padding: '9px 12px',
};

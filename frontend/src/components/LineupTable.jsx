
const COLUMNS = [
  { key: 'players',        label: 'Lineup',     sortable: false, width: '35%' },
  { key: 'minutes',        label: 'MIN',         sortable: true,  width: '9%',  fmt: v => v.toFixed(1) },
  { key: 'points_for',     label: 'PTS+',        sortable: true,  width: '8%' },
  { key: 'points_against', label: 'PTS-',        sortable: true,  width: '8%' },
  { key: 'plus_minus',     label: '+/-',         sortable: true,  width: '8%',  signed: true },
  { key: 'off_rating',     label: 'OffRtg',      sortable: true,  width: '10%', fmt: v => v.toFixed(1) },
  { key: 'def_rating',     label: 'DefRtg',      sortable: true,  width: '10%', fmt: v => v.toFixed(1) },
  { key: 'net_rating',     label: 'NetRtg',      sortable: true,  width: '10%', fmt: v => v.toFixed(1), highlight: true },
];

function fmt(col, value) {
  if (col.fmt) return col.fmt(value);
  return value;
}

function colorForRating(value) {
  if (value > 5)  return '#4ADE80';
  if (value > 0)  return '#A3E635';
  if (value < -5) return '#F87171';
  if (value < 0)  return '#FCA5A5';
  return 'var(--text-secondary)';
}

export default function LineupTable({ lineups, sortBy, sortDir = 'desc', onSort }) {
  if (!lineups || lineups.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
        No lineups found for this filter.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  padding: '12px 14px',
                  textAlign: col.key === 'players' ? 'left' : 'right',
                  color: sortBy === col.key ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: col.sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => col.sortable && onSort(col.key)}
              >
                {col.label}{col.sortable && sortBy === col.key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(sortDir === 'asc' ? [...lineups].reverse() : lineups).map((lineup, i) => (
            <tr
              key={lineup.lineup_id}
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              }}
            >
              {COLUMNS.map(col => {
                const value = lineup[col.key];
                const isPlayers = col.key === 'players';
                const isNetRtg  = col.highlight;
                const isSigned  = col.signed;

                let displayColor = 'var(--text-secondary)';
                if (isNetRtg) displayColor = colorForRating(value);
                if (isSigned) displayColor = value > 0 ? '#4ADE80' : value < 0 ? '#F87171' : 'var(--text-secondary)';

                return (
                  <td
                    key={col.key}
                    style={{
                      padding: '14px 14px',
                      textAlign: isPlayers ? 'left' : 'right',
                      color: isPlayers ? 'var(--text-secondary)' : displayColor,
                      fontWeight: isNetRtg ? 700 : 400,
                      verticalAlign: 'middle',
                    }}
                  >
                    {isPlayers ? (
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
                        {value.map((name, j) => (
                          <span key={j} style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                            {name}{j < value.length - 1 ? ' ·' : ''}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <>
                        {isSigned && value > 0 ? '+' : ''}
                        {fmt(col, value)}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

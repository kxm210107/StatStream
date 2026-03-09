// frontend/src/components/LiveGameCard.jsx
import WinProbabilityBar from './WinProbabilityBar';

const PERIOD_LABEL = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH' };

export default function LiveGameCard({ game, selected, onClick }) {
  const { home_team: home, away_team: away, period, clock } = game;
  const periodLabel = PERIOD_LABEL[period] ?? `OT${period - 4}`;

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? 'var(--bg-card-2)' : 'var(--bg-card)',
        border: `1px solid ${selected ? 'var(--cyan)' : 'var(--border-light)'}`,
        borderRadius: 14,
        padding: '18px 22px',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
        boxShadow: selected ? '0 0 0 1px rgba(34,211,238,0.15) inset' : 'none',
      }}
    >
      {/* Period + clock header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 14,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.15em',
          color: '#4ADE80', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: '#4ADE80', boxShadow: '0 0 5px #4ADE80',
            animation: 'pulse 2s ease infinite',
          }} />
          Live
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
        }}>
          {periodLabel} · {clock}
        </span>
      </div>

      {/* Scoreboard */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        {/* Away team */}
        <div style={{ textAlign: 'left', minWidth: 80 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            {away.abbr}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1,
            color: away.score > home.score ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>
            {away.score}
          </div>
        </div>

        {/* VS divider */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>VS</div>

        {/* Home team */}
        <div style={{ textAlign: 'right', minWidth: 80 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            {home.abbr}
          </div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1,
            color: home.score > away.score ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}>
            {home.score}
          </div>
        </div>
      </div>

      {/* Win probability bar */}
      {home.win_probability != null && (
        <WinProbabilityBar
          homeProb={home.win_probability}
          awayProb={away.win_probability}
          homeAbbr={home.abbr}
          awayAbbr={away.abbr}
        />
      )}
    </div>
  );
}

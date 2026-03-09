// frontend/src/components/WinProbabilityBar.jsx
/**
 * Horizontal probability bar showing home vs away win probability.
 * Props:
 *   homeProb  – float 0–1
 *   awayProb  – float 0–1
 *   homeAbbr  – string e.g. "LAL"
 *   awayAbbr  – string e.g. "BOS"
 */
export default function WinProbabilityBar({ homeProb, awayProb, homeAbbr, awayAbbr }) {
  const homePct = Math.round(homeProb * 100);
  const awayPct = Math.round(awayProb * 100);

  return (
    <div style={{ width: '100%' }}>
      {/* Labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        color: 'var(--text-secondary)', marginBottom: 5,
        textTransform: 'uppercase',
      }}>
        <span style={{ color: homePct > 50 ? 'var(--cyan)' : 'var(--text-secondary)' }}>
          {homeAbbr} {homePct}%
        </span>
        <span style={{ color: awayPct > 50 ? 'var(--orange)' : 'var(--text-secondary)' }}>
          {awayPct}% {awayAbbr}
        </span>
      </div>

      {/* Bar */}
      <div style={{
        display: 'flex', height: 8, borderRadius: 4,
        overflow: 'hidden', background: 'var(--bg-hover)',
        border: '1px solid var(--border)',
      }}>
        <div style={{
          width: `${homePct}%`,
          background: homePct > awayPct
            ? 'linear-gradient(90deg, var(--cyan) 0%, rgba(34,211,238,0.6) 100%)'
            : 'rgba(34,211,238,0.25)',
          transition: 'width 0.6s ease',
          borderRadius: '4px 0 0 4px',
        }} />
        <div style={{
          width: `${awayPct}%`,
          background: awayPct > homePct
            ? 'linear-gradient(90deg, rgba(249,115,22,0.6) 0%, var(--orange) 100%)'
            : 'rgba(249,115,22,0.25)',
          transition: 'width 0.6s ease',
          borderRadius: '0 4px 4px 0',
        }} />
      </div>
    </div>
  );
}

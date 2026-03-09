// frontend/src/components/WinProbabilityBar.jsx
import { getTeamColor } from '../utils/teamLogos';

/**
 * Horizontal probability bar aligned to match the card layout:
 * away team on the LEFT, home team on the RIGHT.
 *
 * Props:
 *   homeProb  – float 0–1
 *   awayProb  – float 0–1
 *   homeAbbr  – string e.g. "LAL"
 *   awayAbbr  – string e.g. "BOS"
 */
export default function WinProbabilityBar({ homeProb, awayProb, homeAbbr, awayAbbr }) {
  const homePct = Math.round(homeProb * 100);
  const awayPct = Math.round(awayProb * 100);

  const awayColor = getTeamColor(awayAbbr);
  const homeColor = getTeamColor(homeAbbr);

  const awayLeading = awayPct >= homePct;

  return (
    <div style={{ width: '100%' }}>
      {/* Labels: away on left, home on right */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', marginBottom: 5,
      }}>
        <span style={{ color: awayLeading ? awayColor : 'var(--text-secondary)' }}>
          {awayAbbr} {awayPct}%
        </span>
        <span style={{ color: !awayLeading ? homeColor : 'var(--text-secondary)' }}>
          {homePct}% {homeAbbr}
        </span>
      </div>

      {/* Bar: away segment on left, home segment on right */}
      <div style={{
        display: 'flex', height: 8, borderRadius: 4,
        overflow: 'hidden', background: 'var(--bg-hover)',
        border: '1px solid var(--border)',
      }}>
        <div style={{
          width: `${awayPct}%`,
          background: awayLeading
            ? `linear-gradient(90deg, ${awayColor} 0%, ${awayColor}99 100%)`
            : `${awayColor}40`,
          transition: 'width 0.6s ease',
          borderRadius: '4px 0 0 4px',
        }} />
        <div style={{
          width: `${homePct}%`,
          background: !awayLeading
            ? `linear-gradient(90deg, ${homeColor}99 0%, ${homeColor} 100%)`
            : `${homeColor}40`,
          transition: 'width 0.6s ease',
          borderRadius: '0 4px 4px 0',
        }} />
      </div>
    </div>
  );
}

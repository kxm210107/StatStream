import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { getTeamLogoUrl } from '../utils/teamLogos';


export default function WinProbabilityChart({ prob_history, homeAbbr, awayAbbr, homeColor, awayColor }) {
  if (!prob_history || prob_history.length < 2) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>
        Tracking win probability…
      </div>
    );
  }

  const raw = prob_history.map(p => ({ x: p.elapsed_sec, y: p.home_prob * 100 }));

  // 7-point centered moving average to smooth out rapid score oscillations
  const WINDOW = 7;
  const data = raw.map((d, i) => {
    const lo = Math.max(0, i - Math.floor(WINDOW / 2));
    const hi = Math.min(raw.length, lo + WINDOW);
    const slice = raw.slice(lo, hi);
    const avg = slice.reduce((s, p) => s + p.y, 0) / slice.length;
    return { x: d.x, y: Math.round(avg) };
  });

  const latest = raw[raw.length - 1];
  const homePct = Math.round(latest.y);
  const awayPct = 100 - homePct;

  const QUARTER_LABELS = { 720: "Q1", 1440: "Q2", 2160: "Q3", 2880: "Q4" };
  const formatXTick = (val) => QUARTER_LABELS[val] ?? "";
  const xStart = data[0]?.x ?? 0;
  const visibleTicks = [720, 1440, 2160, 2880].filter(t => t > xStart);

  // Y-axis = home win probability: top (100%) = home winning, bottom (0%) = away winning.
  // Home label is fixed at top-left, away label at bottom-left.
  // This guarantees the winning team's label always sits near the line:
  //   home winning → line near top → home label at top ✓
  //   away winning → line near bottom → away label at bottom ✓

  return (
    <div style={{ position: 'relative', marginTop: 8 }}>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[xStart, 2880]}
            ticks={visibleTicks}
            tickFormatter={formatXTick}
            tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={false}
            axisLine={true}
            tickLine={false}
            width={4}
          />
          <ReferenceLine y={50} strokeDasharray="4 4" stroke="rgba(255,255,255,0.2)" />
          <Tooltip
            formatter={(value) => [`${value}%`, homeAbbr]}
            labelFormatter={() => ''}
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
            itemStyle={{ color: homeColor }}
          />
          <Line
            dataKey="y"
            type="monotone"
            dot={false}
            strokeWidth={2}
            stroke={homeColor}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Top-left: home team (top of chart = home winning zone) */}
      <div style={{
        position: 'absolute', top: 6, left: 6,
        display: 'flex', alignItems: 'center', gap: 7,
        pointerEvents: 'none',
      }}>
        {getTeamLogoUrl(homeAbbr) && (
          <img src={getTeamLogoUrl(homeAbbr)} width={24} height={24}
            style={{ objectFit: 'contain', flexShrink: 0 }} />
        )}
        <div>
          <div style={{ color: homeColor, fontSize: 16, fontWeight: 800, letterSpacing: '0.1em', lineHeight: 1 }}>
            {homeAbbr}
          </div>
          <div style={{ color: homeColor, fontSize: 13, fontWeight: 700, opacity: 0.9, lineHeight: 1.3 }}>
            {homePct}%
          </div>
        </div>
      </div>

      {/* Bottom-left: away team (bottom of chart = away winning zone) */}
      <div style={{
        position: 'absolute', bottom: 22, left: 6,
        display: 'flex', alignItems: 'center', gap: 7,
        pointerEvents: 'none',
      }}>
        {getTeamLogoUrl(awayAbbr) && (
          <img src={getTeamLogoUrl(awayAbbr)} width={24} height={24}
            style={{ objectFit: 'contain', flexShrink: 0 }} />
        )}
        <div>
          <div style={{ color: awayColor, fontSize: 16, fontWeight: 800, letterSpacing: '0.1em', lineHeight: 1 }}>
            {awayAbbr}
          </div>
          <div style={{ color: awayColor, fontSize: 13, fontWeight: 700, opacity: 0.9, lineHeight: 1.3 }}>
            {awayPct}%
          </div>
        </div>
      </div>
    </div>
  );
}

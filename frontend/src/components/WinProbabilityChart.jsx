import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

export default function WinProbabilityChart({ prob_history, homeAbbr, awayAbbr, homeColor, awayColor }) {
  if (!prob_history || prob_history.length < 2) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>
        Tracking win probability…
      </div>
    );
  }

  const data = prob_history.map(p => ({ x: p.elapsed_sec, y: Math.round(p.home_prob * 100) }));

  const QUARTER_LABELS = { 720: "Q1", 1440: "Q2", 2160: "Q3", 2880: "Q4" };
  const formatXTick = (val) => QUARTER_LABELS[val] ?? "";

  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, 2880]}
            ticks={[720, 1440, 2160, 2880]}
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
      <div style={{ position: 'absolute', bottom: 8, left: 8, color: awayColor, fontSize: 10, fontWeight: 700, pointerEvents: 'none' }}>
        {awayAbbr}
      </div>
      <div style={{ position: 'absolute', top: 8, right: 8, color: homeColor, fontSize: 10, fontWeight: 700, pointerEvents: 'none' }}>
        {homeAbbr}
      </div>
    </div>
  );
}

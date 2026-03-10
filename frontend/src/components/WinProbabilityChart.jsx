import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

export default function WinProbabilityChart({ history, homeAbbr, awayAbbr, homeColor, awayColor }) {
  if (!history || history.length < 2) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '12px 0' }}>
        Tracking win probability…
      </div>
    );
  }

  const data = history.map(p => ({ time: p.time, homeProb: Math.round(p.homeProb * 100) }));

  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="time" hide={true} />
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
            dataKey="homeProb"
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

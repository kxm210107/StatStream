import { useState, useEffect } from 'react';
import { fetchTeams, fetchTeamComparison } from '../api';

// ── small helpers ─────────────────────────────────────────────────────────────

const selectStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-light)',
  color: 'var(--text-primary)',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
  colorScheme: 'dark',
};

const StatRow = ({ label, val1, val2, highlight }) => {
  const better = val1 > val2 ? 'left' : val2 > val1 ? 'right' : null;
  return (
    <div style={{ display: 'contents' }}>
      <div style={{
        padding: '10px 20px',
        fontWeight: better === 'left' ? 800 : 600,
        fontSize: 15,
        color: better === 'left' ? highlight : 'var(--text-primary)',
        textAlign: 'right',
        borderBottom: '1px solid var(--border)',
      }}>
        {val1?.toFixed(1)}
      </div>
      <div style={{
        padding: '10px 16px',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        textAlign: 'center',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {label}
      </div>
      <div style={{
        padding: '10px 20px',
        fontWeight: better === 'right' ? 800 : 600,
        fontSize: 15,
        color: better === 'right' ? '#7C3AED' : 'var(--text-primary)',
        textAlign: 'left',
        borderBottom: '1px solid var(--border)',
      }}>
        {val2?.toFixed(1)}
      </div>
    </div>
  );
};

// ── main component ────────────────────────────────────────────────────────────

export default function TeamComparer({ season = '2024-25' }) {
  const [teams,   setTeams  ] = useState([]);
  const [team1,   setTeam1  ] = useState('');
  const [team2,   setTeam2  ] = useState('');
  const [home,    setHome   ] = useState('team1');   // 'team1' | 'team2'
  const [result,  setResult ] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  useEffect(() => {
    setResult(null);
    setError(null);
    fetchTeams(season).then(data => {
      setTeams(data);
      if (data.length >= 2) {
        setTeam1(data[0]);
        setTeam2(data[1]);
      } else {
        setTeam1('');
        setTeam2('');
      }
    });
  }, [season]);

  async function handleCompare() {
    if (team1 === team2) {
      setError('Please select two different teams.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const homeAbbr = home === 'team1' ? team1 : team2;
      const data = await fetchTeamComparison(team1, team2, homeAbbr, season);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const winner = result
    ? result.team1.win_probability > result.team2.win_probability ? 'team1' : 'team2'
    : null;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Team Comparer
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
          Select two teams and home court to calculate win probability
        </p>
      </div>

      {/* ── Controls ── */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 14, padding: '20px 24px',
        marginBottom: 28,
      }}>
        {/* Team selectors */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'end', marginBottom: 20 }}>
          {/* Team 1 */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--cyan)', marginBottom: 6 }}>
              Team 1
            </label>
            <div style={{ position: 'relative' }}>
              <select value={team1} onChange={e => setTeam1(e.target.value)} style={selectStyle}>
                {teams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 10 }}>▼</span>
            </div>
          </div>

          {/* VS divider */}
          <div style={{ textAlign: 'center', paddingBottom: 2 }}>
            <span style={{
              fontSize: 13, fontWeight: 800, letterSpacing: '0.1em',
              color: 'var(--text-muted)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 14px',
            }}>VS</span>
          </div>

          {/* Team 2 */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#7C3AED', marginBottom: 6 }}>
              Team 2
            </label>
            <div style={{ position: 'relative' }}>
              <select value={team2} onChange={e => setTeam2(e.target.value)} style={selectStyle}>
                {teams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 10 }}>▼</span>
            </div>
          </div>
        </div>

        {/* Home court + compare button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
              🏠 Home Court:
            </span>
            {[
              { val: 'team1', label: team1 || 'Team 1', color: 'var(--cyan)'   },
              { val: 'team2', label: team2 || 'Team 2', color: '#7C3AED' },
            ].map(({ val, label, color }) => (
              <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <div
                  onClick={() => setHome(val)}
                  style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: `2px solid ${home === val ? color : 'var(--border-bright)'}`,
                    background: home === val ? color : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', flexShrink: 0, cursor: 'pointer',
                  }}
                >
                  {home === val && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#000' }} />}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: home === val ? color : 'var(--text-secondary)' }}>
                  {label}
                </span>
              </label>
            ))}
          </div>

          <button
            className="ss-btn"
            onClick={handleCompare}
            disabled={loading || teams.length < 2}
            style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer', minWidth: 120 }}
          >
            {loading ? 'Comparing…' : 'Compare ⚡'}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13, marginBottom: 20,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && <div className="spinner" />}

      {/* ── Results ── */}
      {result && !loading && (
        <div className="fade-in">
          {/* Win probability bar */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--cyan)' }}>
                {result.team1.team}
                {result.home_team === result.team1.team && (
                  <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.8 }}>🏠</span>
                )}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Win Probability
              </span>
              <span style={{ fontWeight: 800, fontSize: 15, color: '#7C3AED' }}>
                {result.home_team === result.team2.team && (
                  <span style={{ fontSize: 11, marginRight: 6, opacity: 0.8 }}>🏠</span>
                )}
                {result.team2.team}
              </span>
            </div>

            {/* Split bar */}
            <div style={{ height: 14, borderRadius: 8, overflow: 'hidden', display: 'flex', background: 'var(--border)' }}>
              <div style={{
                width: `${result.team1.win_probability}%`,
                background: 'linear-gradient(90deg, #00D4FF, #0099BB)',
                transition: 'width 0.6s ease',
                borderRadius: '8px 0 0 8px',
              }} />
              <div style={{
                width: `${result.team2.win_probability}%`,
                background: 'linear-gradient(90deg, #6D28D9, #7C3AED)',
                transition: 'width 0.6s ease',
                borderRadius: '0 8px 8px 0',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--cyan)' }}>
                {result.team1.win_probability}%
              </span>

              {/* Model type badge */}
              {result.model_type === 'ml' ? (
                <span style={{
                  background: 'rgba(0,212,255,0.10)', color: 'var(--cyan)',
                  border: '1px solid rgba(0,212,255,0.25)',
                  borderRadius: 20, padding: '3px 10px',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                }}>
                  🤖 ML Model
                </span>
              ) : (
                <span style={{
                  background: 'rgba(245,158,11,0.10)', color: 'var(--orange)',
                  border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: 20, padding: '3px 10px',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                }}>
                  ⚖️ Weighted Formula
                </span>
              )}

              <span style={{ fontSize: 22, fontWeight: 900, color: '#7C3AED' }}>
                {result.team2.win_probability}%
              </span>
            </div>
          </div>

          {/* Side-by-side stat table */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 90px 1fr',
            borderRadius: 14, overflow: 'hidden',
            border: '1px solid var(--border-light)',
          }}>
            {/* Column headers */}
            <div style={{
              padding: '14px 20px',
              background: winner === 'team1'
                ? 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.04))'
                : 'var(--bg-card)',
              border: `2px solid ${winner === 'team1' ? 'rgba(0,212,255,0.4)' : 'transparent'}`,
              borderRight: 'none', borderRadius: '14px 0 0 0',
              textAlign: 'right',
            }}>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 20, color: 'var(--cyan)' }}>
                {result.team1.team}
                {winner === 'team1' && <span style={{ marginLeft: 8, fontSize: 16 }}>🏆</span>}
              </p>
              {result.home_team === result.team1.team &&
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Home</p>}
            </div>
            <div style={{
              background: 'var(--bg-secondary)', padding: '14px 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              color: 'var(--text-muted)', textTransform: 'uppercase',
            }}>
              Stat
            </div>
            <div style={{
              padding: '14px 20px',
              background: winner === 'team2'
                ? 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(124,58,237,0.04))'
                : 'var(--bg-card)',
              border: `2px solid ${winner === 'team2' ? 'rgba(124,58,237,0.4)' : 'transparent'}`,
              borderLeft: 'none', borderRadius: '0 14px 0 0',
            }}>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 20, color: '#7C3AED' }}>
                {winner === 'team2' && <span style={{ marginRight: 8, fontSize: 16 }}>🏆</span>}
                {result.team2.team}
              </p>
              {result.home_team === result.team2.team &&
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Home</p>}
            </div>

            {/* Stat rows */}
            <StatRow label="PPG"     val1={result.team1.avg_pts}      val2={result.team2.avg_pts}      highlight="var(--cyan)" />
            <StatRow label="RPG"     val1={result.team1.avg_reb}      val2={result.team2.avg_reb}      highlight="var(--cyan)" />
            <StatRow label="APG"     val1={result.team1.avg_ast}      val2={result.team2.avg_ast}      highlight="var(--cyan)" />
            <StatRow label="Score"   val1={result.team1.score}        val2={result.team2.score}        highlight="var(--cyan)" />

            {/* Player count row */}
            <div style={{ padding: '10px 20px', textAlign: 'right', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>
              {result.team1.player_count}
            </div>
            <div style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Players
            </div>
            <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>
              {result.team2.player_count}
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!result && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Pick two teams and click Compare
          </p>
          <p style={{ fontSize: 13 }}>Win probability uses an ML model (or weighted formula before training)</p>
        </div>
      )}
    </div>
  );
}

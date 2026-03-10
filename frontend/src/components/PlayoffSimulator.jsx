import { useState } from 'react';
import { RefreshCw, Wifi, Database, Info } from 'lucide-react';
import { fetchPlayoffSimulation } from '../api';
import { getTeamLogoUrl } from '../utils/teamLogos';

// ── Animated bar ──────────────────────────────────────────────────────────────
function ProbBar({ value, color, animate, height = 4 }) {
  return (
    <div style={{ height, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', width: '100%' }}>
      <div style={{
        height: '100%', borderRadius: 2, background: color,
        width: animate ? `${Math.min(value, 100)}%` : '0%',
        transition: 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }} />
    </div>
  );
}

// ── Data source badge ─────────────────────────────────────────────────────────
function DataBadge({ source, method, fetchedAt }) {
  const isLive = source === 'live_nba';
  const isPartial = source === 'live_standings';
  const label = isLive ? 'Live NBA Data' : isPartial ? 'Live Standings' : 'DB Estimates';
  const color = isLive ? '#4ade80' : isPartial ? '#f59e0b' : 'var(--text-muted)';
  const Icon = isLive || isPartial ? Wifi : Database;

  const methodLabel = method === 'net_rating' ? 'Net Rating model'
                    : method === 'win_pct'     ? 'Win % (Bradley-Terry)'
                    : 'Scoring strength';

  const ts = fetchedAt ? new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: `${color}18`, border: `1px solid ${color}40`,
        borderRadius: 20, padding: '3px 10px',
      }}>
        <Icon size={11} color={color} strokeWidth={2.5} />
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {methodLabel} · HCA + play-in
        {ts && ` · ${ts}`}
      </span>
    </div>
  );
}

// ── Play-in section ───────────────────────────────────────────────────────────
function PlayInSection({ teams, title }) {
  return (
    <div style={{
      background: 'var(--bg-card-2)', border: '1px solid var(--border-light)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <p style={{
        fontSize: 10, fontWeight: 800, color: 'var(--accent)',
        letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 12px',
      }}>
        {title} Play-In Tournament
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {teams.map(t => (
          <div key={t.team} style={{
            background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              {getTeamLogoUrl(t.team) && (
                <img src={getTeamLogoUrl(t.team)} alt={t.team} width={16} height={16}
                  style={{ objectFit: 'contain' }}
                  onError={e => { e.target.style.display = 'none'; }} />
              )}
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12 }}>
                {t.team}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                #{t.seed}
              </span>
            </div>
            {t.record !== '—' && (
              <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 6px' }}>
                {t.record}{t.net_rating !== undefined && ` · NR ${t.net_rating > 0 ? '+' : ''}${t.net_rating}`}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[
                { label: '7th seed', value: t.made_7th,   color: 'var(--stat-pts)' },
                { label: '8th seed', value: t.made_8th,   color: 'var(--stat-reb)' },
                { label: 'Elim.',    value: t.eliminated, color: 'var(--accent)'   },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 42, flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1 }}>
                    <ProbBar value={value} color={color} animate={true} height={3} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 30, textAlign: 'right' }}>
                    {value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Team row in bracket ───────────────────────────────────────────────────────
function TeamRow({ team, highlight, onHover, onLeave, animate }) {
  const champColor =
    team.champ_prob >= 20 ? 'var(--stat-pts)' :
    team.champ_prob >= 10 ? 'var(--stat-reb)' :
    team.champ_prob >= 5  ? 'var(--stat-ast)' :
    'var(--text-muted)';

  const isHL = highlight === team.team;

  return (
    <div
      onMouseEnter={() => onHover(team.team)}
      onMouseLeave={onLeave}
      style={{
        background: isHL ? 'var(--bg-hover)' : 'transparent',
        border: `1px solid ${isHL ? 'var(--border-bright)' : 'transparent'}`,
        borderRadius: 10, padding: '9px 10px', marginBottom: 5,
        transition: 'all 0.15s',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', width: 12, textAlign: 'center' }}>
          {team.seed}
        </span>
        {getTeamLogoUrl(team.team) ? (
          <img src={getTeamLogoUrl(team.team)} alt={team.team} width={20} height={20}
            style={{ objectFit: 'contain', flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12 }}>
            {team.team}
          </span>
          {team.record && team.record !== '—' && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>
              {team.record}
            </span>
          )}
          {team.net_rating !== undefined && team.net_rating !== 0 && (
            <span style={{
              fontSize: 9, marginLeft: 4, fontWeight: 700,
              color: team.net_rating >= 0 ? '#4ade80' : 'var(--accent)',
            }}>
              NR {team.net_rating >= 0 ? '+' : ''}{team.net_rating}
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, fontWeight: 900, color: champColor, minWidth: 38, textAlign: 'right' }}>
          {team.champ_prob.toFixed(1)}%
        </span>
      </div>

      {/* Round bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { label: 'R1',   value: team.r1_prob,   color: 'var(--stat-ast)' },
          { label: 'R2',   value: team.r2_prob,   color: 'var(--stat-reb)' },
          { label: 'Conf', value: team.conf_prob, color: 'var(--stat-pts)' },
          { label: '🏆',  value: team.champ_prob, color: 'var(--accent)'   },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', width: 26, flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1 }}><ProbBar value={value} color={color} animate={animate} /></div>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, textAlign: 'right' }}>
              {value.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Conference bracket column ─────────────────────────────────────────────────
function ConferenceColumn({ title, teams, playIn, highlight, onHover, onLeave, animate }) {
  const sorted = [...teams].sort((a, b) => b.champ_prob - a.champ_prob);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{
          margin: 0, fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{title}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 10, margin: '2px 0 0' }}>
          Seeds 1–8 · sorted by championship %
        </p>
      </div>

      {sorted.map(t => (
        <TeamRow
          key={t.team}
          team={t}
          highlight={highlight}
          onHover={onHover}
          onLeave={onLeave}
          animate={animate}
        />
      ))}

      {playIn && playIn.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <PlayInSection teams={playIn} title={title.split(' ')[0]} />
        </div>
      )}
    </div>
  );
}

// ── Championship podium ───────────────────────────────────────────────────────
function ChampPodium({ east, west }) {
  const all = [...east, ...west].sort((a, b) => b.champ_prob - a.champ_prob).slice(0, 5);
  const styles = [
    { bg: 'var(--accent-dim)',            border: 'rgba(255,255,255,0.3)',  text: 'var(--accent)'      },
    { bg: 'rgba(143,165,190,0.1)',        border: 'rgba(143,165,190,0.25)', text: 'var(--stat-reb)'    },
    { bg: 'rgba(90,122,149,0.1)',         border: 'rgba(90,122,149,0.25)',  text: 'var(--stat-ast)'    },
    { bg: 'var(--bg-hover)',              border: 'var(--border)',           text: 'var(--text-secondary)' },
    { bg: 'var(--bg-hover)',              border: 'var(--border)',           text: 'var(--text-secondary)' },
  ];
  return (
    <div style={{
      background: 'var(--bg-card-2)', border: '1px solid var(--border-light)',
      borderRadius: 14, padding: '18px 20px',
    }}>
      <p style={{
        fontSize: 10, fontWeight: 800, color: 'var(--accent)',
        letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 14px',
      }}>🏆 Championship Contenders</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {all.map((team, i) => {
          const c = styles[i] || styles[4];
          return (
            <div key={team.team} style={{
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 12, padding: '10px 14px',
              flex: i < 3 ? '1 1 110px' : '1 1 90px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {getTeamLogoUrl(team.team) && (
                  <img src={getTeamLogoUrl(team.team)} alt={team.team} width={22} height={22}
                    style={{ objectFit: 'contain' }}
                    onError={e => { e.target.style.display = 'none'; }} />
                )}
                <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 13 }}>{team.team}</span>
              </div>
              {team.record && team.record !== '—' && (
                <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '0 0 4px' }}>
                  {team.record}
                  {team.net_rating !== 0 && ` · NR ${team.net_rating >= 0 ? '+' : ''}${team.net_rating}`}
                </p>
              )}
              <p style={{ fontSize: 24, fontWeight: 900, color: c.text, margin: 0, lineHeight: 1 }}>
                {team.champ_prob.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 600 }}>%</span>
              </p>
              <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: '2px 0 0' }}>championship</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PlayoffSimulator({ season = '2024-25' }) {
  const [result,    setResult   ] = useState(null);
  const [loading,   setLoading  ] = useState(false);
  const [error,     setError    ] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [animate,   setAnimate  ] = useState(false);
  const [nSims,     setNSims    ] = useState(5000);

  async function runSim() {
    setLoading(true);
    setError(null);
    setAnimate(false);
    setResult(null);
    try {
      const data = await fetchPlayoffSimulation(season, nSims);
      setResult(data);
      setTimeout(() => setAnimate(true), 120);
    } catch {
      setError('Simulation failed — make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Playoff Probability Simulator
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
          Monte Carlo bracket simulation · real NBA standings + net-rating model · {season}
        </p>
      </div>

      {/* ── Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Simulations:</span>
          {[1000, 5000, 10000].map(n => (
            <button
              key={n}
              onClick={() => setNSims(n)}
              style={{
                background: nSims === n ? 'var(--text-primary)' : 'var(--bg-card-2)',
                color: nSims === n ? 'var(--bg-primary)' : 'var(--text-secondary)',
                border: '1px solid var(--border-bright)',
                borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {n.toLocaleString()}
            </button>
          ))}
        </div>

        <button
          className="ss-btn"
          onClick={runSim}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={13} strokeWidth={2.5}
            style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
          {loading ? 'Fetching live data…' : result ? 'Re-run' : 'Run Simulation'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {result && !loading && (
        <div className="fade-in">

          {/* Data source + methodology */}
          <div style={{ marginBottom: 16 }}>
            <DataBadge
              source={result.data_source}
              method={result.prob_method}
              fetchedAt={result.fetched_at}
            />
          </div>

          {/* Championship podium */}
          <div style={{ marginBottom: 20 }}>
            <ChampPodium east={result.east} west={result.west} />
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Rounds:</span>
            {[
              { label: 'R1', color: 'var(--stat-ast)' },
              { label: 'R2', color: 'var(--stat-reb)' },
              { label: 'Conf Finals', color: 'var(--stat-pts)' },
              { label: 'Champion', color: 'var(--accent)' },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 16, height: 3, borderRadius: 2, background: color }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Hover to highlight · NR = net rating per 100 poss.
            </span>
          </div>

          {/* East + West columns */}
          <div style={{ display: 'flex', gap: 18 }}>
            <ConferenceColumn
              title="Eastern Conference"
              teams={result.east}
              playIn={result.east_play_in}
              highlight={highlight}
              onHover={setHighlight}
              onLeave={() => setHighlight(null)}
              animate={animate}
            />
            <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', minHeight: 400, flexShrink: 0 }} />
            <ConferenceColumn
              title="Western Conference"
              teams={result.west}
              playIn={result.west_play_in}
              highlight={highlight}
              onHover={setHighlight}
              onLeave={() => setHighlight(null)}
              animate={animate}
            />
          </div>

          {/* Methodology footnote */}
          <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 18, lineHeight: 1.7 }}>
            Seeding from live NBA standings · Win probability: net rating (points/100 poss. differential) ·
            Series odds via game-by-game simulation with real home/away schedule ·
            Play-in: seeds 7–10 · Finals: neutral court
          </p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && !result && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🏆</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Run the simulation
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            Fetches live NBA standings + net ratings from nba.com<br />
            and runs a Monte Carlo playoff bracket simulation
          </p>
        </div>
      )}
    </div>
  );
}

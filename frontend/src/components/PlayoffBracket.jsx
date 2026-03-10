import { useState } from 'react';
import { RefreshCw, Wifi, Database } from 'lucide-react';
import { fetchPlayoffSimulation } from '../api';
import { getTeamLogoUrl, getTeamColor } from '../utils/teamLogos';

// ── Layout constants ───────────────────────────────────────────────────────────
const SLOT   = 44;   // team card height (px)
const GAP    = 16;   // gap between the 2 teams in a matchup
const MUP    = 20;   // gap between matchups
const COL_W  = 160;  // team card column width
const CON_W  = 36;   // SVG connector strip width between columns
const FINALS_W = 172; // finals center column

// ── Pre-computed Y positions for 8-team bracket ───────────────────────────────
// R1: 4 matchups × 2 teams each
// Matchup spacing = SLOT*2 + GAP + MUP
const MUP_H = SLOT * 2 + GAP + MUP;

const R1_Y = Array.from({ length: 8 }, (_, i) => {
  const m = Math.floor(i / 2);
  const p = i % 2;
  return m * MUP_H + p * (SLOT + GAP);
});
// Center Y of each team slot
const R1_CY = R1_Y.map(y => y + SLOT / 2);
// Mid-Y of each matchup (midpoint between the two teams' centers)
const R1_MID = [0, 1, 2, 3].map(m => (R1_CY[m * 2] + R1_CY[m * 2 + 1]) / 2);

// R2: 4 slots total (winners of R1 matchups)
const R2_Y  = R1_MID.map(mid => mid - SLOT / 2);
const R2_CY = R2_Y.map(y => y + SLOT / 2);
const R2_MID = [0, 1].map(m => (R2_CY[m * 2] + R2_CY[m * 2 + 1]) / 2);

// Conf Finals: 2 slots
const CF_Y  = R2_MID.map(mid => mid - SLOT / 2);
const CF_CY = CF_Y.map(y => y + SLOT / 2);

// Finals: 1 slot — center of the whole bracket
const FINALS_CY = (CF_CY[0] + CF_CY[1]) / 2;
const FINALS_Y  = FINALS_CY - SLOT / 2;

// Total bracket height
const TOTAL_H = R1_Y[7] + SLOT;

// R1 bracket slot order: [seed1, seed8, seed4, seed5, seed3, seed6, seed2, seed7]
// position i in R1 array → which seed goes there
const SEED_ORDER = [1, 8, 4, 5, 3, 6, 2, 7];

// ── Helpers ────────────────────────────────────────────────────────────────────

function pct(val) {
  if (val == null) return '—';
  return `${val.toFixed(0)}%`;
}

// ── SVG Connectors (East: lines go right; West: lines go left) ─────────────────
function R1Connectors({ side }) {
  const h = TOTAL_H;
  const flip = side === 'west';
  const x0 = flip ? CON_W : 0;
  const x1 = CON_W / 2;
  const x2 = flip ? 0 : CON_W;

  return (
    <svg width={CON_W} height={h} style={{ flexShrink: 0, overflow: 'visible' }}>
      {[0, 1, 2, 3].map(m => {
        const cy0 = R1_CY[m * 2];
        const cy1 = R1_CY[m * 2 + 1];
        const mid = R1_MID[m];
        return (
          <g key={m}>
            <path
              d={`M ${x0},${cy0} H ${x1} V ${mid} H ${x2}`}
              fill="none" stroke="var(--border-bright)" strokeWidth={1.5}
            />
            <path
              d={`M ${x0},${cy1} H ${x1} V ${mid}`}
              fill="none" stroke="var(--border-bright)" strokeWidth={1.5}
            />
          </g>
        );
      })}
    </svg>
  );
}

function R2Connectors({ side }) {
  const h = TOTAL_H;
  const flip = side === 'west';
  const x0 = flip ? CON_W : 0;
  const x1 = CON_W / 2;
  const x2 = flip ? 0 : CON_W;

  return (
    <svg width={CON_W} height={h} style={{ flexShrink: 0, overflow: 'visible' }}>
      {[0, 1].map(m => {
        const cy0 = R2_CY[m * 2];
        const cy1 = R2_CY[m * 2 + 1];
        const mid = R2_MID[m];
        return (
          <g key={m}>
            <path
              d={`M ${x0},${cy0} H ${x1} V ${mid} H ${x2}`}
              fill="none" stroke="var(--border-bright)" strokeWidth={1.5}
            />
            <path
              d={`M ${x0},${cy1} H ${x1} V ${mid}`}
              fill="none" stroke="var(--border-bright)" strokeWidth={1.5}
            />
          </g>
        );
      })}
    </svg>
  );
}

function CFConnectors({ side }) {
  const h = TOTAL_H;
  const flip = side === 'west';
  const x0 = flip ? CON_W : 0;
  const x1 = CON_W / 2;
  const x2 = flip ? 0 : CON_W;
  const mid = FINALS_CY;

  return (
    <svg width={CON_W} height={h} style={{ flexShrink: 0, overflow: 'visible' }}>
      {[0, 1].map(i => {
        const cy = CF_CY[i];
        return (
          <g key={i}>
            <path
              d={`M ${x0},${cy} H ${x1} V ${mid} H ${x2}`}
              fill="none" stroke="var(--border-bright)" strokeWidth={1.5}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ── Team card ──────────────────────────────────────────────────────────────────
function TeamCard({ team, prob, probLabel, isProjected, width = COL_W }) {
  if (!team) {
    return (
      <div style={{
        width, height: SLOT, borderRadius: 8,
        background: 'var(--bg-card-2)', border: '1px dashed var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>TBD</span>
      </div>
    );
  }

  const color = getTeamColor(team.team);
  const logoUrl = getTeamLogoUrl(team.team);

  return (
    <div style={{
      width, height: SLOT, borderRadius: 8,
      background: 'var(--bg-card-2)',
      border: `1px solid ${isProjected ? color + '60' : 'var(--border)'}`,
      display: 'flex', alignItems: 'center',
      padding: '0 8px', gap: 6,
      boxShadow: isProjected ? `0 0 8px ${color}30` : 'none',
      overflow: 'hidden',
    }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', minWidth: 13, textAlign: 'center' }}>
        {team.seed}
      </span>
      {logoUrl && (
        <img src={logoUrl} alt={team.team} width={20} height={20}
          style={{ objectFit: 'contain', flexShrink: 0 }}
          onError={e => { e.target.style.display = 'none'; }}
        />
      )}
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {team.team}
      </span>
      {prob != null && (
        <span style={{ fontSize: 10, fontWeight: 700, color, flexShrink: 0, minWidth: 28, textAlign: 'right' }}>
          {pct(prob)}
        </span>
      )}
    </div>
  );
}

// ── Column of team cards at absolute Y positions ──────────────────────────────
function BracketColumn({ teams, yPositions, probKey, projectedIdx, label, width = COL_W }) {
  return (
    <div style={{ position: 'relative', width, height: TOTAL_H, flexShrink: 0 }}>
      {label && (
        <div style={{
          position: 'absolute', top: -22, left: 0, right: 0,
          textAlign: 'center', fontSize: 9, fontWeight: 800,
          color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {label}
        </div>
      )}
      {yPositions.map((y, i) => (
        <div key={i} style={{ position: 'absolute', top: y, left: 0 }}>
          <TeamCard
            team={teams[i]}
            prob={teams[i]?.[probKey]}
            isProjected={projectedIdx === i}
            width={width}
          />
        </div>
      ))}
    </div>
  );
}

// ── Finals column (center) ────────────────────────────────────────────────────
function FinalsColumn({ eastTeam, westTeam, champProb }) {
  return (
    <div style={{ position: 'relative', width: FINALS_W, height: TOTAL_H, flexShrink: 0 }}>
      <div style={{
        position: 'absolute', top: -22, left: 0, right: 0,
        textAlign: 'center', fontSize: 9, fontWeight: 800,
        color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        NBA Finals
      </div>
      {/* East finalist */}
      <div style={{ position: 'absolute', top: FINALS_Y - SLOT - 8, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <TeamCard team={eastTeam} prob={eastTeam?.conf_prob} width={FINALS_W - 16} />
      </div>
      {/* VS divider */}
      <div style={{
        position: 'absolute', top: FINALS_Y - 12, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8,
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 8 }} />
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)' }}>VS</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)', marginRight: 8 }} />
      </div>
      {/* West finalist */}
      <div style={{ position: 'absolute', top: FINALS_Y + 4, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <TeamCard team={westTeam} prob={westTeam?.conf_prob} width={FINALS_W - 16} />
      </div>
      {/* Champion projection */}
      {champProb && (
        <div style={{
          position: 'absolute', top: FINALS_Y + SLOT + 20,
          left: 0, right: 0, display: 'flex', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-card-2)', border: '1px solid var(--accent)40',
            borderRadius: 8, padding: '6px 12px', textAlign: 'center',
            boxShadow: '0 0 12px var(--accent)20',
          }}>
            <p style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 800, letterSpacing: '0.08em', margin: '0 0 2px', textTransform: 'uppercase' }}>
              Projected Champion
            </p>
            {champProb.team && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                {getTeamLogoUrl(champProb.team.team) && (
                  <img src={getTeamLogoUrl(champProb.team.team)} alt={champProb.team.team} width={18} height={18}
                    style={{ objectFit: 'contain' }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
                <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)' }}>
                  {champProb.team.team}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: getTeamColor(champProb.team.team) }}>
                  {pct(champProb.team.champ_prob)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Conference bracket (East or West) ─────────────────────────────────────────
function ConferenceBracket({ teams, side, label }) {
  if (!teams || teams.length < 8) return null;

  // Build seed → team map
  const bySeeed = {};
  teams.forEach(t => { bySeeed[t.seed] = t; });

  // Build R1 slots in bracket order
  const r1Teams = SEED_ORDER.map(seed => bySeeed[seed]);

  // Project R2 winners: better r1_prob in each matchup
  const r2Teams = [0, 1, 2, 3].map(m => {
    const t0 = r1Teams[m * 2];
    const t1 = r1Teams[m * 2 + 1];
    return (t0?.r1_prob ?? 0) >= (t1?.r1_prob ?? 0) ? t0 : t1;
  });

  // Project Conf Finals winners: better r2_prob in each semi
  const cfTeams = [0, 1].map(m => {
    const t0 = r2Teams[m * 2];
    const t1 = r2Teams[m * 2 + 1];
    return (t0?.r2_prob ?? 0) >= (t1?.r2_prob ?? 0) ? t0 : t1;
  });

  // Finals representative: better conf_prob
  const finalist = (cfTeams[0]?.conf_prob ?? 0) >= (cfTeams[1]?.conf_prob ?? 0)
    ? cfTeams[0] : cfTeams[1];

  const isEast = side === 'east';

  // East layout: R1 → connector → R2 → connector → CF → connector → (Finals center)
  // West layout: (Finals center) → connector → CF → connector → R2 → connector → R1
  const cols = isEast
    ? (
      <>
        <BracketColumn
          teams={r1Teams} yPositions={R1_Y}
          probKey="r1_prob" label="Round 1"
        />
        <R1Connectors side="east" />
        <BracketColumn
          teams={r2Teams} yPositions={R2_Y}
          probKey="r2_prob" label="Round 2"
        />
        <R2Connectors side="east" />
        <BracketColumn
          teams={cfTeams} yPositions={CF_Y}
          probKey="conf_prob" label="Conf Finals"
        />
        <CFConnectors side="east" />
      </>
    ) : (
      <>
        <CFConnectors side="west" />
        <BracketColumn
          teams={cfTeams} yPositions={CF_Y}
          probKey="conf_prob" label="Conf Finals"
        />
        <R2Connectors side="west" />
        <BracketColumn
          teams={r2Teams} yPositions={R2_Y}
          probKey="r2_prob" label="Round 2"
        />
        <R1Connectors side="west" />
        <BracketColumn
          teams={r1Teams} yPositions={R1_Y}
          probKey="r1_prob" label="Round 1"
        />
      </>
    );

  return (
    <div>
      <p style={{
        fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)',
        letterSpacing: '0.08em', textTransform: 'uppercase',
        margin: '0 0 28px', textAlign: isEast ? 'left' : 'right',
      }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {cols}
      </div>
      {/* Finalist to pass to Finals column */}
      <div data-finalist={finalist?.team} />
    </div>
  );
}

// ── Play-in mini section ───────────────────────────────────────────────────────
function PlayInStrip({ teams, label }) {
  if (!teams || teams.length === 0) return null;
  const sorted = [...teams].sort((a, b) => a.seed - b.seed);
  return (
    <div style={{
      marginTop: 20, padding: '10px 14px',
      background: 'var(--bg-card-2)', border: '1px solid var(--border-light)',
      borderRadius: 10,
    }}>
      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 8px' }}>
        {label} Play-In (Seeds 7–10)
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {sorted.map(t => {
          const color = getTeamColor(t.team);
          const logoUrl = getTeamLogoUrl(t.team);
          return (
            <div key={t.team} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--bg-hover)', border: `1px solid var(--border)`,
              borderRadius: 7, padding: '5px 9px', minWidth: 100,
            }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', minWidth: 10 }}>
                {t.seed}
              </span>
              {logoUrl && (
                <img src={logoUrl} alt={t.team} width={16} height={16}
                  style={{ objectFit: 'contain' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{t.team}</span>
              {t.record && t.record !== '—' && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>{t.record}</span>
              )}
              <div style={{
                background: `${color}20`, border: `1px solid ${color}50`,
                borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 800, color,
                marginLeft: 4,
              }}>
                7: {pct(t.made_7th)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PlayoffBracket({ season = '2024-25' }) {
  const [result,  setResult ] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);
  const [nSims,   setNSims  ] = useState(5000);

  async function runSim() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchPlayoffSimulation(season, nSims);
      setResult(data);
    } catch {
      setError('Simulation failed — make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  // Compute bracket data from result
  let eastTeams = [], westTeams = [];
  let eastFinalist = null, westFinalist = null;
  let champion = null;

  if (result) {
    eastTeams = result.east || [];
    westTeams = result.west || [];

    const eastBySeed = {};
    eastTeams.forEach(t => { eastBySeed[t.seed] = t; });
    const westBySeed = {};
    westTeams.forEach(t => { westBySeed[t.seed] = t; });

    // Project conf finals for each conference
    const eastR1 = SEED_ORDER.map(s => eastBySeed[s]);
    const westR1 = SEED_ORDER.map(s => westBySeed[s]);

    const eastR2 = [0,1,2,3].map(m => {
      const a = eastR1[m*2], b = eastR1[m*2+1];
      return (a?.r1_prob ?? 0) >= (b?.r1_prob ?? 0) ? a : b;
    });
    const westR2 = [0,1,2,3].map(m => {
      const a = westR1[m*2], b = westR1[m*2+1];
      return (a?.r1_prob ?? 0) >= (b?.r1_prob ?? 0) ? a : b;
    });

    const eastCF = [0,1].map(m => {
      const a = eastR2[m*2], b = eastR2[m*2+1];
      return (a?.r2_prob ?? 0) >= (b?.r2_prob ?? 0) ? a : b;
    });
    const westCF = [0,1].map(m => {
      const a = westR2[m*2], b = westR2[m*2+1];
      return (a?.r2_prob ?? 0) >= (b?.r2_prob ?? 0) ? a : b;
    });

    eastFinalist = (eastCF[0]?.conf_prob ?? 0) >= (eastCF[1]?.conf_prob ?? 0) ? eastCF[0] : eastCF[1];
    westFinalist = (westCF[0]?.conf_prob ?? 0) >= (westCF[1]?.conf_prob ?? 0) ? westCF[0] : westCF[1];

    const all = [...eastTeams, ...westTeams].sort((a, b) => b.champ_prob - a.champ_prob);
    champion = all[0] ? { team: all[0] } : null;
  }

  const isLive = result?.data_source === 'live_nba';
  const isPartial = result?.data_source === 'live_standings';
  const badgeColor = isLive ? '#4ade80' : isPartial ? '#f59e0b' : 'var(--text-muted)';
  const badgeLabel = isLive ? 'Live NBA Data' : isPartial ? 'Live Standings' : 'DB Estimates';

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Playoff Bracket
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
          Seeded by live standings · projected winners based on Monte Carlo simulation · {season}
        </p>
      </div>

      {/* ── Controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Simulations:</span>
          {[1000, 5000, 10000].map(n => (
            <button key={n} onClick={() => setNSims(n)} style={{
              background: nSims === n ? 'var(--text-primary)' : 'var(--bg-card-2)',
              color: nSims === n ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: '1px solid var(--border-bright)',
              borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {n.toLocaleString()}
            </button>
          ))}
        </div>

        <button className="ss-btn" onClick={runSim} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={13} strokeWidth={2.5}
            style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
          {loading ? 'Fetching live data…' : result ? 'Re-run' : 'Generate Bracket'}
        </button>

        {result && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: `${badgeColor}18`, border: `1px solid ${badgeColor}40`,
            borderRadius: 20, padding: '3px 10px',
          }}>
            {isLive || isPartial
              ? <Wifi size={11} color={badgeColor} strokeWidth={2.5} />
              : <Database size={11} color={badgeColor} strokeWidth={2.5} />
            }
            <span style={{ fontSize: 11, fontWeight: 700, color: badgeColor }}>{badgeLabel}</span>
          </div>
        )}
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

      {/* ── Legend ── */}
      {result && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Team cards show:</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Seed · Logo · Abbreviation · Win prob for that round</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Highlighted borders = projected to advance
          </span>
        </div>
      )}

      {/* ── Bracket ── */}
      {result && !loading && (
        <div className="fade-in" style={{ overflowX: 'auto', paddingBottom: 12 }}>
          {/* Column labels row */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 0,
            marginTop: 24,
            marginBottom: 0,
            minWidth: COL_W * 3 + CON_W * 3 + FINALS_W + COL_W * 3 + CON_W * 3,
          }}>

            {/* ── EAST ── */}
            {(() => {
              const bySeeed = {};
              eastTeams.forEach(t => { bySeeed[t.seed] = t; });
              const r1 = SEED_ORDER.map(s => bySeeed[s]);
              const r2 = [0,1,2,3].map(m => {
                const a = r1[m*2], b = r1[m*2+1];
                return (a?.r1_prob ?? 0) >= (b?.r1_prob ?? 0) ? a : b;
              });
              const cf = [0,1].map(m => {
                const a = r2[m*2], b = r2[m*2+1];
                return (a?.r2_prob ?? 0) >= (b?.r2_prob ?? 0) ? a : b;
              });

              return (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 28px' }}>
                    Eastern Conference
                  </p>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <BracketColumn teams={r1} yPositions={R1_Y} probKey="r1_prob" label="Round 1" />
                    <R1Connectors side="east" />
                    <BracketColumn teams={r2} yPositions={R2_Y} probKey="r2_prob" label="Round 2" />
                    <R2Connectors side="east" />
                    <BracketColumn teams={cf} yPositions={CF_Y} probKey="conf_prob" label="Conf Finals" />
                    <CFConnectors side="east" />
                  </div>
                </div>
              );
            })()}

            {/* ── FINALS CENTER ── */}
            <FinalsColumn
              eastTeam={eastFinalist}
              westTeam={westFinalist}
              champProb={champion}
            />

            {/* ── WEST ── */}
            {(() => {
              const bySeeed = {};
              westTeams.forEach(t => { bySeeed[t.seed] = t; });
              const r1 = SEED_ORDER.map(s => bySeeed[s]);
              const r2 = [0,1,2,3].map(m => {
                const a = r1[m*2], b = r1[m*2+1];
                return (a?.r1_prob ?? 0) >= (b?.r1_prob ?? 0) ? a : b;
              });
              const cf = [0,1].map(m => {
                const a = r2[m*2], b = r2[m*2+1];
                return (a?.r2_prob ?? 0) >= (b?.r2_prob ?? 0) ? a : b;
              });

              return (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 28px', textAlign: 'right' }}>
                    Western Conference
                  </p>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <CFConnectors side="west" />
                    <BracketColumn teams={cf} yPositions={CF_Y} probKey="conf_prob" label="Conf Finals" />
                    <R2Connectors side="west" />
                    <BracketColumn teams={r2} yPositions={R2_Y} probKey="r2_prob" label="Round 2" />
                    <R1Connectors side="west" />
                    <BracketColumn teams={r1} yPositions={R1_Y} probKey="r1_prob" label="Round 1" />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Play-In sections ── */}
          <div style={{ display: 'flex', gap: 20, marginTop: 28, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <PlayInStrip teams={result.east_play_in} label="Eastern" />
            </div>
            <div style={{ flex: 1, minWidth: 300 }}>
              <PlayInStrip teams={result.west_play_in} label="Western" />
            </div>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && !result && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Generate the bracket
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            Fetches live standings and places teams in their seeded bracket positions.<br />
            Round advancement is projected via Monte Carlo simulation.
          </p>
        </div>
      )}
    </div>
  );
}

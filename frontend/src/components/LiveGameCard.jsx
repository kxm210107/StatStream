// frontend/src/components/LiveGameCard.jsx
import { useState, useEffect } from 'react';
import WinProbabilityBar from './WinProbabilityBar';
import WinProbabilityChart from './WinProbabilityChart';
import { getTeamLogoUrl, getTeamColor } from '../utils/teamLogos';

const PERIOD_LABEL = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH' };

function to24h(timeStr) {
  const parts = timeStr.trim().split(' ');
  const [h24, m24] = parts[0].split(':').map(Number);
  const meridiem = (parts[1] || '').toLowerCase();
  let h = h24;
  if (meridiem === 'pm' && h !== 12) h += 12;
  if (meridiem === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m24).padStart(2, '0')}:00`;
}

function etOffset(dateStr) {
  // US DST: 2nd Sunday of March 02:00 ET → 1st Sunday of November 02:00 ET
  const year = new Date(dateStr).getFullYear();
  const mar = new Date(year, 2, 1);
  mar.setDate(1 + (7 - mar.getDay()) % 7 + 7); // 2nd Sunday of March
  const nov = new Date(year, 10, 1);
  nov.setDate(1 + (7 - nov.getDay()) % 7);      // 1st Sunday of November
  const d = new Date(dateStr);
  return d >= mar && d < nov ? '-04:00' : '-05:00';
}

function parseTipoffMs(dateStr, timeStr) {
  try {
    const cleaned = timeStr.replace(/\s*ET$/i, '').trim();
    const tipoff = new Date(`${dateStr}T${to24h(cleaned)}${etOffset(dateStr)}`);
    return tipoff.getTime() - Date.now();
  } catch {
    return null;
  }
}

function formatCountdown(ms) {
  if (ms <= 0) return 'STARTING';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTipoffTime(timeStr) {
  return timeStr.toUpperCase();
}

function CountdownCell({ dateStr, timeStr }) {
  const [msLeft, setMsLeft] = useState(() => parseTipoffMs(dateStr, timeStr));

  useEffect(() => {
    const id = setInterval(() => {
      setMsLeft(parseTipoffMs(dateStr, timeStr));
    }, 1000);
    return () => clearInterval(id);
  }, [dateStr, timeStr]);

  return (
    <div style={{ textAlign: 'center', minWidth: 160 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 32, letterSpacing: '0.08em',
        color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1,
      }}>
        {msLeft != null ? formatCountdown(msLeft) : '--:--:--'}
      </div>
      <div style={{
        fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-muted)',
        textTransform: 'uppercase', marginTop: 6,
      }}>
        to tipoff
      </div>
    </div>
  );
}

function ScoreCell({ home, away }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 160, justifyContent: 'center' }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 42, lineHeight: 1,
        color: away.score >= home.score ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}>
        {away.score}
      </span>
      <span style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>VS</span>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 42, lineHeight: 1,
        color: home.score >= away.score ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}>
        {home.score}
      </span>
    </div>
  );
}

function TipoffCell({ timeStr }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 160 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 20, letterSpacing: '0.08em',
        color: 'var(--text-secondary)', fontWeight: 600,
      }}>
        {formatTipoffTime(timeStr)}
      </div>
    </div>
  );
}

function ScoreFlash({ plays, teamAbbr, side }) {
  const [flashes, setFlashes] = useState([]);

  useEffect(() => {
    const mine = (plays || []).filter(p => p.team_abbr === teamAbbr);
    if (mine.length === 0) return;
    const newFlashes = mine.map((p, i) => ({
      id: `${p.action_number}-${i}`,
      points: p.points,
    }));
    setFlashes(prev => [...prev, ...newFlashes]);
    const timer = setTimeout(() => {
      setFlashes(prev => prev.filter(f => !newFlashes.find(n => n.id === f.id)));
    }, 1800);
    return () => clearTimeout(timer);
  }, [plays, teamAbbr]);

  if (flashes.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      [side === 'left' ? 'left' : 'right']: 20,
      top: 0,
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      {flashes.map(f => (
        <span
          key={f.id}
          style={{
            display: 'block',
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 900,
            color: '#4ADE80',
            animation: 'scoreFloat 1.8s ease-out forwards',
            letterSpacing: '0.05em',
          }}
        >
          +{f.points}
        </span>
      ))}
    </div>
  );
}

export default function LiveGameCard({ game, selected, onClick, history = [], new_scoring_plays = [] }) {
  const { home_team: home, away_team: away } = game;
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const isLive     = game.status !== 'Upcoming';
  const isToday    = game.date === todayStr;
  const isTomorrow = !isLive && game.date === tomorrowStr;

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? 'var(--bg-card-2)' : 'var(--bg-card)',
        border: `1px solid ${selected ? 'var(--cyan)' : 'var(--border-light)'}`,
        borderRadius: 12,
        padding: '22px 28px',
        cursor: isLive ? 'pointer' : 'default',
        position: 'relative',
        transition: 'border-color 0.2s, background 0.2s',
        boxShadow: selected ? '0 0 0 1px rgba(34,211,238,0.15) inset' : 'none',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ScoreFlash plays={new_scoring_plays} teamAbbr={away.abbr} side="left" />

        {/* Status badge */}
        <div style={{ minWidth: 72, flexShrink: 0 }}>
          {isLive ? (
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.15em',
              color: '#4ADE80', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{
                display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                background: '#4ADE80', boxShadow: '0 0 5px #4ADE80',
                animation: 'pulse 2s ease infinite', flexShrink: 0,
              }} />
              {PERIOD_LABEL[game.period] ?? `OT${game.period - 4}`}
              <br />
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{game.clock}</span>
            </span>
          ) : isToday ? (
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.15em',
              color: 'var(--text-muted)', textTransform: 'uppercase',
            }}>Today</span>
          ) : (
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.15em',
              color: 'var(--text-muted)', textTransform: 'uppercase',
            }}>Tomorrow</span>
          )}
        </div>

        {/* Away team */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 4,
            }}>
              {away.abbr}
            </div>
            <div style={{
              fontSize: 18, color: 'var(--text-secondary)', letterSpacing: '0.03em',
              fontWeight: 500,
            }}>
              {away.name}
            </div>
          </div>
          {getTeamLogoUrl(away.abbr) && (
            <img src={getTeamLogoUrl(away.abbr)} alt={away.abbr} width={48} height={48}
              style={{ objectFit: 'contain', flexShrink: 0 }} />
          )}
        </div>

        {/* Center: score / countdown / time */}
        <div style={{ flexShrink: 0 }}>
          {isLive    && <ScoreCell home={home} away={away} />}
          {isToday   && !isLive && <CountdownCell dateStr={game.date} timeStr={game.time} />}
          {isTomorrow && <TipoffCell timeStr={game.time} />}
        </div>

        {/* Home team */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 14 }}>
          {getTeamLogoUrl(home.abbr) && (
            <img src={getTeamLogoUrl(home.abbr)} alt={home.abbr} width={48} height={48}
              style={{ objectFit: 'contain', flexShrink: 0 }} />
          )}
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.12em',
              textTransform: 'uppercase', marginBottom: 4,
            }}>
              {home.abbr}
            </div>
            <div style={{
              fontSize: 18, color: 'var(--text-secondary)', letterSpacing: '0.03em',
              fontWeight: 500,
            }}>
              {home.name}
            </div>
          </div>
        </div>

        <ScoreFlash plays={new_scoring_plays} teamAbbr={home.abbr} side="right" />
      </div>

      {/* Win probability bar — live and pregame */}
      {home.win_probability != null && (
        <div style={{ marginTop: 14 }}>
          <WinProbabilityBar
            homeProb={home.win_probability}
            awayProb={away.win_probability}
            homeAbbr={home.abbr}
            awayAbbr={away.abbr}
          />
        </div>
      )}

      {/* Win probability chart — shown when live game is selected */}
      {selected && isLive && (
        <div style={{ marginTop: 20 }}>
          <WinProbabilityChart
            history={history}
            homeAbbr={home.abbr}
            awayAbbr={away.abbr}
            homeColor={getTeamColor(home.abbr)}
            awayColor={getTeamColor(away.abbr)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * DisplayCards — Reusable NBA analytics card display component
 *
 * Renders a collection of player stat cards in one of two layouts:
 *   - 'grid'  : responsive auto-fill grid (default)
 *   - 'stack' : vertical expandable list (great for rankings)
 *
 * NBA Analytics stat presets available: 'pts', 'reb', 'ast'
 * Each preset maps to the correct player field, colour, and label.
 *
 * @param {Object}         props
 * @param {PlayerData[]}   props.players            - Array of player objects
 * @param {'grid'|'stack'} [props.variant='grid']   - Layout variant
 * @param {boolean}        [props.showRank=true]    - Show rank badge / number
 * @param {boolean}        [props.showTeam=true]    - Show team abbreviation
 * @param {StatKey[]}      [props.stats]            - Stats to show (default: ['pts','reb','ast'])
 * @param {MaxStats}       [props.maxStats]         - Override max values for bar scaling
 * @param {boolean}        [props.loading=false]    - Show loading spinner
 * @param {string}         [props.emptyTitle]       - Empty-state heading
 * @param {string}         [props.emptyMessage]     - Empty-state sub-text
 * @param {string}         [props.emptyIcon='🏀']  - Empty-state emoji
 *
 * @typedef {'pts'|'reb'|'ast'} StatKey
 * @typedef {{ pts?: number, reb?: number, ast?: number }} MaxStats
 * @typedef {{ player_id: number, player_name: string, team?: string,
 *             pts_per_game: number, reb_per_game: number, ast_per_game: number }} PlayerData
 */

import { useState } from 'react';
import { getTeamLogoUrl, getPlayerHeadshotUrl } from '../utils/teamLogos';

function TeamLogo({ abbr, size = 26 }) {
  const url = getTeamLogoUrl(abbr);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={abbr}
      width={size}
      height={size}
      style={{ objectFit: 'contain', flexShrink: 0 }}
      onError={e => { e.target.style.display = 'none'; }}
    />
  );
}

// ── NBA Analytics stat preset registry ───────────────────────────────────────
const STAT_PRESETS = {
  pts: {
    label:  'PTS',
    field:  'pts_per_game',
    color:  '#22D3EE',
    bg:     'rgba(34,211,238,0.08)',
    border: 'rgba(34,211,238,0.2)',
  },
  reb: {
    label:  'REB',
    field:  'reb_per_game',
    color:  '#4ADE80',
    bg:     'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.2)',
  },
  ast: {
    label:  'AST',
    field:  'ast_per_game',
    color:  '#F97316',
    bg:     'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.2)',
  },
};

const DEFAULT_STATS = ['pts', 'reb', 'ast'];
const MEDALS        = ['🥇', '🥈', '🥉'];

// ── Shared primitives ─────────────────────────────────────────────────────────

/**
 * Animated horizontal progress bar for a single stat.
 * Exposes aria meter semantics for screen readers.
 */
function StatBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      role="meter"
      aria-label={`${label} ${value?.toFixed(1)}`}
      aria-valuenow={value ?? 0}
      aria-valuemax={max}
      aria-valuemin={0}
    >
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
        color: 'var(--text-muted)', width: 26, flexShrink: 0,
      }}>
        {label}
      </span>

      {/* Track */}
      <div style={{
        flex: 1, height: 6, background: 'var(--border)',
        borderRadius: 3, overflow: 'hidden',
      }}>
        {/* Fill */}
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}CC, ${color})`,
          boxShadow: `0 0 6px ${color}60`,
          borderRadius: 3,
          transition: 'width 0.45s ease',
        }} />
      </div>

      <span style={{
        fontSize: 22, fontWeight: 700, color,
        width: 34, textAlign: 'right', flexShrink: 0,
      }}>
        {value?.toFixed(1)}
      </span>
    </div>
  );
}

/**
 * Square rank badge used in grid cards.
 * Top 3 → medal emoji; others → number.
 */
function RankBadge({ rank, isLeader }) {
  return (
    <div
      aria-label={`Rank ${rank + 1}`}
      style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: rank < 3 ? 16 : 12, fontWeight: 800,
        background: isLeader ? 'rgba(245,158,11,0.1)' : 'var(--bg-hover)',
        color:  isLeader ? '#F59E0B' : 'var(--text-muted)',
        border: isLeader ? '1px solid rgba(245,158,11,0.5)' : '1px solid var(--border)',
        userSelect: 'none',
      }}
    >
      {rank < 3 ? MEDALS[rank] : rank + 1}
    </div>
  );
}

// ── Grid variant card ─────────────────────────────────────────────────────────

/**
 * A hoverable player stat card for use in a responsive grid layout.
 * Keyboard-focusable with visible focus ring.
 */
function GridCard({ player, rank, showRank, showTeam, showHeadshot, resolvedStats }) {
  const isLeader = rank === 0;
  const [imgError, setImgError] = useState(false);
  const headshotUrl = showHeadshot && player.player_id
    ? getPlayerHeadshotUrl(player.player_id)
    : null;

  return (
    <article
      aria-label={`${player.player_name} player card`}
      tabIndex={0}
      style={{
        background: 'var(--bg-card)',
        border:     '1px solid var(--border-light)',
        borderRadius: 12,
        overflow: 'hidden',
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease',
        boxShadow: 'none',
        outline: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform    = 'translateY(-2px)';
        e.currentTarget.style.borderColor  = 'rgba(255,255,255,0.35)';
        e.currentTarget.style.boxShadow    = '0 0 24px rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.4)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform    = 'none';
        e.currentTarget.style.borderColor  = 'var(--border-light)';
        e.currentTarget.style.boxShadow    = 'none';
      }}
      onFocus={e => {
        e.currentTarget.style.outline      = '2px solid rgba(255,255,255,0.5)';
        e.currentTarget.style.outlineOffset = '2px';
      }}
      onBlur={e => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      {/* ── Headshot banner ── */}
      {headshotUrl && !imgError && (
        <div style={{
          height: 96,
          background: 'linear-gradient(180deg, var(--bg-card-2) 0%, var(--bg-card) 100%)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          overflow: 'hidden', position: 'relative',
        }}>
          {showRank && (
            <div style={{
              position: 'absolute', top: 8, left: 10,
              background: isLeader ? 'rgba(245,158,11,0.1)' : 'var(--bg-hover)',
              border: isLeader ? '1px solid rgba(245,158,11,0.5)' : '1px solid var(--border)',
              borderRadius: 6, padding: '2px 7px',
              fontSize: rank < 3 ? 14 : 11, fontWeight: 800,
              color: isLeader ? '#F59E0B' : 'var(--text-muted)',
            }}>
              {rank < 3 ? MEDALS[rank] : rank + 1}
            </div>
          )}
          <img
            src={headshotUrl}
            alt={player.player_name}
            style={{
              height: 110,
              width: 'auto',
              objectFit: 'contain',
              objectPosition: 'top',
              marginBottom: -6,
            }}
            onError={() => setImgError(true)}
          />
        </div>
      )}

      {/* ── Card header ── */}
      <div style={{
        padding: '13px 16px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'transparent',
      }}>
        {(!headshotUrl || imgError) && showRank && <RankBadge rank={rank} isLeader={isLeader} />}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontWeight: 700, fontSize: 14,
            color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {player.player_name}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
            {player.position && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                color: 'var(--text-muted)',
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '1px 6px',
              }}>
                {player.position}
              </span>
            )}
            {showTeam && player.team && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <TeamLogo abbr={player.team} size={18} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {player.team}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat bars ── */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {resolvedStats.map(s => (
          <StatBar key={s.label} label={s.label} value={s.value} max={s.max} color={s.color} />
        ))}
      </div>
    </article>
  );
}

// ── Stack variant card ────────────────────────────────────────────────────────

/**
 * A keyboard-accessible, expandable row for use in a ranked stack layout.
 * Click (or Enter / Space) to expand stat bars below the row.
 * Each card manages its own expanded state independently.
 */
function StackCard({ player, rank, showRank, showTeam, resolvedStats }) {
  const [expanded, setExpanded] = useState(false);
  const isLeader = rank === 0;

  // First resolved stat is used as the pill highlight in the collapsed row
  const primaryStat = resolvedStats[0];

  function toggle() { setExpanded(prev => !prev); }

  return (
    <div
      role="button"
      aria-expanded={expanded}
      aria-label={
        `${player.player_name}` +
        (primaryStat ? `, ${primaryStat.value?.toFixed(1)} ${primaryStat.label}` : '') +
        `. Press to ${expanded ? 'collapse' : 'expand'} stats.`
      }
      tabIndex={0}
      onClick={toggle}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      }}
      style={{
        background: expanded ? 'var(--bg-card-2)' : 'var(--bg-card)',
        border: `1px solid ${expanded ? 'var(--border-bright)' : 'var(--border-light)'}`,
        borderRadius: 10,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'border-color 0.18s, background 0.18s',
        outline: 'none',
      }}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.borderColor = 'var(--border-bright)'; }}
      onMouseLeave={e => { if (!expanded) e.currentTarget.style.borderColor = 'var(--border-light)'; }}
      onFocus={e  => { e.currentTarget.style.boxShadow = '0 0 0 2px rgba(224,62,68,0.25)'; }}
      onBlur={e   => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* ── Collapsed summary row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px' }}>

        {/* Rank number */}
        {showRank && (
          <span
            aria-hidden="true"
            style={{
              minWidth: 22, fontSize: 13, fontWeight: 800, textAlign: 'center',
              color: isLeader ? 'var(--accent)' : rank < 3 ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {rank + 1}
          </span>
        )}

        {/* Name + optional team */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontWeight: 700, fontSize: 14,
            color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {player.player_name}
          </p>

          {showTeam && player.team && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <TeamLogo abbr={player.team} size={16} />
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 11 }}>
                {player.team}
              </p>
            </div>
          )}
        </div>

        {/* Primary stat pill */}
        {primaryStat && (
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 4,
            background: primaryStat.bg,
            border:     `1px solid ${primaryStat.border}`,
            borderRadius: 8, padding: '4px 10px',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: primaryStat.color, lineHeight: 1 }}>
              {primaryStat.value?.toFixed(1)}
            </span>
            <span style={{ fontSize: 10, color: '#7A9AB8', fontWeight: 700 }}>
              {primaryStat.label}
            </span>
          </div>
        )}

        {/* Expand chevron */}
        <span
          aria-hidden="true"
          style={{
            color: 'var(--text-secondary)', fontSize: 12,
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(180deg)' : 'none',
            display: 'inline-block',
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </div>

      {/* ── Expanded stat bars ── */}
      {expanded && (
        <div
          className="fade-in"
          style={{
            padding: '4px 16px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 9,
          }}
        >
          {resolvedStats.map(s => (
            <StatBar key={s.label} label={s.label} value={s.value} max={s.max} color={s.color} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon = '🏀', title = 'No players found', message }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        textAlign: 'center', padding: '50px 24px', color: 'var(--text-muted)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">{icon}</div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
        {title}
      </p>
      {message && <p style={{ fontSize: 13 }}>{message}</p>}
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

export default function DisplayCards({
  players      = [],
  variant      = 'grid',
  showRank     = true,
  showTeam     = true,
  showHeadshot = false,
  stats        = DEFAULT_STATS,
  maxStats,
  loading      = false,
  emptyTitle   = 'No players found',
  emptyMessage,
  emptyIcon    = '🏀',
}) {
  // Resolve stat preset objects from the requested keys
  const resolvedPresets = stats
    .map(key => ({ key, ...STAT_PRESETS[key] }))
    .filter(p => p.field);           // silently skip unknown keys

  // Compute max values for bar scaling.
  // Prefer explicit maxStats prop; fall back to computing from the data.
  const computedMaxes = {};
  for (const preset of resolvedPresets) {
    if (maxStats?.[preset.key] != null) {
      computedMaxes[preset.key] = maxStats[preset.key];
    } else {
      computedMaxes[preset.key] = Math.max(...players.map(p => p[preset.field] ?? 0)) || 1;
    }
  }

  /** Build the resolved stat array for a single player */
  function playerStats(player) {
    return resolvedPresets.map(preset => ({
      label:  preset.label,
      color:  preset.color,
      bg:     preset.bg,
      border: preset.border,
      value:  player[preset.field] ?? 0,
      max:    computedMaxes[preset.key],
    }));
  }

  // ── Loading ──
  if (loading) {
    return <div className="spinner" role="status" aria-label="Loading players" />;
  }

  // ── Empty ──
  if (players.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} />;
  }

  // ── Stack layout ──
  if (variant === 'stack') {
    return (
      <div
        role="list"
        aria-label="Player rankings"
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        {players.map((player, i) => (
          <div key={player.player_id ?? i} role="listitem">
            <StackCard
              player={player}
              rank={i}
              showRank={showRank}
              showTeam={showTeam}
              resolvedStats={playerStats(player)}
            />
          </div>
        ))}
      </div>
    );
  }

  // ── Grid layout (default) ──
  return (
    <div
      role="list"
      aria-label="Player cards"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 14,
      }}
    >
      {players.map((player, i) => (
        <div key={player.player_id ?? i} role="listitem">
          <GridCard
            player={player}
            rank={i}
            showRank={showRank}
            showTeam={showTeam}
            showHeadshot={showHeadshot}
            resolvedStats={playerStats(player)}
          />
        </div>
      ))}
    </div>
  );
}

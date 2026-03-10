/**
 * DisplayNavCards — Stacked card tab navigation
 *
 * Adapted from 21st.dev DisplayCards component.
 * Original used: TypeScript · Tailwind CSS · shadcn/ui · cn() utility
 * This version uses: JSX · inline CSS · StatStream dark-theme CSS variables
 *
 * Each card represents one app tab (Roster, Top Scorers, Team Search, Team Comparer).
 * Cards are skewed and stacked via the CSS grid-area trick from the original.
 * The active card is highlighted with a cyan glow; others are greyscale until hovered.
 * Clicking any card fires onTabChange(tab.id).
 *
 * @param {Object[]} tabs
 * @param {string}   tabs[].id          - Tab identifier key
 * @param {ReactNode} tabs[].icon       - Lucide-react icon element
 * @param {string}   tabs[].label       - Card title
 * @param {string}   tabs[].description - One-line card description
 * @param {string}   tabs[].stat        - Small footer stat / subtitle
 * @param {string}   activeTab          - id of the currently active tab
 * @param {Function} onTabChange        - Called with tab.id on click
 */

import { useState } from 'react';

// ── Stack offset positions (index 0 = furthest back, index 3 = front) ────────
const STACK = [
  { x: 48, y: 30, z: 1 },
  { x: 32, y: 20, z: 2 },
  { x: 16, y: 10, z: 3 },
  { x: 0,  y: 0,  z: 4 },
];

// ── Single card ───────────────────────────────────────────────────────────────

function DisplayCard({ icon, label, description, stat, isActive, stackIndex, onClick }) {
  const [hovered, setHovered] = useState(false);

  const { x, y, z } = STACK[stackIndex] ?? STACK[3];

  // Active card floats up slightly for emphasis
  const liftY = isActive ? y - 12 : y;

  return (
    <div
      role="button"
      aria-pressed={isActive}
      aria-label={`Switch to ${label}`}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        // Grid-area stacking trick (from original component)
        gridArea: 'stack',

        // Geometry
        position:  'relative',
        height:    '8.5rem',
        width:     '22rem',
        transform: `skewY(-8deg) translateX(${x}px) translateY(${liftY}px)`,
        transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s, filter 0.4s, box-shadow 0.3s',

        // Visual
        borderRadius: '0.75rem',
        border: isActive
          ? '2px solid rgba(0, 212, 255, 0.55)'
          : `2px solid ${hovered ? 'rgba(255,255,255,0.18)' : 'var(--border-light)'}`,
        background:      'rgba(15, 24, 41, 0.78)',
        backdropFilter:  'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: isActive
          ? '0 0 28px rgba(0, 212, 255, 0.18), 0 8px 24px rgba(0,0,0,0.5)'
          : 'none',

        // Layout
        padding:        '12px 16px',
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'space-between',
        cursor:         'pointer',
        userSelect:     'none',
        outline:        'none',
        overflow:       'hidden',

        // Stack order
        zIndex: isActive ? 10 : z,

        // Grayscale for inactive (lifted on hover)
        filter: isActive ? 'none' : `grayscale(${hovered ? '0%' : '90%'})`,
      }}
    >
      {/* ── Dark overlay for non-active cards (fades on hover) ── */}
      {/* Mirrors the before: pseudo-element from the original Tailwind version */}
      <div style={{
        position:     'absolute',
        inset:        0,
        borderRadius: '0.75rem',
        background:   'rgba(5, 8, 15, 0.55)',
        transition:   'opacity 0.5s',
        opacity:      isActive || hovered ? 0 : 1,
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* ── Right-edge gradient fade ── */}
      {/* Mirrors the after: pseudo-element from the original Tailwind version */}
      <div style={{
        position:   'absolute',
        right:      -4,
        top:        '-5%',
        height:     '110%',
        width:      '5rem',
        background: 'linear-gradient(to left, #05080F, transparent)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      {/* ── Card content (above both overlays) ── */}
      <div style={{
        position:       'relative',
        zIndex:         3,
        display:        'flex',
        flexDirection:  'column',
        height:         '100%',
        justifyContent: 'space-between',
      }}>

        {/* Top row: icon badge + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display:      'inline-flex',
            padding:      6,
            borderRadius: '50%',
            background:   isActive ? 'rgba(0,212,255,0.15)' : 'rgba(124,58,237,0.10)',
            border:       isActive
              ? '1px solid rgba(0,212,255,0.30)'
              : '1px solid rgba(124,58,237,0.18)',
            transition:   'all 0.3s',
          }}>
            {icon}
          </span>

          <p style={{
            fontSize:   '1.05rem',
            fontWeight:  600,
            color:       isActive ? 'var(--cyan)' : 'var(--text-secondary)',
            margin:      0,
            transition: 'color 0.3s',
          }}>
            {label}
          </p>
        </div>

        {/* Middle: description */}
        <p style={{
          fontSize:    '0.9rem',
          whiteSpace:  'nowrap',
          overflow:    'hidden',
          textOverflow: 'ellipsis',
          color:       'var(--text-primary)',
          margin:       0,
          fontWeight:   500,
        }}>
          {description}
        </p>

        {/* Bottom: stat / footer line */}
        <p style={{
          fontSize:        '0.72rem',
          color:           'var(--text-muted)',
          margin:           0,
          letterSpacing:   '0.05em',
          textTransform:   'uppercase',
          fontWeight:       600,
        }}>
          {stat}
        </p>
      </div>
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

export default function DisplayNavCards({ tabs, activeTab, onTabChange }) {
  return (
    // grid-template-areas trick: all children share "stack" area,
    // creating the layered visual purely with CSS transforms + z-index.
    <div style={{
      display:            'grid',
      gridTemplateAreas:  '"stack"',
      placeItems:         'center',
      // Reserve enough room for the deepest card offset
      paddingRight:       '3.5rem',
      paddingBottom:      '2.5rem',
    }}>
      {tabs.map((tab, index) => (
        <DisplayCard
          key={tab.id}
          icon={tab.icon}
          label={tab.label}
          description={tab.description}
          stat={tab.stat}
          isActive={tab.id === activeTab}
          stackIndex={index}
          onClick={() => onTabChange(tab.id)}
        />
      ))}
    </div>
  );
}

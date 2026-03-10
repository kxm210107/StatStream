/**
 * TubelightNavbar — Floating pill navbar with animated tubelight indicator
 *
 * Adapted from 21st.dev tubelight-navbar component.
 * Original used: TypeScript · Tailwind CSS · shadcn/ui · Next.js Link · framer-motion
 * This version uses: JSX · inline CSS · framer-motion · StatStream dark-theme CSS variables
 *
 * Sits fixed at the bottom of the viewport (works as a floating dock).
 * On desktop: shows icon + label. On mobile (<768 px): icon only.
 * The active tab gets a spring-animated cyan tubelight glow above the pill.
 *
 * @param {Object[]} items        - Tab definitions passed from App
 * @param {string}   items[].id   - Unique tab key
 * @param {string}   items[].label - Display label
 * @param {ReactNode} items[].icon - Lucide-react icon element (pre-rendered)
 * @param {string}   activeTab    - Currently active tab id
 * @param {Function} onTabChange  - Called with tab.id when a pill is clicked
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function TubelightNavbar({ items, activeTab, onTabChange }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    /* Fixed dock — top-centred on all screen sizes */
    <div style={{
      position:  'fixed',
      top:       0,
      left:      '50%',
      transform: 'translateX(-50%)',
      zIndex:    50,
      paddingTop: 20,
    }}>
      {/* Pill container */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        gap:             6,
        background:      'rgba(0, 0, 0, 0.85)',
        border:          '1px solid var(--border-bright)',
        backdropFilter:  'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding:         6,
        borderRadius:    9999,
        boxShadow:       '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
        /* overflow must stay visible so the tubelight glow isn't clipped */
        overflow:        'visible',
      }}>
        {items.map((item) => {
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              aria-label={item.label}
              onClick={() => onTabChange(item.id)}
              style={{
                position:   'relative',
                cursor:     'pointer',
                fontFamily: 'inherit',
                fontSize:   15,
                fontWeight: 600,
                padding:    isMobile ? '11px 18px' : '11px 28px',
                borderRadius: 9999,
                border:     'none',
                background: 'transparent',
                color:      isActive ? 'var(--text-primary)' : 'rgba(148, 163, 184, 0.5)',
                transition: 'color 0.2s',
                display:    'flex',
                alignItems: 'center',
                gap:        8,
                outline:    'none',
                /* Let the absolute tubelight element escape the button bounds */
                overflow:   'visible',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.color = 'rgba(148, 163, 184, 0.8)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.color = 'rgba(148, 163, 184, 0.5)';
              }}
            >
              {/* Icon — always visible */}
              {item.icon}

              {/* Label — hidden on mobile */}
              {!isMobile && <span>{item.label}</span>}

              {/* ── Animated tubelight indicator ── */}
              {isActive && (
                <motion.div
                  layoutId="tubelight"        /* shared key → spring slides between tabs */
                  initial={false}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  style={{
                    position:     'absolute',
                    inset:        0,
                    borderRadius: 9999,
                    background:   'rgba(255, 255, 255, 0.06)',
                    zIndex:       -1,
                    /* overflow visible so the tube + glow escape upward */
                    overflow:     'visible',
                  }}
                >
                  {/* ── Tube bar: hangs just below the pill bottom ── */}
                  {/* Navbar is at top → glow radiates downward into content */}
                  <div style={{
                    position:     'absolute',
                    bottom:       -8,
                    left:         '50%',
                    transform:    'translateX(-50%)',
                    width:        36,
                    height:       4,
                    background:   '#FFFFFF',
                    borderRadius: '4px 4px 0 0',
                    overflow:     'visible',
                  }}>

                    {/* Glow layer 1 — widest spread */}
                    <div style={{
                      position:     'absolute',
                      width:        64,
                      height:       32,
                      background:   'rgba(255, 255, 255, 0.2)',
                      borderRadius: 9999,
                      filter:       'blur(14px)',
                      top:          4,
                      left:         -14,
                    }} />

                    {/* Glow layer 2 — medium */}
                    <div style={{
                      position:     'absolute',
                      width:        40,
                      height:       24,
                      background:   'rgba(255, 255, 255, 0.15)',
                      borderRadius: 9999,
                      filter:       'blur(9px)',
                      top:          2,
                      left:         -2,
                    }} />

                    {/* Glow layer 3 — tight hot-spot */}
                    <div style={{
                      position:     'absolute',
                      width:        20,
                      height:       20,
                      background:   'rgba(255, 255, 255, 0.35)',
                      borderRadius: 9999,
                      filter:       'blur(5px)',
                      top:          0,
                      left:         8,
                    }} />
                  </div>
                </motion.div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

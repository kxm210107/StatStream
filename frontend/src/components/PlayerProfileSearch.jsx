import { useState, useEffect, useRef } from 'react';
import { searchPlayers } from '../api';
import PlayerCard from './PlayerCard';
import PlayerTable from './PlayerTable';
import { getTeamLogoUrl } from '../utils/teamLogos';

export default function PlayerProfileSearch({ season }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState([]); // up to 2 PlayerStat objects
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search handler
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlayers(val.trim(), season);
        setSuggestions(results);
        setDropdownOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const addPlayer = (player) => {
    setDropdownOpen(false);
    setQuery('');
    setSuggestions([]);
    setSelected(prev => {
      if (prev.find(p => p.player_id === player.player_id)) return prev;
      if (prev.length >= 2) return [prev[1], player]; // replace oldest
      return [...prev, player];
    });
  };

  const removePlayer = (playerId) => {
    setSelected(prev => prev.filter(p => p.player_id !== playerId));
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Player Search
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
          Search any NBA player · Add up to 2 to compare
        </p>
      </div>

      {/* Search bar with autocomplete */}
      <div ref={wrapRef} style={{ position: 'relative', maxWidth: 440, marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            pointerEvents: 'none', color: 'var(--text-muted)', display: 'flex',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            className="ss-input"
            placeholder="Search player name..."
            value={query}
            onChange={handleQueryChange}
            onFocus={() => suggestions.length > 0 && setDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && suggestions.length > 0) addPlayer(suggestions[0]);
              if (e.key === 'Escape') setDropdownOpen(false);
            }}
            style={{ paddingLeft: 38, width: '100%' }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setSuggestions([]); setDropdownOpen(false); }}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Dropdown */}
        {dropdownOpen && suggestions.length > 0 && (
          <div className="slide-down" style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
            width: '100%', zIndex: 50,
            background: 'var(--bg-card-2)',
            border: '1px solid var(--border-bright)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden', maxHeight: 280, overflowY: 'auto',
          }}>
            {suggestions.map((player, i) => (
              <div
                key={player.player_id}
                onMouseDown={() => addPlayer(player)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {getTeamLogoUrl(player.team) && (
                  <img src={getTeamLogoUrl(player.team)} alt={player.team}
                    width={22} height={22} style={{ objectFit: 'contain', flexShrink: 0 }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}>
                  {player.player_name}
                </span>
                <span style={{
                  marginLeft: 'auto',
                  background: 'var(--bg-hover)', border: '1px solid var(--border-bright)',
                  borderRadius: 6, padding: '2px 7px',
                  fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                  color: 'var(--text-secondary)', flexShrink: 0,
                }}>
                  {player.team}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comparison area */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
          {selected.map(player => (
            <div key={player.player_id} style={{ flex: 1, minWidth: 300 }}>
              <PlayerCard
                player={player}
                season={season}
                onRemove={() => removePlayer(player.player_id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Top-50 table */}
      <div>
        <h3 style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, margin: '0 0 12px',
        }}>
          Top 50 Players
        </h3>
        <PlayerTable season={season} onPlayerClick={addPlayer} />
      </div>
    </div>
  );
}

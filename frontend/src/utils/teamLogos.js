/**
 * NBA team abbreviation → NBA CDN logo URL helper.
 * Uses the official NBA CDN: https://cdn.nba.com/logos/nba/{TEAM_ID}/global/L/logo.svg
 */

const TEAM_IDS = {
  ATL: 1610612737,
  BOS: 1610612738,
  BKN: 1610612751,
  CHA: 1610612766,
  CHI: 1610612741,
  CLE: 1610612739,
  DAL: 1610612742,
  DEN: 1610612743,
  DET: 1610612765,
  GSW: 1610612744,
  HOU: 1610612745,
  IND: 1610612754,
  LAC: 1610612746,
  LAL: 1610612747,
  MEM: 1610612763,
  MIA: 1610612748,
  MIL: 1610612749,
  MIN: 1610612750,
  NOP: 1610612740,
  NYK: 1610612752,
  OKC: 1610612760,
  ORL: 1610612753,
  PHI: 1610612755,
  PHX: 1610612756,
  POR: 1610612757,
  SAC: 1610612758,
  SAS: 1610612759,
  TOR: 1610612761,
  UTA: 1610612762,
  WAS: 1610612764,
};

/**
 * Returns the NBA CDN SVG logo URL for a team abbreviation, or null if unknown.
 * @param {string} abbr  e.g. 'LAL', 'GSW', 'BKN'
 * @returns {string|null}
 */
export function getTeamLogoUrl(abbr) {
  const id = TEAM_IDS[abbr?.toUpperCase()];
  if (!id) return null;
  return `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg`;
}

/**
 * Returns the NBA CDN headshot URL for a player ID.
 * @param {number} playerId  NBA player ID
 * @returns {string}
 */
export function getPlayerHeadshotUrl(playerId) {
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`;
}

/** Primary brand color for each NBA team. */
const TEAM_COLORS = {
  ATL: '#C1D32F', BOS: '#007A33', BKN: '#BBBBBB', CHA: '#1D1160',
  CHI: '#CE1141', CLE: '#860038', DAL: '#00538C', DEN: '#FEC524',
  DET: '#C8102E', GSW: '#1D428A', HOU: '#CE1141', IND: '#FDBB30',
  LAC: '#C8102E', LAL: '#552583', MEM: '#5D76A9', MIA: '#98002E',
  MIL: '#00471B', MIN: '#78BE20', NOP: '#0C2340', NYK: '#F58426',
  OKC: '#007AC1', ORL: '#0077C0', PHI: '#006BB6', PHX: '#E56020',
  POR: '#E03A3E', SAC: '#5A2D81', SAS: '#C4CED4', TOR: '#CE1141',
  UTA: '#002B5C', WAS: '#E31837',
};

/**
 * Returns the primary brand color for a team abbreviation.
 * @param {string} abbr
 * @returns {string}  CSS hex color
 */
export function getTeamColor(abbr) {
  return TEAM_COLORS[abbr?.toUpperCase()] ?? 'var(--accent)';
}

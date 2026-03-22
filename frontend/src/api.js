// frontend/src/api.js

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/** Returns a sorted list of seasons available in the DB, e.g. ["2024-25", "2023-24", …] */
export async function fetchSeasons() {
  const res = await fetch(BASE_URL + '/seasons');
  if (!res.ok) throw new Error('Failed to fetch seasons');
  return res.json();
}

export async function fetchAllPlayers(season = '2024-25') {
  const res = await fetch(`${BASE_URL}/players?season=${season}`);
  if (!res.ok) throw new Error('Failed to fetch players');
  return res.json();
}

export async function fetchTopScorers(limit = 10, season = '2024-25') {
  const res = await fetch(
    `${BASE_URL}/players/top/scorers?limit=${limit}&season=${season}`
  );
  if (!res.ok) throw new Error('Failed to fetch scorers');
  return res.json();
}

export async function fetchPlayersByTeam(team, season = '2024-25') {
  const res = await fetch(
    `${BASE_URL}/players/team/${team}?season=${season}`
  );
  if (!res.ok) throw new Error('Team not found');
  return res.json();
}

export async function fetchTeams(season = '2024-25') {
  const res = await fetch(`${BASE_URL}/teams?season=${season}`);
  if (!res.ok) throw new Error('Failed to fetch teams');
  return res.json();
}

export async function searchPlayers(q, season = '2024-25') {
  const res = await fetch(`${BASE_URL}/players/search?q=${encodeURIComponent(q)}&season=${season}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function fetchPlayerGameLog(playerId, season = '2024-25') {
  const res = await fetch(`${BASE_URL}/players/${playerId}/gamelog?season=${season}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchTeamComparison(team1, team2, home, season = '2024-25') {
  const res = await fetch(
    `${BASE_URL}/teams/compare?team1=${team1}&team2=${team2}&home=${home}&season=${season}`
  );
  if (!res.ok) throw new Error('Failed to compare teams');
  return res.json();
}

export async function fetchPlayoffSimulation(season = '2024-25', nSims = 5000) {
  const res = await fetch(`${BASE_URL}/playoff/simulate?season=${season}&n_sims=${nSims}`);
  if (!res.ok) throw new Error('Simulation failed');
  return res.json();
}

export async function fetchTeamDashboard(team, season = '2024-25') {
  const res = await fetch(
    `${BASE_URL}/teams/${team}/dashboard?season=${season}`
  );
  if (!res.ok) throw new Error('Team dashboard failed');
  return res.json();
}

export async function fetchTeamSchedule(team, season = '2024-25') {
  const res = await fetch(`${BASE_URL}/teams/${team}/schedule?season=${season}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getLiveGamesWithProbabilities() {
  const res = await fetch(`${BASE_URL}/games/live/probabilities`);
  if (!res.ok) throw new Error('Failed to fetch live probabilities');
  return res.json();
}

export async function getUpcomingGames() {
  const res = await fetch(`${BASE_URL}/games/upcoming`);
  if (!res.ok) throw new Error('Failed to fetch upcoming games');
  return res.json();
}

export async function getTeamLineups(teamAbbr, { season = '2025-26', minMinutes = 20, limit = 20, sortBy = 'net_rating' } = {}) {
  const params = new URLSearchParams({ season, min_minutes: minMinutes, limit, sort_by: sortBy });
  const res = await fetch(`${BASE_URL}/teams/${teamAbbr}/lineups?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch lineups for ${teamAbbr}`);
  return res.json();
}

// ── Account API ────────────────────────────────────────────────────────────

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function getAccountProfile(token) {
  const resp = await fetch(`${BASE_URL}/account/me`, { headers: authHeaders(token) });
  if (!resp.ok) throw new Error('Failed to fetch profile');
  return resp.json();
}

export async function updateFavoriteTeam(token, favoriteTeamAbbr) {
  const resp = await fetch(`${BASE_URL}/account/favorite-team`, {
    method:  'PATCH',
    headers: authHeaders(token),
    body:    JSON.stringify({ favorite_team_abbr: favoriteTeamAbbr }),
  });
  if (!resp.ok) throw new Error('Failed to update favorite team');
  return resp.json();
}

export async function getAccountSettings(token) {
  const resp = await fetch(`${BASE_URL}/account/settings`, { headers: authHeaders(token) });
  if (!resp.ok) throw new Error('Failed to fetch settings');
  return resp.json();
}

export async function updateAccountSettings(token, payload) {
  const resp = await fetch(`${BASE_URL}/account/settings`, {
    method:  'PATCH',
    headers: authHeaders(token),
    body:    JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error('Failed to update settings');
  return resp.json();
}

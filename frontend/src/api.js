// frontend/src/api.js

const BASE_URL = 'http://localhost:8000';

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

export async function fetchTeamComparison(team1, team2, home, season = '2024-25') {
  const res = await fetch(
    `${BASE_URL}/teams/compare?team1=${team1}&team2=${team2}&home=${home}&season=${season}`
  );
  if (!res.ok) throw new Error('Failed to compare teams');
  return res.json();
}

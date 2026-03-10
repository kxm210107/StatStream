import { Users } from 'lucide-react';

export default function MyTeamCard({ teamAbbr, onOpenMyTeam }) {
  if (!teamAbbr) {
    return (
      <div className="my-team-card my-team-card--empty">
        <Users size={20} />
        <p>No favorite team set. Pick one below.</p>
      </div>
    );
  }

  return (
    <div className="my-team-card">
      <div className="my-team-card__info">
        <Users size={20} />
        <span className="my-team-card__abbr">{teamAbbr}</span>
        <span>is your favorite team</span>
      </div>
      <button className="my-team-card__btn" onClick={() => onOpenMyTeam(teamAbbr)}>
        Open My Team →
      </button>
    </div>
  );
}

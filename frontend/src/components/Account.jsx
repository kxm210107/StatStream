import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAccountProfile, updateFavoriteTeam, getAccountSettings } from '../api';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import AccountSettings from './AccountSettings';
import MyTeamCard from './MyTeamCard';

// Simple team list for the favorite team picker
const NBA_TEAMS = [
  'ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GSW',
  'HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NOP','NYK',
  'OKC','ORL','PHI','PHX','POR','SAC','SAS','TOR','UTA','WAS',
];

export default function Account({ onOpenMyTeam, onFavoriteTeamChanged }) {
  const { isLoading, isLoggedIn, user, logout, getAccessToken } = useAuth();
  const [showSignup,     setShowSignup    ] = useState(false);
  const [profile,        setProfile       ] = useState(null);
  const [settings,       setSettings      ] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError,   setProfileError  ] = useState(null);
  const [teamMsg,        setTeamMsg       ] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setProfile(null);
      setSettings(null);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    const token = getAccessToken();
    Promise.all([getAccountProfile(token), getAccountSettings(token)])
      .then(([p, s]) => { setProfile(p); setSettings(s); })
      .catch(() => setProfileError('Failed to load account data. Please try refreshing.'))
      .finally(() => setProfileLoading(false));
  }, [isLoggedIn]);

  async function handleSetFavoriteTeam(abbr) {
    setTeamMsg(null);
    try {
      const token = getAccessToken();
      const result = await updateFavoriteTeam(token, abbr || null);
      setProfile(prev => ({ ...prev, favorite_team_abbr: result.favorite_team_abbr }));
      onFavoriteTeamChanged?.(result.favorite_team_abbr ?? null);
      setTeamMsg({ type: 'success', text: `${result.favorite_team_abbr ?? 'None'} saved.` });
    } catch {
      setTeamMsg({ type: 'error', text: 'Failed to save team.' });
    }
  }

  if (isLoading) {
    return <div className="account-page"><p className="account-page__loading">Loading…</p></div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="account-page account-page--guest">
        <div className="account-page__guest-header">
          <h2>My Account</h2>
          <p className="account-page__guest-blurb">
            Create an account to save your favorite team, personalize the dashboard, and more.
          </p>
        </div>
        {showSignup
          ? <SignupForm onToggleLogin={() => setShowSignup(false)} />
          : <LoginForm  onToggleSignup={() => setShowSignup(true)} />
        }
      </div>
    );
  }

  if (profileLoading) {
    return <div className="account-page"><p className="account-page__loading">Loading account…</p></div>;
  }

  if (profileError) {
    return (
      <div className="account-page">
        <p className="auth-form__error">{profileError}</p>
        <button className="auth-form__submit" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const isValidTeam = !profile?.favorite_team_abbr || NBA_TEAMS.includes(profile.favorite_team_abbr);

  return (
    <div className="account-page">
      <div className="account-page__header">
        <h2>My Account</h2>
        <p className="account-page__email">{user?.email}</p>
      </div>

      <section className="account-page__section">
        <h3>My Team</h3>
        <MyTeamCard
          teamAbbr={profile?.favorite_team_abbr}
          onOpenMyTeam={onOpenMyTeam}
        />
      </section>

      <section className="account-page__section">
        <h3>Favorite Team</h3>
        {!isValidTeam && (
          <p className="auth-form__error">
            Your saved team ({profile.favorite_team_abbr}) is no longer valid. Please select a new one.
          </p>
        )}
        <div className="account-page__team-picker">
          <select
            value={profile?.favorite_team_abbr ?? ''}
            onChange={e => handleSetFavoriteTeam(e.target.value)}
            className="account-page__team-select"
          >
            <option value="">— None —</option>
            {NBA_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {teamMsg && (
          <p className={teamMsg.type === 'error' ? 'auth-form__error' : 'account-settings__success'}>
            {teamMsg.text}
          </p>
        )}
      </section>

      <section className="account-page__section">
        <h3>Settings</h3>
        <AccountSettings settings={settings} onSettingsUpdated={() => {}} />
      </section>

      <section className="account-page__section">
        <button className="account-page__logout" onClick={logout}>Sign out</button>
      </section>
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateAccountSettings } from '../api';

export default function AccountSettings({ settings, onSettingsUpdated }) {
  const { changeEmail, changePassword, getAccessToken } = useAuth();

  const [newEmail,    setNewEmail   ] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw,   setConfirmPw  ] = useState('');
  const [defaultSeason, setDefaultSeason] = useState(settings?.default_season ?? '');

  const [emailMsg,    setEmailMsg   ] = useState(null);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [settingsMsg, setSettingsMsg] = useState(null);

  async function handleChangeEmail(e) {
    e.preventDefault();
    setEmailMsg(null);
    try {
      await changeEmail(newEmail);
      setEmailMsg({ type: 'success', text: 'Email update initiated — check your inbox to confirm.' });
      setNewEmail('');
    } catch (err) {
      setEmailMsg({ type: 'error', text: err.message });
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmPw) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    try {
      await changePassword(newPassword);
      setPasswordMsg({ type: 'success', text: 'Password updated.' });
      setNewPassword('');
      setConfirmPw('');
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message });
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSettingsMsg(null);
    try {
      const token = getAccessToken();
      await updateAccountSettings(token, { default_season: defaultSeason || null });
      setSettingsMsg({ type: 'success', text: 'Settings saved.' });
      onSettingsUpdated?.();
    } catch (err) {
      setSettingsMsg({ type: 'error', text: err.message });
    }
  }

  return (
    <div className="account-settings">
      <section className="account-settings__section">
        <h3>Preferences</h3>
        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="auth-form__field">
            <label>Default season</label>
            <input value={defaultSeason} onChange={e => setDefaultSeason(e.target.value)} placeholder="e.g. 2025-26" />
          </div>
          <button type="submit" className="auth-form__submit" style={{ maxWidth: 160 }}>Save</button>
          {settingsMsg && <p className={settingsMsg.type === 'error' ? 'auth-form__error' : 'account-settings__success'}>{settingsMsg.text}</p>}
        </form>
      </section>

      <section className="account-settings__section">
        <h3>Change email</h3>
        <form onSubmit={handleChangeEmail} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="auth-form__field">
            <label>New email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
          </div>
          <button type="submit" className="auth-form__submit" style={{ maxWidth: 160 }}>Update email</button>
          {emailMsg && <p className={emailMsg.type === 'error' ? 'auth-form__error' : 'account-settings__success'}>{emailMsg.text}</p>}
        </form>
      </section>

      <section className="account-settings__section">
        <h3>Change password</h3>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="auth-form__field">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" />
          </div>
          <div className="auth-form__field">
            <label>Confirm new password</label>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required autoComplete="new-password" />
          </div>
          <button type="submit" className="auth-form__submit" style={{ maxWidth: 180 }}>Update password</button>
          {passwordMsg && <p className={passwordMsg.type === 'error' ? 'auth-form__error' : 'account-settings__success'}>{passwordMsg.text}</p>}
        </form>
      </section>
    </div>
  );
}

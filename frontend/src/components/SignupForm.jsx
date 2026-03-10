import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function SignupForm({ onToggleLogin }) {
  const { signup } = useAuth();
  const [email,    setEmail   ] = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm ] = useState('');
  const [error,    setError   ] = useState(null);
  const [loading,  setLoading ] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await signup(email, password);
    } catch (err) {
      setError(err.message ?? 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2 className="auth-form__title">Create account</h2>
      {error && <p className="auth-form__error">{error}</p>}
      <div className="auth-form__field">
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className="auth-form__field">
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>
      <div className="auth-form__field">
        <label>Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>
      <button type="submit" className="auth-form__submit" disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>
      {onToggleLogin && (
        <p className="auth-form__toggle">
          Already have an account?{' '}
          <button type="button" className="auth-form__link" onClick={onToggleLogin}>
            Sign in
          </button>
        </p>
      )}
    </form>
  );
}

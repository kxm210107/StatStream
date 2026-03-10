import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginForm({ onToggleSignup }) {
  const { login } = useAuth();
  const [email,    setEmail   ] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError   ] = useState(null);
  const [loading,  setLoading ] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2 className="auth-form__title">Sign in</h2>
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
          autoComplete="current-password"
        />
      </div>
      <button type="submit" className="auth-form__submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      {onToggleSignup && (
        <p className="auth-form__toggle">
          No account?{' '}
          <button type="button" className="auth-form__link" onClick={onToggleSignup}>
            Sign up
          </button>
        </p>
      )}
    </form>
  );
}

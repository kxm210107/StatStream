import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import { Lock } from 'lucide-react';

export default function AuthGate({ children }) {
  const { isLoggedIn, isLoading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  if (isLoading) return null;

  if (isLoggedIn) return children;

  return (
    <div className="auth-gate">
      <div className="auth-gate__card">
        <div className="auth-gate__icon"><Lock size={28} /></div>
        <h2 className="auth-gate__title">Sign in to access this feature</h2>
        <p className="auth-gate__blurb">
          This tab is available to registered users. Create a free account to unlock it.
        </p>
        {showSignup
          ? <SignupForm onToggleLogin={() => setShowSignup(false)} />
          : <LoginForm  onToggleSignup={() => setShowSignup(true)} />
        }
      </div>
    </div>
  );
}

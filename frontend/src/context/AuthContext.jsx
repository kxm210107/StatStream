import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getAccountProfile } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]         = useState(undefined); // undefined = loading
  const [user,    setUser   ]         = useState(null);
  const [favoriteTeam, setFavoriteTeam] = useState(null);

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      if (data.session?.access_token) {
        getAccountProfile(data.session.access_token)
          .then(p => setFavoriteTeam(p.favorite_team_abbr ?? null))
          .catch(() => {});
      }
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_OUT' || !newSession) {
        setFavoriteTeam(null);
        return;
      }

      if (newSession?.access_token) {
        getAccountProfile(newSession.access_token)
          .then(p => setFavoriteTeam(p.favorite_team_abbr ?? null))
          .catch(() => setFavoriteTeam(null));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signup(email, password) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async function login(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function changeEmail(newEmail) {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
  }

  async function changePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  function getAccessToken() {
    return session?.access_token ?? null;
  }

  const value = {
    session,
    user,
    isLoading:  session === undefined,
    isLoggedIn: !!user,
    signup,
    login,
    logout,
    changeEmail,
    changePassword,
    getAccessToken,
    favoriteTeam,
    setFavoriteTeam,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

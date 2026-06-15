import { createContext, useContext, useEffect, useState } from 'react';
import { getMe } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('selp_token');
    if (!token) { setLoading(false); return; }
    getMe()
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem('selp_token'))
      .finally(() => setLoading(false));
  }, []);

  function signIn(token, userData) {
    localStorage.setItem('selp_token', token);
    setUser(userData);
  }

  function signOut() {
    localStorage.removeItem('selp_token');
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

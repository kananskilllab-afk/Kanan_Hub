import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kh_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem('kh_token'))
      .finally(() => setLoading(false));
  }, []);

  // Role/moduleAccess can be changed by an admin while this session is already open (e.g. Tech
  // Admin editing someone's module mapping) — refresh periodically and whenever the tab regains
  // focus, so those changes take effect without forcing a logout/login.
  useEffect(() => {
    if (!localStorage.getItem('kh_token')) return;
    function refresh() {
      if (!localStorage.getItem('kh_token')) return;
      api.get('/auth/me').then((res) => setUser(res.data.user)).catch(() => {});
    }
    function onVisible() {
      if (!document.hidden) refresh();
    }
    const id = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.id]);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('kh_token', res.data.token);
    setUser(res.data.user);
  }

  function logout() {
    localStorage.removeItem('kh_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

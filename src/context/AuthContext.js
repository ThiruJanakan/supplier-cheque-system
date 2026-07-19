"use client";
import { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken, clearToken, getToken } from '@/api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }

    const raw = localStorage.getItem('chq_user');
    if (raw) {
      setUser(JSON.parse(raw));
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const { token, user } = await api.post('/auth/login', { username, password });
    setToken(token);
    localStorage.setItem('chq_user', JSON.stringify(user));
    setUser(user);
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem('chq_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthed: !!user && !!getToken(), loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

import { createContext, useContext, useState } from 'react';
import { api, setToken, clearToken, getToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('chq_user');
    return raw ? JSON.parse(raw) : null;
  });

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
    <AuthContext.Provider value={{ user, isAuthed: !!user && !!getToken(), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);

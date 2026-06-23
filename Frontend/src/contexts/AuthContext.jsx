import { createContext, useContext, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

function getStoredUser() {
  const stored = localStorage.getItem('smarthr_user');
  if (!stored) return null;

  try {
    const user = JSON.parse(stored);
    if (!user || typeof user !== 'object') throw new Error('Session invalide');
    return user;
  } catch {
    localStorage.removeItem('smarthr_token');
    localStorage.removeItem('smarthr_user');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('smarthr_token', data.access_token);
    localStorage.setItem('smarthr_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('smarthr_token');
    localStorage.removeItem('smarthr_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      // Restore from cache immediately so the UI isn't blank
      const cached = JSON.parse(savedUser);
      setUser(cached);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Then fetch fresh profile from DB to pick up any name/avatar changes
      api.get('/users/me')
        .then(res => {
          const fresh = res.data;
          setUser(fresh);
          localStorage.setItem('user', JSON.stringify(fresh));
        })
        .catch(() => {
          // Token may be expired — leave cached user in place; protected routes
          // will redirect to login if the token is truly invalid
        });
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user: userData, requiresTwoFA, tempToken } = response.data;

    // 2FA required — return the flag so LoginPage can show the code step
    if (requiresTwoFA) {
      return { requiresTwoFA: true, tempToken };
    }

    // Normal login — store token and user
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    return userData;
  };

  // Called after successful TOTP verification (step 2)
  const finaliseLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  };

  const logout = async () => {
    try {
      // Tell the server to clear the session token (invalidates the JWT server-side)
      await api.post('/auth/logout');
    } catch {
      // Ignore errors — we clear client state regardless
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  // Update local user state + localStorage after profile edits
  const updateUser = (updatedFields) => {
    const merged = { ...user, ...updatedFields };
    setUser(merged);
    localStorage.setItem('user', JSON.stringify(merged));
  };

  return (
    <AuthContext.Provider value={{
      user, login, logout, loading, updateUser, finaliseLogin,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

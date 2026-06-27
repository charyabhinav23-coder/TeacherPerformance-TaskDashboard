import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, getBaseURL } from '../services/api';
import { mockAccounts } from '../data/mockData';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('activeRole'));
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Automatic online/offline status detection
  useEffect(() => {
    const checkHealth = async () => {
      if (!navigator.onLine) {
        setIsOffline(true);
        return;
      }
      try {
        const baseUrl = getBaseURL();
        const response = await fetch(`${baseUrl}/health`, { method: 'GET' });
        if (response.ok) {
          setIsOffline(false);
        } else {
          setIsOffline(true);
        }
      } catch (err) {
        setIsOffline(true);
      }
    };

    const handleOnline = () => checkHealth();
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkHealth();

    // Periodic check every 15 seconds
    const interval = setInterval(checkHealth, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Initialize auth state from local storage and verify with API
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('activeUser');
      const storedRole = localStorage.getItem('activeRole');

      if (storedToken) {
        try {
          // Attempt to sync profile from backend
          const res = await authAPI.getMe();
          if (res.data && res.data.success) {
            const apiUser = res.data.data.user;
            setUser(apiUser);
            setRole(apiUser.role.toLowerCase());
            setIsOffline(false);
            localStorage.setItem('activeUser', JSON.stringify(apiUser));
            localStorage.setItem('activeRole', apiUser.role.toLowerCase());
          }
        } catch (error) {
          console.warn('API getMe failed.', error);
          if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            // Invalid or expired token - do not fallback
            localStorage.removeItem('token');
            localStorage.removeItem('activeUser');
            localStorage.removeItem('activeRole');
            setUser(null);
            setRole(null);
            setToken(null);
          } else {
            console.warn('Falling back to stored localStorage credentials.');
            setIsOffline(true);
            if (storedUser) {
              try {
                setUser(JSON.parse(storedUser));
              } catch (e) {
                setUser(null);
              }
            }
            if (storedRole) {
              setRole(storedRole);
            }
          }
        }
      } else {
        // No token, check if we have mock user session
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (e) {}
        }
        if (storedRole) {
          setRole(storedRole);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      // 1. Try Backend API first
      const response = await authAPI.login(email, password);
      if (response.data && response.data.success) {
        const { token: apiToken, user: apiUser } = response.data.data;
        const normalizedRole = apiUser.role.toLowerCase();

        localStorage.setItem('token', apiToken);
        localStorage.setItem('activeUser', JSON.stringify(apiUser));
        localStorage.setItem('activeRole', normalizedRole);

        setToken(apiToken);
        setUser(apiUser);
        setRole(normalizedRole);
        setIsOffline(false);
        setLoading(false);
        return { success: true, role: normalizedRole, name: apiUser.name };
      }
    } catch (apiError) {
      if (apiError.response && apiError.response.data && apiError.response.data.message) {
        setLoading(false);
        setIsOffline(false);
        throw new Error(apiError.response.data.message);
      }
      
      console.warn('Backend login failed or unavailable. Trying mock data fallback...', apiError.message);
      setIsOffline(true);

      // 2. Fallback to Mock Data
      const match = mockAccounts.find(
        (acc) => acc.email.toLowerCase() === email.trim().toLowerCase() && acc.password === password
      );

      if (match) {
        const mockUser = {
          id: match.id || 'mock-id',
          name: match.name,
          email: match.email,
          role: match.role.toUpperCase(),
          phone: '+91 99999 99999',
        };
        const mockRole = match.role.toLowerCase();
        const fakeToken = 'mock-jwt-token-12345';

        localStorage.setItem('token', fakeToken);
        localStorage.setItem('activeUser', JSON.stringify(mockUser));
        localStorage.setItem('activeRole', mockRole);

        setToken(fakeToken);
        setUser(mockUser);
        setRole(mockRole);
        setLoading(false);
        return { success: true, role: mockRole, name: match.name, isMock: true };
      } else {
        setLoading(false);
        throw new Error('Invalid email or password');
      }
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeUser');
    localStorage.removeItem('activeRole');
    // Also clear other transient states if any
    localStorage.removeItem('localNotifications');

    setToken(null);
    setUser(null);
    setRole(null);
    setIsOffline(false);
  }, []);

  const updateProfile = async (name, phone) => {
    try {
      const res = await authAPI.updateProfile({ name, phone });
      if (res.data && res.data.success) {
        const updatedUser = res.data.data.user;
        setUser(updatedUser);
        localStorage.setItem('activeUser', JSON.stringify(updatedUser));
        return { success: true, user: updatedUser };
      }
    } catch (apiError) {
      console.warn('Backend profile update failed or offline. Updating locally...', apiError.message);
      
      const storedUser = localStorage.getItem('activeUser');
      let localUser = { name, phone };
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          localUser = { ...parsed, name, phone };
        } catch (e) {}
      }
      
      setUser(localUser);
      localStorage.setItem('activeUser', JSON.stringify(localUser));
      return { success: true, user: localUser, isMock: true };
    }
  };

  const value = {
    user,
    token,
    role,
    loading,
    isAuthenticated: !!token,
    login,
    logout,
    isOffline,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface User {
  id: string;
  nickname: string;
  avatar_color: string;
  status: 'online' | 'away' | 'offline';
  created_at: string;
  last_activity: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  updateStatus: (status: User['status']) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (nickname: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });
      
      if (!response.ok) throw new Error('Login failed');
      
      const userData = await response.json();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('userId', userData.id);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
  }, []);

  const updateStatus = useCallback(async (status: User['status']) => {
    if (!user) return;
    try {
      const response = await fetch('/api/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, status }),
      });
      
      if (!response.ok) throw new Error('Status update failed');
      const updatedUser = await response.json();
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, updateStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DEMO_JWT } from './constants';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  port?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  /** Returns current JWT token for API calls */
  getToken: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('ocean_ai_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('ocean_ai_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, _password?: string) => {
    setIsLoading(true);
    // Simulate Cognito authentication
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const mockUser: User = {
      id: 'usr_demo_001',
      name: 'Ram Mohan',
      email: email,
      role: 'Premium Fisher',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fisherman&backgroundColor=b6e3f4',
      port: 'Ratnagiri Port, Maharashtra',
    };

    setUser(mockUser);
    localStorage.setItem('ocean_ai_user', JSON.stringify(mockUser));
    // Store JWT for API client (demo token for now; replace with real Cognito token)
    localStorage.setItem('ocean_ai_token', DEMO_JWT);
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ocean_ai_user');
    localStorage.removeItem('ocean_ai_token');
  };

  const getToken = (): string => {
    if (typeof window === 'undefined') return DEMO_JWT;
    return localStorage.getItem('ocean_ai_token') || DEMO_JWT;
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout, getToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

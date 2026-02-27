/**
 * Auth context — stub Cognito behaviour using AsyncStorage.
 * Swap out `mockLogin` / `mockRegister` for real Cognito SDK calls when backend is ready.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEMO_JWT } from './constants';

const TOKEN_KEY = 'ocean_ai_token';
const USER_KEY = 'ocean_ai_user';

export interface User {
    userId: string;
    name: string;
    email: string;
    phone?: string;
    location?: string;
    role: 'fisherman' | 'admin';
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string, phone: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEMO_USER: User = {
    userId: 'usr_demo_001',
    name: 'Rajan Fisherman',
    email: 'rajan@example.com',
    phone: '+91 98765 43210',
    location: 'Sassoon Dock, Mumbai',
    role: 'fisherman',
};

function delay(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Restore session on mount
        (async () => {
            try {
                const [storedToken, storedUser] = await Promise.all([
                    AsyncStorage.getItem(TOKEN_KEY),
                    AsyncStorage.getItem(USER_KEY),
                ]);
                if (storedToken && storedUser) {
                    setToken(storedToken);
                    setUser(JSON.parse(storedUser));
                }
            } catch (_) {
                // ignore
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const login = async (email: string, _password: string) => {
        await delay(1000); // Simulate Cognito round-trip
        const loggedInUser: User = { ...DEMO_USER, email };
        await AsyncStorage.setItem(TOKEN_KEY, DEMO_JWT);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
        setToken(DEMO_JWT);
        setUser(loggedInUser);
    };

    const register = async (name: string, email: string, _password: string, phone: string) => {
        await delay(1200);
        const newUser: User = {
            userId: `usr_${Date.now()}`,
            name,
            email,
            phone,
            location: 'India',
            role: 'fisherman',
        };
        await AsyncStorage.setItem(TOKEN_KEY, DEMO_JWT);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser));
        setToken(DEMO_JWT);
        setUser(newUser);
    };

    const logout = async () => {
        await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

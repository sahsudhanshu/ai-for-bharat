/**
 * Auth context — stub Cognito behaviour using AsyncStorage.
 * Swap out `mockLogin` / `mockRegister` for real Cognito SDK calls when backend is ready.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthenticationDetails, CognitoUser, CognitoUserAttribute, CognitoUserPool } from 'amazon-cognito-identity-js';

const TOKEN_KEY = 'ocean_ai_token';
const USER_KEY = 'ocean_ai_user';

const poolData = {
    UserPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || '',
    ClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID || ''
};
const userPool = new CognitoUserPool(poolData);

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

    const login = async (email: string, password: string) => {
        return new Promise<void>((resolve, reject) => {
            const authenticationDetails = new AuthenticationDetails({
                Username: email,
                Password: password,
            });

            const cognitoUser = new CognitoUser({
                Username: email,
                Pool: userPool,
            });

            cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: async (result) => {
                    const jwtToken = result.getIdToken().getJwtToken();
                    const loggedInUser: User = {
                        userId: result.getIdToken().payload.sub as string,
                        name: result.getIdToken().payload.name || 'User',
                        email: email,
                        role: 'fisherman'
                    };
                    await AsyncStorage.setItem(TOKEN_KEY, jwtToken);
                    await AsyncStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));
                    setToken(jwtToken);
                    setUser(loggedInUser);
                    resolve();
                },
                onFailure: (err) => {
                    reject(err);
                },
            });
        });
    };

    const register = async (name: string, email: string, password: string, phone: string) => {
        return new Promise<void>((resolve, reject) => {
            const attributeList = [
                new CognitoUserAttribute({ Name: 'name', Value: name }),
                new CognitoUserAttribute({ Name: 'phone_number', Value: phone || '' })
            ];

            userPool.signUp(email, password, attributeList, [], async (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Usually user needs to verify email before login, but for the hackathon we can try to auto-login
                // If your Cognito pool auto-verifies, logging in immediately might work.
                // Otherwise they must verify their email. For now we will just log the user in locally to mock the successful signup.
                if (result) {
                    const newUser: User = {
                        userId: result.userSub,
                        name,
                        email,
                        phone,
                        location: 'India',
                        role: 'fisherman',
                    };
                    // Since they might need to log in to get a real token, we just resolve so the UI knows signup worked.
                    resolve();
                }
            });
        });
    };

    const logout = async () => {
        const cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
            cognitoUser.signOut();
        }
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

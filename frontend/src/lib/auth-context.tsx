"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthenticationDetails, CognitoUser, CognitoUserAttribute, CognitoUserPool, CognitoUserSession } from 'amazon-cognito-identity-js';

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

const poolData = {
  UserPoolId: userPoolId,
  ClientId: clientId,
};
const userPool = new CognitoUserPool(poolData);

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
  register: (name: string, email: string, password: string, phone: string) => Promise<void>;
  logout: () => void;
  /** Returns current JWT token for API calls */
  getToken: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isCognitoConfigured = Boolean(userPoolId && clientId);

function toUserFromSession(session: CognitoUserSession, fallbackEmail: string): User {
  const payload = session.getIdToken().payload;
  return {
    id: (payload.sub as string) || fallbackEmail,
    name: (payload.name as string) || 'User',
    email: (payload.email as string) || fallbackEmail,
    role: 'fisherman',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fisherman&backgroundColor=b6e3f4',
    port: 'India',
  };
}

function persistUserSession(nextUser: User, token: string): void {
  localStorage.setItem('ocean_ai_user', JSON.stringify(nextUser));
  localStorage.setItem('ocean_ai_token', token);
}

function mapCognitoError(err: unknown): Error {
  const maybeError = err as { code?: string; message?: string };
  const code = maybeError?.code;

  if (code === 'NotAuthorizedException') {
    return new Error('Incorrect email or password.');
  }
  if (code === 'UserNotFoundException') {
    return new Error('No account found for this email.');
  }
  if (code === 'UsernameExistsException') {
    return new Error('An account with this email already exists. Please sign in.');
  }
  if (code === 'InvalidPasswordException') {
    return new Error('Password does not meet Cognito policy requirements.');
  }
  if (code === 'UserNotConfirmedException') {
    return new Error('Account is not confirmed yet.');
  }
  if (code === 'PasswordResetRequiredException') {
    return new Error('Password reset required. Please reset your password and try again.');
  }
  if (code === 'InvalidParameterException' && maybeError?.message?.includes('SECRET_HASH')) {
    return new Error('Cognito app client is misconfigured: use a public client with no client secret.');
  }

  return new Error(maybeError?.message || 'Authentication failed. Please try again.');
}

function assertCognitoConfigured(): void {
  if (!isCognitoConfigured) {
    throw new Error('Cognito env is missing. Set NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID in frontend/.env.local.');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isCognitoConfigured) {
      setIsLoading(false);
      return;
    }

    // Check if there is an active session
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          logout();
          setIsLoading(false);
          return;
        }

        const loggedInUser = toUserFromSession(session, cognitoUser.getUsername());
        setUser(loggedInUser);
        persistUserSession(loggedInUser, session.getAccessToken().getJwtToken());
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);

    return new Promise<void>((resolve, reject) => {
      try {
        assertCognitoConfigured();
      } catch (err) {
        setIsLoading(false);
        reject(err);
        return;
      }

      if (!password) {
        setIsLoading(false);
        reject(new Error("Password is required for login."));
        return;
      }

      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          const apiToken = result.getAccessToken().getJwtToken();
          const loggedInUser = toUserFromSession(result, email);

          setUser(loggedInUser);
          persistUserSession(loggedInUser, apiToken);
          setIsLoading(false);
          resolve();
        },
        onFailure: (err) => {
          setIsLoading(false);
          reject(mapCognitoError(err));
        },
      });
    });
  };

  const register = async (name: string, email: string, password: string, phone: string) => {
    return new Promise<void>((resolve, reject) => {
      try {
        assertCognitoConfigured();
      } catch (err) {
        reject(err);
        return;
      }

      const attributeList = [
        new CognitoUserAttribute({ Name: 'name', Value: name }),
        ...(phone && phone.trim() !== '' ? [new CognitoUserAttribute({ Name: 'phone_number', Value: phone })] : [])
      ];

      userPool.signUp(email, password, attributeList, [], (err) => {
        if (err) {
          reject(mapCognitoError(err));
          return;
        }
        resolve();
      });
    });
  };

  const logout = () => {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    setUser(null);
    localStorage.removeItem('ocean_ai_user');
    localStorage.removeItem('ocean_ai_token');
  };

  const getToken = (): string => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('ocean_ai_token') || '';
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, register, logout, getToken }}
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

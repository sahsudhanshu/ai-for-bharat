/**
 * Mock Network Context - Use this temporarily if you can't rebuild the app
 * 
 * To use this mock:
 * 1. In app/_layout.tsx, change:
 *    import { NetworkProvider } from '../lib/network-context';
 *    to:
 *    import { NetworkProvider } from '../lib/network-context-mock';
 * 
 * 2. The app will work but always assume online mode with excellent connection
 * 
 * 3. Remember to rebuild the app later to get real network detection:
 *    npx expo run:android
 */
import React, { createContext, useContext, ReactNode } from 'react';

interface NetworkContextType {
    isOnline: boolean;
    isChecking: boolean;
    connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
    effectiveMode: 'online' | 'offline';
}

const NetworkContext = createContext<NetworkContextType>({
    isOnline: true,
    isChecking: false,
    connectionQuality: 'excellent',
    effectiveMode: 'online',
});

export function NetworkProvider({ children }: { children: ReactNode }) {
    // Mock: Always return online with excellent quality
    // This allows the app to run without the native netinfo module
    return (
        <NetworkContext.Provider value={{
            isOnline: true,
            isChecking: false,
            connectionQuality: 'excellent',
            effectiveMode: 'online',
        }}>
            {children}
        </NetworkContext.Provider>
    );
}

export function useNetwork() {
    return useContext(NetworkContext);
}

/**
 * Mock connection speed test - always returns true
 */
export async function testConnectionSpeed(apiUrl: string): Promise<boolean> {
    return true;
}

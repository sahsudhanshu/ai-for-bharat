import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { COLORS } from '../lib/constants';

function RootLayoutNav() {
    const { user, isLoading } = useAuth();

    useEffect(() => {
        if (isLoading) return;
        if (user) {
            router.replace('/(tabs)');
        } else {
            router.replace('/auth/login');
        }
    }, [user, isLoading]);

    if (isLoading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="auth/register" />
        </Stack>
    );
}

import { ThemeProvider, DarkTheme } from '@react-navigation/native';

const customDarkTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: COLORS.bgDark,
        card: COLORS.bgCard,
        text: COLORS.textPrimary,
        border: COLORS.border,
        primary: COLORS.primary,
    },
};

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={styles.root}>
            <ThemeProvider value={customDarkTheme}>
                <SafeAreaProvider>
                    <AuthProvider>
                        <StatusBar style="light" backgroundColor={COLORS.bgDark} />
                        <RootLayoutNav />
                    </AuthProvider>
                </SafeAreaProvider>
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: COLORS.bgDark },
    loading: {
        flex: 1,
        backgroundColor: COLORS.bgDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth-context';
import { COLORS, FONTS, SPACING, RADIUS } from '../../lib/constants';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function LoginScreen() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Missing Fields', 'Please enter your email and password.');
            return;
        }
        setLoading(true);
        try {
            await login(email.trim(), password);
            router.replace('/(tabs)');
        } catch (e: any) {
            Alert.alert('Login Failed', e.message || 'Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = async () => {
        setLoading(true);
        try {
            await login('rajan@example.com', 'demo123');
            router.replace('/(tabs)');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Hero */}
                    <View style={styles.hero}>
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoEmoji}>🐟</Text>
                        </View>
                        <Text style={styles.appName}>OceanAI</Text>
                        <Text style={styles.tagline}>AI for Bharat Fishermen</Text>
                        <View style={styles.heroBadge}>
                            <Text style={styles.heroBadgeText}>🏆 AWS AI for Bharat Challenge</Text>
                        </View>
                    </View>

                    {/* Card */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Welcome Back</Text>
                        <Text style={styles.cardSubtitle}>Sign in to continue to your dashboard</Text>

                        <View style={styles.formGroup}>
                            <Input
                                label="Email Address"
                                placeholder="rajan@example.com"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Input
                                label="Password"
                                placeholder="Enter your password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <Button
                            label={loading ? 'Signing in...' : 'Sign In'}
                            onPress={handleLogin}
                            loading={loading}
                            fullWidth
                            size="lg"
                            style={styles.loginBtn}
                        />

                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.demoBtn}
                            onPress={handleDemoLogin}
                            disabled={loading}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.demoBtnLabel}>⚡ Continue with Demo Account</Text>
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/auth/register')}>
                                <Text style={styles.footerLink}>Register</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Feature highlights */}
                    <View style={styles.features}>
                        {[
                            { emoji: '🐟', label: 'AI Fish ID' },
                            { emoji: '🗺️', label: 'Ocean Map' },
                            { emoji: '💬', label: 'AI Assistant' },
                            { emoji: '📊', label: 'Analytics' },
                        ].map((f) => (
                            <View key={f.label} style={styles.featureItem}>
                                <Text style={styles.featureEmoji}>{f.emoji}</Text>
                                <Text style={styles.featureLabel}>{f.label}</Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDark },
    keyboardView: { flex: 1 },
    scroll: {
        flexGrow: 1,
        paddingHorizontal: SPACING.xl,
        paddingBottom: SPACING['4xl'],
    },

    hero: {
        alignItems: 'center',
        paddingTop: SPACING['3xl'],
        paddingBottom: SPACING['2xl'],
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.base,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    },
    logoEmoji: { fontSize: 36 },
    appName: {
        fontSize: FONTS.sizes['4xl'],
        fontWeight: FONTS.weights.extrabold,
        color: COLORS.textPrimary,
        letterSpacing: -1,
    },
    tagline: {
        fontSize: FONTS.sizes.base,
        color: COLORS.textMuted,
        marginTop: SPACING.xs,
        fontWeight: FONTS.weights.medium,
    },
    heroBadge: {
        marginTop: SPACING.base,
        backgroundColor: COLORS.accent + '20',
        borderRadius: RADIUS.full,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
    },
    heroBadgeText: {
        color: COLORS.accentLight,
        fontSize: FONTS.sizes.xs,
        fontWeight: FONTS.weights.bold,
    },

    card: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS['2xl'],
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.xl,
        marginBottom: SPACING.xl,
    },
    cardTitle: {
        fontSize: FONTS.sizes['2xl'],
        fontWeight: FONTS.weights.bold,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    cardSubtitle: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textMuted,
        marginBottom: SPACING.xl,
    },
    formGroup: { marginBottom: SPACING.base },

    loginBtn: { marginTop: SPACING.md },

    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SPACING.base,
        gap: SPACING.md,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
    dividerText: { color: COLORS.textSubtle, fontSize: FONTS.sizes.sm },

    demoBtn: {
        borderWidth: 1.5,
        borderColor: COLORS.accent,
        borderRadius: RADIUS.lg,
        paddingVertical: SPACING.md,
        alignItems: 'center',
    },
    demoBtnLabel: {
        color: COLORS.accentLight,
        fontSize: FONTS.sizes.base,
        fontWeight: FONTS.weights.bold,
    },

    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: SPACING.lg,
    },
    footerText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },
    footerLink: { color: COLORS.primaryLight, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },

    features: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    featureItem: { alignItems: 'center', gap: SPACING.xs },
    featureEmoji: { fontSize: 24 },
    featureLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSubtle, fontWeight: FONTS.weights.semibold },
});

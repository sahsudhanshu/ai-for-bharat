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

export default function RegisterScreen() {
    const { register } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!name.trim() || !email.trim() || !password.trim()) {
            Alert.alert('Missing Fields', 'Please fill in all required fields.');
            return;
        }
        setLoading(true);
        try {
            await register(name.trim(), email.trim(), password, phone.trim());
            router.replace('/(tabs)');
        } catch (e: any) {
            Alert.alert('Registration Failed', e.message || 'Please try again.');
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
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <Text style={styles.backBtnText}>← Back</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Hero */}
                    <View style={styles.hero}>
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoEmoji}>🌊</Text>
                        </View>
                        <Text style={styles.title}>Create Your Account</Text>
                        <Text style={styles.subtitle}>Join thousands of fishermen modernizing their operations</Text>
                    </View>

                    {/* Form Card */}
                    <View style={styles.card}>
                        <View style={styles.formGroup}>
                            <Input
                                label="Full Name *"
                                placeholder="Rajan Kumar"
                                value={name}
                                onChangeText={setName}
                                autoCapitalize="words"
                            />
                        </View>
                        <View style={styles.formGroup}>
                            <Input
                                label="Email Address *"
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
                                label="Phone Number"
                                placeholder="+91 98765 43210"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                            />
                        </View>
                        <View style={styles.formGroup}>
                            <Input
                                label="Password *"
                                placeholder="Create a secure password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <Button
                            label={loading ? 'Creating Account...' : 'Create Account'}
                            onPress={handleRegister}
                            loading={loading}
                            fullWidth
                            size="lg"
                            style={styles.registerBtn}
                        />

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/auth/login')}>
                                <Text style={styles.footerLink}>Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Benefits */}
                    <View style={styles.benefits}>
                        <Text style={styles.benefitsTitle}>Why OceanAI?</Text>
                        {[
                            '✅ Instant AI fish species identification',
                            '✅ Accurate weight & market price estimates',
                            '✅ Real-time ocean data & fishing zones',
                            '✅ 24/7 AI fisherman assistant',
                            '✅ Catch history & earnings analytics',
                        ].map((b) => (
                            <Text key={b} style={styles.benefitItem}>{b}</Text>
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
    header: { paddingTop: SPACING.base },
    backBtn: { alignSelf: 'flex-start', paddingVertical: SPACING.sm },
    backBtnText: { color: COLORS.primaryLight, fontSize: FONTS.sizes.base, fontWeight: FONTS.weights.semibold },

    hero: {
        alignItems: 'center',
        paddingVertical: SPACING.xl,
    },
    logoContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: COLORS.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
        shadowColor: COLORS.secondary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
    },
    logoEmoji: { fontSize: 28 },
    title: {
        fontSize: FONTS.sizes['2xl'],
        fontWeight: FONTS.weights.bold,
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.xs,
        paddingHorizontal: SPACING.xl,
    },

    card: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS['2xl'],
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.xl,
        marginBottom: SPACING.xl,
    },
    formGroup: { marginBottom: SPACING.base },
    registerBtn: { marginTop: SPACING.sm },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: SPACING.lg,
    },
    footerText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },
    footerLink: { color: COLORS.primaryLight, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },

    benefits: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.xl,
        gap: SPACING.sm,
    },
    benefitsTitle: {
        fontSize: FONTS.sizes.md,
        fontWeight: FONTS.weights.bold,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    benefitItem: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textSecondary,
        lineHeight: 22,
    },
});

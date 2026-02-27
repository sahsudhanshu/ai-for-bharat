import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth-context';
import { getAnalytics } from '../../lib/api-client';
import { COLORS, FONTS, SPACING, RADIUS } from '../../lib/constants';
import { Card, StatCard } from '../../components/ui/Card';

type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

const FEATURES = [
    { emoji: '📷', title: 'Upload Catch', desc: 'Identify species instantly', route: '/upload', color: COLORS.primary },
    { emoji: '🗺️', title: 'Ocean Map', desc: 'Sea organism distribution', route: '/map', color: COLORS.secondary },
    { emoji: '💬', title: 'AI Assistant', desc: 'Get fishing advice', route: '/chat', color: COLORS.accent },
    { emoji: '📊', title: 'Analytics', desc: 'Track earnings & catches', route: '/analytics', color: '#7c3aed' },
];

export default function HomeScreen() {
    const { user } = useAuth();
    const [analytics, setAnalytics] = useState<Analytics | null>(null);

    useEffect(() => {
        getAnalytics().then(setAnalytics).catch(() => { });
    }, []);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>{greeting} 👋</Text>
                        <Text style={styles.userName}>{user?.name ?? 'Fisherman'}</Text>
                    </View>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{(user?.name ?? 'F')[0].toUpperCase()}</Text>
                    </View>
                </View>

                {/* Hero Banner */}
                <View style={styles.heroBanner}>
                    <View style={styles.heroContent}>
                        <View style={styles.heroBadge}>
                            <Text style={styles.heroBadgeText}>🏆 AWS AI for Bharat</Text>
                        </View>
                        <Text style={styles.heroTitle}>Maritime Intelligence</Text>
                        <Text style={styles.heroSubtitle}>
                            AI-powered platform for Indian fishermen
                        </Text>
                        <TouchableOpacity
                            style={styles.heroBtn}
                            onPress={() => router.push('/upload')}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.heroBtnText}>Analyze Catch →</Text>
                        </TouchableOpacity>
                    </View>
                    {/* Decorative circles */}
                    <View style={styles.decoCircle1} />
                    <View style={styles.decoCircle2} />
                </View>

                {/* Stats */}
                <Text style={styles.sectionTitle}>Your Overview</Text>
                <View style={styles.statsGrid}>
                    <StatCard
                        label="Total Earnings"
                        value={analytics ? `₹${(analytics.totalEarnings / 1000).toFixed(0)}K` : '—'}
                        icon={<Text style={{ fontSize: 20 }}>💰</Text>}
                        accentColor={COLORS.secondary}
                        style={styles.statCard}
                    />
                    <StatCard
                        label="Fish Caught"
                        value={analytics ? `${analytics.totalCatches}` : '—'}
                        icon={<Text style={{ fontSize: 20 }}>🐟</Text>}
                        accentColor={COLORS.primary}
                        style={styles.statCard}
                    />
                    <StatCard
                        label="Active Zones"
                        value="12"
                        icon={<Text style={{ fontSize: 20 }}>⚓</Text>}
                        accentColor={COLORS.accent}
                        style={styles.statCard}
                    />
                    <StatCard
                        label="Eco Score"
                        value="88/100"
                        icon={<Text style={{ fontSize: 20 }}>🌊</Text>}
                        accentColor="#06b6d4"
                        style={styles.statCard}
                    />
                </View>

                {/* Feature Cards */}
                <Text style={styles.sectionTitle}>Tools</Text>
                <View style={styles.featureGrid}>
                    {FEATURES.map((f) => (
                        <TouchableOpacity
                            key={f.title}
                            style={[styles.featureCard, { borderColor: f.color + '40' }]}
                            onPress={() => router.push(f.route as any)}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.featureIcon, { backgroundColor: f.color + '20' }]}>
                                <Text style={{ fontSize: 26 }}>{f.emoji}</Text>
                            </View>
                            <Text style={styles.featureTitle}>{f.title}</Text>
                            <Text style={styles.featureDesc}>{f.desc}</Text>
                            <Text style={[styles.featureArrow, { color: f.color }]}>→</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Recent Activity */}
                <Text style={styles.sectionTitle}>Catch Insights</Text>
                <Card style={styles.insightCard} padding={SPACING.lg}>
                    {[
                        { label: 'Best Time to Fish', value: '5:00–8:00 AM', emoji: '⏰' },
                        { label: 'Top Species', value: analytics?.topSpecies ?? 'Indian Pomfret', emoji: '🐠' },
                        { label: 'Sustainability Score', value: '88/100', emoji: '♻️' },
                        { label: 'Market Trend', value: 'Pomfret ↑12%', emoji: '📈' },
                    ].map((item, i) => (
                        <View key={item.label} style={[styles.insightRow, i > 0 && styles.insightRowBorder]}>
                            <Text style={styles.insightEmoji}>{item.emoji}</Text>
                            <Text style={styles.insightLabel}>{item.label}</Text>
                            <Text style={styles.insightValue}>{item.value}</Text>
                        </View>
                    ))}
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDark },
    scroll: { flex: 1 },
    content: { padding: SPACING.xl, paddingBottom: SPACING['4xl'] },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING['2xl'],
    },
    greeting: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, fontWeight: FONTS.weights.medium },
    userName: { fontSize: FONTS.sizes.xl, color: COLORS.textPrimary, fontWeight: FONTS.weights.bold },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: RADIUS.full,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: FONTS.sizes.lg, color: '#fff', fontWeight: FONTS.weights.bold },

    // Hero Banner
    heroBanner: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS['2xl'],
        padding: SPACING.xl,
        marginBottom: SPACING.xl,
        overflow: 'hidden',
        position: 'relative',
        minHeight: 160,
    },
    heroContent: { zIndex: 2, flex: 1 },
    heroBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: RADIUS.full,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        alignSelf: 'flex-start',
        marginBottom: SPACING.sm,
    },
    heroBadgeText: { color: 'rgba(255,255,255,0.9)', fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
    heroTitle: {
        fontSize: FONTS.sizes['2xl'],
        color: '#fff',
        fontWeight: FONTS.weights.extrabold,
        marginBottom: SPACING.xs,
    },
    heroSubtitle: { fontSize: FONTS.sizes.sm, color: 'rgba(255,255,255,0.75)', marginBottom: SPACING.base },
    heroBtn: {
        backgroundColor: '#fff',
        borderRadius: RADIUS.lg,
        paddingHorizontal: SPACING.base,
        paddingVertical: SPACING.sm,
        alignSelf: 'flex-start',
    },
    heroBtnText: { color: COLORS.primary, fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.sm },
    decoCircle1: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.08)',
        right: -30,
        top: -30,
    },
    decoCircle2: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.06)',
        right: 40,
        bottom: -20,
    },

    sectionTitle: {
        fontSize: FONTS.sizes.md,
        color: COLORS.textPrimary,
        fontWeight: FONTS.weights.bold,
        marginBottom: SPACING.md,
        marginTop: SPACING.sm,
    },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.xl },
    statCard: { width: '47%', flexGrow: 1 },

    featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.xl },
    featureCard: {
        width: '47%',
        flexGrow: 1,
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        padding: SPACING.base,
        gap: SPACING.xs,
    },
    featureIcon: {
        width: 50,
        height: 50,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xs,
    },
    featureTitle: { fontSize: FONTS.sizes.md, color: COLORS.textPrimary, fontWeight: FONTS.weights.bold },
    featureDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
    featureArrow: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, marginTop: SPACING.xs },

    insightCard: { marginBottom: SPACING.xl },
    insightRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm },
    insightRowBorder: { borderTopWidth: 1, borderColor: COLORS.border },
    insightEmoji: { fontSize: 18, marginRight: SPACING.md },
    insightLabel: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textMuted, fontWeight: FONTS.weights.medium },
    insightValue: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, fontWeight: FONTS.weights.bold },
});

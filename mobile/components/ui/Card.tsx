import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../lib/constants';

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    padding?: number;
}

export function Card({ children, style, padding = SPACING.xl }: CardProps) {
    return (
        <View style={[styles.card, { padding }, style]}>
            {children}
        </View>
    );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

interface BadgeProps {
    label: string;
    color?: string;
    textColor?: string;
    style?: ViewStyle;
    textStyle?: TextStyle;
    size?: 'sm' | 'md';
}

export function Badge({
    label,
    color = COLORS.primary,
    textColor = '#fff',
    style,
    textStyle,
    size = 'md',
}: BadgeProps) {
    return (
        <View style={[styles.badge, { backgroundColor: color + '22' }, size === 'sm' && styles.badgeSm, style]}>
            <Text style={[styles.badgeText, { color }, size === 'sm' && styles.badgeTextSm, textStyle]}>
                {label}
            </Text>
        </View>
    );
}

// ── Divider ───────────────────────────────────────────────────────────────────

export function Divider({ style }: { style?: ViewStyle }) {
    return <View style={[styles.divider, style]} />;
}

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: string;
    icon: React.ReactNode;
    accentColor: string;
    style?: ViewStyle;
}

export function StatCard({ label, value, icon, accentColor, style }: StatCardProps) {
    return (
        <View style={[styles.statCard, style]}>
            <View style={[styles.statIcon, { backgroundColor: accentColor + '20' }]}>
                {icon}
            </View>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </View>
    );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    style?: ViewStyle;
}

export function SectionHeader({ title, subtitle, style }: SectionHeaderProps) {
    return (
        <View style={[styles.sectionHeader, style]}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    // Card
    card: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS['2xl'],
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    // Badge
    badge: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: RADIUS.full,
        alignSelf: 'flex-start',
    },
    badgeSm: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
    },
    badgeText: {
        fontSize: FONTS.sizes.sm,
        fontWeight: FONTS.weights.bold,
        letterSpacing: 0.3,
    },
    badgeTextSm: {
        fontSize: FONTS.sizes.xs,
    },

    // Divider
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: SPACING.base,
    },

    // StatCard
    statCard: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.base,
        alignItems: 'flex-start',
    },
    statIcon: {
        width: 44,
        height: 44,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.sm,
    },
    statLabel: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textMuted,
        fontWeight: FONTS.weights.medium,
        marginBottom: SPACING.xs,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    statValue: {
        fontSize: FONTS.sizes.xl,
        color: COLORS.textPrimary,
        fontWeight: FONTS.weights.extrabold,
    },

    // Section Header
    sectionHeader: {
        marginBottom: SPACING.base,
    },
    sectionTitle: {
        fontSize: FONTS.sizes['2xl'],
        color: COLORS.textPrimary,
        fontWeight: FONTS.weights.bold,
    },
    sectionSubtitle: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textMuted,
        marginTop: SPACING.xs,
    },
});

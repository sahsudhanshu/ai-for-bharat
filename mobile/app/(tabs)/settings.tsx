import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    Alert,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth-context';
import { COLORS, FONTS, SPACING, RADIUS, INDIAN_LANGUAGES } from '../../lib/constants';
import { Card } from '../../components/ui/Card';

export default function SettingsScreen() {
    const { user, logout } = useAuth();
    const [notifications, setNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(true);
    const [kgUnit, setKgUnit] = useState(true);
    const [language, setLanguage] = useState('English');
    const [langModalVisible, setLangModalVisible] = useState(false);

    const handleLogout = () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                        router.replace('/auth/login');
                    },
                },
            ]
        );
    };

    const PreferenceRow = ({
        label,
        value,
        onValueChange,
        description,
    }: {
        label: string;
        value: boolean;
        onValueChange: (v: boolean) => void;
        description?: string;
    }) => (
        <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
                <Text style={styles.prefLabel}>{label}</Text>
                {description && <Text style={styles.prefDesc}>{description}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '80' }}
                thumbColor={value ? COLORS.primary : COLORS.textSubtle}
            />
        </View>
    );

    const MenuRow = ({
        label,
        value,
        onPress,
        danger,
    }: {
        label: string;
        value?: string;
        onPress: () => void;
        danger?: boolean;
    }) => (
        <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
            <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
            <View style={styles.menuRight}>
                {value && <Text style={styles.menuValue}>{value}</Text>}
                <Text style={styles.menuArrow}>{danger ? '→' : '›'}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Settings</Text>
                </View>

                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.profileAvatar}>
                        <Text style={styles.profileAvatarText}>{(user?.name ?? 'F')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{user?.name ?? 'Fisherman'}</Text>
                        <Text style={styles.profileEmail}>{user?.email ?? 'demo@example.com'}</Text>
                        {user?.location && <Text style={styles.profileLocation}>📍 {user.location}</Text>}
                    </View>
                </View>

                {/* Account Info */}
                <Text style={styles.sectionLabel}>ACCOUNT</Text>
                <Card padding={0} style={styles.menuCard}>
                    {user?.phone && <MenuRow label="Phone" value={user.phone} onPress={() => { }} />}
                    <MenuRow label="Fishing Location" value={user?.location ?? 'Not set'} onPress={() => { }} />
                    <MenuRow label="Member Since" value="Feb 2026" onPress={() => { }} />
                </Card>

                {/* Preferences */}
                <Text style={styles.sectionLabel}>PREFERENCES</Text>
                <Card padding={0} style={styles.menuCard}>
                    <PreferenceRow
                        label="Push Notifications"
                        value={notifications}
                        onValueChange={setNotifications}
                        description="Market prices, weather alerts"
                    />
                    <View style={styles.prefDivider} />
                    <PreferenceRow
                        label="Dark Mode"
                        value={darkMode}
                        onValueChange={setDarkMode}
                    />
                    <View style={styles.prefDivider} />
                    <PreferenceRow
                        label="Weight in KG"
                        value={kgUnit}
                        onValueChange={setKgUnit}
                        description={kgUnit ? 'Currently: Kilograms' : 'Currently: Pounds'}
                    />
                </Card>

                {/* Language */}
                <Text style={styles.sectionLabel}>LANGUAGE</Text>
                <Card padding={0} style={styles.menuCard}>
                    <MenuRow
                        label="App Language"
                        value={language}
                        onPress={() => setLangModalVisible(true)}
                    />
                </Card>

                {/* Privacy & Security */}
                <Text style={styles.sectionLabel}>PRIVACY & SECURITY</Text>
                <Card padding={0} style={styles.menuCard}>
                    <MenuRow label="Change Password" onPress={() => Alert.alert('Coming Soon', 'Password change via Cognito coming soon.')} />
                    <MenuRow label="Export My Data" onPress={() => Alert.alert('Export', 'Your data export will be emailed to you.')} />
                    <MenuRow label="Delete Account" onPress={() => Alert.alert('Delete Account', 'Please contact support.')} danger />
                </Card>

                {/* Help */}
                <Text style={styles.sectionLabel}>HELP & SUPPORT</Text>
                <Card padding={0} style={styles.menuCard}>
                    <MenuRow label="FAQ" onPress={() => { }} />
                    <MenuRow label="Contact Support" onPress={() => { }} />
                    <MenuRow label="App Version" value="1.0.0" onPress={() => { }} />
                </Card>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
                    <Text style={styles.logoutText}>🚪  Log Out</Text>
                </TouchableOpacity>

                {/* App Info */}
                <Text style={styles.appInfo}>OceanAI v1.0.0 · AWS AI for Bharat Challenge</Text>
            </ScrollView>

            {/* Language Modal */}
            <Modal
                visible={langModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setLangModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Select Language</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {INDIAN_LANGUAGES.map((lang) => (
                                <TouchableOpacity
                                    key={lang}
                                    style={[styles.langOption, lang === language && styles.langOptionActive]}
                                    onPress={() => { setLanguage(lang); setLangModalVisible(false); }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.langOptionText, lang === language && styles.langOptionTextActive]}>
                                        {lang}
                                    </Text>
                                    {lang === language && <Text style={{ color: COLORS.primaryLight, fontSize: 16 }}>✓</Text>}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDark },
    scroll: { flex: 1 },
    content: { padding: SPACING.xl, paddingBottom: SPACING['4xl'] },

    header: { marginBottom: SPACING.xl },
    title: { fontSize: FONTS.sizes['3xl'], color: COLORS.textPrimary, fontWeight: FONTS.weights.extrabold },

    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS['2xl'],
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.xl,
        marginBottom: SPACING.xl,
        gap: SPACING.base,
    },
    profileAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    profileAvatarText: { fontSize: FONTS.sizes['2xl'], color: '#fff', fontWeight: FONTS.weights.extrabold },
    profileInfo: { flex: 1 },
    profileName: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
    profileEmail: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginTop: SPACING.xs },
    profileLocation: { fontSize: FONTS.sizes.xs, color: COLORS.textSubtle, marginTop: SPACING.xs },

    sectionLabel: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textSubtle,
        fontWeight: FONTS.weights.bold,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: SPACING.sm,
        marginTop: SPACING.md,
        paddingHorizontal: SPACING.xs,
    },

    menuCard: {
        marginBottom: SPACING.sm,
        overflow: 'hidden',
    },
    menuRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.base,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    menuLabel: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },
    menuLabelDanger: { color: COLORS.error },
    menuRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    menuValue: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
    menuArrow: { fontSize: FONTS.sizes.lg, color: COLORS.textSubtle },

    prefRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.base,
        paddingVertical: SPACING.md,
    },
    prefLeft: { flex: 1, marginRight: SPACING.base },
    prefLabel: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },
    prefDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textSubtle, marginTop: 2 },
    prefDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.base },

    logoutBtn: {
        backgroundColor: COLORS.error + '15',
        borderWidth: 1,
        borderColor: COLORS.error + '40',
        borderRadius: RADIUS.xl,
        padding: SPACING.base,
        alignItems: 'center',
        marginTop: SPACING.xl,
        marginBottom: SPACING.md,
    },
    logoutText: { color: COLORS.error, fontSize: FONTS.sizes.base, fontWeight: FONTS.weights.bold },

    appInfo: {
        textAlign: 'center',
        color: COLORS.textSubtle,
        fontSize: FONTS.sizes.xs,
        marginBottom: SPACING.base,
    },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalSheet: {
        backgroundColor: COLORS.bgCard,
        borderTopLeftRadius: RADIUS['2xl'],
        borderTopRightRadius: RADIUS['2xl'],
        padding: SPACING.xl,
        paddingBottom: SPACING['3xl'],
        maxHeight: '70%',
    },
    modalTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.base },
    langOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    langOptionActive: { backgroundColor: COLORS.primary + '15', borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm },
    langOptionText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary },
    langOptionTextActive: { color: COLORS.primaryLight, fontWeight: FONTS.weights.bold },
});

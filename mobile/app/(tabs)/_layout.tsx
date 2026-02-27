import React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING } from '../../lib/constants';
import { useLanguage } from '../../lib/i18n';
import { TouchableOpacity, View, StyleSheet, Platform } from 'react-native';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
    const insets = useSafeAreaInsets();
    const { t } = useLanguage();

    const icon = (name: IoniconName, focusedName: IoniconName) =>
        ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons name={focused ? focusedName : name} size={22} color={color} />
        );

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: COLORS.bgCard,
                    borderTopColor: COLORS.border,
                    borderTopWidth: 1,
                    paddingBottom: Math.max(insets.bottom, SPACING.sm),
                    paddingTop: SPACING.sm,
                    height: 60 + Math.max(insets.bottom, SPACING.sm),
                    elevation: 0,
                    shadowOpacity: 0,
                },
                tabBarActiveTintColor: COLORS.primaryLight,
                tabBarInactiveTintColor: COLORS.textSubtle,
                tabBarLabelStyle: {
                    fontSize: FONTS.sizes.xs,
                    fontWeight: FONTS.weights.semibold,
                    marginTop: 2,
                },
            }}
        >
            <Tabs.Screen name="index" options={{ title: t('nav.dashboard'), tabBarIcon: icon('home-outline', 'home') }} />
            <Tabs.Screen name="chat" options={{ title: t('nav.assistant'), tabBarIcon: icon('chatbubble-outline', 'chatbubble') }} />
            <Tabs.Screen
                name="upload"
                options={{
                    title: t('nav.upload'),
                    tabBarButton: (props) => (
                        <TouchableOpacity
                            onPress={props.onPress as any}
                            accessibilityRole={props.accessibilityRole}
                            accessibilityState={props.accessibilityState}
                            activeOpacity={0.8}
                            style={styles.customUploadButtonContainer}
                        >
                            <View style={[styles.customUploadButton, props.accessibilityState?.selected && styles.customUploadButtonActive]}>
                                <Ionicons name="camera" size={28} color="#fff" />
                            </View>
                        </TouchableOpacity>
                    ),
                }}
            />
            <Tabs.Screen name="map" options={{ title: t('nav.oceanMap'), tabBarIcon: icon('map-outline', 'map') }} />
            <Tabs.Screen name="settings" options={{ title: t('nav.settings'), tabBarIcon: icon('settings-outline', 'settings') }} />

            {/* Hide analytics from standard bottom strip since we don't have enough space or it's accessed via the home page tools */}
            <Tabs.Screen name="analytics" options={{ href: null }} />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    customUploadButtonContainer: {
        top: -15,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 5,
            },
            android: {
                elevation: 6,
            }
        }),
    },
    customUploadButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: COLORS.bgDark,
    },
    customUploadButtonActive: {
        backgroundColor: COLORS.primaryLight,
    },
});

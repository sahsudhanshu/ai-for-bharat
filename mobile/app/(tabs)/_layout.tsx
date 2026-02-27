import React from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING } from '../../lib/constants';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
    const insets = useSafeAreaInsets();

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
            <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
            <Tabs.Screen name="upload" options={{ title: 'Upload', tabBarIcon: icon('camera-outline', 'camera') }} />
            <Tabs.Screen name="map" options={{ title: 'Ocean Map', tabBarIcon: icon('map-outline', 'map') }} />
            <Tabs.Screen name="chat" options={{ title: 'AI Chat', tabBarIcon: icon('chatbubble-outline', 'chatbubble') }} />
            <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarIcon: icon('bar-chart-outline', 'bar-chart') }} />
            <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-outline', 'settings') }} />
        </Tabs>
    );
}

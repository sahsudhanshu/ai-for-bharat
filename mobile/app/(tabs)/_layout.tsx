import React from "react";
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, SPACING } from "../../lib/constants";
import { useLanguage } from "../../lib/i18n";
import { TouchableOpacity, View, StyleSheet, Platform } from "react-native";
import { ConnectionQualityIcon } from "../../components/ui/ConnectionQualityIcon";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const icon =
    (name: IoniconName, focusedName: IoniconName) =>
    ({ color, focused }: { color: string; focused: boolean }) => (
      <Ionicons name={focused ? focusedName : name} size={20} color={color} />
    );

  // Header right component with connection quality
  const HeaderRight = () => (
    <View style={styles.headerRight}>
      <ConnectionQualityIcon size={18} />
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: COLORS.bgCard,
          borderBottomColor: COLORS.border,
          borderBottomWidth: 1,
        },
        headerTitleStyle: {
          color: COLORS.textPrimary,
          fontSize: FONTS.sizes.md,
          fontWeight: FONTS.weights.semibold,
        },
        headerRight: () => <HeaderRight />,
        tabBarStyle: {
          backgroundColor: COLORS.bgCard,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: Math.max(insets.bottom, 4),
          paddingTop: 5,
          height: 54 + Math.max(insets.bottom, 4),
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: COLORS.primaryLight,
        tabBarInactiveTintColor: COLORS.textSubtle,
        tabBarLabelStyle: {
          fontSize: FONTS.sizes.xs,
          fontWeight: FONTS.weights.medium,
          marginTop: 1,
        },
      }}
    >
      {/* Agent/Chat tab - First position (default landing screen) */}
      <Tabs.Screen
        name="chat"
        options={{
          title: t("nav.assistant"),
          tabBarButton: (props) => (
            <TouchableOpacity
              onPress={props.onPress as any}
              accessibilityRole={props.accessibilityRole}
              accessibilityState={props.accessibilityState}
              activeOpacity={0.8}
              style={styles.agentFabContainer}
            >
              <View
                style={[
                  styles.agentFab,
                  props.accessibilityState?.selected && styles.agentFabActive,
                ]}
              >
                <Ionicons name="chatbubble" size={26} color="#fff" />
              </View>
              {!props.accessibilityState?.selected && (
                <View style={styles.agentFabPulse} />
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.dashboard"),
          tabBarIcon: icon("home-outline", "home"),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: t("nav.upload"),
          tabBarIcon: icon("camera-outline", "camera"),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t("nav.oceanMap"),
          tabBarIcon: icon("map-outline", "map"),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: "History", tabBarIcon: icon("time-outline", "time") }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("nav.settings"),
          tabBarIcon: icon("settings-outline", "settings"),
          href: null,
        }}
      />

      {/* Hide analytics from standard bottom strip */}
      <Tabs.Screen name="analytics" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  agentFabContainer: {
    top: -18,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#3b82f6",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  agentFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: COLORS.bgDark,
  },
  agentFabActive: {
    backgroundColor: COLORS.primaryLight,
  },
  agentFabPulse: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.primaryLight + "30",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginRight: SPACING.md,
  },
});

import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

export interface FishingZone {
  zoneId: string;
  name: string;
  coordinates: { latitude: number; longitude: number };
  health: "excellent" | "good" | "fair" | "poor";
  topSpecies: string[];
  avgTemperature: number;
  catchCount: number;
  advisory?: string;
  lastUpdated: string;
}

interface ZoneInsightsProps {
  zone: FishingZone;
}

export function ZoneInsights({ zone }: ZoneInsightsProps) {
  const healthColors = {
    excellent: COLORS.success,
    good: "#6ee7b7",
    fair: COLORS.warning,
    poor: COLORS.error,
  };

  const healthColor = healthColors[zone.health];

  return (
    <View style={styles.container}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: SPACING.md,
        }}
      >
        <Ionicons
          name="analytics-outline"
          size={20}
          color={COLORS.primaryLight}
        />
        <Text style={styles.title}>Live Zone Insights</Text>
      </View>

      <View style={styles.zoneCard}>
        <View style={styles.zoneHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.zoneName}>{zone.name}</Text>
            <Text style={styles.zoneRegion}>
              {zone.coordinates.latitude.toFixed(3)}°N,{" "}
              {zone.coordinates.longitude.toFixed(3)}°E
            </Text>
          </View>
          <View
            style={[
              styles.healthBadge,
              { backgroundColor: healthColor + "20" },
            ]}
          >
            <Text style={[styles.healthText, { color: healthColor }]}>
              {zone.health.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Top Species */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Top Species</Text>
          <View style={styles.speciesTags}>
            {zone.topSpecies.map((species, index) => (
              <View key={index} style={styles.speciesTag}>
                <Text style={styles.speciesTagText}>{species}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons
                name="thermometer-outline"
                size={14}
                color={COLORS.textMuted}
              />
              <Text style={styles.statLabel}>Avg Temp</Text>
            </View>
            <Text style={styles.statValue}>{zone.avgTemperature}°C</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="fish" size={20} color={COLORS.primary} />
            <Text style={styles.statLabel}>Catches</Text>
            <Text style={styles.statValue}>{zone.catchCount}</Text>
          </View>
        </View>

        {/* Advisory */}
        {zone.advisory && (
          <View style={styles.advisoryBox}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Ionicons name="bulb-outline" size={14} color={COLORS.warning} />
              <Text style={styles.advisoryText}>{zone.advisory}</Text>
            </View>
          </View>
        )}

        <Text style={styles.lastUpdated}>
          Last updated: {new Date(zone.lastUpdated).toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  zoneCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  zoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  zoneName: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  zoneRegion: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  healthBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  healthText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  section: {
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
    fontWeight: FONTS.weights.semibold,
  },
  speciesTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  speciesTag: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  speciesTagText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semibold,
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statItem: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  advisoryBox: {
    backgroundColor: COLORS.primary + "15",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  advisoryText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },
  lastUpdated: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WeatherService } from "../../lib/weather-service";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";

interface FishermanToolsProps {
  location: { latitude: number; longitude: number };
}

export function FishermanTools({ location }: FishermanToolsProps) {
  const [sunTimes, setSunTimes] = useState<{
    sunrise: string;
    sunset: string;
  } | null>(null);
  const [moonPhase, setMoonPhase] = useState<{
    phase: string;
    illumination: number;
    emoji: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [location]);

  const loadData = () => {
    setLoading(true);
    try {
      const sun = WeatherService.calculateSunTimes(
        location.latitude,
        location.longitude,
      );
      const moon = WeatherService.getMoonPhase();
      setSunTimes(sun);
      setMoonPhase(moon);
    } catch (error) {
      console.error("Failed to load fisherman tools data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={COLORS.primaryLight} />
      </View>
    );
  }

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
          name="compass-outline"
          size={20}
          color={COLORS.primaryLight}
        />
        <Text style={styles.title}>Fisherman Tools</Text>
      </View>

      <View style={styles.toolsGrid}>
        {/* Sunrise/Sunset */}
        <View style={[styles.toolCard, { borderColor: "#f59e0b30" }]}>
          <Ionicons name="sunny-outline" size={22} color="#fbbf24" />
          <Text style={[styles.toolLabel, { color: "#fbbf24" }]}>Sunrise</Text>
          <Text style={styles.toolValue}>{sunTimes?.sunrise || "--:--"}</Text>
          <Text style={styles.toolSub}>
            Sunset {sunTimes?.sunset || "--:--"}
          </Text>
        </View>

        {/* Moon Phase */}
        <View style={[styles.toolCard, { borderColor: "#818cf830" }]}>
          <Ionicons name="moon-outline" size={22} color="#a5b4fc" />
          <Text style={[styles.toolLabel, { color: "#a5b4fc" }]}>Moon</Text>
          <Text style={styles.toolValue}>{moonPhase?.phase || "Unknown"}</Text>
          <Text style={styles.toolSub}>
            {moonPhase
              ? `${Math.round(moonPhase.illumination * 100)}% illuminated`
              : "--"}
          </Text>
        </View>

        {/* Tide Information (placeholder) */}
        <View style={[styles.toolCard, { borderColor: "#22d3ee30" }]}>
          <Ionicons name="water" size={32} color="#67e8f9" />
          <Text style={[styles.toolLabel, { color: "#67e8f9" }]}>Tide</Text>
          <Text style={styles.toolValue}>High → 2.1m</Text>
          <Text style={styles.toolSub}>Next low: 3:45 PM</Text>
        </View>

        {/* Best Fishing Times */}
        <View style={[styles.toolCard, { borderColor: "#34d39930" }]}>
          <Ionicons name="time-outline" size={22} color="#6ee7b7" />
          <Text style={[styles.toolLabel, { color: "#6ee7b7" }]}>
            Best Time
          </Text>
          <Text style={styles.toolValue}>5:30 – 8:00 AM</Text>
          <Text style={styles.toolSub}>High activity</Text>
        </View>
      </View>

      {/* Sea State */}
      <View style={styles.seaStateBar}>
        <View style={styles.seaStateHeader}>
          <Ionicons name="rainy" size={16} color={COLORS.textSecondary} />
          <Text style={styles.seaStateText}>
            Sea State:{" "}
            <Text style={{ fontWeight: "700", color: COLORS.textPrimary }}>
              Moderate
            </Text>
          </Text>
        </View>
        <Text style={styles.seaStateSub}>
          Wave 1.2m • Wind NW 15 km/h • Vis 8 km
        </Text>
      </View>

      <TouchableOpacity onPress={loadData}>
        <Text style={styles.refreshText}>Refresh</Text>
      </TouchableOpacity>
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
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toolCard: {
    width: "48%",
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },
  toolEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  toolLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  toolValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  toolSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  seaStateBar: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#3b82f630",
  },
  seaStateText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  seaStateSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  refreshText: {
    textAlign: "center",
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
  },
});

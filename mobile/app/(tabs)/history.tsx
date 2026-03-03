import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { getGroups, deleteGroup } from "../../lib/api-client";
import { HistoryCard } from "../../components/history/HistoryCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { COLORS, FONTS, SPACING } from "../../lib/constants";
import { Ionicons } from "@expo/vector-icons";
import type { GroupRecord } from "../../lib/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HISTORY_CACHE_KEY = "ocean_ai_history_cache";

export default function HistoryScreen() {
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        // Try to load from cache first
        const cached = await AsyncStorage.getItem(HISTORY_CACHE_KEY);
        if (cached) {
          try {
            const parsedData = JSON.parse(cached);
            setGroups(parsedData);
            setLoading(false);
          } catch (parseError) {
            console.error("Failed to parse cached history:", parseError);
            // Clear corrupted cache
            await AsyncStorage.removeItem(HISTORY_CACHE_KEY);
          }
        }
      }

      // Fetch fresh data
      const data = await getGroups();
      setGroups(data.groups);

      // Cache the data
      await AsyncStorage.setItem(
        HISTORY_CACHE_KEY,
        JSON.stringify(data.groups),
      );
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadHistory(true);
  }, []);

  const handleViewDetails = (groupId: string) => {
    router.push(`/history/${groupId}` as any);
  };

  const handleDelete = async (groupId: string) => {
    try {
      await deleteGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.groupId !== groupId));

      // Update cache
      const updated = groups.filter((g) => g.groupId !== groupId);
      await AsyncStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to delete group:", error);
    }
  };

  const handleAskAI = (groupId: string) => {
    router.push({
      pathname: "/(tabs)/chat",
      params: { groupId },
    });
  };

  const handleExportPDF = (groupId: string) => {
    // PDF export will be implemented in Task 9
    console.log("Export PDF for group:", groupId);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>{groups.length} analysis sessions</Text>
      </View>

      {groups.length === 0 ? (
        <EmptyState
          icon={
            <Ionicons name="time-outline" size={48} color={COLORS.textMuted} />
          }
          title="No History Yet"
          description="Your catch analysis history will appear here. Upload images to get started!"
          action={{
            label: "Upload Now",
            onPress: () => router.push("/(tabs)/upload"),
          }}
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.groupId}
          renderItem={({ item }) => (
            <HistoryCard
              group={item}
              onViewDetails={() => handleViewDetails(item.groupId)}
              onDelete={() => handleDelete(item.groupId)}
              onAskAI={() => handleAskAI(item.groupId)}
              onExportPDF={() => handleExportPDF(item.groupId)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  list: {
    padding: SPACING.xl,
  },
});

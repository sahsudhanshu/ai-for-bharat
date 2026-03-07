/**
 * Sync Status Indicator
 * Shows sync status with icon and manual sync button
 */
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNetwork } from "../../lib/network-context";
import { toastService } from "../../lib/toast-service";

interface SyncStatusIndicatorProps {
  showLabel?: boolean;
  size?: "small" | "medium";
}

export function SyncStatusIndicator({
  showLabel = false,
  size = "medium",
}: SyncStatusIndicatorProps) {
  const {
    syncStatus,
    pendingCount,
    failedCount,
    lastSyncTime,
    manualSync,
    isOnline,
  } = useNetwork();

  const handleManualSync = async () => {
    if (!isOnline) {
      toastService.error("No internet connection");
      return;
    }

    try {
      await manualSync();
      toastService.success("Sync completed");
    } catch (error) {
      toastService.error("Sync failed");
    }
  };

  const getStatusConfig = () => {
    if (syncStatus === "syncing") {
      return {
        icon: null,
        color: "#3B82F6",
        text: "Syncing...",
        showSpinner: true,
      };
    }

    if (syncStatus === "failed" || failedCount > 0) {
      return {
        icon: "alert-circle" as const,
        color: "#EF4444",
        text: `${failedCount} failed`,
        showSpinner: false,
      };
    }

    if (pendingCount > 0) {
      return {
        icon: "cloud-upload" as const,
        color: "#F59E0B",
        text: `${pendingCount} pending`,
        showSpinner: false,
      };
    }

    if (syncStatus === "synced" && lastSyncTime) {
      const now = new Date();
      const diff = now.getTime() - lastSyncTime.getTime();
      const minutes = Math.floor(diff / 60000);

      let timeText = "Just now";
      if (minutes > 0) {
        timeText = `${minutes}m ago`;
      }

      return {
        icon: "checkmark-circle" as const,
        color: "#10B981",
        text: timeText,
        showSpinner: false,
      };
    }

    return {
      icon: "cloud-done" as const,
      color: "#6B7280",
      text: "Synced",
      showSpinner: false,
    };
  };

  const config = getStatusConfig();
  const iconSize = size === "small" ? 16 : 20;
  const fontSize = size === "small" ? 12 : 14;

  // Show manual sync button if there are pending items
  const showSyncButton = pendingCount > 0 && !syncStatus.includes("syncing");

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={showSyncButton ? handleManualSync : undefined}
      disabled={!showSyncButton}
    >
      <View style={styles.content}>
        {config.showSpinner ? (
          <ActivityIndicator size="small" color={config.color} />
        ) : (
          config.icon && (
            <Ionicons name={config.icon} size={iconSize} color={config.color} />
          )
        )}
        {showLabel && (
          <Text style={[styles.text, { color: config.color, fontSize }]}>
            {config.text}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  text: {
    fontWeight: "500",
  },
});

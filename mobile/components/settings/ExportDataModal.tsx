import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Modal } from "../ui/Modal";
import { ExportService } from "../../lib/export-service";
import type { DataExportOptions } from "../../lib/types";

interface ExportDataModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ExportDataModal({ visible, onClose }: ExportDataModalProps) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);

      const options: DataExportOptions = {
        format,
        includeAnalysis: true,
        includeChat: true,
      };

      await ExportService.exportData(options);
      Alert.alert("Success", "Data exported successfully");
      onClose();
    } catch (err) {
      console.error("Error exporting data:", err);
      Alert.alert("Error", "Failed to export data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Export Data">
      <View style={styles.content}>
        <Text style={styles.description}>
          Export all your catch history, analysis results, and chat
          conversations.
        </Text>

        <View style={styles.formatSection}>
          <Text style={styles.label}>Select Format</Text>
          <View style={styles.formatButtons}>
            <TouchableOpacity
              style={[
                styles.formatButton,
                format === "csv" && styles.formatButtonActive,
              ]}
              onPress={() => setFormat("csv")}
            >
              <Text
                style={[
                  styles.formatButtonText,
                  format === "csv" && styles.formatButtonTextActive,
                ]}
              >
                CSV
              </Text>
              <Text style={styles.formatButtonDesc}>Spreadsheet format</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.formatButton,
                format === "json" && styles.formatButtonActive,
              ]}
              onPress={() => setFormat("json")}
            >
              <Text
                style={[
                  styles.formatButtonText,
                  format === "json" && styles.formatButtonTextActive,
                ]}
              >
                JSON
              </Text>
              <Text style={styles.formatButtonDesc}>Raw data format</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            📦 Your data will be downloaded and you can share it via email,
            cloud storage, or other apps.
          </Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.exportButton,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleExport}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.exportButtonText}>Export</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SPACING.lg,
  },
  description: {
    fontSize: FONTS.sizes.sm,
    color: "#cbd5e1", // Brighter text
    lineHeight: 20,
  },
  formatSection: {
    gap: SPACING.sm,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  formatButtons: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  formatButton: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
    alignItems: "center",
  },
  formatButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "15",
  },
  formatButtonText: {
    fontSize: FONTS.sizes.base,
    color: "#cbd5e1", // Brighter text
    fontWeight: FONTS.weights.bold,
    marginBottom: SPACING.xs,
  },
  formatButtonTextActive: {
    color: COLORS.primary,
  },
  formatButtonDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
  },
  infoBox: {
    backgroundColor: COLORS.primary + "10",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.base,
  },
  infoText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  buttons: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#0f172a", // Darker for contrast
    borderWidth: 1,
    borderColor: "#475569", // Lighter border
  },
  cancelButtonText: {
    fontSize: FONTS.sizes.base,
    color: "#cbd5e1", // Brighter text
    fontWeight: FONTS.weights.medium,
  },
  exportButton: {
    backgroundColor: COLORS.primary,
  },
  exportButtonText: {
    fontSize: FONTS.sizes.base,
    color: "#fff",
    fontWeight: FONTS.weights.bold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

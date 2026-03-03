/**
 * Technical Details Screen - Shows full ML analysis with YOLO, GradCAM, crops
 */
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Stack } from "expo-router";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Card } from "../../components/ui/Card";
import { useLanguage } from "../../lib/i18n";
import { Ionicons } from "@expo/vector-icons";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function TechnicalDetailsScreen() {
  const { t } = useLanguage();
  const params = useLocalSearchParams();

  // Parse the ML data passed from upload screen
  const mlData = params.mlData ? JSON.parse(params.mlData as string) : null;
  const baseUrl = (params.baseUrl as string) || "";

  if (!mlData) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ title: "Technical Details" }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No analysis data available</Text>
        </View>
      </SafeAreaView>
    );
  }

  const crops = Object.entries(mlData.crops || {});

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{ title: "Technical Analysis", headerShown: true }}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* YOLO Detection Output */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YOLO Detection Output</Text>
          <Card style={styles.imageCard} padding={0}>
            {mlData.yolo_image_url ? (
              <Image
                source={{ uri: `${baseUrl}${mlData.yolo_image_url}` }}
                style={styles.yoloImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderText}>
                  YOLO output not available (offline mode)
                </Text>
              </View>
            )}
          </Card>
        </View>

        {/* Detected Crops */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Detected Fish ({crops.length})
          </Text>
          {crops.map(([key, crop]: [string, any]) => (
            <Card key={key} style={styles.cropCard} padding={SPACING.base}>
              <View style={styles.cropHeader}>
                <Text style={styles.cropTitle}>
                  {key.replace("_", " ").toUpperCase()}
                </Text>
                <Text style={styles.yoloConf}>
                  YOLO: {(crop.yolo_confidence * 100).toFixed(1)}%
                </Text>
              </View>

              {/* Crop Image */}
              {crop.crop_url && (
                <Image
                  source={{ uri: `${baseUrl}${crop.crop_url}` }}
                  style={styles.cropImage}
                  resizeMode="contain"
                />
              )}

              {/* Bounding Box */}
              <View style={styles.bboxRow}>
                <Text style={styles.bboxLabel}>BBox:</Text>
                <Text style={styles.bboxValue}>[{crop.bbox.join(", ")}]</Text>
              </View>

              {/* Species Classification */}
              <View style={styles.classSection}>
                <Text style={styles.classTitle}>Species Classification</Text>
                <View style={styles.classRow}>
                  <View style={styles.classInfo}>
                    <Text style={styles.classLabel}>{crop.species.label}</Text>
                    <Text style={styles.classConf}>
                      {(crop.species.confidence * 100).toFixed(1)}%
                    </Text>
                  </View>
                  {crop.species.gradcam_url && (
                    <Image
                      source={{ uri: `${baseUrl}${crop.species.gradcam_url}` }}
                      style={styles.gradcamThumb}
                      resizeMode="cover"
                    />
                  )}
                </View>
              </View>

              {/* Disease Classification */}
              <View style={styles.classSection}>
                <Text style={styles.classTitle}>Disease Detection</Text>
                <View style={styles.classRow}>
                  <View style={styles.classInfo}>
                    <Text
                      style={[
                        styles.classLabel,
                        {
                          color:
                            crop.disease.label === "Healthy Fish"
                              ? COLORS.success
                              : COLORS.warning,
                        },
                      ]}
                    >
                      {crop.disease.label}
                    </Text>
                    <Text style={styles.classConf}>
                      {(crop.disease.confidence * 100).toFixed(1)}%
                    </Text>
                  </View>
                  {crop.disease.gradcam_url && (
                    <Image
                      source={{ uri: `${baseUrl}${crop.disease.gradcam_url}` }}
                      style={styles.gradcamThumb}
                      resizeMode="cover"
                    />
                  )}
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* Model Info */}
        <Card style={styles.infoCard} padding={SPACING.base}>
          <Text style={styles.infoTitle}>ℹ️ Model Pipeline</Text>
          <Text style={styles.infoText}>1. YOLOv11 Object Detection</Text>
          <Text style={styles.infoText}>2. Species Classification (CNN)</Text>
          <Text style={styles.infoText}>3. Disease Detection (CNN)</Text>
          <Text style={styles.infoText}>4. GradCAM Visualization</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  scroll: { flex: 1 },
  content: { padding: SPACING.xl, paddingBottom: SPACING["4xl"] },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  errorText: { color: COLORS.textMuted, fontSize: FONTS.sizes.md },

  section: { marginBottom: SPACING.xl },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },

  imageCard: { overflow: "hidden" },
  yoloImage: { width: "100%", height: 300 },
  placeholderBox: {
    width: "100%",
    height: 300,
    backgroundColor: COLORS.bgCard,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  placeholderText: { color: COLORS.textMuted, textAlign: "center" },

  cropCard: { marginBottom: SPACING.md },
  cropHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  cropTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryLight,
  },
  yoloConf: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontFamily: "monospace",
  },

  cropImage: {
    width: "100%",
    height: 200,
    backgroundColor: COLORS.bgDark,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
  },

  bboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  bboxLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.bold,
  },
  bboxValue: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontFamily: "monospace",
    flex: 1,
  },

  classSection: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.md,
  },
  classTitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.bold,
    textTransform: "uppercase",
    marginBottom: SPACING.xs,
  },
  classRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  classInfo: { flex: 1 },
  classLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
  },
  classConf: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  gradcamThumb: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  infoCard: { marginTop: SPACING.md },
  infoTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
});

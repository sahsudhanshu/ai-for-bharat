/**
 * Detailed Analysis Report
 * Shows full ML analysis data for both online (cloud) and offline (on-device) results.
 * Data is passed via the analysis-store module.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { getAnalysisData } from "../../lib/analysis-store";
import type { OfflineDetectionResult } from "../../lib/offline-inference";
import type { MLCropResult } from "../../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const YOLO_CONFIDENCE_THRESHOLD = 0.3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ConfBadge({ value, label }: { value: number; label?: string }) {
  const pct = (value * 100).toFixed(1);
  const color =
    value >= 0.8
      ? COLORS.success
      : value >= 0.5
        ? COLORS.warning
        : COLORS.error;
  return (
    <View style={[s.confBadge, { backgroundColor: color + "22" }]}>
      <Text style={[s.confPct, { color }]}>{pct}%</Text>
      {label && <Text style={s.confLabel}>{label}</Text>}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionTitle}>{title}</Text>;
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, mono && s.mono]}>{value}</Text>
    </View>
  );
}

// ─── Online Detailed View ─────────────────────────────────────────────────────

function OnlineDetailPage() {
  const data = getAnalysisData();
  if (!data || data.mode !== "online") return null;
  const { groupAnalysis, groupId, imageUris, location } = data;

  const [activeTab, setActiveTab] = useState(0);
  const totalImages = groupAnalysis.images.length;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {/* ── Identity & Meta ── */}
      <SectionHeader title="Report Identity" />
      <Card style={s.card} padding={SPACING.base}>
        <InfoRow label="Group ID" value={groupId} mono />
        <InfoRow
          label="Processed At"
          value={new Date(groupAnalysis.processedAt).toLocaleString()}
        />
        {location && (
          <InfoRow
            label="Location"
            value={`${location.lat.toFixed(5)}°N, ${location.lng.toFixed(5)}°E`}
            mono
          />
        )}
        <InfoRow label="Images" value={`${totalImages}`} />
      </Card>

      {/* ── Aggregate Stats ── */}
      <SectionHeader title="Aggregate Statistics" />
      <Card style={s.card} padding={SPACING.base}>
        <InfoRow
          label="Total Fish Detected"
          value={`${groupAnalysis.aggregateStats.totalFishCount}`}
        />
        <InfoRow
          label="Average YOLO Confidence"
          value={`${(groupAnalysis.aggregateStats.averageConfidence * 100).toFixed(1)}%`}
        />
        <InfoRow
          label="Total Estimated Weight"
          value={`${groupAnalysis.aggregateStats.totalEstimatedWeight.toFixed(3)} kg`}
        />
        <InfoRow
          label="Total Estimated Value"
          value={`₹${groupAnalysis.aggregateStats.totalEstimatedValue.toLocaleString("en-IN")}`}
        />
        <InfoRow
          label="Disease Status"
          value={
            groupAnalysis.aggregateStats.diseaseDetected
              ? "Disease Detected"
              : "All Healthy"
          }
        />
        {Object.keys(groupAnalysis.aggregateStats.speciesDistribution).length >
          0 && (
          <View style={s.speciesDist}>
            <Text style={s.subTitle}>Species Distribution</Text>
            {Object.entries(groupAnalysis.aggregateStats.speciesDistribution)
              .sort(([, a], [, b]) => b - a)
              .map(([species, count]) => (
                <View key={species} style={s.speciesRow}>
                  <Text style={s.speciesName}>{species}</Text>
                  <Text style={s.speciesCount}>{count}</Text>
                </View>
              ))}
          </View>
        )}
      </Card>

      {/* ── Image-level tabs ── */}
      <SectionHeader title="Per-Image Analysis" />

      {/* Tab selector */}
      {totalImages > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabsRow}
        >
          {groupAnalysis.images.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              style={[s.tab, activeTab === idx && s.tabActive]}
              onPress={() => setActiveTab(idx)}
            >
              <Text style={[s.tabText, activeTab === idx && s.tabTextActive]}>
                Image {idx + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Active Image Detail */}
      {groupAnalysis.images[activeTab] &&
        (() => {
          const img = groupAnalysis.images[activeTab];
          const crops = Object.entries(img.crops).filter(
            ([, crop]) => crop.yolo_confidence >= YOLO_CONFIDENCE_THRESHOLD,
          );

          return (
            <View>
              {/* Image meta */}
              <Card style={s.card} padding={SPACING.base}>
                <InfoRow label="Image Index" value={`${img.imageIndex + 1}`} />
                <InfoRow label="S3 Key" value={img.s3Key} mono />
                {img.error && (
                  <View style={s.errorBox}>
                    <Text style={s.errorText}>{img.error}</Text>
                  </View>
                )}
              </Card>

              {/* Source image thumbnail */}
              {imageUris[activeTab] && (
                <View style={s.imgSection}>
                  <Text style={s.subTitle}>Source Image</Text>
                  <Image
                    source={{ uri: imageUris[activeTab] }}
                    style={s.sourceImg}
                    resizeMode="contain"
                  />
                </View>
              )}

              {/* YOLO detection image */}
              {img.yolo_image_url && (
                <View style={s.imgSection}>
                  <Text style={s.subTitle}>YOLO Detection Output</Text>
                  <Image
                    source={{ uri: img.yolo_image_url }}
                    style={s.yoloImg}
                    resizeMode="contain"
                  />
                </View>
              )}

              {/* Per-crop detail */}
              {crops.length === 0 ? (
                <Card style={s.card} padding={SPACING.xl}>
                  <Text style={s.emptyText}>
                    No fish met the 30% confidence threshold.
                  </Text>
                </Card>
              ) : (
                crops.map(([cropKey, crop], ci) => (
                  <OnlineCropDetail
                    key={cropKey}
                    cropKey={cropKey}
                    crop={crop}
                    index={ci}
                  />
                ))
              )}
            </View>
          );
        })()}
    </ScrollView>
  );
}

function OnlineCropDetail({
  cropKey,
  crop,
  index,
}: {
  cropKey: string;
  crop: MLCropResult;
  index: number;
}) {
  const diseaseColor =
    crop.disease.label === "Healthy Fish" ? COLORS.success : COLORS.warning;

  return (
    <Card style={s.cropCard} padding={SPACING.base}>
      <View style={s.cropHeader}>
        <Text style={s.cropTitle}>Fish #{index + 1}</Text>
        <ConfBadge value={crop.yolo_confidence} label="YOLO" />
      </View>

      {/* Species */}
      <Text style={s.cropSpecies}>{crop.species.label}</Text>
      <View style={s.confRow}>
        <ConfBadge value={crop.species.confidence} label="Species conf" />
      </View>

      {/* Disease */}
      <View style={s.diseaseRow}>
        <Text style={[s.diseaseLabel, { color: diseaseColor }]}>
          {crop.disease.label}
        </Text>
        <ConfBadge value={crop.disease.confidence} label="Disease conf" />
      </View>

      {/* Bounding box */}
      <View style={s.metaBox}>
        <Text style={s.metaTitle}>Bounding Box (px)</Text>
        <Text style={s.mono}>[{crop.bbox.join(", ")}]</Text>
      </View>

      {/* Crop key / internal ID */}
      <View style={s.metaBox}>
        <Text style={s.metaTitle}>Crop ID</Text>
        <Text style={s.mono}>{cropKey}</Text>
      </View>

      {/* Images grid */}
      <View style={s.imagesGrid}>
        {crop.crop_url ? (
          <CropImageBox uri={crop.crop_url} label="Crop" />
        ) : null}
        {crop.species.gradcam_url ? (
          <CropImageBox
            uri={crop.species.gradcam_url}
            label="Species GradCAM"
          />
        ) : null}
        {crop.disease.gradcam_url ? (
          <CropImageBox
            uri={crop.disease.gradcam_url}
            label="Disease GradCAM"
          />
        ) : null}
      </View>

      {/* Raw URLs info */}
      <View style={s.urlSection}>
        <Text style={s.urlSectionTitle}>Raw URLs</Text>
        {crop.crop_url && (
          <Text style={s.urlText} numberOfLines={2}>
            Crop: {crop.crop_url}
          </Text>
        )}
        {crop.species.gradcam_url && (
          <Text style={s.urlText} numberOfLines={2}>
            Species GradCAM: {crop.species.gradcam_url}
          </Text>
        )}
        {crop.disease.gradcam_url && (
          <Text style={s.urlText} numberOfLines={2}>
            Disease GradCAM: {crop.disease.gradcam_url}
          </Text>
        )}
      </View>
    </Card>
  );
}

// ─── Offline Detailed View ────────────────────────────────────────────────────

function OfflineDetailPage() {
  const data = getAnalysisData();
  if (!data || data.mode !== "offline") return null;
  const { offlineResults, processingTime, imageUri, location } = data;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {/* ── Meta ── */}
      <SectionHeader title="Report Info" />
      <Card style={s.card} padding={SPACING.base}>
        <InfoRow label="Mode" value="Offline (On-Device)" />
        <InfoRow
          label="Processing Time"
          value={`${processingTime}ms (${(processingTime / 1000).toFixed(1)}s)`}
        />
        <InfoRow label="Fish Detected" value={`${offlineResults.length}`} />
        {location && (
          <InfoRow
            label="Location"
            value={`${location.lat.toFixed(5)}°N, ${location.lng.toFixed(5)}°E`}
            mono
          />
        )}
      </Card>

      {/* Source image */}
      {imageUri && (
        <View style={s.imgSection}>
          <SectionHeader title="Source Image" />
          <Image
            source={{ uri: imageUri }}
            style={s.sourceImg}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Per-fish */}
      <SectionHeader title={`Fish Details (${offlineResults.length})`} />
      {offlineResults.map((det, idx) => (
        <OfflineFishDetail key={idx} det={det} index={idx} />
      ))}
    </ScrollView>
  );
}

function OfflineFishDetail({
  det,
  index,
}: {
  det: OfflineDetectionResult;
  index: number;
}) {
  const diseaseColor =
    det.disease === "Healthy Fish" ? COLORS.success : COLORS.warning;
  const qualColor =
    det.qualityGrade === "Premium"
      ? COLORS.success
      : det.qualityGrade === "Standard"
        ? COLORS.warning
        : COLORS.error;

  return (
    <Card style={s.cropCard} padding={SPACING.base}>
      <View style={s.cropHeader}>
        <Text style={s.cropTitle}>Fish #{index + 1}</Text>
        <ConfBadge value={det.speciesConfidence} label="Species" />
      </View>

      {/* Species */}
      <Text style={s.cropSpecies}>{det.species}</Text>

      {/* Disease */}
      <View style={s.diseaseRow}>
        <Text style={[s.diseaseLabel, { color: diseaseColor }]}>
          {det.disease}
        </Text>
        <ConfBadge value={det.diseaseConfidence} label="Disease conf" />
      </View>

      {/* Quality */}
      <View style={s.infoRow}>
        <Text style={s.infoLabel}>Quality Grade</Text>
        <Text
          style={[
            s.infoValue,
            { color: qualColor, fontWeight: FONTS.weights.bold },
          ]}
        >
          {det.qualityGrade}
        </Text>
      </View>

      {/* Measurements */}
      <View style={s.metaBox}>
        <Text style={s.metaTitle}>Measurements</Text>
        <InfoRow
          label="Weight"
          value={`${det.weightG}g (${(det.weightG / 1000).toFixed(3)} kg)`}
        />
        <InfoRow label="Length" value={`${det.lengthMm} mm`} />
        <InfoRow
          label="Legal Size"
          value={
            det.isLegalSize
              ? `✅ Yes (min ${det.minLegalSize}mm)`
              : `❌ No (min ${det.minLegalSize}mm)`
          }
        />
      </View>

      {/* Market */}
      <View style={s.metaBox}>
        <Text style={s.metaTitle}>Market Estimate</Text>
        <InfoRow label="Price per kg" value={`₹${det.pricePerKg}`} />
        <InfoRow label="Estimated Value" value={`₹${det.estimatedValue}`} />
      </View>

      {/* Bounding box */}
      <View style={s.metaBox}>
        <Text style={s.metaTitle}>Bounding Box (px)</Text>
        <Text style={s.mono}>[{det.bbox.join(", ")}]</Text>
      </View>

      {/* Images */}
      <View style={s.imagesGrid}>
        {det.cropUri ? <CropImageBox uri={det.cropUri} label="Crop" /> : null}
        {det.gradcamUri ? (
          <CropImageBox uri={det.gradcamUri} label="GradCAM" />
        ) : null}
      </View>

      {/* Error */}
      {det.error && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{det.error}</Text>
        </View>
      )}
    </Card>
  );
}

// ─── Shared Image Box ─────────────────────────────────────────────────────────

function CropImageBox({ uri, label }: { uri: string; label: string }) {
  return (
    <View style={s.imgBox}>
      <Image source={{ uri }} style={s.imgBoxImg} resizeMode="contain" />
      <Text style={s.imgBoxLabel}>{label}</Text>
    </View>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function DetailedAnalysisScreen() {
  const data = getAnalysisData();

  return (
    <SafeAreaView style={s.safe}>
      <Stack.Screen
        options={{
          title: "Detailed Analysis Report",
          headerShown: true,
          headerStyle: { backgroundColor: COLORS.bgDark },
          headerTintColor: COLORS.textPrimary,
          headerTitleStyle: { fontWeight: FONTS.weights.bold },
        }}
      />

      {!data ? (
        <View style={s.emptyPage}>
          <Text style={s.emptyPageText}>No analysis data available.</Text>
          <Button
            label="Go Back"
            onPress={() => router.back()}
            variant="outline"
            style={{ marginTop: SPACING.xl }}
          />
        </View>
      ) : data.mode === "online" ? (
        <OnlineDetailPage />
      ) : (
        <OfflineDetailPage />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  scroll: { flex: 1 },
  content: { padding: SPACING.xl, paddingBottom: SPACING["4xl"] },

  emptyPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING["2xl"],
  },
  emptyPageText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.md,
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    textAlign: "center",
  },

  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  subTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },

  card: { marginBottom: SPACING.sm },
  cropCard: { marginBottom: SPACING.md },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  infoLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    flex: 1,
  },
  infoValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    flex: 2,
    textAlign: "right",
  },
  mono: {
    fontFamily: "monospace",
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },

  confBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    alignItems: "center",
  },
  confPct: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  confLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  confRow: { flexDirection: "row", marginVertical: SPACING.xs },

  cropHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  cropTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  cropSpecies: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.extrabold,
    color: COLORS.primaryLight,
    marginBottom: SPACING.xs,
  },
  diseaseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  diseaseLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
  },

  metaBox: {
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginVertical: SPACING.xs,
  },
  metaTitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },

  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  imgBox: {
    flex: 1,
    minWidth:
      (SCREEN_WIDTH - SPACING.xl * 2 - SPACING["2xl"] * 2 - SPACING.sm) / 3,
    alignItems: "center",
  },
  imgBoxImg: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  imgBoxLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: "center",
  },

  urlSection: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.bgDark,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  urlSectionTitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  urlText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    fontFamily: "monospace",
    marginBottom: 2,
  },

  errorBox: {
    backgroundColor: COLORS.error + "15",
    borderWidth: 1,
    borderColor: COLORS.error + "40",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.sm,
  },

  speciesDist: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  speciesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.xs,
  },
  speciesName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  speciesCount: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },

  // Image sections
  imgSection: { marginBottom: SPACING.md },
  sourceImg: {
    width: "100%",
    height: 220,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.bgCard,
  },
  yoloImg: {
    width: "100%",
    height: 260,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.bgCard,
  },

  // Tabs
  tabsRow: {
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  tabActive: {
    borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.primaryLight + "22",
  },
  tabText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.semibold,
  },
});

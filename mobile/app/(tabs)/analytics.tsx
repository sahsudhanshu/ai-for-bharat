import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getAnalytics, getImages } from "../../lib/api-client";
import type { AnalyticsResponse, ImageRecord } from "../../lib/api-client";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { useLanguage } from "../../lib/i18n";
import { Card, StatCard } from "../../components/ui/Card";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Analytics = AnalyticsResponse;

const GRADE_COLORS: Record<string, string> = {
  Premium: COLORS.success,
  Standard: COLORS.warning,
  Low: COLORS.error,
};

export default function AnalyticsScreen() {
  const { t, isLoaded } = useLanguage();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getAnalytics()
        .then(setAnalytics)
        .catch((e) => setError(e.message || "Failed to load analytics")),
      getImages(10)
        .then((r) => setImages(r.items))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading || !isLoaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t("upload.analyzing")}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxEarnings = Math.max(
    ...(analytics?.weeklyTrend.map((d) => d.earnings) ?? [1]),
  );

  // Show error state when analytics data is unavailable
  if (error || !analytics) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t("nav.analytics")}</Text>
            <Text style={styles.subtitle}>{t("home.statEarnings")}</Text>
          </View>
          <View
            style={{ alignItems: "center", paddingVertical: SPACING["3xl"] }}
          >
            <Ionicons
              name="bar-chart"
              size={48}
              color={COLORS.textMuted}
              style={{ marginBottom: SPACING.md }}
            />
            <Text
              style={{
                fontSize: FONTS.sizes.lg,
                fontWeight: FONTS.weights.bold,
                color: COLORS.textPrimary,
                marginBottom: SPACING.sm,
                textAlign: "center",
              }}
            >
              Analytics Unavailable
            </Text>
            <Text
              style={{
                fontSize: FONTS.sizes.sm,
                color: COLORS.textMuted,
                textAlign: "center",
                lineHeight: 22,
                paddingHorizontal: SPACING.xl,
              }}
            >
              {error ||
                "No analytics data available. Upload and analyze catches to see your dashboard."}
            </Text>
          </View>

          {/* Still show catch history if we have images */}
          {images && images.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t("upload.title")}</Text>
              {images.slice(0, 5).map((img) => (
                <Card
                  key={img.imageId}
                  padding={SPACING.base}
                  style={styles.catchItem}
                >
                  <View style={styles.catchRow}>
                    <View style={styles.catchLeft}>
                      <Ionicons
                        name="fish-outline"
                        size={22}
                        color={COLORS.primaryLight}
                      />
                      <View>
                        <Text style={styles.catchSpecies}>
                          {img.status === "failed"
                            ? "Analysis Failed"
                            : (img.analysisResult?.species ?? "Pending")}
                        </Text>
                        <Text style={styles.catchDate}>
                          {new Date(img.createdAt).toLocaleDateString("en-IN")}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.catchRight}>
                      {img.status === "failed" ? (
                        <View
                          style={[
                            styles.catchGrade,
                            { backgroundColor: COLORS.error + "20" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.catchGradeText,
                              { color: COLORS.error },
                            ]}
                          >
                            FAILED
                          </Text>
                        </View>
                      ) : img.analysisResult ? (
                        <>
                          <View
                            style={[
                              styles.catchGrade,
                              {
                                backgroundColor:
                                  GRADE_COLORS[
                                    img.analysisResult.qualityGrade ??
                                      "Standard"
                                  ] + "20",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.catchGradeText,
                                {
                                  color:
                                    GRADE_COLORS[
                                      img.analysisResult.qualityGrade ??
                                        "Standard"
                                    ],
                                },
                              ]}
                            >
                              {img.analysisResult.qualityGrade ?? "—"}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View
                          style={[
                            styles.catchGrade,
                            { backgroundColor: COLORS.warning + "20" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.catchGradeText,
                              { color: COLORS.warning },
                            ]}
                          >
                            PENDING
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t("nav.analytics")}</Text>
          <Text style={styles.subtitle}>{t("home.statEarnings")}</Text>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsGrid}>
          <StatCard
            label={t("home.statEarnings")}
            value={`₹${analytics ? (analytics.totalEarnings / 1000).toFixed(1) + "K" : "—"}`}
            icon={
              <Ionicons
                name="cash-outline"
                size={20}
                color={COLORS.secondary}
              />
            }
            accentColor={COLORS.secondary}
            style={styles.statCard}
          />
          <StatCard
            label={t("home.statCatches")}
            value={`${analytics?.totalCatches ?? "—"}`}
            icon={
              <Ionicons name="fish-outline" size={20} color={COLORS.primary} />
            }
            accentColor={COLORS.primary}
            style={styles.statCard}
          />
          <StatCard
            label={t("map.weight")}
            value={`${analytics ? analytics.avgWeight.toFixed(0) : "—"}g`}
            icon={
              <Ionicons name="scale-outline" size={20} color={COLORS.accent} />
            }
            accentColor={COLORS.accent}
            style={styles.statCard}
          />
          <StatCard
            label={t("home.insightSpecies")}
            value={analytics?.topSpecies?.split(" ")[0] ?? "—"}
            icon={<Ionicons name="trophy-outline" size={20} color="#7c3aed" />}
            accentColor="#7c3aed"
            style={styles.statCard}
          />
        </View>

        {/* Earnings Chart */}
        <Text style={styles.sectionTitle}>{t("home.statEarnings")}</Text>
        <Card padding={SPACING.base} style={styles.chartCard}>
          <View style={styles.barChart}>
            {analytics?.weeklyTrend.map((day) => {
              const barHeight = Math.max((day.earnings / maxEarnings) * 120, 8);
              return (
                <View key={day.date} style={styles.barWrapper}>
                  <Text style={styles.barValue}>
                    ₹{(day.earnings / 1000).toFixed(0)}k
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        { height: barHeight, backgroundColor: COLORS.primary },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{day.date}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Species Breakdown */}
        <Text style={styles.sectionTitle}>{t("home.insightSpecies")}</Text>
        <Card padding={SPACING.base} style={styles.chartCard}>
          {analytics?.speciesBreakdown.map((s, i) => {
            const colors = [
              COLORS.primary,
              COLORS.secondary,
              COLORS.accent,
              "#7c3aed",
            ];
            const color = colors[i % colors.length];
            return (
              <View key={s.name} style={styles.speciesRow}>
                <View style={styles.speciesLeft}>
                  <View
                    style={[styles.speciesDot, { backgroundColor: color }]}
                  />
                  <Text style={styles.speciesName}>{s.name}</Text>
                </View>
                <View style={styles.speciesBarContainer}>
                  <View
                    style={[
                      styles.speciesBar,
                      {
                        width: `${s.percentage}%`,
                        backgroundColor: color + "80",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.speciesPct}>{s.percentage}%</Text>
              </View>
            );
          })}
        </Card>

        {/* Quality Distribution */}
        <Text style={styles.sectionTitle}>{t("upload.species")}</Text>
        <View style={styles.qualityRow}>
          {analytics?.qualityDistribution.map((q) => (
            <Card
              key={q.grade}
              padding={SPACING.base}
              style={styles.qualityCard}
            >
              <View
                style={[
                  styles.qualityDot,
                  { backgroundColor: GRADE_COLORS[q.grade] },
                ]}
              />
              <Text
                style={[styles.qualityGrade, { color: GRADE_COLORS[q.grade] }]}
              >
                {q.grade}
              </Text>
              <Text style={styles.qualityCount}>{q.count}</Text>
              <Text style={styles.qualityLabel}>{t("home.statCatches")}</Text>
            </Card>
          ))}
        </View>

        {/* Catch History */}
        <Text style={styles.sectionTitle}>{t("upload.title")}</Text>
        {images && images.length > 0 && images.slice(0, 5).map((img) => (
          <Card
            key={img.imageId}
            padding={SPACING.base}
            style={styles.catchItem}
          >
            <View style={styles.catchRow}>
              <View style={styles.catchLeft}>
                <Ionicons
                  name="fish-outline"
                  size={22}
                  color={COLORS.primaryLight}
                />
                <View>
                  <Text style={styles.catchSpecies}>
                    {img.status === "failed"
                      ? "Analysis Failed"
                      : (img.analysisResult?.species ?? "Pending")}
                  </Text>
                  <Text style={styles.catchDate}>
                    {new Date(img.createdAt).toLocaleDateString("en-IN")}
                  </Text>
                </View>
              </View>
              <View style={styles.catchRight}>
                {img.status === "failed" ? (
                  <View
                    style={[
                      styles.catchGrade,
                      { backgroundColor: COLORS.error + "20" },
                    ]}
                  >
                    <Text
                      style={[styles.catchGradeText, { color: COLORS.error }]}
                    >
                      FAILED
                    </Text>
                  </View>
                ) : img.analysisResult ? (
                  <>
                    <View
                      style={[
                        styles.catchGrade,
                        {
                          backgroundColor:
                            GRADE_COLORS[
                              img.analysisResult.qualityGrade ?? "Standard"
                            ] + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catchGradeText,
                          {
                            color:
                              GRADE_COLORS[
                                img.analysisResult.qualityGrade ?? "Standard"
                              ],
                          },
                        ]}
                      >
                        {img.analysisResult.qualityGrade ?? "—"}
                      </Text>
                    </View>
                    <Text style={styles.catchWeight}>
                      {(img.analysisResult.measurements?.weight_g
                        ? img.analysisResult.measurements.weight_g / 1000
                        : img.analysisResult.weightEstimate
                      ).toFixed(2)}{" "}
                      kg
                    </Text>
                    <Text style={styles.catchValue}>
                      ₹
                      {img.analysisResult.marketEstimate?.estimated_value ??
                        Math.round(
                          img.analysisResult.marketPriceEstimate *
                            img.analysisResult.weightEstimate,
                        )}
                    </Text>
                  </>
                ) : (
                  <View
                    style={[
                      styles.catchGrade,
                      { backgroundColor: COLORS.warning + "20" },
                    ]}
                  >
                    <Text
                      style={[styles.catchGradeText, { color: COLORS.warning }]}
                    >
                      PENDING
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  scroll: { flex: 1 },
  content: { padding: SPACING.xl, paddingBottom: SPACING["4xl"] },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  loadingText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },

  header: { marginBottom: SPACING.xl },
  title: {
    fontSize: FONTS.sizes["3xl"],
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.extrabold,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },

  sectionTitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  statCard: { width: "47%" },

  chartCard: { marginBottom: SPACING.xl },

  // Bar Chart
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 160,
  },
  barWrapper: { alignItems: "center", flex: 1, gap: SPACING.xs },
  barValue: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  barTrack: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: SPACING.xs,
  },
  bar: { borderRadius: RADIUS.sm, minWidth: 16 },
  barLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSubtle },

  // Species
  speciesRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  speciesLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    width: 80,
  },
  speciesDot: { width: 8, height: 8, borderRadius: 4 },
  speciesName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  speciesBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  speciesBar: { height: "100%", borderRadius: RADIUS.full },
  speciesPct: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    width: 35,
    textAlign: "right",
  },

  // Quality
  qualityRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  qualityCard: { flex: 1, alignItems: "center" },
  qualityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: SPACING.sm,
  },
  qualityGrade: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
  qualityCount: {
    fontSize: FONTS.sizes["2xl"],
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.extrabold,
    marginTop: SPACING.xs,
  },
  qualityLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

  // Insights
  insightsCard: { marginBottom: SPACING.xl },
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  insightBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },

  insightText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Catch History
  catchItem: { marginBottom: SPACING.md },
  catchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catchLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.md },

  catchSpecies: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
  },
  catchDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  catchRight: { alignItems: "flex-end", gap: SPACING.xs },
  catchGrade: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  catchGradeText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  catchWeight: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semibold,
  },
  catchValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.success,
    fontWeight: FONTS.weights.bold,
  },
});

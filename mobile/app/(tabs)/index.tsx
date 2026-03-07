import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { getAnalytics } from "../../lib/api-client";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { useLanguage } from "../../lib/i18n";
import { Card, StatCard } from "../../components/ui/Card";
import { ProfileMenu } from "../../components/ui/ProfileMenu";

type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export default function HomeScreen() {
  const { user } = useAuth();
  const { t, isLoaded } = useLanguage();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    getAnalytics()
      .then(setAnalytics)
      .catch(() => {});
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("home.greetingMorning")
      : hour < 17
        ? t("home.greetingAfternoon")
        : t("home.greetingEvening");

  if (!isLoaded) return null;

  const QUICK_PROMPTS: {
    icon: IoniconName;
    label: string;
    prompt: string;
    color: string;
  }[] = [
    {
      icon: "sunny",
      label: "Daily Briefing",
      prompt:
        "Give me my daily fishing briefing — weather, best zones, market prices, and safety alerts.",
      color: COLORS.secondary,
    },
    {
      icon: "cash",
      label: "Market Prices",
      prompt:
        "What are today's fish market prices? Which species are trending up?",
      color: "#06b6d4",
    },
    {
      icon: "navigate",
      label: "Best Zones",
      prompt: "What are the best fishing zones near me right now?",
      color: COLORS.accent,
    },
    {
      icon: "warning",
      label: "Safety Alerts",
      prompt:
        "Are there any active safety alerts or weather warnings near my location?",
      color: "#ef4444",
    },
  ];

  const TOOLS: {
    icon: IoniconName;
    title: string;
    desc: string;
    route: string;
    color: string;
  }[] = [
    {
      icon: "camera",
      title: t("nav.upload"),
      desc: t("home.toolUploadDesc"),
      route: "/upload",
      color: COLORS.primary,
    },
    {
      icon: "map",
      title: t("nav.oceanMap"),
      desc: t("home.toolMapDesc"),
      route: "/map",
      color: COLORS.secondary,
    },
    {
      icon: "time",
      title: "History",
      desc: "Past catches & records",
      route: "/history",
      color: "#7c3aed",
    },
    {
      icon: "bar-chart",
      title: t("nav.analytics"),
      desc: t("home.toolAnalyticsDesc"),
      route: "/analytics",
      color: COLORS.accent,
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.userName}>{user?.name ?? "Fisherman"}</Text>
          </View>
          <ProfileMenu size={36} />
        </View>

        {/* Agent Hero Banner */}
        <TouchableOpacity
          style={styles.agentBanner}
          onPress={() => router.push("/(tabs)/chat")}
          activeOpacity={0.85}
        >
          <View style={styles.agentBannerContent}>
            <View style={styles.agentBannerIcon}>
              <Ionicons name="chatbubble" size={22} color="#fff" />
            </View>
            <View style={styles.agentBannerText}>
              <View style={styles.agentBadgeRow}>
                <View style={styles.agentLiveBadge}>
                  <View style={styles.agentLiveDot} />
                  <Text style={styles.agentLiveBadgeText}>AI AGENT</Text>
                </View>
              </View>
              <Text style={styles.agentBannerTitle}>
                Your Fishing Assistant
              </Text>
              <Text style={styles.agentBannerSub}>
                Ask about weather, market prices, catch analysis, safety alerts
                & more
              </Text>
            </View>
          </View>
          <View style={styles.agentBannerArrow}>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="rgba(255,255,255,0.7)"
            />
          </View>
          <View style={styles.decoCircle1} />
          <View style={styles.decoCircle2} />
        </TouchableOpacity>

        {/* Quick Ask Agent Prompts */}
        <Text style={styles.sectionTitle}>Ask the Agent</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.promptRow}
        >
          {QUICK_PROMPTS.map((p) => (
            <TouchableOpacity
              key={p.label}
              style={styles.promptCard}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/chat",
                  params: { initialMessage: p.prompt },
                })
              }
              activeOpacity={0.75}
            >
              <View
                style={[styles.promptIcon, { backgroundColor: p.color + "18" }]}
              >
                <Ionicons name={p.icon} size={16} color={p.color} />
              </View>
              <Text style={styles.promptLabel}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stats */}
        <Text style={styles.sectionTitle}>{t("home.overview")}</Text>
        <View style={styles.statsGrid}>
          <StatCard
            label={t("home.statEarnings")}
            value={
              analytics
                ? `₹${(analytics.totalEarnings / 1000).toFixed(0)}K`
                : "—"
            }
            icon={<Ionicons name="cash" size={20} color={COLORS.secondary} />}
            accentColor={COLORS.secondary}
            style={styles.statCard}
          />
          <StatCard
            label={t("home.statCatches")}
            value={analytics ? `${analytics.totalCatches}` : "—"}
            icon={<Ionicons name="fish" size={20} color={COLORS.primary} />}
            accentColor={COLORS.primary}
            style={styles.statCard}
          />
          <StatCard
            label={t("home.statZones")}
            value="12"
            icon={<Ionicons name="boat" size={20} color={COLORS.accent} />}
            accentColor={COLORS.accent}
            style={styles.statCard}
          />
          <StatCard
            label={t("home.statEco")}
            value="88/100"
            icon={<Ionicons name="leaf" size={20} color="#06b6d4" />}
            accentColor="#06b6d4"
            style={styles.statCard}
          />
        </View>

        {/* Tools */}
        <Text style={styles.sectionTitle}>{t("home.tools")}</Text>
        <View style={styles.toolsGrid}>
          {TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.title}
              style={[styles.toolCard, { borderColor: tool.color + "30" }]}
              onPress={() => router.push(tool.route as any)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.toolIcon,
                  { backgroundColor: tool.color + "18" },
                ]}
              >
                <Ionicons name={tool.icon} size={18} color={tool.color} />
              </View>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolDesc}>{tool.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Insights */}
        <Text style={styles.sectionTitle}>{t("home.insights")}</Text>
        <Card style={styles.insightCard} padding={SPACING.md}>
          {[
            {
              icon: "time-outline" as IoniconName,
              label: t("home.insightTime"),
              value: "5:00–8:00 AM",
            },
            {
              icon: "fish-outline" as IoniconName,
              label: t("home.insightSpecies"),
              value: analytics?.topSpecies ?? "Indian Pomfret",
            },
            {
              icon: "leaf-outline" as IoniconName,
              label: t("home.insightSustainability"),
              value: "88/100",
            },
            {
              icon: "trending-up-outline" as IoniconName,
              label: t("home.insightMarket"),
              value: "Pomfret ↑12%",
            },
          ].map((item, i) => (
            <View
              key={item.label}
              style={[styles.insightRow, i > 0 && styles.insightRowBorder]}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={COLORS.primaryLight}
                style={{ marginRight: SPACING.sm }}
              />
              <Text style={styles.insightLabel}>{item.label}</Text>
              <Text style={styles.insightValue}>{item.value}</Text>
            </View>
          ))}
        </Card>

        {/* Bottom CTA */}
        <TouchableOpacity
          style={styles.bottomCta}
          onPress={() => router.push("/(tabs)/chat")}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubble" size={18} color="#fff" />
          <Text style={styles.bottomCtaText}>Talk to AI Agent</Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color="rgba(255,255,255,0.7)"
          />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING["3xl"] },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.medium,
  },
  userName: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: FONTS.sizes.base,
    color: "#fff",
    fontWeight: FONTS.weights.bold,
  },

  /* Agent Banner */
  agentBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    overflow: "hidden",
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  agentBannerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    zIndex: 2,
  },
  agentBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  agentBannerText: {
    flex: 1,
  },
  agentBadgeRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  agentLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  agentLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ade80",
  },
  agentLiveBadgeText: {
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.5,
  },
  agentBannerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: "#fff",
    marginBottom: 2,
  },
  agentBannerSub: {
    fontSize: FONTS.sizes.xs,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 16,
  },
  agentBannerArrow: {
    zIndex: 2,
    marginLeft: 8,
  },
  decoCircle1: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.06)",
    right: -20,
    top: -20,
  },
  decoCircle2: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.04)",
    right: 50,
    bottom: -15,
  },

  /* Quick ask prompts */
  promptRow: {
    gap: 10,
    paddingBottom: 4,
    marginBottom: SPACING.lg,
  },
  promptCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    gap: 6,
    minWidth: 90,
  },
  promptIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  promptLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  sectionTitle: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: { width: "47%", flexGrow: 1 },

  /* Tools grid */
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  toolCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.sm,
    gap: 4,
  },
  toolIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  toolTitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
  },
  toolDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },

  /* Insights */
  insightCard: { marginBottom: SPACING.lg },
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  insightRowBorder: { borderTopWidth: 1, borderColor: COLORS.border },
  insightLabel: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.medium,
  },
  insightValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
  },

  /* Bottom CTA */
  bottomCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    gap: 8,
    marginTop: SPACING.xs,
  },
  bottomCtaText: {
    color: "#fff",
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    letterSpacing: 0.3,
  },
});

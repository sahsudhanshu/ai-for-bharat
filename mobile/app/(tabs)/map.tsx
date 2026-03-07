import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Dimensions,
  Platform,
  PixelRatio,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, {
  Marker,
  Circle as MapCircle,
  UrlTile,
  PROVIDER_DEFAULT,
  Region,
} from "react-native-maps";
import * as Location from "expo-location";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getMapData, getLocationWeather } from "../../lib/api-client";
import type { MapMarker } from "../../lib/api-client";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  FISH_SPECIES,
} from "../../lib/constants";
import { useLanguage } from "../../lib/i18n";
import { useNetwork } from "../../lib/network-context";
import { Button } from "../../components/ui/Button";
import {
  fetchLiveAlerts,
  computeSafetyStatus,
  getSeverityColor,
  getAlertIcon,
} from "../../lib/alerts";
import type { DisasterAlert } from "../../lib/alerts";
import { DisasterAlerts } from "../../components/map/DisasterAlerts";
import {
  checkAndNotifyNearbyAlerts,
  setupNotificationListener,
  initializeNotificationService,
} from "../../lib/notification-service";
import { FishermanTools } from "../../components/map/FishermanTools";
import { ZoneInsights } from "../../components/map/ZoneInsights";
import {
  WeatherLayers,
  WeatherLayerControls,
  type WeatherLayer,
} from "../../components/map/WeatherLayers";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { ProfileMenu } from "../../components/ui/ProfileMenu";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// High-DPI tile support
const TILE_SIZE = 256;
const SCALE = PixelRatio.get();
const USE_RETINA = SCALE >= 2;

const GRADE_COLORS: Record<string, string> = {
  Premium: COLORS.success,
  Standard: COLORS.warning,
  Low: COLORS.error,
};

const OWM_API_KEY = process.env.EXPO_PUBLIC_OWM_API_KEY || "";

// India-only bounds
const INDIA_REGION: Region = {
  latitude: 16.0,
  longitude: 76.0,
  latitudeDelta: 25,
  longitudeDelta: 25,
};

const INDIA_BOUNDARY = {
  northEast: { latitude: 38.0, longitude: 100.0 },
  southWest: { latitude: 4.0, longitude: 64.0 },
};

const WEATHER_LAYERS: {
  id: WeatherLayer | "none";
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { id: "none", label: "Catches", icon: "fish-outline" },
  { id: "temperature", label: "Temp", icon: "thermometer-outline" },
  { id: "wind", label: "Wind", icon: "flag-outline" },
  { id: "pressure", label: "Pressure", icon: "radio-button-off-outline" },
  { id: "clouds", label: "Clouds", icon: "cloudy-outline" },
];

interface TappedWeather {
  latitude: number;
  longitude: number;
  current?: {
    temperature: number;
    windSpeed: number;
    windDirection: number;
    pressure: number;
    humidity: number;
    conditions: string;
    icon: string;
  };
  forecast?: Array<{
    time: string;
    temperature: number;
    conditions: string;
    icon: string;
  }>;
  location?: {
    name: string;
    latitude: number;
    longitude: number;
  };
  loading: boolean;
  error?: string;
}

export default function MapScreen() {
  const { t, isLoaded } = useLanguage();
  const { effectiveMode, connectionQuality } = useNetwork();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [filterSpecies, setFilterSpecies] = useState("All Species");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeWeatherLayer, setActiveWeatherLayer] =
    useState<WeatherLayer | null>(null);
  const [layerOpacity, setLayerOpacity] = useState(0.7);
  const [tappedWeather, setTappedWeather] = useState<TappedWeather | null>(
    null,
  );
  const [bottomSheet, setBottomSheet] = useState<
    "none" | "tools" | "insights" | "alerts" | "layers"
  >("none");
  const mapRef = useRef<MapView>(null);

  // Alerts
  const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);

  // User location
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const safetyStatus = useMemo(() => {
    if (!userLocation) return null;
    return computeSafetyStatus(
      userLocation.latitude,
      userLocation.longitude,
      alerts,
    );
  }, [userLocation, alerts]);

  // Fetch user location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    })();
  }, []);

  // Load persisted layer preference
  useEffect(() => {
    const loadLayerPreference = async () => {
      try {
        const savedLayer = await AsyncStorage.getItem("@map_weather_layer");
        const savedOpacity = await AsyncStorage.getItem("@map_layer_opacity");
        if (savedLayer && savedLayer !== "none") {
          setActiveWeatherLayer(savedLayer as WeatherLayer);
        }
        if (savedOpacity) {
          setLayerOpacity(parseFloat(savedOpacity));
        }
      } catch (error) {
        console.warn("Failed to load layer preference:", error);
      }
    };
    loadLayerPreference();
  }, []);

  // Persist layer preference when it changes
  useEffect(() => {
    const saveLayerPreference = async () => {
      try {
        await AsyncStorage.setItem(
          "@map_weather_layer",
          activeWeatherLayer || "none",
        );
      } catch (error) {
        console.warn("Failed to save layer preference:", error);
      }
    };
    saveLayerPreference();
  }, [activeWeatherLayer]);

  // Persist opacity preference when it changes
  useEffect(() => {
    const saveOpacityPreference = async () => {
      try {
        await AsyncStorage.setItem("@map_layer_opacity", String(layerOpacity));
      } catch (error) {
        console.warn("Failed to save opacity preference:", error);
      }
    };
    saveOpacityPreference();
  }, [layerOpacity]);

  // Initialize notification service
  useEffect(() => {
    initializeNotificationService();

    // Set up notification tap handler
    const subscription = setupNotificationListener((alertId) => {
      // When user taps notification, open alerts bottom sheet
      setBottomSheet("alerts");
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Fetch live alerts
  useEffect(() => {
    fetchLiveAlerts(OWM_API_KEY)
      .then(setAlerts)
      .catch(console.error)
      .finally(() => setAlertsLoading(false));
    const timer = setInterval(
      () => {
        fetchLiveAlerts(OWM_API_KEY).then(setAlerts).catch(console.error);
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(timer);
  }, []);

  // Check for nearby critical alerts and send notifications
  useEffect(() => {
    if (alerts.length > 0 && userLocation) {
      checkAndNotifyNearbyAlerts(alerts, userLocation);
    }
  }, [alerts, userLocation]);

  // Fetch map data
  useEffect(() => {
    loadMapData();
  }, [filterSpecies]);

  const loadMapData = async () => {
    setLoading(true);
    try {
      const data = await getMapData(
        filterSpecies !== "All Species"
          ? { species: filterSpecies }
          : undefined,
      );
      setMarkers(data.markers);
    } catch {
      setMarkers([]);
    } finally {
      setLoading(false);
    }
  };

  // Optimize marker rendering - limit to visible markers and use memoization
  const filteredMarkers = useMemo(() => {
    const filtered =
      filterSpecies === "All Species"
        ? markers
        : markers.filter((m) => m.species === filterSpecies);

    // Limit to 30 most recent markers for fast loading
    return filtered.slice(0, 30);
  }, [markers, filterSpecies]);

  const handleMapPress = useCallback(async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedMarker(null);
    setBottomSheet("none");
    setTappedWeather({ latitude, longitude, loading: true });
    try {
      const weatherData = await getLocationWeather(latitude, longitude);
      setTappedWeather({
        latitude,
        longitude,
        current: weatherData.current,
        forecast: weatherData.forecast,
        location: weatherData.location,
        loading: false,
      });
    } catch (error) {
      console.error("Failed to fetch location weather:", error);
      setTappedWeather({
        latitude,
        longitude,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load weather data",
      });
    }
  }, []);

  const handleLocateUser = useCallback(() => {
    if (!mapRef.current) return;
    if (userLocation) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 2,
          longitudeDelta: 2,
        },
        800,
      );
    }
  }, [userLocation]);

  if (!isLoaded) return null;

  const topAlert =
    alerts.length > 0
      ? [...alerts].sort((a, b) => {
          const o: Record<string, number> = { red: 0, orange: 1, yellow: 2 };
          return o[a.severity] - o[b.severity];
        })[0]
      : null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Offline Overlay */}
      {effectiveMode === "offline" && (
        <View style={styles.offlineOverlay}>
          <View style={styles.offlineCard}>
            <Ionicons
              name={
                connectionQuality === "poor"
                  ? "speedometer-outline"
                  : "cloud-offline"
              }
              size={48}
              color={COLORS.warning}
            />
            <Text style={styles.offlineTitle}>
              {connectionQuality === "poor"
                ? "Slow Connection"
                : "No Internet Connection"}
            </Text>
            <Text style={styles.offlineText}>
              {connectionQuality === "poor"
                ? "Ocean Map requires a stable internet connection. Your connection is too slow to load real-time data."
                : "Ocean Map requires an active internet connection to display real-time data and alerts."}
            </Text>
          </View>
        </View>
      )}

      {/* ── Alert Banner ─────────────────────────────────── */}
      {topAlert && (
        <TouchableOpacity
          style={[
            styles.alertBanner,
            { borderColor: getSeverityColor(topAlert.severity) + "40" },
          ]}
          onPress={() => setBottomSheet("alerts")}
          activeOpacity={0.8}
        >
          <Ionicons
            name={
              getAlertIcon(topAlert.type) as React.ComponentProps<
                typeof Ionicons
              >["name"]
            }
            size={22}
            color={getSeverityColor(topAlert.severity)}
            style={{ width: 22 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle} numberOfLines={1}>
              {topAlert.title}
            </Text>
            <Text style={styles.alertDesc} numberOfLines={1}>
              {topAlert.description}
            </Text>
          </View>
          <View
            style={[
              styles.safetyBadge,
              safetyStatus === "UNSAFE" ? styles.unsafeBadge : styles.safeBadge,
            ]}
          >
            <Text
              style={[
                styles.safetyText,
                {
                  color:
                    safetyStatus === "UNSAFE" ? COLORS.error : COLORS.success,
                },
              ]}
            >
              {safetyStatus ?? "..."}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Header ───────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("nav.oceanMap")}</Text>
          <Text style={styles.subtitle}>
            {filteredMarkers.length} catches • {alerts.length} alerts
          </Text>
        </View>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Ionicons name="search" size={14} color={COLORS.textSecondary} />
            <Text style={styles.filterBtnText}>
              {filterSpecies === "All Species"
                ? "Filter"
                : filterSpecies.split(" ")[0]}
            </Text>
          </View>
        </TouchableOpacity>
        <ProfileMenu size={36} />
      </View>

      {/* ── Weather Layer Tabs ────────────────────────────── */}
      <View style={styles.layerTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.layerTabsScroll}
        >
          {WEATHER_LAYERS.map((layer) => {
            const isActive =
              layer.id === "none"
                ? !activeWeatherLayer
                : activeWeatherLayer === layer.id;
            return (
              <TouchableOpacity
                key={layer.id}
                style={[styles.layerTab, isActive && styles.layerTabActive]}
                onPress={() =>
                  setActiveWeatherLayer(layer.id === "none" ? null : layer.id)
                }
                activeOpacity={0.8}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Ionicons
                    name={layer.icon}
                    size={13}
                    color={isActive ? COLORS.primaryLight : COLORS.textMuted}
                  />
                  <Text
                    style={[
                      styles.layerTabText,
                      isActive && styles.layerTabTextActive,
                    ]}
                  >
                    {layer.label}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Quick Tools Bar ──────────────────────────────── */}
      <View style={styles.quickBar}>
        {(
          [
            { id: "layers", icon: "layers-outline", label: "Layers" },
            { id: "tools", icon: "compass-outline", label: "Tools" },
            { id: "insights", icon: "analytics-outline", label: "Insights" },
            { id: "alerts", icon: "warning-outline", label: "Alerts" },
          ] as const
        ).map((btn) => {
          const isActive = bottomSheet === btn.id;
          return (
            <TouchableOpacity
              key={btn.id}
              style={[styles.quickBtn, isActive && styles.quickBtnActive]}
              onPress={() =>
                setBottomSheet(bottomSheet === btn.id ? "none" : btn.id)
              }
              activeOpacity={0.7}
            >
              <View style={styles.quickBtnInner}>
                <Ionicons
                  name={btn.icon}
                  size={13}
                  color={isActive ? COLORS.primaryLight : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.quickBtnText,
                    isActive && styles.quickBtnTextActive,
                  ]}
                >
                  {btn.label}
                  {btn.id === "alerts" && alerts.length > 0
                    ? ` (${alerts.length})`
                    : ""}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={handleLocateUser}
          activeOpacity={0.7}
        >
          <View style={styles.quickBtnInner}>
            <Ionicons
              name="locate-outline"
              size={13}
              color={COLORS.textSecondary}
            />
            <Text style={styles.quickBtnText}>Me</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Map ──────────────────────────────────────────── */}
      <View style={styles.mapContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={INDIA_REGION}
          mapType="none"
          showsUserLocation
          showsCompass
          showsMyLocationButton={false}
          minZoomLevel={4}
          maxZoomLevel={20}
          loadingEnabled={false}
          moveOnMarkerPress={false}
          pitchEnabled={false}
          rotateEnabled={false}
          scrollEnabled={true}
          zoomEnabled={true}
          zoomTapEnabled={true}
          zoomControlEnabled={false}
          toolbarEnabled={false}
          onPress={handleMapPress}
        >
          {/* Google Satellite Tiles - High-DPI optimized */}
          <UrlTile
            urlTemplate={
              USE_RETINA
                ? "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}&scale=2"
                : "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
            }
            maximumZ={20}
            minimumZ={4}
            tileSize={TILE_SIZE}
          />
          {/* Weather overlay - only load if active */}
          {activeWeatherLayer && (
            <WeatherLayers
              activeLayer={activeWeatherLayer}
              onLayerChange={setActiveWeatherLayer}
              opacity={layerOpacity}
            />
          )}

          {/* Disaster Alerts Component - only load if there are alerts */}
          {alerts.length > 0 && (
            <DisasterAlerts
              alerts={alerts}
              userLocation={userLocation}
              onAlertPress={(alert) => {
                setSelectedMarker(null);
                setTappedWeather(null);
              }}
            />
          )}

          {/* Zone Insights Component - only load if user location is available */}
          {userLocation && (
            <ZoneInsights
              userLocation={userLocation}
              onZoneSelect={(zoneId) => {
                setSelectedMarker(null);
                setTappedWeather(null);
                setBottomSheet("none");
              }}
              onRefresh={() => {
                // Refresh map data when zone insights are refreshed
                loadMapData();
              }}
            />
          )}

          {/* API fetch markers - Use Circle for better performance */}
          {filteredMarkers.map((marker) => (
            <MapCircle
              key={marker.imageId}
              center={{
                latitude: marker.latitude,
                longitude: marker.longitude,
              }}
              radius={25000}
              fillColor={`${GRADE_COLORS[marker.qualityGrade ?? "Standard"]}99`}
              strokeColor={GRADE_COLORS[marker.qualityGrade ?? "Standard"]}
              strokeWidth={2}
              zIndex={999}
              // @ts-ignore — onPress works at runtime; typedefs for react-native-maps lag behind
              onPress={() => {
                setTappedWeather(null);
                setSelectedMarker(marker);
                setBottomSheet("none");
              }}
            />
          ))}
        </MapView>

        {/* No data message */}
        {!loading && filteredMarkers.length === 0 && (
          <View style={styles.recZone}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 4,
              }}
            >
              <Ionicons
                name="cloudy-night-outline"
                size={18}
                color={COLORS.textMuted}
              />
              <Text style={styles.recZoneTitle}>No Data</Text>
            </View>
            <Text style={styles.recZoneText}>No catch data available</Text>
            <Text style={styles.recZoneSub}>Upload catches to see markers</Text>
          </View>
        )}
      </View>

      {/* ── API Marker Info Sheet ─────────────────────────── */}
      {selectedMarker && (
        <>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setSelectedMarker(null)}
          />
          <View style={styles.infoSheet}>
            <View style={styles.infoSheetHandle} />
            <View style={styles.infoSheetContent}>
              <View style={styles.infoRow}>
                <Text style={styles.infoSpecies}>
                  {selectedMarker.species ?? "Unknown"}
                </Text>
                <View
                  style={[
                    styles.gradeBadge,
                    {
                      backgroundColor:
                        GRADE_COLORS[
                          selectedMarker.qualityGrade ?? "Standard"
                        ] + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.gradeText,
                      {
                        color:
                          GRADE_COLORS[
                            selectedMarker.qualityGrade ?? "Standard"
                          ],
                      },
                    ]}
                  >
                    {selectedMarker.qualityGrade}
                  </Text>
                </View>
              </View>
              <View style={styles.infoDetails}>
                <View style={styles.infoDetailItem}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Ionicons
                      name="scale-outline"
                      size={12}
                      color={COLORS.textMuted}
                    />
                    <Text style={styles.infoDetailLabel}>Weight</Text>
                  </View>
                  <Text style={styles.infoDetailValue}>
                    {selectedMarker.weight_g
                      ? `${(selectedMarker.weight_g / 1000).toFixed(2)} kg`
                      : "—"}
                  </Text>
                </View>
                <View style={styles.infoDetailItem}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Ionicons
                      name="location-outline"
                      size={12}
                      color={COLORS.textMuted}
                    />
                    <Text style={styles.infoDetailLabel}>Location</Text>
                  </View>
                  <Text style={styles.infoDetailValue}>
                    {selectedMarker.latitude.toFixed(3)}°N
                  </Text>
                </View>
                <View style={styles.infoDetailItem}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={12}
                      color={COLORS.textMuted}
                    />
                    <Text style={styles.infoDetailLabel}>Date</Text>
                  </View>
                  <Text style={styles.infoDetailValue}>
                    {new Date(selectedMarker.createdAt).toLocaleDateString(
                      "en-IN",
                    )}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  const msg = `Tell me about ${selectedMarker.species} fishing in this area (${selectedMarker.latitude.toFixed(4)}°N, ${selectedMarker.longitude.toFixed(4)}°E). What are the current conditions, best practices, and market outlook?`;
                  setSelectedMarker(null);
                  router.push({
                    pathname: "/(tabs)/chat",
                    params: { initialMessage: msg },
                  });
                }}
                style={styles.askAgentBtn}
              >
                <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
                <Text style={styles.askAgentBtnText}>
                  Ask Agent About This Zone
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedMarker(null)}
                style={styles.dismissBtn}
              >
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ── Tapped Weather Modal ──────────────────────────── */}
      <Modal
        visible={!!tappedWeather && !selectedMarker}
        transparent
        animationType="slide"
        onRequestClose={() => setTappedWeather(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.weatherModal}>
            <View style={styles.infoSheetHandle} />
            <View style={styles.weatherModalHeader}>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color={COLORS.primaryLight}
                  />
                  <Text style={styles.weatherModalTitle}>
                    {tappedWeather?.location?.name || "Location Weather"}
                  </Text>
                </View>
                <Text style={styles.coordText}>
                  {tappedWeather?.latitude.toFixed(4)}°N,{" "}
                  {tappedWeather?.longitude.toFixed(4)}°E
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setTappedWeather(null)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {tappedWeather?.loading ? (
              <View style={styles.weatherLoadingContainer}>
                <ActivityIndicator
                  size="large"
                  color={COLORS.primaryLight}
                  style={{ marginVertical: SPACING.xl }}
                />
                <Text style={styles.weatherLoadingText}>
                  Loading weather data...
                </Text>
              </View>
            ) : tappedWeather?.error ? (
              <View style={styles.weatherErrorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={48}
                  color={COLORS.error}
                  style={{ marginBottom: SPACING.md }}
                />
                <Text style={styles.weatherErrorTitle}>
                  Failed to Load Weather
                </Text>
                <Text style={styles.weatherErrorText}>
                  {tappedWeather.error}
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    if (tappedWeather) {
                      handleMapPress({
                        nativeEvent: {
                          coordinate: {
                            latitude: tappedWeather.latitude,
                            longitude: tappedWeather.longitude,
                          },
                        },
                      });
                    }
                  }}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={16}
                    color={COLORS.primaryLight}
                  />
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : tappedWeather?.current ? (
              <ScrollView
                style={styles.weatherModalContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Current Conditions */}
                <View style={styles.currentWeatherSection}>
                  <Text style={styles.sectionTitle}>Current Conditions</Text>
                  <View style={styles.currentWeatherCard}>
                    <View style={styles.currentWeatherMain}>
                      <Text style={styles.currentTemp}>
                        {tappedWeather.current.temperature.toFixed(1)}°C
                      </Text>
                      <Text style={styles.currentConditions}>
                        {tappedWeather.current.conditions}
                      </Text>
                    </View>
                  </View>

                  {/* Weather Details Grid — 2×2 */}
                  <View style={styles.weatherDetailsGrid}>
                    <View style={styles.weatherDetailCard}>
                      <Ionicons
                        name="flag-outline"
                        size={22}
                        color={COLORS.primaryLight}
                      />
                      <Text style={styles.weatherDetailLabel}>Wind Speed</Text>
                      <Text style={styles.weatherDetailValue}>
                        {tappedWeather.current.windSpeed.toFixed(1)} m/s
                      </Text>
                    </View>

                    <View style={styles.weatherDetailCard}>
                      <Ionicons
                        name="compass-outline"
                        size={22}
                        color={COLORS.primaryLight}
                      />
                      <Text style={styles.weatherDetailLabel}>Wind Dir.</Text>
                      <Text style={styles.weatherDetailValue}>
                        {tappedWeather.current.windDirection}°
                      </Text>
                    </View>

                    <View style={styles.weatherDetailCard}>
                      <Ionicons
                        name="speedometer-outline"
                        size={22}
                        color={COLORS.primaryLight}
                      />
                      <Text style={styles.weatherDetailLabel}>Pressure</Text>
                      <Text style={styles.weatherDetailValue}>
                        {tappedWeather.current.pressure} hPa
                      </Text>
                    </View>

                    <View style={styles.weatherDetailCard}>
                      <Ionicons
                        name="water-outline"
                        size={22}
                        color={COLORS.primaryLight}
                      />
                      <Text style={styles.weatherDetailLabel}>Humidity</Text>
                      <Text style={styles.weatherDetailValue}>
                        {tappedWeather.current.humidity}%
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 24-Hour Forecast */}
                {tappedWeather.forecast &&
                  tappedWeather.forecast.length > 0 && (
                    <View style={styles.forecastSection}>
                      <Text style={styles.sectionTitle}>24-Hour Forecast</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.forecastScroll}
                      >
                        {tappedWeather.forecast.map((item, index) => {
                          const forecastTime = new Date(item.time);
                          const hours = forecastTime.getHours();
                          const timeStr = `${hours.toString().padStart(2, "0")}:00`;

                          return (
                            <View key={index} style={styles.forecastCard}>
                              <Text style={styles.forecastTime}>{timeStr}</Text>
                              <Ionicons
                                name={
                                  item.icon.includes("cloud")
                                    ? "cloudy-outline"
                                    : item.icon.includes("rain")
                                      ? "rainy-outline"
                                      : item.icon.includes("sun")
                                        ? "sunny-outline"
                                        : "partly-sunny-outline"
                                }
                                size={28}
                                color={COLORS.primaryLight}
                                style={{ marginVertical: SPACING.sm }}
                              />
                              <Text style={styles.forecastTemp}>
                                {item.temperature.toFixed(0)}°C
                              </Text>
                              <Text
                                style={styles.forecastConditions}
                                numberOfLines={2}
                              >
                                {item.conditions}
                              </Text>
                            </View>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                <View style={{ height: SPACING.xl }} />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ── Bottom Sheet Backdrop ────────────────────────── */}
      {bottomSheet !== "none" && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setBottomSheet("none")}
        />
      )}

      {/* ── Bottom Sheet: Fisherman Tools ─────────────────── */}
      {bottomSheet === "tools" && userLocation && (
        <View style={styles.bottomSheetContainer}>
          <View style={styles.infoSheetHandle} />
          <View style={styles.bsHeaderRow}>
            <Ionicons
              name="compass-outline"
              size={20}
              color={COLORS.primaryLight}
            />
            <Text style={styles.bsTitle}>Fisherman Tools</Text>
          </View>
          <View style={{ flex: 1 }}>
            <FishermanTools
              location={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }}
              onRefresh={() => {}}
            />
          </View>
          <TouchableOpacity
            onPress={() => setBottomSheet("none")}
            style={styles.dismissBtn}
          >
            <Text style={styles.dismissText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bottom Sheet: Weather Layer Controls ──────────── */}
      {bottomSheet === "layers" && (
        <View style={styles.bottomSheetContainer}>
          <View style={styles.infoSheetHandle} />
          <View style={styles.bsHeaderRow}>
            <Ionicons
              name="layers-outline"
              size={20}
              color={COLORS.primaryLight}
            />
            <Text style={styles.bsTitle}>Weather Layers</Text>
          </View>
          <WeatherLayerControls
            activeLayer={activeWeatherLayer}
            onLayerChange={setActiveWeatherLayer}
            opacity={layerOpacity}
            onOpacityChange={setLayerOpacity}
          />
          <TouchableOpacity
            onPress={() => setBottomSheet("none")}
            style={styles.dismissBtn}
          >
            <Text style={styles.dismissText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bottom Sheet: Live Zone Insights ──────────────── */}
      {bottomSheet === "insights" && (
        <View style={styles.bottomSheetContainer}>
          <View style={styles.infoSheetHandle} />
          <View style={styles.bsHeaderRow}>
            <Ionicons
              name="analytics-outline"
              size={20}
              color={COLORS.primaryLight}
            />
            <Text style={styles.bsTitle}>Live Zone Insights</Text>
          </View>
          <View style={styles.noAlertsBox}>
            <Ionicons
              name="location-outline"
              size={36}
              color={COLORS.primaryLight}
              style={{ marginBottom: SPACING.sm }}
            />
            <Text style={styles.noAlertsText}>
              Zone insights are displayed as markers on the map. Tap any zone
              marker to view detailed fishing recommendations, target species,
              and recent activity statistics.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setBottomSheet("none")}
            style={styles.dismissBtn}
          >
            <Text style={styles.dismissText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bottom Sheet: Alerts ──────────────────────────── */}
      {bottomSheet === "alerts" && (
        <View style={styles.bottomSheetContainer}>
          <View style={styles.infoSheetHandle} />
          <View style={styles.bsHeaderRow}>
            <Ionicons name="warning-outline" size={20} color={COLORS.error} />
            <Text style={styles.bsTitle}>Live Alerts ({alerts.length})</Text>
          </View>
          {alertsLoading ? (
            <ActivityIndicator
              size="small"
              color={COLORS.primaryLight}
              style={{ marginVertical: SPACING.md }}
            />
          ) : alerts.length === 0 ? (
            <View style={styles.noAlertsBox}>
              <Ionicons
                name="checkmark-circle-outline"
                size={36}
                color={COLORS.success}
                style={{ marginBottom: SPACING.sm }}
              />
              <Text style={styles.noAlertsText}>
                All clear! No active weather alerts for Indian coastal waters.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.bsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {alerts.map((alert) => (
                <View
                  key={alert.id}
                  style={[
                    styles.alertCard,
                    { borderLeftColor: getSeverityColor(alert.severity) },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name={
                        getAlertIcon(alert.type) as React.ComponentProps<
                          typeof Ionicons
                        >["name"]
                      }
                      size={20}
                      color={getSeverityColor(alert.severity)}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertCardTitle}>{alert.title}</Text>
                      <Text style={styles.alertCardDesc}>
                        {alert.description}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.alertSource,
                      { color: getSeverityColor(alert.severity) },
                    ]}
                  >
                    {alert.source} • Radius: {alert.radiusKm} km
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
          <TouchableOpacity
            onPress={() => setBottomSheet("none")}
            style={styles.dismissBtn}
          >
            <Text style={styles.dismissText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Species Filter Modal ──────────────────────────── */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Filter by Species</Text>
            {FISH_SPECIES.map((species) => (
              <TouchableOpacity
                key={species}
                style={[
                  styles.modalOption,
                  filterSpecies === species && styles.modalOptionActive,
                ]}
                onPress={() => {
                  setFilterSpecies(species);
                  setFilterModalVisible(false);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    filterSpecies === species && styles.modalOptionTextActive,
                  ]}
                >
                  {species}
                </Text>
                {filterSpecies === species && (
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={COLORS.primaryLight}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },

  // Alert banner
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
  },

  alertTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  alertDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  safetyBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  safeBadge: { backgroundColor: COLORS.success + "20" },
  unsafeBadge: { backgroundColor: COLORS.error + "20" },
  safetyText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  filterBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  filterBtnText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },

  // Layers
  layerTabsContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  layerTabsScroll: { gap: SPACING.sm, paddingHorizontal: SPACING.xs },
  layerTab: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  layerTabActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryLight,
  },
  layerTabText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },
  layerTabTextActive: { color: COLORS.primaryLight },

  // Quick bar
  quickBar: {
    flexDirection: "row",
    paddingHorizontal: SPACING.md,
    gap: 6,
    marginBottom: SPACING.sm,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    paddingVertical: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickBtnInner: { flexDirection: "row", alignItems: "center", gap: 3 },
  quickBtnText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semibold,
  },
  quickBtnActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryLight,
  },
  quickBtnTextActive: {
    color: COLORS.primaryLight,
  },

  // Map
  mapContainer: { flex: 1, position: "relative" },
  map: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bgDark + "aa",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  // Markers
  catchDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 4,
  },
  catchDotText: { fontSize: 14 },
  markerDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 4,
  },

  // Recommended zone
  recZone: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: COLORS.bgCard + "ee",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    maxWidth: 180,
    borderWidth: 1,
    borderColor: COLORS.success + "30",
  },
  recZoneTitle: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.success,
  },
  recZoneText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  recZoneSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Info sheets
  infoSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 90,
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS["2xl"],
    borderTopRightRadius: RADIUS["2xl"],
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingBottom: SPACING.lg,
  },
  infoSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  infoSheetContent: { paddingHorizontal: SPACING.xl },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  infoSpecies: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  gradeBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  gradeText: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
  infoDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  infoDetailItem: { minWidth: 80 },
  infoDetailLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  infoDetailValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semibold,
  },
  dismissText: {
    textAlign: "center",
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },

  // Weather
  coordText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: SPACING.md,
  },
  weatherGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  weatherItem: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minWidth: 75,
    alignItems: "center",
  },

  weatherLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  weatherValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
  },

  // Bottom sheets
  bottomSheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    maxHeight: "65%",
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS["2xl"],
    borderTopRightRadius: RADIUS["2xl"],
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  bsTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    flex: 1,
  },
  bsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingTop: SPACING.xs,
  },
  bsScrollContent: {
    maxHeight: Math.round(SCREEN_H * 0.35),
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 50,
  },
  askAgentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  askAgentBtnText: {
    color: "#fff",
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },
  dismissBtn: {
    alignItems: "center",
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },

  // Tools
  toolsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  toolCard: {
    width: (SCREEN_W - SPACING.xl * 2 - 8) / 2,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },

  toolLabel: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  toolValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  toolSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  seaStateBar: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#3b82f630",
  },
  seaStateText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
  seaStateSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Zone insights
  zoneCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  zoneName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    flex: 1,
  },
  zoneRegion: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  healthBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  healthGood: { backgroundColor: COLORS.success + "15" },
  healthMod: { backgroundColor: COLORS.warning + "15" },
  healthText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
  speciesTag: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  speciesTagText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semibold,
  },
  zoneStats: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  zoneAdvisory: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontStyle: "italic",
  },

  // Alerts
  noAlertsBox: {
    alignItems: "center",
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },

  noAlertsText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  alertCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  alertCardTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  alertCardDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  alertSource: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    marginTop: 6,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS["2xl"],
    borderTopRightRadius: RADIUS["2xl"],
    padding: SPACING.xl,
    paddingBottom: SPACING["3xl"],
  },
  modalTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalOptionActive: {
    backgroundColor: COLORS.primary + "15",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
  },
  modalOptionText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary },
  modalOptionTextActive: {
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.bold,
  },

  // Weather Modal
  weatherModal: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS["2xl"],
    borderTopRightRadius: RADIUS["2xl"],
    maxHeight: "85%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  weatherModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  weatherModalTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgSurface,
  },
  weatherModalContent: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  weatherLoadingContainer: {
    padding: SPACING["3xl"],
    alignItems: "center",
  },
  weatherLoadingText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  weatherErrorContainer: {
    padding: SPACING["3xl"],
    alignItems: "center",
  },
  weatherErrorTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.error,
    marginBottom: SPACING.sm,
  },
  weatherErrorText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  retryButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryLight,
  },
  currentWeatherSection: {
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  currentWeatherCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: "center",
  },
  currentWeatherMain: {
    alignItems: "center",
  },
  currentTemp: {
    fontSize: 36,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryLight,
  },
  currentConditions: {
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textTransform: "capitalize",
  },
  weatherDetailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  weatherDetailCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: (SCREEN_W - SPACING.xl * 2 - SPACING.sm) / 2,
    alignItems: "center",
  },
  weatherDetailLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: "center",
  },
  weatherDetailValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  forecastSection: {
    marginTop: SPACING.lg,
  },
  forecastScroll: {
    gap: SPACING.sm,
    paddingRight: SPACING.xl,
  },
  forecastCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: 90,
    alignItems: "center",
  },
  forecastTime: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textSecondary,
  },
  forecastTemp: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primaryLight,
  },
  forecastConditions: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: "center",
  },

  // Offline overlay
  offlineOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  offlineCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS["2xl"],
    padding: SPACING["2xl"],
    alignItems: "center",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  offlineTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  offlineText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
});

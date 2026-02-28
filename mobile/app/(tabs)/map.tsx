import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle as MapCircle, UrlTile, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { getMapData } from '../../lib/api-client';
import type { MapMarker } from '../../lib/api-client';
import { COLORS, FONTS, SPACING, RADIUS, FISH_SPECIES } from '../../lib/constants';
import { useLanguage } from '../../lib/i18n';
import { Button } from '../../components/ui/Button';
import {
    fetchLiveAlerts,
    computeSafetyStatus,
    getSeverityColor,
    getAlertIcon,
} from '../../lib/alerts';
import type { DisasterAlert } from '../../lib/alerts';
import { OCEAN_CATCH_DATA, ZONE_INSIGHTS } from '../../lib/ocean-mock-data';
import type { OceanCatchPoint } from '../../lib/ocean-mock-data';

const { width: SCREEN_W } = Dimensions.get('window');

const GRADE_COLORS: Record<string, string> = {
    Premium: COLORS.success,
    Standard: COLORS.warning,
    Low: COLORS.error,
};

const OWM_API_KEY = process.env.EXPO_PUBLIC_OWM_API_KEY || '';

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

const WEATHER_LAYERS = [
    { id: 'none', label: '🐟 Catches' },
    { id: 'temp_new', label: '🌡️ Temp' },
    { id: 'wind_new', label: '💨 Wind' },
    { id: 'pressure_new', label: '🔵 Pressure' },
    { id: 'clouds_new', label: '☁️ Clouds' },
];

interface TappedWeather {
    latitude: number;
    longitude: number;
    temp?: number;
    feelsLike?: number;
    wind?: number;
    humidity?: number;
    description?: string;
    loading: boolean;
}

export default function MapScreen() {
    const { t, isLoaded } = useLanguage();
    const [markers, setMarkers] = useState<MapMarker[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
    const [selectedCatch, setSelectedCatch] = useState<OceanCatchPoint | null>(null);
    const [filterSpecies, setFilterSpecies] = useState('All Species');
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [activeWeatherLayer, setActiveWeatherLayer] = useState('none');
    const [tappedWeather, setTappedWeather] = useState<TappedWeather | null>(null);
    const [bottomSheet, setBottomSheet] = useState<'none' | 'tools' | 'insights' | 'alerts'>('none');
    const mapRef = useRef<MapView>(null);

    // Alerts
    const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
    const [alertsLoading, setAlertsLoading] = useState(true);

    // User location
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    const safetyStatus = useMemo(() => {
        if (!userLocation) return null;
        return computeSafetyStatus(userLocation.lat, userLocation.lng, alerts);
    }, [userLocation, alerts]);

    // Fetch user location
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            }
        })();
    }, []);

    // Fetch live alerts
    useEffect(() => {
        fetchLiveAlerts(OWM_API_KEY)
            .then(setAlerts)
            .catch(console.error)
            .finally(() => setAlertsLoading(false));
        const timer = setInterval(() => {
            fetchLiveAlerts(OWM_API_KEY).then(setAlerts).catch(console.error);
        }, 5 * 60 * 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch map data
    useEffect(() => {
        loadMapData();
    }, [filterSpecies]);

    const loadMapData = async () => {
        setLoading(true);
        try {
            const data = await getMapData(
                filterSpecies !== 'All Species' ? { species: filterSpecies } : undefined
            );
            setMarkers(data.markers);
        } catch {
            setMarkers([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredMarkers = filterSpecies === 'All Species'
        ? markers
        : markers.filter((m) => m.species === filterSpecies);

    const handleMapPress = useCallback(async (e: any) => {
        const { latitude, longitude } = e.nativeEvent.coordinate;
        setSelectedMarker(null);
        setSelectedCatch(null);
        setBottomSheet('none');
        setTappedWeather({ latitude, longitude, loading: true });
        try {
            const res = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OWM_API_KEY}&units=metric`
            );
            const data = await res.json();
            setTappedWeather({
                latitude, longitude,
                temp: data.main?.temp, feelsLike: data.main?.feels_like,
                wind: data.wind?.speed, humidity: data.main?.humidity,
                description: data.weather?.[0]?.description, loading: false,
            });
        } catch {
            setTappedWeather(null);
        }
    }, []);

    const handleLocateUser = useCallback(() => {
        if (!mapRef.current) return;
        if (userLocation) {
            mapRef.current.animateToRegion({
                latitude: userLocation.lat, longitude: userLocation.lng,
                latitudeDelta: 2, longitudeDelta: 2,
            }, 800);
        }
    }, [userLocation]);

    if (!isLoaded) return null;

    const weatherTileUrl = activeWeatherLayer !== 'none'
        ? `https://tile.openweathermap.org/map/${activeWeatherLayer}/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`
        : null;

    const topAlert = alerts.length > 0
        ? [...alerts].sort((a, b) => {
            const o: Record<string, number> = { red: 0, orange: 1, yellow: 2 };
            return o[a.severity] - o[b.severity];
        })[0]
        : null;

    return (
        <SafeAreaView style={styles.safe}>
            {/* ── Alert Banner ─────────────────────────────────── */}
            {topAlert && (
                <TouchableOpacity
                    style={[styles.alertBanner, { borderColor: getSeverityColor(topAlert.severity) + '40' }]}
                    onPress={() => setBottomSheet('alerts')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.alertIcon}>{getAlertIcon(topAlert.type)}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.alertTitle} numberOfLines={1}>{topAlert.title}</Text>
                        <Text style={styles.alertDesc} numberOfLines={1}>{topAlert.description}</Text>
                    </View>
                    <View style={[styles.safetyBadge, safetyStatus === 'UNSAFE' ? styles.unsafeBadge : styles.safeBadge]}>
                        <Text style={[styles.safetyText, { color: safetyStatus === 'UNSAFE' ? COLORS.error : COLORS.success }]}>
                            {safetyStatus ?? '...'}
                        </Text>
                    </View>
                </TouchableOpacity>
            )}

            {/* ── Header ───────────────────────────────────────── */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{t('nav.oceanMap')}</Text>
                    <Text style={styles.subtitle}>{OCEAN_CATCH_DATA.length + filteredMarkers.length} catches • {alerts.length} alerts</Text>
                </View>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModalVisible(true)} activeOpacity={0.8}>
                    <Text style={styles.filterBtnText}>🔍 {filterSpecies === 'All Species' ? 'Filter' : filterSpecies.split(' ')[0]}</Text>
                </TouchableOpacity>
            </View>

            {/* ── Weather Layer Tabs ────────────────────────────── */}
            <View style={styles.layerTabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerTabsScroll}>
                    {WEATHER_LAYERS.map((layer) => (
                        <TouchableOpacity
                            key={layer.id}
                            style={[styles.layerTab, activeWeatherLayer === layer.id && styles.layerTabActive]}
                            onPress={() => setActiveWeatherLayer(layer.id)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.layerTabText, activeWeatherLayer === layer.id && styles.layerTabTextActive]}>
                                {layer.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* ── Quick Tools Bar ──────────────────────────────── */}
            <View style={styles.quickBar}>
                <TouchableOpacity style={styles.quickBtn} onPress={() => setBottomSheet(bottomSheet === 'tools' ? 'none' : 'tools')}>
                    <Text style={styles.quickBtnText}>🧭 Tools</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => setBottomSheet(bottomSheet === 'insights' ? 'none' : 'insights')}>
                    <Text style={styles.quickBtnText}>⚓ Insights</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => setBottomSheet(bottomSheet === 'alerts' ? 'none' : 'alerts')}>
                    <Text style={styles.quickBtnText}>🚨 Alerts ({alerts.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={handleLocateUser}>
                    <Text style={styles.quickBtnText}>📍 Me</Text>
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
                    mapType="satellite"
                    showsUserLocation
                    showsCompass
                    showsMyLocationButton={false}
                    minZoomLevel={4}
                    onPress={handleMapPress}
                >
                    {/* Weather overlay */}
                    {weatherTileUrl && (
                        <UrlTile urlTemplate={weatherTileUrl} maximumZ={19} opacity={0.8} zIndex={1} />
                    )}

                    {/* Alert zone circles */}
                    {alerts.map((alert) => (
                        <MapCircle
                            key={alert.id}
                            center={{ latitude: alert.lat, longitude: alert.lng }}
                            radius={alert.radiusKm * 1000}
                            strokeColor={getSeverityColor(alert.severity) + '80'}
                            fillColor={getSeverityColor(alert.severity) + '15'}
                            strokeWidth={2}
                            zIndex={2}
                        />
                    ))}

                    {/* Ocean catch dummy markers */}
                    {OCEAN_CATCH_DATA.map((pt) => (
                        <Marker
                            key={pt.id}
                            coordinate={{ latitude: pt.latitude, longitude: pt.longitude }}
                            onPress={() => { setTappedWeather(null); setSelectedMarker(null); setSelectedCatch(pt); setBottomSheet('none'); }}
                        >
                            <View style={[styles.catchDot, { backgroundColor: GRADE_COLORS[pt.qualityGrade] }]}>
                                <Text style={styles.catchDotText}>🐟</Text>
                            </View>
                        </Marker>
                    ))}

                    {/* API fetch markers */}
                    {filteredMarkers.map((marker) => (
                        <Marker
                            key={marker.imageId}
                            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                            onPress={() => { setTappedWeather(null); setSelectedCatch(null); setSelectedMarker(marker); setBottomSheet('none'); }}
                        >
                            <View style={[styles.markerDot, { backgroundColor: GRADE_COLORS[marker.qualityGrade ?? 'Standard'] }]}>
                                <Text style={styles.markerEmoji}>🐟</Text>
                            </View>
                        </Marker>
                    ))}
                </MapView>

                {/* Recommended Zone floating card */}
                <View style={styles.recZone}>
                    <Text style={styles.recZoneTitle}>✨ Recommended</Text>
                    <Text style={styles.recZoneText}>Malabar Basin — Skipjack Tuna</Text>
                    <Text style={styles.recZoneSub}>Optimal for next 6h</Text>
                </View>
            </View>

            {/* ── Ocean Catch Info Sheet ────────────────────────── */}
            {selectedCatch && (
                <View style={styles.infoSheet}>
                    <View style={styles.infoSheetHandle} />
                    <View style={styles.infoSheetContent}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoSpecies}>🐟 {selectedCatch.species}</Text>
                            <View style={[styles.gradeBadge, { backgroundColor: GRADE_COLORS[selectedCatch.qualityGrade] + '20' }]}>
                                <Text style={[styles.gradeText, { color: GRADE_COLORS[selectedCatch.qualityGrade] }]}>{selectedCatch.qualityGrade}</Text>
                            </View>
                        </View>
                        <View style={styles.infoDetails}>
                            <View style={styles.infoDetailItem}>
                                <Text style={styles.infoDetailLabel}>⚖️ Weight</Text>
                                <Text style={styles.infoDetailValue}>{selectedCatch.weight_kg} kg</Text>
                            </View>
                            <View style={styles.infoDetailItem}>
                                <Text style={styles.infoDetailLabel}>🌊 Depth</Text>
                                <Text style={styles.infoDetailValue}>{selectedCatch.depth_m}m</Text>
                            </View>
                            <View style={styles.infoDetailItem}>
                                <Text style={styles.infoDetailLabel}>🌡️ Water</Text>
                                <Text style={styles.infoDetailValue}>{selectedCatch.waterTemp_c}°C</Text>
                            </View>
                            <View style={styles.infoDetailItem}>
                                <Text style={styles.infoDetailLabel}>💎 Fresh</Text>
                                <Text style={styles.infoDetailValue}>{selectedCatch.freshness}</Text>
                            </View>
                            <View style={styles.infoDetailItem}>
                                <Text style={styles.infoDetailLabel}>🎣 Method</Text>
                                <Text style={styles.infoDetailValue}>{selectedCatch.catchMethod}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedCatch(null)}>
                            <Text style={styles.dismissText}>Dismiss</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* ── API Marker Info Sheet ─────────────────────────── */}
            {selectedMarker && (
                <View style={styles.infoSheet}>
                    <View style={styles.infoSheetHandle} />
                    <View style={styles.infoSheetContent}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoSpecies}>{selectedMarker.species ?? 'Unknown'}</Text>
                            <View style={[styles.gradeBadge, { backgroundColor: GRADE_COLORS[selectedMarker.qualityGrade ?? 'Standard'] + '20' }]}>
                                <Text style={[styles.gradeText, { color: GRADE_COLORS[selectedMarker.qualityGrade ?? 'Standard'] }]}>{selectedMarker.qualityGrade}</Text>
                            </View>
                        </View>
                        <View style={styles.infoDetails}>
                            <View style={styles.infoDetailItem}>
                                <Text style={styles.infoDetailLabel}>⚖️ Weight</Text>
                                <Text style={styles.infoDetailValue}>{selectedMarker.weight_g ? `${(selectedMarker.weight_g / 1000).toFixed(2)} kg` : '—'}</Text>
                            </View>
                            <View style={styles.infoDetailItem}>
                                <Text style={styles.infoDetailLabel}>📍 Location</Text>
                                <Text style={styles.infoDetailValue}>{selectedMarker.latitude.toFixed(3)}°N</Text>
                            </View>
                            <View style={styles.infoDetailItem}>
                                <Text style={styles.infoDetailLabel}>📅 Date</Text>
                                <Text style={styles.infoDetailValue}>{new Date(selectedMarker.createdAt).toLocaleDateString('en-IN')}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedMarker(null)}>
                            <Text style={styles.dismissText}>Dismiss</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* ── Tapped Weather Info ───────────────────────────── */}
            {tappedWeather && !selectedMarker && !selectedCatch && (
                <View style={styles.infoSheet}>
                    <View style={styles.infoSheetHandle} />
                    <View style={styles.infoSheetContent}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoSpecies}>📍 Weather</Text>
                            <TouchableOpacity onPress={() => setTappedWeather(null)}>
                                <Text style={{ color: COLORS.textMuted, fontSize: 18 }}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.coordText}>{tappedWeather.latitude.toFixed(4)}°N, {tappedWeather.longitude.toFixed(4)}°E</Text>
                        {tappedWeather.loading ? (
                            <ActivityIndicator size="small" color={COLORS.primaryLight} style={{ marginVertical: SPACING.md }} />
                        ) : (
                            <View style={styles.weatherGrid}>
                                <View style={styles.weatherItem}><Text style={styles.weatherIcon}>🌡️</Text><Text style={styles.weatherLabel}>Temp</Text><Text style={styles.weatherValue}>{tappedWeather.temp?.toFixed(1)}°C</Text></View>
                                <View style={styles.weatherItem}><Text style={styles.weatherIcon}>💨</Text><Text style={styles.weatherLabel}>Wind</Text><Text style={styles.weatherValue}>{tappedWeather.wind} m/s</Text></View>
                                <View style={styles.weatherItem}><Text style={styles.weatherIcon}>💧</Text><Text style={styles.weatherLabel}>Humidity</Text><Text style={styles.weatherValue}>{tappedWeather.humidity}%</Text></View>
                                {tappedWeather.description && (
                                    <View style={styles.weatherItem}><Text style={styles.weatherIcon}>⛅</Text><Text style={styles.weatherLabel}>Conditions</Text><Text style={[styles.weatherValue, { textTransform: 'capitalize', fontSize: 12 }]}>{tappedWeather.description}</Text></View>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            )}

            {/* ── Bottom Sheet: Fisherman Tools ─────────────────── */}
            {bottomSheet === 'tools' && (
                <View style={styles.bottomSheet}>
                    <View style={styles.infoSheetHandle} />
                    <Text style={styles.bsTitle}>🧭 Fisherman Tools</Text>
                    <View style={styles.toolsGrid}>
                        <View style={[styles.toolCard, { borderColor: '#f59e0b30' }]}>
                            <Text style={styles.toolEmoji}>☀️</Text>
                            <Text style={[styles.toolLabel, { color: '#fbbf24' }]}>Sunrise</Text>
                            <Text style={styles.toolValue}>06:32 AM</Text>
                            <Text style={styles.toolSub}>Sunset 06:18 PM</Text>
                        </View>
                        <View style={[styles.toolCard, { borderColor: '#818cf830' }]}>
                            <Text style={styles.toolEmoji}>🌙</Text>
                            <Text style={[styles.toolLabel, { color: '#a5b4fc' }]}>Moon</Text>
                            <Text style={styles.toolValue}>Waxing Crescent</Text>
                            <Text style={styles.toolSub}>32% illuminated</Text>
                        </View>
                        <View style={[styles.toolCard, { borderColor: '#22d3ee30' }]}>
                            <Text style={styles.toolEmoji}>🌊</Text>
                            <Text style={[styles.toolLabel, { color: '#67e8f9' }]}>Tide</Text>
                            <Text style={styles.toolValue}>High → 2.1m</Text>
                            <Text style={styles.toolSub}>Next low: 3:45 PM</Text>
                        </View>
                        <View style={[styles.toolCard, { borderColor: '#34d39930' }]}>
                            <Text style={styles.toolEmoji}>⏰</Text>
                            <Text style={[styles.toolLabel, { color: '#6ee7b7' }]}>Best Time</Text>
                            <Text style={styles.toolValue}>5:30 – 8:00 AM</Text>
                            <Text style={styles.toolSub}>High activity</Text>
                        </View>
                    </View>
                    <View style={styles.seaStateBar}>
                        <Text style={styles.seaStateText}>🌧️ Sea State: <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>Moderate</Text></Text>
                        <Text style={styles.seaStateSub}>Wave 1.2m • Wind NW 15 km/h • Vis 8 km</Text>
                    </View>
                    <TouchableOpacity onPress={() => setBottomSheet('none')}>
                        <Text style={styles.dismissText}>Close</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Bottom Sheet: Live Zone Insights ──────────────── */}
            {bottomSheet === 'insights' && (
                <View style={styles.bottomSheet}>
                    <View style={styles.infoSheetHandle} />
                    <Text style={styles.bsTitle}>⚓ Live Zone Insights</Text>
                    <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                        {ZONE_INSIGHTS.map((zone, i) => (
                            <View key={i} style={styles.zoneCard}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={styles.zoneName}>{zone.zone}</Text>
                                    <View style={[styles.healthBadge, zone.healthStatus === 'Healthy' ? styles.healthGood : styles.healthMod]}>
                                        <Text style={[styles.healthText, { color: zone.healthStatus === 'Healthy' ? COLORS.success : COLORS.warning }]}>
                                            {zone.healthStatus} {zone.trend === 'up' ? '↗' : zone.trend === 'down' ? '↘' : '→'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.zoneRegion}>{zone.region}</Text>
                                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                    {zone.topSpecies.map(sp => (
                                        <View key={sp} style={styles.speciesTag}><Text style={styles.speciesTagText}>{sp}</Text></View>
                                    ))}
                                </View>
                                <Text style={styles.zoneStats}>🌡️ {zone.avgTemp}°C  •  🐟 {zone.catchCount} catches</Text>
                                <Text style={styles.zoneAdvisory}>{zone.advisory}</Text>
                            </View>
                        ))}
                    </ScrollView>
                    <TouchableOpacity onPress={() => setBottomSheet('none')}>
                        <Text style={styles.dismissText}>Close</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Bottom Sheet: Alerts ──────────────────────────── */}
            {bottomSheet === 'alerts' && (
                <View style={styles.bottomSheet}>
                    <View style={styles.infoSheetHandle} />
                    <Text style={styles.bsTitle}>🚨 Live Alerts ({alerts.length})</Text>
                    {alertsLoading ? (
                        <ActivityIndicator size="small" color={COLORS.primaryLight} />
                    ) : alerts.length === 0 ? (
                        <View style={styles.noAlertsBox}>
                            <Text style={styles.noAlertsEmoji}>✅</Text>
                            <Text style={styles.noAlertsText}>All clear! No active weather alerts for Indian coastal waters.</Text>
                        </View>
                    ) : (
                        <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                            {alerts.map((alert) => (
                                <View key={alert.id} style={[styles.alertCard, { borderLeftColor: getSeverityColor(alert.severity) }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={{ fontSize: 20 }}>{getAlertIcon(alert.type)}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.alertCardTitle}>{alert.title}</Text>
                                            <Text style={styles.alertCardDesc}>{alert.description}</Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.alertSource, { color: getSeverityColor(alert.severity) }]}>
                                        {alert.source} • Radius: {alert.radiusKm} km
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                    <TouchableOpacity onPress={() => setBottomSheet('none')}>
                        <Text style={styles.dismissText}>Close</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Species Filter Modal ──────────────────────────── */}
            <Modal visible={filterModalVisible} transparent animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Filter by Species</Text>
                        {['All Species', ...FISH_SPECIES].map((species) => (
                            <TouchableOpacity
                                key={species}
                                style={[styles.modalOption, filterSpecies === species && styles.modalOptionActive]}
                                onPress={() => { setFilterSpecies(species); setFilterModalVisible(false); }}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.modalOptionText, filterSpecies === species && styles.modalOptionTextActive]}>{species}</Text>
                                {filterSpecies === species && <Text style={{ color: COLORS.primaryLight }}>✓</Text>}
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
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginHorizontal: SPACING.md, marginTop: SPACING.sm,
        padding: SPACING.md, borderRadius: RADIUS.lg,
        backgroundColor: COLORS.bgCard, borderWidth: 1,
    },
    alertIcon: { fontSize: 22 },
    alertTitle: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
    alertDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
    safetyBadge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
    safeBadge: { backgroundColor: COLORS.success + '20' },
    unsafeBadge: { backgroundColor: COLORS.error + '20' },
    safetyText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm },
    title: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
    subtitle: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
    filterBtn: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
    filterBtnText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },

    // Layers
    layerTabsContainer: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xs },
    layerTabsScroll: { gap: SPACING.sm, paddingHorizontal: SPACING.xs },
    layerTab: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: 6 },
    layerTabActive: { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primaryLight },
    layerTabText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },
    layerTabTextActive: { color: COLORS.primaryLight },

    // Quick bar
    quickBar: { flexDirection: 'row', paddingHorizontal: SPACING.md, gap: 6, marginBottom: SPACING.xs },
    quickBtn: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, paddingVertical: 6, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
    quickBtnText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: FONTS.weights.semibold },

    // Map
    mapContainer: { flex: 1, position: 'relative' },
    map: { flex: 1 },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.bgDark + 'aa', alignItems: 'center', justifyContent: 'center', zIndex: 10 },

    // Markers
    catchDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', elevation: 4 },
    catchDotText: { fontSize: 14 },
    markerDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', elevation: 4 },
    markerEmoji: { fontSize: 16 },

    // Recommended zone
    recZone: { position: 'absolute', top: 12, right: 12, backgroundColor: COLORS.bgCard + 'ee', borderRadius: RADIUS.lg, padding: SPACING.md, maxWidth: 180, borderWidth: 1, borderColor: COLORS.success + '30' },
    recZoneTitle: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold, color: COLORS.success },
    recZoneText: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginTop: 2 },
    recZoneSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },

    // Info sheets
    infoSheet: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], borderWidth: 1, borderColor: COLORS.border, paddingBottom: SPACING.base },
    infoSheetHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: SPACING.md, marginBottom: SPACING.md },
    infoSheetContent: { paddingHorizontal: SPACING.xl },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    infoSpecies: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
    gradeBadge: { borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
    gradeText: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
    infoDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.md },
    infoDetailItem: { minWidth: 80 },
    infoDetailLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: SPACING.xs },
    infoDetailValue: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: FONTS.weights.semibold },
    dismissText: { textAlign: 'center', color: COLORS.primaryLight, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, paddingVertical: SPACING.sm },

    // Weather
    coordText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: SPACING.md },
    weatherGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
    weatherItem: { backgroundColor: COLORS.bgSurface, borderRadius: RADIUS.md, padding: SPACING.md, minWidth: 75, alignItems: 'center' },
    weatherIcon: { fontSize: 18, marginBottom: SPACING.xs },
    weatherLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: 2 },
    weatherValue: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, fontWeight: FONTS.weights.bold },

    // Bottom sheets
    bottomSheet: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },
    bsTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.md },

    // Tools
    toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    toolCard: { width: (SCREEN_W - SPACING.xl * 2 - 8) / 2, backgroundColor: COLORS.bgSurface, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1 },
    toolEmoji: { fontSize: 20, marginBottom: 4 },
    toolLabel: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
    toolValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginTop: 2 },
    toolSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
    seaStateBar: { backgroundColor: COLORS.bgSurface, borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: 8, borderWidth: 1, borderColor: '#3b82f630' },
    seaStateText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
    seaStateSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 4 },

    // Zone insights
    zoneCard: { backgroundColor: COLORS.bgSurface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
    zoneName: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, flex: 1 },
    zoneRegion: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 },
    healthBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
    healthGood: { backgroundColor: COLORS.success + '15' },
    healthMod: { backgroundColor: COLORS.warning + '15' },
    healthText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },
    speciesTag: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, paddingHorizontal: 8, paddingVertical: 3 },
    speciesTagText: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, fontWeight: FONTS.weights.semibold },
    zoneStats: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 6 },
    zoneAdvisory: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 4, fontStyle: 'italic' },

    // Alerts
    noAlertsBox: { alignItems: 'center', padding: SPACING.xl },
    noAlertsEmoji: { fontSize: 40, marginBottom: SPACING.md },
    noAlertsText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center' },
    alertCard: { backgroundColor: COLORS.bgSurface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: 8, borderLeftWidth: 4 },
    alertCardTitle: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
    alertCardDesc: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
    alertSource: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold, marginTop: 6 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS['2xl'], borderTopRightRadius: RADIUS['2xl'], padding: SPACING.xl, paddingBottom: SPACING['3xl'] },
    modalTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.base },
    modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    modalOptionActive: { backgroundColor: COLORS.primary + '15', borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm },
    modalOptionText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary },
    modalOptionTextActive: { color: COLORS.primaryLight, fontWeight: FONTS.weights.bold },
});

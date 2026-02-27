import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import { getMapData } from '../../lib/api-client';
import type { MapMarker } from '../../lib/api-client';
import { COLORS, FONTS, SPACING, RADIUS, DEFAULT_MAP_REGION, FISH_SPECIES } from '../../lib/constants';
import { useLanguage } from '../../lib/i18n';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

const GRADE_COLORS: Record<string, string> = {
    Premium: COLORS.success,
    Standard: COLORS.warning,
    Low: COLORS.error,
};

export default function MapScreen() {
    const { t, isLoaded } = useLanguage();
    const [markers, setMarkers] = useState<MapMarker[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
    const [filterSpecies, setFilterSpecies] = useState(t('map.allSpecies'));
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const mapRef = useRef<MapView>(null);

    useEffect(() => {
        loadMapData();
    }, [filterSpecies]);

    const loadMapData = async () => {
        setLoading(true);
        try {
            const data = await getMapData(
                filterSpecies !== t('map.allSpecies') ? { species: filterSpecies } : undefined
            );
            setMarkers(data.markers);
        } catch {
            setMarkers([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredMarkers = filterSpecies === t('map.allSpecies')
        ? markers
        : markers.filter((m) => m.species === filterSpecies);

    if (!isLoaded) return null;

    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>{t('nav.oceanMap')}</Text>
                    <Text style={styles.subtitle}>{filteredMarkers.length} {t('map.catchLocations')}</Text>
                </View>
                <TouchableOpacity
                    style={styles.filterBtn}
                    onPress={() => setFilterModalVisible(true)}
                    activeOpacity={0.8}
                >
                    <Text style={styles.filterBtnText}>🔍 {filterSpecies === t('map.allSpecies') ? t('map.filter') : filterSpecies.split(' ')[0]}</Text>
                </TouchableOpacity>
            </View>

            {/* Map */}
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
                    initialRegion={DEFAULT_MAP_REGION}
                    mapType="satellite"
                    showsUserLocation
                    showsCompass
                >
                    {filteredMarkers.map((marker) => (
                        <Marker
                            key={marker.imageId}
                            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                            onPress={() => setSelectedMarker(marker)}
                            pinColor={GRADE_COLORS[marker.qualityGrade ?? 'Standard']}
                        >
                            <View style={[styles.markerDot, { backgroundColor: GRADE_COLORS[marker.qualityGrade ?? 'Standard'] }]}>
                                <Text style={styles.markerEmoji}>🐟</Text>
                            </View>
                        </Marker>
                    ))}
                </MapView>
            </View>

            {/* Marker Info Sheet */}
            {selectedMarker && (
                <View style={styles.infoSheet}>
                    <View style={styles.infoSheetHandle} />
                    <View style={styles.infoSheetContent}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoSpecies}>{selectedMarker.species ?? 'Unknown'}</Text>
                            <View style={[styles.gradeBadge, { backgroundColor: GRADE_COLORS[selectedMarker.qualityGrade ?? 'Standard'] + '20' }]}>
                                <Text style={[styles.gradeText, { color: GRADE_COLORS[selectedMarker.qualityGrade ?? 'Standard'] }]}>
                                    {selectedMarker.qualityGrade}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.infoDetails}>
                            <View style={styles.infoDetailItem}>
                                <Text style={styles.infoDetailLabel}>⚖️ {t('map.weight')}</Text>
                                <Text style={styles.infoDetailValue}>
                                    {selectedMarker.weight_g ? `${(selectedMarker.weight_g / 1000).toFixed(2)} kg` : '—'}
                                </Text>
                            </View>
                            <View style={styles.infoDetailItem}>
                                <Text style={styles.infoDetailLabel}>📍 {t('map.location')}</Text>
                                <Text style={styles.infoDetailValue}>
                                    {selectedMarker.latitude.toFixed(3)}°N, {selectedMarker.longitude.toFixed(3)}°E
                                </Text>
                            </View>
                            <View style={styles.infoDetailItem}>
                                <Text style={styles.infoDetailLabel}>📅 {t('map.date')}</Text>
                                <Text style={styles.infoDetailValue}>
                                    {new Date(selectedMarker.createdAt).toLocaleDateString('en-IN')}
                                </Text>
                            </View>
                        </View>
                        <Button
                            label={t('common.dismiss')}
                            onPress={() => setSelectedMarker(null)}
                            variant="ghost"
                            size="sm"
                            style={styles.dismissBtn}
                        />
                    </View>
                </View>
            )}

            {/* Fishing Zone Cards */}
            <View style={styles.zonesSection}>
                <Text style={styles.zonesTitle}>{t('map.recommendedZones')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zonesScroll}>
                    {[
                        { zone: 'Zone A', lat: '17°–19°N', species: 'Indian Pomfret', density: t('map.densityHigh'), emoji: '⭐' },
                        { zone: 'Zone B', lat: '15°–17°N', species: 'Kingfish', density: t('map.densityMedium'), emoji: '🎯' },
                        { zone: 'Zone C', lat: '11°–14°N', species: 'Yellowfin Tuna', density: t('map.densityHigh'), emoji: '🔥' },
                    ].map((z) => (
                        <View key={z.zone} style={styles.zoneCard}>
                            <Text style={styles.zoneEmoji}>{z.emoji}</Text>
                            <Text style={styles.zoneName}>{z.zone}</Text>
                            <Text style={styles.zoneLocation}>{z.lat}</Text>
                            <Text style={styles.zoneSpecies}>{z.species}</Text>
                            <Text style={[styles.zoneDensity, { color: z.density === String(t('map.densityHigh')) ? COLORS.success : COLORS.warning }]}>
                                {z.density}
                            </Text>
                        </View>
                    ))}
                </ScrollView>
            </View>

            {/* Species Filter Modal */}
            <Modal
                visible={filterModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setFilterModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>{t('map.filterBySpecies')}</Text>
                        <TouchableOpacity
                            style={[styles.modalOption, filterSpecies === t('map.allSpecies') && styles.modalOptionActive]}
                            onPress={() => { setFilterSpecies(t('map.allSpecies')); setFilterModalVisible(false); }}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.modalOptionText, filterSpecies === t('map.allSpecies') && styles.modalOptionTextActive]}>
                                {t('map.allSpecies')}
                            </Text>
                            {filterSpecies === t('map.allSpecies') && <Text style={{ color: COLORS.primaryLight }}>✓</Text>}
                        </TouchableOpacity>
                        {FISH_SPECIES.map((species) => (
                            <TouchableOpacity
                                key={species}
                                style={[styles.modalOption, filterSpecies === species && styles.modalOptionActive]}
                                onPress={() => { setFilterSpecies(species); setFilterModalVisible(false); }}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.modalOptionText, filterSpecies === species && styles.modalOptionTextActive]}>
                                    {species}
                                </Text>
                                {filterSpecies === species && <Text style={{ color: COLORS.primaryLight }}>✓</Text>}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDark },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.xl,
        paddingBottom: SPACING.md,
    },
    title: { fontSize: FONTS.sizes['2xl'], fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
    subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
    filterBtn: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    filterBtnText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },

    mapContainer: { flex: 1, position: 'relative' },
    map: { flex: 1 },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.bgDark + 'aa',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },

    markerDot: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    markerEmoji: { fontSize: 16 },

    infoSheet: {
        backgroundColor: COLORS.bgCard,
        borderTopLeftRadius: RADIUS['2xl'],
        borderTopRightRadius: RADIUS['2xl'],
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingBottom: SPACING.base,
    },
    infoSheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: COLORS.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: SPACING.md,
        marginBottom: SPACING.md,
    },
    infoSheetContent: { paddingHorizontal: SPACING.xl },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    infoSpecies: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
    gradeBadge: { borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
    gradeText: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
    infoDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.md },
    infoDetailItem: { minWidth: 100 },
    infoDetailLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginBottom: SPACING.xs },
    infoDetailValue: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: FONTS.weights.semibold },
    dismissBtn: { alignSelf: 'center' },

    zonesSection: { padding: SPACING.xl, paddingTop: SPACING.md },
    zonesTitle: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.md },
    zonesScroll: { gap: SPACING.md },
    zoneCard: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.base,
        minWidth: 140,
        alignItems: 'center',
    },
    zoneEmoji: { fontSize: 22, marginBottom: SPACING.xs },
    zoneName: { fontSize: FONTS.sizes.md, color: COLORS.textPrimary, fontWeight: FONTS.weights.bold },
    zoneLocation: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.xs },
    zoneSpecies: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center' },
    zoneDensity: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold, marginTop: SPACING.xs },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalSheet: {
        backgroundColor: COLORS.bgCard,
        borderTopLeftRadius: RADIUS['2xl'],
        borderTopRightRadius: RADIUS['2xl'],
        padding: SPACING.xl,
        paddingBottom: SPACING['3xl'],
    },
    modalTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.base },
    modalOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalOptionActive: { backgroundColor: COLORS.primary + '15', borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm },
    modalOptionText: { fontSize: FONTS.sizes.base, color: COLORS.textSecondary },
    modalOptionTextActive: { color: COLORS.primaryLight, fontWeight: FONTS.weights.bold },
});

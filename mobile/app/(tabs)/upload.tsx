import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
    Animated,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import { getPresignedUrl, uploadToS3, analyzeImage } from '../../lib/api-client';
import type { FishAnalysisResult } from '../../lib/mock-api';
import { COLORS, FONTS, SPACING, RADIUS } from '../../lib/constants';
import { useLanguage } from '../../lib/i18n';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { runDetection, loadModel, reloadModel, getModelDebugInfo, type BoundingBox } from '../../lib/detection';
import { BoundingBoxOverlay } from '../../components/BoundingBoxOverlay';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Step = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export default function UploadScreen() {
    const { t, isLoaded } = useLanguage();
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [step, setStep] = useState<Step>('idle');
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<FishAnalysisResult | null>(null);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const progressAnim = useRef(new Animated.Value(0)).current;

    // ── Detection state ──
    const [detections, setDetections] = useState<BoundingBox[]>([]);
    const [isDetecting, setIsDetecting] = useState(false);
    const [detectionTime, setDetectionTime] = useState<number | null>(null);
    const [cropUris, setCropUris] = useState<string[]>([]);
    const [modelError, setModelError] = useState(false);
    const [isReloadingModel, setIsReloadingModel] = useState(false);
    const [modelName, setModelName] = useState<string>('detection_float32.tflite');
    const [modelSource, setModelSource] = useState<string>('not loaded');

    const refreshModelStatus = () => {
        const info = getModelDebugInfo();
        setModelName(info.modelName);
        setModelSource(info.loadedUri ?? 'not loaded');
        setModelError(!info.isLoaded);
    };

    // Preload the TFLite model on mount
    useEffect(() => {
        loadModel()
            .then(() => {
                refreshModelStatus();
            })
            .catch(() => {
                setModelError(true);
                setModelSource('missing');
            });
    }, []);

    const handleReloadModel = async () => {
        setIsReloadingModel(true);
        try {
            await reloadModel();
            refreshModelStatus();
        } catch {
            setModelError(true);
            setModelSource('missing');
            Alert.alert('Model Reload Failed', 'Could not reload the model from device storage.');
        } finally {
            setIsReloadingModel(false);
        }
    };

    const isAnalyzing = step === 'uploading' || step === 'processing';

    const animateProgress = (to: number) => {
        Animated.timing(progressAnim, {
            toValue: to,
            duration: 300,
            useNativeDriver: false,
        }).start();
        setProgress(to);
    };

    const captureLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            }
        } catch { /* optional */ }
    };

    const pickFromGallery = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('common.error'), 'Please allow access to your photos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            quality: 0.8,
            allowsEditing: false,
        });
        if (!result.canceled && result.assets[0]) {
            setImageUri(result.assets[0].uri);
            setResult(null);
            setStep('idle');
            captureLocation();
        }
    };

    const captureFromCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('common.error'), 'Please allow access to your camera.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
            allowsEditing: false,
        });
        if (!result.canceled && result.assets[0]) {
            setImageUri(result.assets[0].uri);
            setResult(null);
            setStep('idle');
            captureLocation();
        }
    };

    const startAnalysis = async () => {
        if (!imageUri) return;
        try {
            // Step 0: Run on-device TFLite detection
            setIsDetecting(true);
            setDetections([]);
            setCropUris([]);
            setDetectionTime(null);
            const t0 = Date.now();
            try {
                const boxes = await runDetection(imageUri);
                setDetections(boxes);
                setDetectionTime(Date.now() - t0);

                if (boxes.length > 0) {
                    Image.getSize(
                        imageUri,
                        async (imgW, imgH) => {
                            const nextCrops: string[] = [];
                            for (const box of boxes.slice(0, 6)) {
                                const originX = Math.max(0, Math.floor(box.x1 * imgW));
                                const originY = Math.max(0, Math.floor(box.y1 * imgH));
                                const width = Math.max(1, Math.floor((box.x2 - box.x1) * imgW));
                                const height = Math.max(1, Math.floor((box.y2 - box.y1) * imgH));

                                if (originX + width > imgW || originY + height > imgH) {
                                    continue;
                                }

                                try {
                                    const cropped = await ImageManipulator.manipulateAsync(
                                        imageUri,
                                        [{ crop: { originX, originY, width, height } }],
                                        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
                                    );
                                    nextCrops.push(cropped.uri);
                                } catch {
                                    // ignore individual crop failure
                                }
                            }
                            setCropUris(nextCrops);
                        },
                        () => setCropUris([])
                    );
                }
            } catch (detErr: any) {
                console.warn('[Detection] Error:', detErr.message);
                // Continue with mock analysis even if detection fails
            }
            setIsDetecting(false);

            // Step 1: Get presigned URL
            setStep('uploading');
            animateProgress(0);
            const fileName = `catch_${Date.now()}.jpg`;
            const { uploadUrl, imageId } = await getPresignedUrl(
                fileName, 'image/jpeg', location?.lat, location?.lng
            );

            // Step 2: Upload
            await uploadToS3(uploadUrl, imageUri, 'image/jpeg', (pct) => animateProgress(pct));
            animateProgress(100);

            // Step 3: Analyze
            setStep('processing');
            animateProgress(0);
            const interval = setInterval(() => {
                setProgress((prev) => {
                    const next = Math.min(prev + 12, 85);
                    Animated.timing(progressAnim, { toValue: next, duration: 250, useNativeDriver: false }).start();
                    return next;
                });
            }, 300);
            const { analysisResult } = await analyzeImage(imageId);
            clearInterval(interval);
            animateProgress(100);
            setResult(analysisResult);
            setStep('done');
        } catch (e: any) {
            setStep('error');
            Alert.alert('Analysis Failed', e.message || t('common.error'));
        }
    };

    const reset = () => {
        setImageUri(null);
        setResult(null);
        setStep('idle');
        setProgress(0);
        progressAnim.setValue(0);
        setLocation(null);
        setDetections([]);
        setCropUris([]);
        setDetectionTime(null);
        setIsDetecting(false);
    };

    const gradeColor = result?.qualityGrade === 'Premium'
        ? COLORS.success : result?.qualityGrade === 'Standard'
            ? COLORS.warning : COLORS.error;

    if (!isLoaded) return null;

    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>{t('upload.title')}</Text>
                    <Text style={styles.subtitle}>{t('upload.subtitle')}</Text>
                </View>

                {/* Upload Zone */}
                {!imageUri ? (
                    <View style={styles.uploadZone}>
                        <Text style={styles.uploadEmoji}>📸</Text>
                        <Text style={styles.uploadTitle}>{t('upload.cta')}</Text>
                        <Text style={styles.uploadHint}>
                            {t('upload.hint')}
                        </Text>
                        <View style={styles.uploadBtns}>
                            <Button
                                label={`📷  ${t('upload.btnCamera')}`}
                                onPress={captureFromCamera}
                                variant="primary"
                                style={styles.uploadBtn}
                            />
                            <Button
                                label={`🖼️  ${t('upload.btnGallery')}`}
                                onPress={pickFromGallery}
                                variant="outline"
                                style={styles.uploadBtn}
                            />
                        </View>
                        {/* Tips */}
                        <View style={styles.tipsBox}>
                            <Text style={styles.tipsTitle}>{t('upload.tipsTitle')}</Text>
                            <Text style={styles.tipItem}>• {t('upload.tip1')}</Text>
                            <Text style={styles.tipItem}>• {t('upload.tip2')}</Text>
                            <Text style={styles.tipItem}>• {t('upload.tip3')}</Text>
                        </View>
                    </View>
                ) : (
                    <>
                        {/* Image Preview */}
                        <View style={styles.previewCard}>
                            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
                            {location && (
                                <View style={styles.locationBadge}>
                                    <Text style={styles.locationText}>
                                        📍 {location.lat.toFixed(3)}°N, {location.lng.toFixed(3)}°E
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Progress */}
                        {isAnalyzing && (
                            <Card style={styles.progressCard} padding={SPACING.base}>
                                <Text style={styles.progressLabel}>
                                    {step === 'uploading' ? `☁️ ${t('upload.uploading')}...` : `🧠 ${t('upload.analyzing')}...`}
                                </Text>
                                <View style={styles.progressBar}>
                                    <Animated.View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: progressAnim.interpolate({
                                                    inputRange: [0, 100],
                                                    outputRange: ['0%', '100%'],
                                                }),
                                            },
                                        ]}
                                    />
                                </View>
                                {step === 'processing' && (
                                    <Text style={styles.progressHint}>YOLOv11 → Species Classification → Weight Estimation</Text>
                                )}
                            </Card>
                        )}

                        {/* Controls */}
                        {step === 'idle' && (
                            <View style={styles.controlRow}>
                                <Button label={`${t('upload.btnStartAnalysis')} ⚡`} onPress={startAnalysis} size="lg" style={styles.analyzeBtn} />
                                <Button label={t('common.cancel')} onPress={reset} variant="ghost" style={styles.removeBtn} />
                            </View>
                        )}
                        {step === 'error' && (
                            <View style={styles.controlRow}>
                                <Button label="Retry" onPress={startAnalysis} style={{ flex: 1 }} />
                                <Button label={t('common.cancel')} onPress={reset} variant="outline" style={{ flex: 1 }} />
                            </View>
                        )}
                        {step === 'done' && (
                            <Button label={t('upload.btnUploadAnother')} onPress={reset} variant="outline" fullWidth style={{ marginTop: SPACING.md }} />
                        )}
                    </>
                )}

                {/* On-device Detection Results */}
                <Card style={styles.modelStatusCard} padding={SPACING.base}>
                    <Text style={styles.modelStatusTitle}>🧩 Model: {modelName}</Text>
                    <Text style={styles.modelStatusPath} numberOfLines={2}>
                        Source: {modelSource}
                    </Text>
                    <View style={styles.modelActionsRow}>
                        <Button
                            label="Reload Model"
                            onPress={handleReloadModel}
                            variant="outline"
                            size="sm"
                            loading={isReloadingModel}
                            style={styles.reloadButton}
                        />
                    </View>
                    {modelError && (
                        <Text style={styles.modelStatusError}>
                            Push with: adb push detection_float32.tflite /sdcard/Android/data/com.aiforbharat.oceanai/files/
                        </Text>
                    )}
                </Card>

                {isDetecting && (
                    <Card style={styles.detectionCard} padding={SPACING.base}>
                        <View style={styles.detectingRow}>
                            <ActivityIndicator size="small" color={COLORS.primaryLight} />
                            <Text style={styles.detectingText}>Running on-device detection…</Text>
                        </View>
                    </Card>
                )}

                {detections.length > 0 && imageUri && (
                    <View style={styles.detectionSection}>
                        <Text style={styles.sectionTitle}>🔍 Detection Results</Text>
                        <Card style={styles.detectionCard} padding={0}>
                            <BoundingBoxOverlay
                                imageUri={imageUri}
                                detections={detections}
                                containerWidth={SCREEN_WIDTH - SPACING.xl * 2}
                                containerHeight={320}
                            />
                        </Card>
                        {detectionTime !== null && (
                            <Text style={styles.detectionMeta}>
                                ⚡ {detections.length} fish detected in {detectionTime}ms (on-device)
                            </Text>
                        )}

                        {cropUris.length > 0 && (
                            <View style={styles.cropsSection}>
                                <Text style={styles.cropsTitle}>Detected Crops</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropsRow}>
                                    {cropUris.map((uri, idx) => (
                                        <View key={`${uri}-${idx}`} style={styles.cropItem}>
                                            <Image source={{ uri }} style={styles.cropImage} resizeMode="cover" />
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                )}

                {/* Analysis Results */}
                {result && (
                    <View style={styles.resultsSection}>
                        <Text style={styles.sectionTitle}>{t('upload.results')}</Text>

                        {/* Species Card */}
                        <Card style={styles.resultCard} padding={SPACING.xl}>
                            <View style={styles.statusRow}>
                                <View
                                    style={[
                                        styles.statusChip,
                                        {
                                            backgroundColor: result.isSustainable
                                                ? COLORS.success + '20'
                                                : COLORS.warning + '20',
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.statusChipText,
                                            { color: result.isSustainable ? COLORS.success : COLORS.warning },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {result.isSustainable ? '✓ Sustainable' : '⚠ Not sustainable'}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.speciesLabel}>{t('upload.species')}</Text>
                            <Text style={styles.speciesName} numberOfLines={2}>{result.species}</Text>
                            <Text style={styles.scientificName} numberOfLines={2}>{result.scientificName}</Text>

                            <View style={styles.confidenceRow}>
                                <Text style={styles.confidenceLabel}>{t('upload.confidence')}</Text>
                                <Text style={styles.confidenceValue}>{(result.confidence * 100).toFixed(1)}%</Text>
                            </View>
                        </Card>

                        {/* Metrics Grid */}
                        <View style={styles.metricsGrid}>
                            <Card style={styles.metricCard} padding={SPACING.base}>
                                <Text style={styles.metricEmoji}>⚖️</Text>
                                <Text style={styles.metricLabel}>{t('map.weight')}</Text>
                                <Text style={styles.metricValue}>
                                    {(result.measurements.weight_g / 1000).toFixed(2)} KG
                                </Text>
                                <Text style={styles.metricSub}>{result.measurements.length_mm} mm</Text>
                            </Card>
                            <Card style={styles.metricCard} padding={SPACING.base}>
                                <Text style={styles.metricEmoji}>🏷️</Text>
                                <Text style={styles.metricLabel}>{t('upload.quality')}</Text>
                                <Text style={[styles.metricValue, { color: gradeColor }]}>{result.qualityGrade}</Text>
                                <Text style={styles.metricSub}>Physical markers</Text>
                            </Card>
                        </View>

                        {/* Market Value */}
                        <Card style={styles.marketCard} padding={SPACING.xl}>
                            <View style={styles.marketRow}>
                                <View style={styles.marketPrimaryBlock}>
                                    <Text style={styles.marketLabel}>📈 {t('upload.marketValue')}</Text>
                                    <Text style={styles.marketValue}>₹{result.marketEstimate.estimated_value.toLocaleString('en-IN')}</Text>
                                    <Text style={styles.marketRate}>@ ₹{result.marketEstimate.price_per_kg}/kg</Text>
                                </View>
                                <View style={styles.marketSecondaryBlock}>
                                    <Text style={styles.legalLabel}>{t('upload.legalSize')}</Text>
                                    <View style={[styles.legalBadge, { backgroundColor: result.compliance.is_legal_size ? COLORS.success + '20' : COLORS.error + '20' }]}>
                                        <Text style={[styles.legalText, { color: result.compliance.is_legal_size ? COLORS.success : COLORS.error }]}>
                                            {result.compliance.is_legal_size ? `≥${result.compliance.min_legal_size_mm}mm ✓` : 'Below Limit'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </Card>

                        {/* Sustainability */}
                        <Card
                            style={{ ...styles.sustainCard, borderColor: result.isSustainable ? COLORS.success + '40' : COLORS.warning + '40' }}
                            padding={SPACING.base}
                        >
                            <Text style={{ fontSize: 20, marginBottom: SPACING.xs }}>
                                {result.isSustainable ? '✅' : '⚠️'}
                            </Text>
                            <Text style={styles.sustainText}>
                                {result.isSustainable
                                    ? t('upload.sustainMsg')
                                    : t('upload.warningMsg')}
                            </Text>
                        </Card>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDark },
    scroll: { flex: 1 },
    content: { padding: SPACING.xl, paddingBottom: SPACING['4xl'] },

    header: { marginBottom: SPACING.xl },
    title: { fontSize: FONTS.sizes['3xl'], color: COLORS.textPrimary, fontWeight: FONTS.weights.extrabold },
    subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginTop: SPACING.xs },

    uploadZone: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS['2xl'],
        borderWidth: 2,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
        padding: SPACING['2xl'],
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    uploadEmoji: { fontSize: 48, marginBottom: SPACING.md },
    uploadTitle: { fontSize: FONTS.sizes.xl, color: COLORS.textPrimary, fontWeight: FONTS.weights.bold, marginBottom: SPACING.sm },
    uploadHint: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.xl, paddingHorizontal: SPACING.xl },
    uploadBtns: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.xl },
    uploadBtn: { minWidth: 130 },

    tipsBox: {
        backgroundColor: COLORS.bgDark,
        borderRadius: RADIUS.lg,
        padding: SPACING.base,
        width: '100%',
    },
    tipsTitle: { color: COLORS.primaryLight, fontWeight: FONTS.weights.bold, fontSize: FONTS.sizes.sm, marginBottom: SPACING.xs },
    tipItem: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, lineHeight: 22 },

    previewCard: {
        borderRadius: RADIUS['2xl'],
        overflow: 'hidden',
        marginBottom: SPACING.md,
        position: 'relative',
    },
    previewImage: { width: '100%', height: 280 },
    locationBadge: {
        position: 'absolute',
        top: SPACING.md,
        left: SPACING.md,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: RADIUS.full,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
    },
    locationText: { color: '#fff', fontSize: FONTS.sizes.xs, fontFamily: 'monospace' },

    progressCard: { marginBottom: SPACING.md },
    progressLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textPrimary, fontWeight: FONTS.weights.medium, marginBottom: SPACING.sm },
    progressBar: { height: 8, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.full },
    progressHint: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.xs, fontStyle: 'italic', textAlign: 'center' },

    controlRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
    analyzeBtn: { flex: 1 },
    removeBtn: { minWidth: 90 },

    resultsSection: { marginTop: SPACING.sm },
    sectionTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary, marginBottom: SPACING.md },

    resultCard: { marginBottom: SPACING.md },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: SPACING.sm,
    },
    statusChip: {
        borderRadius: RADIUS.full,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        maxWidth: '75%',
    },
    statusChipText: {
        fontSize: FONTS.sizes.xs,
        fontWeight: FONTS.weights.bold,
    },
    speciesLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: FONTS.weights.bold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: SPACING.xs },
    speciesName: {
        fontSize: FONTS.sizes['2xl'],
        color: COLORS.primaryLight,
        fontWeight: FONTS.weights.extrabold,
        marginBottom: SPACING.xs,
        flexShrink: 1,
        maxWidth: '100%',
    },
    scientificName: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.textMuted,
        fontStyle: 'italic',
        marginBottom: SPACING.base,
        flexShrink: 1,
        maxWidth: '100%',
    },
    confidenceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    confidenceLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
    confidenceValue: { fontSize: FONTS.sizes.md, color: COLORS.textPrimary, fontWeight: FONTS.weights.bold },

    metricsGrid: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
    metricCard: { flex: 1 },
    metricEmoji: { fontSize: 22, marginBottom: SPACING.xs },
    metricLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.xs },
    metricValue: { fontSize: FONTS.sizes.xl, color: COLORS.textPrimary, fontWeight: FONTS.weights.extrabold },
    metricSub: { fontSize: FONTS.sizes.xs, color: COLORS.textSubtle, marginTop: SPACING.xs },

    marketCard: { marginBottom: SPACING.md },
    marketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: SPACING.md },
    marketPrimaryBlock: { flexShrink: 1, minWidth: 170, maxWidth: '100%' },
    marketSecondaryBlock: { marginLeft: 'auto', minWidth: 120, maxWidth: '100%' },
    marketLabel: { fontSize: FONTS.sizes.xs, color: COLORS.primaryLight, fontWeight: FONTS.weights.bold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.xs },
    marketValue: {
        fontSize: FONTS.sizes['2xl'],
        color: COLORS.textPrimary,
        fontWeight: FONTS.weights.extrabold,
        flexShrink: 1,
    },
    marketRate: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
    legalLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'right', marginBottom: SPACING.xs },
    legalBadge: { borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
    legalText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },

    sustainCard: { borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
    sustainText: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 22 },

    modelStatusCard: { marginBottom: SPACING.md },
    modelStatusTitle: { color: COLORS.textPrimary, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, marginBottom: SPACING.xs },
    modelStatusPath: { color: COLORS.textMuted, fontSize: FONTS.sizes.xs, fontFamily: 'monospace' },
    modelActionsRow: { marginTop: SPACING.sm, flexDirection: 'row' },
    reloadButton: { minWidth: 128 },
    modelStatusError: { color: COLORS.warning, fontSize: FONTS.sizes.xs, marginTop: SPACING.xs },

    // Detection styles
    detectionSection: { marginTop: SPACING.sm, marginBottom: SPACING.md },
    detectionCard: { marginBottom: SPACING.sm, overflow: 'hidden', borderRadius: RADIUS.xl },
    detectingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    detectingText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },
    cropsSection: { marginTop: SPACING.sm },
    cropsTitle: {
        color: COLORS.textSecondary,
        fontSize: FONTS.sizes.sm,
        marginBottom: SPACING.sm,
        fontWeight: FONTS.weights.semibold,
    },
    cropsRow: { gap: SPACING.sm, paddingRight: SPACING.sm },
    cropItem: {
        width: 100,
        height: 100,
        borderRadius: RADIUS.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.bgCard,
    },
    cropImage: { width: '100%', height: '100%' },
    detectionMeta: {
        fontSize: FONTS.sizes.xs,
        color: COLORS.textMuted,
        textAlign: 'center',
        fontFamily: 'monospace',
        marginTop: SPACING.xs,
    },
});

import React, { useState, useRef, useEffect } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as ImageManipulator from "expo-image-manipulator";
import {
  getPresignedUrl,
  uploadToS3,
  analyzeImage,
} from "../../lib/api-client";
import type { FishAnalysisResult } from "../../lib/types";
import {
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  IS_DEMO_MODE,
} from "../../lib/constants";
import { useLanguage } from "../../lib/i18n";
import { useNetwork } from "../../lib/network-context";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  runDetection,
  loadModel,
  reloadModel,
  getModelDebugInfo,
  type BoundingBox,
} from "../../lib/detection";
import {
  loadAllTFLiteModels,
  reloadTFLiteModels,
  getTFLiteModelDebugInfo,
  type TFLiteModelDebugInfo,
} from "../../lib/tflite-inference";
import {
  runOfflineInference,
  offlineResultToAnalysisResult,
  type OfflineDetectionResult,
} from "../../lib/offline-inference";
import { BoundingBoxOverlay } from "../../components/BoundingBoxOverlay";

const SCREEN_WIDTH = Dimensions.get("window").width;

type Step = "idle" | "uploading" | "processing" | "done" | "error";

export default function UploadScreen() {
  const { t, isLoaded } = useLanguage();
  const { effectiveMode, connectionQuality } = useNetwork();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<FishAnalysisResult | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── Detection state ──
  const [detections, setDetections] = useState<BoundingBox[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionTime, setDetectionTime] = useState<number | null>(null);
  const [cropUris, setCropUris] = useState<string[]>([]);
  const [modelError, setModelError] = useState(false);
  const [isReloadingModel, setIsReloadingModel] = useState(false);
  const [modelName, setModelName] = useState<string>(
    "detection_float32.tflite",
  );
  const [modelSource, setModelSource] = useState<string>("not loaded");

  // ── Offline inference state ──
  const [offlineResults, setOfflineResults] = useState<
    OfflineDetectionResult[]
  >([]);
  const [offlineProcessingTime, setOfflineProcessingTime] = useState<
    number | null
  >(null);
  const [analysisMode, setAnalysisMode] = useState<"online" | "offline" | null>(
    null,
  );

  // ── TFLite classification model state ──
  const [tfliteInfo, setTfliteInfo] = useState<TFLiteModelDebugInfo | null>(
    null,
  );
  const [tfliteLoading, setTfliteLoading] = useState(false);
  const [tfliteError, setTfliteError] = useState<string | null>(null);

  const refreshModelStatus = () => {
    const info = getModelDebugInfo();
    setModelName(info.modelName);
    setModelSource(info.loadedUri ?? "not loaded");
    setModelError(!info.isLoaded);
  };

  const refreshTfliteStatus = () => {
    setTfliteInfo(getTFLiteModelDebugInfo());
  };

  // Preload all models on mount
  useEffect(() => {
    // TFLite detection model
    loadModel()
      .then(() => refreshModelStatus())
      .catch(() => {
        setModelError(true);
        setModelSource("missing");
      });

    // TFLite species + disease models
    setTfliteLoading(true);
    loadAllTFLiteModels()
      .then(() => {
        refreshTfliteStatus();
        setTfliteError(null);
      })
      .catch((err) => {
        refreshTfliteStatus();
        setTfliteError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setTfliteLoading(false));
  }, []);

  const handleReloadModel = async () => {
    setIsReloadingModel(true);
    try {
      // Reload all models in parallel
      await Promise.allSettled([
        reloadModel().then(() => refreshModelStatus()),
        reloadTFLiteModels().then(() => {
          refreshTfliteStatus();
          setTfliteError(null);
        }),
      ]);
      refreshModelStatus();
      refreshTfliteStatus();
    } catch {
      setModelError(true);
      setModelSource("missing");
      Alert.alert(
        "Model Reload Failed",
        "Could not reload one or more models from device storage.",
      );
    } finally {
      setIsReloadingModel(false);
    }
  };

  const isAnalyzing = step === "uploading" || step === "processing";

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
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    } catch {
      /* optional */
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("common.error"), "Please allow access to your photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setResult(null);
      setStep("idle");
      captureLocation();
    }
  };

  const captureFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("common.error"), "Please allow access to your camera.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setResult(null);
      setStep("idle");
      captureLocation();
    }
  };

  // ── Decide whether to use offline or online mode ──
  const shouldUseOffline = IS_DEMO_MODE || effectiveMode === "offline";

  const startAnalysis = async () => {
    if (!imageUri) return;

    // Reset state
    setDetections([]);
    setCropUris([]);
    setDetectionTime(null);
    setOfflineResults([]);
    setOfflineProcessingTime(null);
    setResult(null);

    console.log("\n╔════════════════════════════════════════════════════╗");
    console.log("  🚀  ANALYSIS STARTED");
    console.log(
      `  Mode          : ${shouldUseOffline ? "OFFLINE (on-device)" : "ONLINE (cloud)"}`,
    );
    console.log(
      `  Network       : ${effectiveMode} (quality: ${connectionQuality})`,
    );
    console.log(`  Demo mode     : ${IS_DEMO_MODE}`);
    console.log(`  Image URI     : ${imageUri.substring(0, 80)}…`);
    console.log("╚════════════════════════════════════════════════════╝\n");

    if (shouldUseOffline) {
      // ═══════════════════════════════════════════════════
      // OFFLINE PATH: Full on-device pipeline
      // ═══════════════════════════════════════════════════
      setAnalysisMode("offline");
      try {
        // Step 1: Show detecting state
        setIsDetecting(true);
        setStep("processing");
        animateProgress(0);
        console.log("[Upload] 🔍 Starting offline inference pipeline…");

        // Simulate progress while running
        const interval = setInterval(() => {
          setProgress((prev) => {
            const next = Math.min(prev + 5, 85);
            Animated.timing(progressAnim, {
              toValue: next,
              duration: 250,
              useNativeDriver: false,
            }).start();
            return next;
          });
        }, 500);

        // Step 2: Run the full offline inference pipeline
        const pipelineStart = Date.now();
        const {
          detections: offlineDets,
          processingTime,
          errors,
        } = await runOfflineInference(imageUri);
        clearInterval(interval);

        console.log(
          `[Upload] ✅ Offline inference complete: ${offlineDets.length} fish in ${processingTime}ms`,
        );
        if (errors && errors.length > 0) {
          console.warn("[Upload] ⚠️ Pipeline errors:", errors);
        }

        // Store offline results
        setOfflineResults(offlineDets);
        setOfflineProcessingTime(processingTime);
        setIsDetecting(false);

        // Extract detection boxes for the BoundingBoxOverlay
        if (offlineDets.length > 0) {
          // Reconstruct BoundingBox[] from offline results for overlay
          // We need the original image dimensions
          const imgDims = await new Promise<{ w: number; h: number }>(
            (resolve) => {
              Image.getSize(
                imageUri,
                (w, h) => resolve({ w, h }),
                () => resolve({ w: 1, h: 1 }),
              );
            },
          );

          const boxes: BoundingBox[] = offlineDets.map((d, i) => ({
            x1: d.bbox[0] / imgDims.w,
            y1: d.bbox[1] / imgDims.h,
            x2: d.bbox[2] / imgDims.w,
            y2: d.bbox[3] / imgDims.h,
            classId: 0,
            confidence: d.speciesConfidence,
          }));
          setDetections(boxes);
          setDetectionTime(processingTime);

          // Collect crop URIs from offline results
          const crops = offlineDets
            .filter((d) => d.cropUri)
            .map((d) => d.cropUri!);
          setCropUris(crops);

          // Convert the best detection (highest confidence) to FishAnalysisResult for the summary card
          const best = offlineDets.reduce((a, b) =>
            b.speciesConfidence > a.speciesConfidence ? b : a,
          );
          const analysisResult = offlineResultToAnalysisResult(best);
          console.log(
            "[Upload] 📊 Best detection converted to FishAnalysisResult:",
          );
          console.log(`  Species     : ${analysisResult.species}`);
          console.log(`  Scientific  : ${analysisResult.scientificName}`);
          console.log(
            `  Confidence  : ${(analysisResult.confidence * 100).toFixed(1)}%`,
          );
          console.log(`  Quality     : ${analysisResult.qualityGrade}`);
          console.log(
            `  Weight      : ${analysisResult.measurements.weight_g}g`,
          );
          console.log(
            `  Length      : ${analysisResult.measurements.length_mm}mm`,
          );
          console.log(
            `  Value       : ₹${analysisResult.marketEstimate.estimated_value}`,
          );
          console.log(
            `  Legal       : ${analysisResult.compliance.is_legal_size ? "Yes" : "No"}`,
          );
          console.log(
            `  Sustainable : ${analysisResult.isSustainable ? "Yes" : "No"}`,
          );

          // User requested to remove the top summary card for offline mode to avoid duplicates
          // setResult(analysisResult);
        } else {
          console.warn("[Upload] ⚠️ No fish detected in image");
          Alert.alert(
            "No Fish Detected",
            "The detection model did not find any fish in this image. Try a clearer photo.",
          );
        }

        animateProgress(100);
        setStep(offlineDets.length > 0 ? "done" : "error");
      } catch (e: any) {
        setIsDetecting(false);
        setStep("error");
        console.error("[Upload] ❌ Offline analysis failed:", e.message);
        Alert.alert("Offline Analysis Failed", e.message || t("common.error"));
      }
    } else {
      // ═══════════════════════════════════════════════════
      // ONLINE PATH: Cloud upload + analysis (with offline fallback)
      // ═══════════════════════════════════════════════════
      setAnalysisMode("online");
      try {
        // Step 0: Run on-device TFLite detection (for display)
        setIsDetecting(true);
        const t0 = Date.now();
        console.log("[Upload] 🔍 Running TFLite detection for preview…");
        try {
          const boxes = await runDetection(imageUri);
          setDetections(boxes);
          setDetectionTime(Date.now() - t0);
          console.log(
            `[Upload] ✅ TFLite detection: ${boxes.length} fish in ${Date.now() - t0}ms`,
          );

          if (boxes.length > 0) {
            Image.getSize(
              imageUri,
              async (imgW, imgH) => {
                const nextCrops: string[] = [];
                for (const box of boxes.slice(0, 6)) {
                  const originX = Math.max(0, Math.floor(box.x1 * imgW));
                  const originY = Math.max(0, Math.floor(box.y1 * imgH));
                  const width = Math.max(
                    1,
                    Math.floor((box.x2 - box.x1) * imgW),
                  );
                  const height = Math.max(
                    1,
                    Math.floor((box.y2 - box.y1) * imgH),
                  );

                  if (originX + width > imgW || originY + height > imgH) {
                    continue;
                  }

                  try {
                    const cropped = await ImageManipulator.manipulateAsync(
                      imageUri,
                      [{ crop: { originX, originY, width, height } }],
                      {
                        compress: 0.9,
                        format: ImageManipulator.SaveFormat.JPEG,
                      },
                    );
                    nextCrops.push(cropped.uri);
                  } catch {
                    // ignore individual crop failure
                  }
                }
                setCropUris(nextCrops);
              },
              () => setCropUris([]),
            );
          }
        } catch (detErr: any) {
          console.warn("[Upload] ⚠️ TFLite detection error:", detErr.message);
        }
        setIsDetecting(false);

        // Step 1: Get presigned URL
        setStep("uploading");
        animateProgress(0);
        console.log("[Upload] ☁️ Getting presigned URL…");
        const fileName = `catch_${Date.now()}.jpg`;
        const { uploadUrl, imageId } = await getPresignedUrl(
          fileName,
          "image/jpeg",
          location?.lat,
          location?.lng,
        );
        console.log(`[Upload] ✅ Got presigned URL for imageId: ${imageId}`);

        // Step 2: Upload
        console.log("[Upload] ☁️ Uploading to S3…");
        await uploadToS3(uploadUrl, imageUri, "image/jpeg", (pct) =>
          animateProgress(pct),
        );
        animateProgress(100);
        console.log("[Upload] ✅ Upload complete");

        // Step 3: Analyze via cloud
        setStep("processing");
        animateProgress(0);
        console.log("[Upload] 🧠 Requesting cloud analysis…");
        const interval = setInterval(() => {
          setProgress((prev) => {
            const next = Math.min(prev + 12, 85);
            Animated.timing(progressAnim, {
              toValue: next,
              duration: 250,
              useNativeDriver: false,
            }).start();
            return next;
          });
        }, 300);
        const cloudResponse = await analyzeImage(imageId);
        const { analysisResult } = cloudResponse;
        clearInterval(interval);
        animateProgress(100);

        console.log("[Upload] ☁️ Cloud analysis raw response JSON:");
        console.log(JSON.stringify(cloudResponse, null, 2));

        console.log("\n╔════════════════════════════════════════════════════╗");
        console.log("║  ☁️  CLOUD ANALYSIS COMPLETE                        ║");
        console.log("╚════════════════════════════════════════════════════╝");
        console.log(`  • Species     : ${analysisResult.species}`);
        console.log(`    └ Scientific: ${analysisResult.scientificName}`);
        console.log(
          `    └ Confidence: ${(analysisResult.confidence * 100).toFixed(1)}%`,
        );
        console.log(`  • Quality     : ${analysisResult.qualityGrade}`);
        console.log("  ────────────────────────────────────────────────────");
        console.log(`  • Measurements:`);
        console.log(
          `    └ Weight    : ${(analysisResult.measurements.weight_g / 1000).toFixed(2)} kg`,
        );
        console.log(
          `    └ Length    : ${analysisResult.measurements.length_mm} mm`,
        );
        console.log(
          `    └ Legal     : ${analysisResult.compliance.is_legal_size ? "✅ Yes" : "❌ No"}`,
        );
        console.log(`  • Economics   :`);
        console.log(
          `    └ Price/kg  : ₹${analysisResult.marketEstimate.price_per_kg}`,
        );
        console.log(
          `    └ Value     : ₹${analysisResult.marketEstimate.estimated_value}`,
        );
        console.log("\n");

        setResult(analysisResult);
        setStep("done");
      } catch (e: any) {
        // ── Cloud failed → fallback to offline ──
        console.warn(`[Upload] ☁️ Cloud analysis failed: ${e.message}`);
        console.log("[Upload] 🔄 Falling back to offline inference…");

        try {
          setStep("processing");
          setAnalysisMode("offline");
          animateProgress(0);

          const interval = setInterval(() => {
            setProgress((prev) => {
              const next = Math.min(prev + 5, 85);
              Animated.timing(progressAnim, {
                toValue: next,
                duration: 250,
                useNativeDriver: false,
              }).start();
              return next;
            });
          }, 500);

          const {
            detections: offlineDets,
            processingTime,
            errors,
          } = await runOfflineInference(imageUri);
          clearInterval(interval);

          console.log(
            `[Upload] ✅ Offline fallback: ${offlineDets.length} fish in ${processingTime}ms`,
          );
          setOfflineResults(offlineDets);
          setOfflineProcessingTime(processingTime);

          if (offlineDets.length > 0) {
            // Reconstruct boxes for overlay
            const imgDims = await new Promise<{ w: number; h: number }>(
              (resolve) => {
                Image.getSize(
                  imageUri!,
                  (w, h) => resolve({ w, h }),
                  () => resolve({ w: 1, h: 1 }),
                );
              },
            );
            const boxes: BoundingBox[] = offlineDets.map((d) => ({
              x1: d.bbox[0] / imgDims.w,
              y1: d.bbox[1] / imgDims.h,
              x2: d.bbox[2] / imgDims.w,
              y2: d.bbox[3] / imgDims.h,
              classId: 0,
              confidence: d.speciesConfidence,
            }));
            setDetections(boxes);
            setDetectionTime(processingTime);
            setCropUris(
              offlineDets.filter((d) => d.cropUri).map((d) => d.cropUri!),
            );

            const best = offlineDets.reduce((a, b) =>
              b.speciesConfidence > a.speciesConfidence ? b : a,
            );
            // User requested to remove the top summary card for offline mode to avoid duplicates
            // setResult(offlineResultToAnalysisResult(best));
          } else {
            Alert.alert("No Fish Detected", "No fish detected in this image.");
          }

          animateProgress(100);
          setStep(offlineDets.length > 0 ? "done" : "error");
        } catch (fallbackErr: any) {
          console.error(
            "[Upload] ❌ Offline fallback also failed:",
            fallbackErr.message,
          );
          setStep("error");
          Alert.alert(
            "Analysis Failed",
            `Cloud: ${e.message}\nOffline: ${fallbackErr.message}`,
          );
        }
      }
    }
  };

  const reset = () => {
    setImageUri(null);
    setResult(null);
    setStep("idle");
    setProgress(0);
    progressAnim.setValue(0);
    setLocation(null);
    setDetections([]);
    setCropUris([]);
    setDetectionTime(null);
    setIsDetecting(false);
    setOfflineResults([]);
    setOfflineProcessingTime(null);
    setAnalysisMode(null);
  };

  const gradeColor =
    result?.qualityGrade === "Premium"
      ? COLORS.success
      : result?.qualityGrade === "Standard"
        ? COLORS.warning
        : COLORS.error;

  if (!isLoaded) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t("upload.title")}</Text>
          <Text style={styles.subtitle}>{t("upload.subtitle")}</Text>
        </View>

        {/* Upload Zone */}
        {!imageUri ? (
          <View style={styles.uploadZone}>
            <Text style={styles.uploadEmoji}>📸</Text>
            <Text style={styles.uploadTitle}>{t("upload.cta")}</Text>
            <Text style={styles.uploadHint}>{t("upload.hint")}</Text>
            <View style={styles.uploadBtns}>
              <Button
                label={`📷  ${t("upload.btnCamera")}`}
                onPress={captureFromCamera}
                variant="primary"
                style={styles.uploadBtn}
              />
              <Button
                label={`🖼️  ${t("upload.btnGallery")}`}
                onPress={pickFromGallery}
                variant="outline"
                style={styles.uploadBtn}
              />
            </View>
            {/* Tips */}
            <View style={styles.tipsBox}>
              <Text style={styles.tipsTitle}>{t("upload.tipsTitle")}</Text>
              <Text style={styles.tipItem}>• {t("upload.tip1")}</Text>
              <Text style={styles.tipItem}>• {t("upload.tip2")}</Text>
              <Text style={styles.tipItem}>• {t("upload.tip3")}</Text>
            </View>
          </View>
        ) : (
          <>
            {/* Image Preview */}
            <View style={styles.previewCard}>
              <Image
                source={{ uri: imageUri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
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
                  {step === "uploading"
                    ? `☁️ ${t("upload.uploading")}...`
                    : `🧠 ${t("upload.analyzing")}...`}
                </Text>
                <View style={styles.progressBar}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                </View>
                {step === "processing" && (
                  <Text style={styles.progressHint}>
                    {analysisMode === "offline"
                      ? "🔌 Offline: YOLOv8 → Species → Disease → GradCAM"
                      : "YOLOv11 → Species Classification → Weight Estimation"}
                  </Text>
                )}
              </Card>
            )}

            {/* Controls */}
            {step === "idle" && (
              <View style={styles.controlRow}>
                <Button
                  label={`${t("upload.btnStartAnalysis")} ⚡`}
                  onPress={startAnalysis}
                  size="lg"
                  style={styles.analyzeBtn}
                />
                <Button
                  label={t("common.cancel")}
                  onPress={reset}
                  variant="ghost"
                  style={styles.removeBtn}
                />
              </View>
            )}
            {step === "error" && (
              <View style={styles.controlRow}>
                <Button
                  label="Retry"
                  onPress={startAnalysis}
                  style={{ flex: 1 }}
                />
                <Button
                  label={t("common.cancel")}
                  onPress={reset}
                  variant="outline"
                  style={{ flex: 1 }}
                />
              </View>
            )}
            {step === "done" && (
              <Button
                label={t("upload.btnUploadAnother")}
                onPress={reset}
                variant="outline"
                fullWidth
                style={{ marginTop: SPACING.md }}
              />
            )}
          </>
        )}

        {/* On-device Model Status */}
        <Card style={styles.modelStatusCard} padding={SPACING.base}>
          <Text
            style={[
              styles.modelStatusTitle,
              { fontSize: FONTS.sizes.base, marginBottom: SPACING.sm },
            ]}
          >
            🧩 On-Device Models
          </Text>

          {/* Detection model (TFLite) */}
          <View style={styles.modelRow}>
            <View
              style={[
                styles.modelDot,
                { backgroundColor: modelError ? COLORS.error : COLORS.success },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.modelRowLabel}>YOLOv8 Detection</Text>
              <Text style={styles.modelStatusPath} numberOfLines={1}>
                {modelName}
              </Text>
              <Text style={styles.modelStatusPath} numberOfLines={1}>
                {modelError ? "❌ Not found" : `✅ ${modelSource}`}
              </Text>
            </View>
          </View>

          {/* Species model (TFLite) */}
          <View style={styles.modelRow}>
            <View
              style={[
                styles.modelDot,
                {
                  backgroundColor: tfliteInfo?.speciesModel.isLoaded
                    ? COLORS.success
                    : COLORS.error,
                },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.modelRowLabel}>
                Species Classification (Fish.tflite)
              </Text>
              <Text style={styles.modelStatusPath} numberOfLines={1}>
                {tfliteLoading
                  ? "⏳ Loading…"
                  : tfliteInfo?.speciesModel.isLoaded
                    ? `✅ ${tfliteInfo.speciesModel.loadedUri}`
                    : "❌ Not found"}
              </Text>
            </View>
          </View>

          {/* Disease model (TFLite) */}
          <View style={styles.modelRow}>
            <View
              style={[
                styles.modelDot,
                {
                  backgroundColor: tfliteInfo?.diseaseModel.isLoaded
                    ? COLORS.success
                    : COLORS.error,
                },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.modelRowLabel}>
                Disease Detection (Fish_disease.tflite)
              </Text>
              <Text style={styles.modelStatusPath} numberOfLines={1}>
                {tfliteLoading
                  ? "⏳ Loading…"
                  : tfliteInfo?.diseaseModel.isLoaded
                    ? `✅ ${tfliteInfo.diseaseModel.loadedUri}`
                    : "❌ Not found"}
              </Text>
            </View>
          </View>

          <View style={styles.modelActionsRow}>
            <Button
              label="Reload All Models"
              onPress={handleReloadModel}
              variant="outline"
              size="sm"
              loading={isReloadingModel}
              style={styles.reloadButton}
            />
          </View>

          {(modelError || tfliteError) && (
            <Text style={styles.modelStatusError}>
              {modelError
                ? "Models not deployed.\nRun: npm run deploy-models\n(or see README for ADB commands)\n"
                : ""}
              {tfliteError ? tfliteError : ""}
            </Text>
          )}
        </Card>

        {isDetecting && (
          <Card style={styles.detectionCard} padding={SPACING.base}>
            <View style={styles.detectingRow}>
              <ActivityIndicator size="small" color={COLORS.primaryLight} />
              <Text style={styles.detectingText}>
                Running on-device detection…
              </Text>
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
                ⚡ {detections.length} fish detected in {detectionTime}ms
                (on-device)
              </Text>
            )}

            {cropUris.length > 0 && (
              <View style={styles.cropsSection}>
                <Text style={styles.cropsTitle}>Detected Crops</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cropsRow}
                >
                  {cropUris.map((uri, idx) => (
                    <View key={`${uri}-${idx}`} style={styles.cropItem}>
                      <Image
                        source={{ uri }}
                        style={styles.cropImage}
                        resizeMode="cover"
                      />
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
            <Text style={styles.sectionTitle}>{t("upload.results")}</Text>

            {/* Species Card */}
            <Card style={styles.resultCard} padding={SPACING.xl}>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: result.isSustainable
                        ? COLORS.success + "20"
                        : COLORS.warning + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      {
                        color: result.isSustainable
                          ? COLORS.success
                          : COLORS.warning,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {result.isSustainable
                      ? "✓ Sustainable"
                      : "⚠ Not sustainable"}
                  </Text>
                </View>
              </View>

              <Text style={styles.speciesLabel}>{t("upload.species")}</Text>
              <Text style={styles.speciesName} numberOfLines={2}>
                {result.species}
              </Text>
              <Text style={styles.scientificName} numberOfLines={2}>
                {result.scientificName}
              </Text>

              <View style={styles.confidenceRow}>
                <Text style={styles.confidenceLabel}>
                  {t("upload.confidence")}
                </Text>
                <Text style={styles.confidenceValue}>
                  {(result.confidence * 100).toFixed(1)}%
                </Text>
              </View>
            </Card>

            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
              <Card style={styles.metricCard} padding={SPACING.base}>
                <Text style={styles.metricEmoji}>⚖️</Text>
                <Text style={styles.metricLabel}>{t("map.weight")}</Text>
                <Text style={styles.metricValue}>
                  {(result.measurements.weight_g / 1000).toFixed(2)} KG
                </Text>
                <Text style={styles.metricSub}>
                  {result.measurements.length_mm} mm
                </Text>
              </Card>
              <Card style={styles.metricCard} padding={SPACING.base}>
                <Text style={styles.metricEmoji}>🏷️</Text>
                <Text style={styles.metricLabel}>{t("upload.quality")}</Text>
                <Text style={[styles.metricValue, { color: gradeColor }]}>
                  {result.qualityGrade}
                </Text>
                <Text style={styles.metricSub}>Physical markers</Text>
              </Card>
            </View>

            {/* Market Value */}
            <Card style={styles.marketCard} padding={SPACING.xl}>
              <View style={styles.marketRow}>
                <View style={styles.marketPrimaryBlock}>
                  <Text style={styles.marketLabel}>
                    📈 {t("upload.marketValue")}
                  </Text>
                  <Text style={styles.marketValue}>
                    ₹
                    {result.marketEstimate.estimated_value.toLocaleString(
                      "en-IN",
                    )}
                  </Text>
                  <Text style={styles.marketRate}>
                    @ ₹{result.marketEstimate.price_per_kg}/kg
                  </Text>
                </View>
                <View style={styles.marketSecondaryBlock}>
                  <Text style={styles.legalLabel}>{t("upload.legalSize")}</Text>
                  <View
                    style={[
                      styles.legalBadge,
                      {
                        backgroundColor: result.compliance.is_legal_size
                          ? COLORS.success + "20"
                          : COLORS.error + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.legalText,
                        {
                          color: result.compliance.is_legal_size
                            ? COLORS.success
                            : COLORS.error,
                        },
                      ]}
                    >
                      {result.compliance.is_legal_size
                        ? `≥${result.compliance.min_legal_size_mm}mm ✓`
                        : "Below Limit"}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* Sustainability */}
            <Card
              style={{
                ...styles.sustainCard,
                borderColor: result.isSustainable
                  ? COLORS.success + "40"
                  : COLORS.warning + "40",
              }}
              padding={SPACING.base}
            >
              <Text style={{ fontSize: 20, marginBottom: SPACING.xs }}>
                {result.isSustainable ? "✅" : "⚠️"}
              </Text>
              <Text style={styles.sustainText}>
                {result.isSustainable
                  ? t("upload.sustainMsg")
                  : t("upload.warningMsg")}
              </Text>
            </Card>

            {/* Analysis mode badge */}
            {analysisMode && (
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>
                  {analysisMode === "offline"
                    ? "🔌 Analyzed Offline (On-Device)"
                    : "☁️ Analyzed via Cloud"}
                </Text>
                {offlineProcessingTime !== null && (
                  <Text style={styles.modeBadgeSub}>
                    Pipeline completed in {offlineProcessingTime}ms
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* ═══ Per-Fish Offline Results ═══ */}
        {offlineResults.length > 0 && (
          <View style={styles.offlineSection}>
            <Text style={styles.sectionTitle}>
              🐟 Detected Fish ({offlineResults.length})
            </Text>
            {offlineResults.map((det, idx) => {
              const diseaseColor =
                det.disease === "Healthy Fish"
                  ? COLORS.success
                  : COLORS.warning;
              const qualColor =
                det.qualityGrade === "Premium"
                  ? COLORS.success
                  : det.qualityGrade === "Standard"
                    ? COLORS.warning
                    : COLORS.error;

              return (
                <Card key={idx} style={styles.fishCard} padding={SPACING.base}>
                  {/* Header */}
                  <View style={styles.fishCardHeader}>
                    <Text style={styles.fishCardTitle}>Fish #{idx + 1}</Text>
                    <View
                      style={[
                        styles.fishConfBadge,
                        { backgroundColor: COLORS.primaryLight + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.fishConfText,
                          { color: COLORS.primaryLight },
                        ]}
                      >
                        {(det.speciesConfidence * 100).toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  {/* Species */}
                  <Text style={styles.fishSpecies}>{det.species}</Text>

                  {/* Disease */}
                  <View style={styles.fishRow}>
                    <Text style={styles.fishLabel}>Disease:</Text>
                    <Text style={[styles.fishValue, { color: diseaseColor }]}>
                      {det.disease} ({(det.diseaseConfidence * 100).toFixed(1)}
                      %)
                    </Text>
                  </View>

                  {/* Quality */}
                  <View style={styles.fishRow}>
                    <Text style={styles.fishLabel}>Quality:</Text>
                    <Text style={[styles.fishValue, { color: qualColor }]}>
                      {det.qualityGrade}
                    </Text>
                  </View>

                  {/* Measurements */}
                  <View style={styles.fishMetrics}>
                    <View style={styles.fishMetricItem}>
                      <Text style={styles.fishMetricVal}>
                        {(det.weightG / 1000).toFixed(2)} kg
                      </Text>
                      <Text style={styles.fishMetricLabel}>Weight</Text>
                    </View>
                    <View style={styles.fishMetricItem}>
                      <Text style={styles.fishMetricVal}>
                        {det.lengthMm} mm
                      </Text>
                      <Text style={styles.fishMetricLabel}>Length</Text>
                    </View>
                    <View style={styles.fishMetricItem}>
                      <Text style={styles.fishMetricVal}>
                        ₹{det.estimatedValue}
                      </Text>
                      <Text style={styles.fishMetricLabel}>Value</Text>
                    </View>
                  </View>

                  {/* Legal size */}
                  <View style={styles.fishRow}>
                    <Text style={styles.fishLabel}>Legal Size:</Text>
                    <Text
                      style={[
                        styles.fishValue,
                        {
                          color: det.isLegalSize
                            ? COLORS.success
                            : COLORS.error,
                        },
                      ]}
                    >
                      {det.isLegalSize
                        ? `✓ ≥${det.minLegalSize}mm`
                        : `✗ Below ${det.minLegalSize}mm`}
                    </Text>
                  </View>

                  {/* Crop + GradCAM images */}
                  <View style={styles.fishImages}>
                    {det.cropUri && (
                      <View style={styles.fishImgBox}>
                        <Image
                          source={{ uri: det.cropUri }}
                          style={styles.fishImg}
                          resizeMode="cover"
                        />
                        <Text style={styles.fishImgLabel}>Crop</Text>
                      </View>
                    )}
                    {det.gradcamUri && (
                      <View style={styles.fishImgBox}>
                        <Image
                          source={{ uri: det.gradcamUri }}
                          style={styles.fishImg}
                          resizeMode="cover"
                        />
                        <Text style={styles.fishImgLabel}>GradCAM</Text>
                      </View>
                    )}
                  </View>

                  {/* Error notice */}
                  {det.error && (
                    <Text style={styles.fishError}>⚠️ {det.error}</Text>
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  scroll: { flex: 1 },
  content: { padding: SPACING.xl, paddingBottom: SPACING["4xl"] },

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

  uploadZone: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS["2xl"],
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    padding: SPACING["2xl"],
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  uploadEmoji: { fontSize: 48, marginBottom: SPACING.md },
  uploadTitle: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
    marginBottom: SPACING.sm,
  },
  uploadHint: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  uploadBtns: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  uploadBtn: { minWidth: 130 },

  tipsBox: {
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    width: "100%",
  },
  tipsTitle: {
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.bold,
    fontSize: FONTS.sizes.sm,
    marginBottom: SPACING.xs,
  },
  tipItem: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
    lineHeight: 22,
  },

  previewCard: {
    borderRadius: RADIUS["2xl"],
    overflow: "hidden",
    marginBottom: SPACING.md,
    position: "relative",
  },
  previewImage: { width: "100%", height: 280 },
  locationBadge: {
    position: "absolute",
    top: SPACING.md,
    left: SPACING.md,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  locationText: {
    color: "#fff",
    fontSize: FONTS.sizes.xs,
    fontFamily: "monospace",
  },

  progressCard: { marginBottom: SPACING.md },
  progressLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.medium,
    marginBottom: SPACING.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  progressHint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    fontStyle: "italic",
    textAlign: "center",
  },

  controlRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  analyzeBtn: { flex: 1 },
  removeBtn: { minWidth: 90 },

  resultsSection: { marginTop: SPACING.sm },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },

  resultCard: { marginBottom: SPACING.md },
  statusRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: SPACING.sm,
  },
  statusChip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    maxWidth: "75%",
  },
  statusChipText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  speciesLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: SPACING.xs,
  },
  speciesName: {
    fontSize: FONTS.sizes["2xl"],
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.extrabold,
    marginBottom: SPACING.xs,
    flexShrink: 1,
    maxWidth: "100%",
  },
  scientificName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontStyle: "italic",
    marginBottom: SPACING.base,
    flexShrink: 1,
    maxWidth: "100%",
  },
  confidenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confidenceLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted },
  confidenceValue: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
  },

  metricsGrid: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  metricCard: { flex: 1 },
  metricEmoji: { fontSize: 22, marginBottom: SPACING.xs },
  metricLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  metricValue: {
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.extrabold,
  },
  metricSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSubtle,
    marginTop: SPACING.xs,
  },

  marketCard: { marginBottom: SPACING.md },
  marketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  marketPrimaryBlock: { flexShrink: 1, minWidth: 170, maxWidth: "100%" },
  marketSecondaryBlock: { marginLeft: "auto", minWidth: 120, maxWidth: "100%" },
  marketLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
  },
  marketValue: {
    fontSize: FONTS.sizes["2xl"],
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.extrabold,
    flexShrink: 1,
  },
  marketRate: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  legalLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: "right",
    marginBottom: SPACING.xs,
  },
  legalBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  legalText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.bold },

  sustainCard: {
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  sustainText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },

  modelStatusCard: { marginBottom: SPACING.md },
  modelStatusTitle: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    marginBottom: SPACING.xs,
  },
  modelStatusPath: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.xs,
    fontFamily: "monospace",
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  modelRowLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },
  modelActionsRow: { marginTop: SPACING.md, flexDirection: "row" },
  reloadButton: { minWidth: 150 },
  modelStatusError: {
    color: COLORS.warning,
    fontSize: FONTS.sizes.xs,
    marginTop: SPACING.sm,
  },

  // Detection styles
  detectionSection: { marginTop: SPACING.sm, marginBottom: SPACING.md },
  detectionCard: {
    marginBottom: SPACING.sm,
    overflow: "hidden",
    borderRadius: RADIUS.xl,
  },
  detectingRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
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
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  cropImage: { width: "100%", height: "100%" },
  detectionMeta: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: "center",
    fontFamily: "monospace",
    marginTop: SPACING.xs,
  },

  // ── Offline per-fish result styles ──
  offlineSection: { marginTop: SPACING.xl },
  fishCard: { marginBottom: SPACING.md },
  fishCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  fishCardTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  fishConfBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  fishConfText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  fishSpecies: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.extrabold,
    color: COLORS.primaryLight,
    marginBottom: SPACING.sm,
  },
  fishRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  fishLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
  },
  fishValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
  },
  fishMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS.lg,
  },
  fishMetricItem: { alignItems: "center" },
  fishMetricVal: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  fishMetricLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  fishImages: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  fishImgBox: {
    flex: 1,
    alignItems: "center",
  },
  fishImg: {
    width: "100%",
    height: 120,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fishImgLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  fishError: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    marginTop: SPACING.sm,
    fontStyle: "italic",
  },
  modeBadge: {
    alignItems: "center",
    paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeBadgeText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semibold,
  },
  modeBadgeSub: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
    fontFamily: "monospace",
  },
});

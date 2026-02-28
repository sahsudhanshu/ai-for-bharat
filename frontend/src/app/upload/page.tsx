"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  Upload,
  Camera,
  FileText,
  Trash2,
  Zap,
  Scale,
  BarChart2,
  TrendingUp,
  Info,
  MapPin,
  Loader2,
  Eye,
  Bot,
  ChevronDown,
  ChevronUp,
  Bug,
  X,
  ChevronLeft,
  ChevronRight,
  Images,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MLAnalysisResponse, MockCropSupplement } from "@/lib/mock-api";
import { generateMockSupplement } from "@/lib/mock-api";
import { jsPDF } from "jspdf";
import {
  createGroupPresignedUrls,
  uploadGroupToS3,
  analyzeGroup,
  getGroups,
  deleteGroup,
  getPrimaryCrop,
  type GroupRecord,
} from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { resolveMLUrl } from "@/lib/constants";
import CameraModal from "@/components/CameraModal";

type UploadStep = "idle" | "uploading" | "processing" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const { t } = useLanguage();

  // Multi-file state
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);

  // Upload & analysis state
  const [step, setStep] = useState<UploadStep>("idle");
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>(
    {},
  );
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // Results state
  const [mlResults, setMlResults] = useState<MLAnalysisResponse[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  // UI state
  const [dragActive, setDragActive] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [showCamera, setShowCamera] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [expandedCrops, setExpandedCrops] = useState<Set<string>>(new Set());

  // History state
  const [history, setHistory] = useState<GroupRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const resultsCardRef = useRef<HTMLDivElement>(null);

  // Current ML result being displayed
  const currentMlResult = mlResults[currentResultIndex] || null;

  // Generate mock supplements for current result
  const mockSupplements = useMemo<Record<string, MockCropSupplement>>(() => {
    if (!currentMlResult?.crops) return {};
    const supplements: Record<string, MockCropSupplement> = {};
    Object.entries(currentMlResult.crops).forEach(([key, crop], idx) => {
      supplements[key] = generateMockSupplement(crop.species.label, idx);
    });
    return supplements;
  }, [currentMlResult]);

  const cropEntries = useMemo(() => {
    if (!currentMlResult?.crops) return [];
    return Object.entries(currentMlResult.crops).sort(
      (a, b) => b[1].species.confidence - a[1].species.confidence,
    );
  }, [currentMlResult]);

  const toggleCropExpand = (key: string) => {
    setExpandedCrops((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const loadHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      console.log("🔄 Loading history...");
      const response = await getGroups(10);
      console.log("📦 History response:", response);
      const groups = response?.groups || (response as any)?.items || [];
      console.log("📊 Number of groups:", groups.length);
      console.log("📋 Groups array:", groups);
      setHistory(groups);
    } catch (err) {
      console.error("❌ Failed to load upload history:", err);
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Get overall upload progress
  const overallUploadProgress = useMemo(() => {
    const progressValues = Object.values(uploadProgress);
    if (progressValues.length === 0) return 0;
    return Math.round(progressValues.reduce((a, b) => a + b, 0) / files.length);
  }, [uploadProgress, files.length]);

  // ── File Handling ───────────────────────────────────────────────────────────
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      handleFiles(droppedFiles);
    }
  }, []);

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((f) => f.type.startsWith("image/"));
    if (validFiles.length !== newFiles.length) {
      toast.error("Some files were skipped (only images allowed)");
    }
    if (validFiles.length === 0) {
      toast.error(t("upload.imageError"));
      return;
    }

    setFiles((prev) => [...prev, ...validFiles]);

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () =>
        setPreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });

    setMlResults([]);
    setStep("idle");
    setScanError(null);
    setExpandedCrops(new Set());

    if ("geolocation" in navigator && files.length === 0) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocation(null),
      );
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));

    if (selectedPreviewIndex >= files.length - 1) {
      setSelectedPreviewIndex(Math.max(0, files.length - 2));
    } else if (selectedPreviewIndex > index) {
      setSelectedPreviewIndex((prev) => prev - 1);
    }
  };

  // ── Camera handling ────────────────────────────────────────────────────────
  const handleCameraClick = () => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      mobileFileInputRef.current?.click();
    } else {
      if (
        window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
      ) {
        toast.error(t("camera.httpsRequired"));
        return;
      }
      setShowCamera(true);
    }
  };

  const handleCameraCapture = (capturedFile: File) => {
    handleFiles([capturedFile]);
    setShowCamera(false);
  };

  // ── Upload + Analyze Flow ──────────────────────────────────────────────────
  const startAnalysis = async () => {
    if (files.length === 0) return;

    try {
      setStep("uploading");
      setUploadProgress({});
      setScanError(null);
      setMlResults([]);
      setCurrentResultIndex(0);

      // Create group presigned URLs
      const fileMetadata = files.map((f) => ({
        fileName: f.name,
        fileType: f.type,
      }));
      const { groupId, presignedUrls } =
        await createGroupPresignedUrls(fileMetadata);
      setCurrentGroupId(groupId);

      // Upload all files to S3
      await uploadGroupToS3(presignedUrls, files, (index, pct) => {
        setUploadProgress((prev) => ({ ...prev, [index]: pct }));
      });

      // Analyze group
      setStep("processing");
      setAnalysisProgress(0);
      const progressInterval = setInterval(() => {
        setAnalysisProgress((prev) => {
          if (prev >= 85) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 8;
        });
      }, 300);

      const { analysisResult } = await analyzeGroup(groupId, files.length);

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      // Debug: Log the analysis result structure
      console.log("Analysis Result:", analysisResult);
      console.log("Images in result:", analysisResult.images);
      console.log("Number of images:", analysisResult.images.length);

      // The images array already contains the ML analysis results
      // Each image has: { imageIndex, s3Key, crops, yolo_image_url }
      // which matches the MLAnalysisResponse structure
      setMlResults(analysisResult.images as any);
      setStep("done");
      setExpandedCrops(new Set());

      // Reload history to show the new upload
      await loadHistory();

      const totalFish = analysisResult.aggregateStats.totalFishCount;
      toast.success(
        `Analysis complete! ${totalFish} fish detected across ${files.length} images.`,
      );
    } catch (err) {
      setStep("error");
      toast.error(err instanceof Error ? err.message : t("upload.error"));
    }
  };

  // ── Export PDF ─────────────────────────────────────────────────────────────
  const exportToPdf = () => {
    if (mlResults.length === 0) return;

    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString("en-IN");

    doc.setFontSize(18);
    doc.text("OceanAI - Group Analysis Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${generatedAt}`, 14, 30);
    doc.text(`Images Analyzed: ${mlResults.length}`, 14, 36);

    let cursorY = 46;
    let totalFish = 0;

    mlResults.forEach((result, imgIdx) => {
      const cropList = Object.entries(result.crops ?? {});
      totalFish += cropList.length;

      if (cursorY > 250) {
        doc.addPage();
        cursorY = 20;
      }

      doc.setFontSize(14);
      doc.text(
        `Image ${imgIdx + 1} - ${cropList.length} fish detected`,
        14,
        cursorY,
      );
      cursorY += 10;

      cropList.forEach(([key, crop], idx) => {
        const supplement = generateMockSupplement(crop.species.label, idx);

        if (cursorY > 260) {
          doc.addPage();
          cursorY = 20;
        }

        doc.setFontSize(11);
        doc.text(`  Fish #${idx + 1}: ${crop.species.label}`, 18, cursorY);
        cursorY += 6;

        doc.setFontSize(9);
        const lines = [
          `    Species: ${crop.species.label} (${(crop.species.confidence * 100).toFixed(1)}%)`,
          `    Disease: ${crop.disease.label} (${(crop.disease.confidence * 100).toFixed(1)}%)`,
          `    Weight: ${supplement?.weight_kg?.toFixed(2) ?? "—"} KG`,
          `    Quality: ${supplement?.qualityGrade ?? "—"}`,
        ];
        lines.forEach((line) => {
          doc.text(line, 18, cursorY);
          cursorY += 5;
        });
        cursorY += 3;
      });
      cursorY += 5;
    });

    doc.setFontSize(12);
    if (cursorY > 260) {
      doc.addPage();
      cursorY = 20;
    }
    doc.text(`Total Fish Detected: ${totalFish}`, 14, cursorY);

    doc.save(`oceanai-group-${Date.now()}.pdf`);
    toast.success("PDF exported successfully.");
  };

  const reset = () => {
    setFiles([]);
    setPreviews([]);
    setSelectedPreviewIndex(0);
    setMlResults([]);
    setCurrentResultIndex(0);
    setStep("idle");
    setUploadProgress({});
    setAnalysisProgress(0);
    setLocation(null);
    setScanError(null);
    setCurrentGroupId(null);
    setExpandedCrops(new Set());
  };

  const isAnalyzing = step === "uploading" || step === "processing";
  const isDisabled = isAnalyzing;
  const hasFiles = files.length > 0;
  const hasResults = mlResults.length > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-10">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t("upload.title")}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {t("upload.subtitle")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column: Upload */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-3xl border-2 border-dashed border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden transition-all duration-300">
            <CardContent className="p-0">
              {!hasFiles ? (
                <div
                  className={cn(
                    "flex flex-col items-center justify-center p-6 sm:p-12 text-center min-h-[300px] sm:min-h-[400px] transition-all duration-300 cursor-pointer",
                    dragActive ? "bg-primary/5 scale-[0.99]" : "bg-transparent",
                  )}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div
                    className={cn(
                      "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 text-primary transition-all duration-300",
                      dragActive
                        ? "bg-primary text-white scale-110"
                        : "bg-primary/10",
                    )}
                  >
                    <Upload className="w-8 h-8 sm:w-10 sm:h-10" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2">
                    {dragActive
                      ? t("upload.dropHere")
                      : "Upload Single or Multiple Images"}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8 max-w-xs mx-auto">
                    Select one or more fish images for AI analysis
                  </p>
                  <div
                    className="flex flex-wrap items-center justify-center gap-3 sm:gap-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl h-10 sm:h-12 px-5 sm:px-6 bg-primary font-bold text-xs sm:text-sm"
                    >
                      {t("upload.browse")}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl h-10 sm:h-12 px-5 sm:px-6 border-border font-bold text-xs sm:text-sm"
                      onClick={handleCameraClick}
                    >
                      <Camera className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                      {t("upload.camera")}
                    </Button>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleFiles(Array.from(e.target.files));
                        e.target.value = ""; // Reset input to allow selecting same files again
                      }
                    }}
                    accept="image/*"
                    multiple
                  />
                  <input
                    type="file"
                    ref={mobileFileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleFiles(Array.from(e.target.files));
                        e.target.value = ""; // Reset input to allow selecting same files again
                      }
                    }}
                    accept="image/*"
                    capture="environment"
                    multiple
                  />
                </div>
              ) : (
                <div>
                  {/* Main Image Display */}
                  <div className="relative group">
                    <img
                      src={previews[selectedPreviewIndex]}
                      alt="Selected Preview"
                      className="w-full h-auto max-h-[400px] sm:max-h-[450px] object-contain rounded-t-3xl bg-black/20"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <Button
                        variant="secondary"
                        className="rounded-xl font-bold bg-white text-black text-xs sm:text-sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isDisabled}
                      >
                        Add More
                      </Button>
                      <Button
                        variant="destructive"
                        className="rounded-xl font-bold text-xs sm:text-sm"
                        onClick={reset}
                        disabled={isDisabled}
                      >
                        <Trash2 className="mr-2 w-4 h-4" />
                        Clear All
                      </Button>
                    </div>
                    {location && (
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-mono">
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        {location.lat.toFixed(4)}°N, {location.lng.toFixed(4)}°E
                      </div>
                    )}
                    {files.length > 1 && (
                      <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-bold">
                        <Images className="w-3 h-3 inline mr-1" />
                        {selectedPreviewIndex + 1} / {files.length}
                      </div>
                    )}
                  </div>

                  {/* Preview Grid */}
                  <div className="p-4 border-t border-border bg-muted/20">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold">
                        {files.length} Images Selected
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isDisabled}
                        className="h-8 text-xs"
                      >
                        Add More
                      </Button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {previews.map((preview, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                            selectedPreviewIndex === idx
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-transparent hover:border-primary/50",
                          )}
                          onClick={() => setSelectedPreviewIndex(idx)}
                        >
                          <img
                            src={preview}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-16 sm:h-20 object-cover"
                          />
                          {step === "idle" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(idx);
                              }}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          {step === "uploading" &&
                            uploadProgress[idx] !== undefined && (
                              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  {uploadProgress[idx]}%
                                </span>
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

            {hasFiles && step === "idle" && !hasResults && (
              <CardFooter className="p-4 sm:p-6 border-t border-border bg-card/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>
                    {files.length} {files.length === 1 ? "image" : "images"}{" "}
                    ready
                  </span>
                </div>
                <Button
                  onClick={startAnalysis}
                  className="w-full sm:w-auto rounded-xl h-12 px-8 bg-primary font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  {t("upload.startAnalysis")}
                  <Zap className="ml-2 w-4 h-4 fill-white" />
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Progress Cards */}
          {step === "uploading" && (
            <Card className="rounded-3xl border-border bg-card/50 backdrop-blur-sm p-6 space-y-4">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  Uploading {files.length}{" "}
                  {files.length === 1 ? "image" : "images"}
                </span>
                <span className="text-primary font-bold">
                  {overallUploadProgress}%
                </span>
              </div>
              <Progress
                value={overallUploadProgress}
                className="h-3 rounded-full bg-primary/10"
              />
            </Card>
          )}

          {step === "processing" && (
            <Card className="rounded-3xl border-border bg-card/50 backdrop-blur-sm p-6 space-y-4">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary fill-primary animate-pulse" />
                  {t("upload.processing")}
                </span>
                <span className="text-primary font-bold">
                  {analysisProgress}%
                </span>
              </div>
              <Progress
                value={analysisProgress}
                className="h-3 rounded-full bg-primary/10"
              />
              <p className="text-xs text-muted-foreground text-center italic animate-pulse">
                Analyzing {files.length} images with AI...
              </p>
            </Card>
          )}

          {/* Tips Card */}
          {step !== "processing" && step !== "uploading" && (
            <Card className="rounded-3xl border-none bg-blue-500/5 p-6">
              <div className="flex gap-4">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 h-fit shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-blue-500">
                    {t("upload.tips")}
                  </h4>
                  <ul className="text-sm text-blue-400/80 leading-relaxed space-y-1">
                    <li>• {t("upload.tip1")}</li>
                    <li>• {t("upload.tip2")}</li>
                    <li>• {t("upload.tip3")}</li>
                    <li>• Upload multiple images for batch analysis</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-5 space-y-6" ref={resultsCardRef}>
          <Card
            className={cn(
              "rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm flex flex-col transition-all duration-500 relative",
              !hasResults && "opacity-50 grayscale pointer-events-none",
            )}
          >
            <CardHeader className="p-6 sm:p-8">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-bold">
                    {t("upload.results")}
                  </CardTitle>
                  <CardDescription>{t("upload.resultsBy")}</CardDescription>
                </div>
                {hasResults && (
                  <Badge className="px-3 sm:px-4 py-1.5 rounded-full border-none text-[10px] sm:text-xs bg-primary text-white">
                    {cropEntries.length} fish in this image
                  </Badge>
                )}
              </div>

              {/* Image Navigation */}
              {mlResults.length > 1 && (
                <div className="mt-4 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentResultIndex((prev) => Math.max(0, prev - 1))
                    }
                    disabled={currentResultIndex === 0}
                    className="rounded-lg"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="text-sm font-medium text-center">
                    Image {currentResultIndex + 1} of {mlResults.length}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentResultIndex((prev) =>
                        Math.min(mlResults.length - 1, prev + 1),
                      )
                    }
                    disabled={currentResultIndex === mlResults.length - 1}
                    className="rounded-lg"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-6 sm:p-8 pt-0 flex-1 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">
              {currentMlResult ? (
                <>
                  {/* YOLO Detection Overview */}
                  {currentMlResult.yolo_image_url && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <Eye className="w-3.5 h-3.5" />
                        YOLO Detection
                      </h4>
                      <img
                        src={resolveMLUrl(currentMlResult.yolo_image_url)}
                        alt="YOLO Detection"
                        className="w-full rounded-2xl border border-border object-contain bg-black/10 max-h-[250px]"
                      />
                    </div>
                  )}

                  {/* Per-Crop Result Cards */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Detected Fish ({cropEntries.length})
                    </h4>

                    {cropEntries.map(([key, crop], idx) => {
                      const supplement = mockSupplements[key];
                      const isExpanded = expandedCrops.has(key);
                      const hasCropImg = !!crop.crop_url;
                      const hasGradcam =
                        !!crop.species.gradcam_url ||
                        !!crop.disease.gradcam_url;
                      const diseaseIsHealthy =
                        crop.disease.label.toLowerCase() === "healthy" ||
                        crop.disease.label.toLowerCase() === "healthy fish";

                      return (
                        <div
                          key={key}
                          className="rounded-2xl border border-border/60 bg-muted/10 overflow-hidden transition-all"
                        >
                          {/* Crop Header */}
                          <div className="p-4 space-y-3">
                            <div className="flex gap-3">
                              {/* Crop Thumbnail */}
                              {hasCropImg ? (
                                <img
                                  src={resolveMLUrl(crop.crop_url)}
                                  alt={crop.species.label}
                                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-border object-cover bg-black/10 shrink-0"
                                />
                              ) : (
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-border bg-primary/5 flex items-center justify-center shrink-0">
                                  <span className="text-2xl">🐟</span>
                                </div>
                              )}

                              {/* Species Info */}
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-xs text-muted-foreground font-medium">
                                      Fish #{idx + 1}
                                    </p>
                                    <h3 className="text-lg sm:text-xl font-bold text-primary leading-tight truncate">
                                      {crop.species.label}
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground italic">
                                      {supplement?.scientificName}
                                    </p>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-2 py-0.5 shrink-0 border-primary/30 text-primary font-bold"
                                  >
                                    {(crop.species.confidence * 100).toFixed(1)}
                                    %
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            {/* Disease Badge */}
                            <div
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                                diseaseIsHealthy
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-amber-500/10 text-amber-600",
                              )}
                            >
                              <span>{diseaseIsHealthy ? "✓" : "🦠"}</span>
                              <span className="font-bold">
                                {crop.disease.label}
                              </span>
                              <span className="text-muted-foreground">
                                ({(crop.disease.confidence * 100).toFixed(1)}%
                                confidence)
                              </span>
                            </div>

                            {/* Confidence Meters */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground font-medium">
                                  Species Confidence
                                </p>
                                <div className="relative h-2 rounded-full bg-primary/10 overflow-hidden">
                                  <div
                                    className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                                    style={{
                                      width: `${crop.species.confidence * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground font-medium">
                                  YOLO Detection
                                </p>
                                <div className="relative h-2 rounded-full bg-blue-500/10 overflow-hidden">
                                  <div
                                    className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all"
                                    style={{
                                      width: `${crop.yolo_confidence * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Mock Supplementary Data */}
                            {supplement && (
                              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
                                <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                    <Scale className="w-3 h-3" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider">
                                      Weight (est.)
                                    </span>
                                  </div>
                                  <p className="text-base sm:text-lg font-bold">
                                    {supplement.weight_kg.toFixed(2)} KG
                                  </p>
                                  <p className="text-[9px] text-muted-foreground">
                                    {supplement.length_mm} mm length
                                  </p>
                                </div>
                                <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
                                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                    <BarChart2 className="w-3 h-3" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider">
                                      Quality (est.)
                                    </span>
                                  </div>
                                  <p
                                    className={cn(
                                      "text-base sm:text-lg font-bold",
                                      supplement.qualityGrade === "Premium"
                                        ? "text-emerald-500"
                                        : supplement.qualityGrade === "Standard"
                                          ? "text-amber-500"
                                          : "text-red-500",
                                    )}
                                  >
                                    {supplement.qualityGrade}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground">
                                    AI quality estimate
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Market Estimate (Mock) */}
                            {supplement && (
                              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 text-primary">
                                    <TrendingUp className="w-3 h-3" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider">
                                      Market Est.
                                    </span>
                                  </div>
                                  <p className="text-lg font-bold">
                                    ₹{supplement.estimatedValue}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] text-muted-foreground">
                                    @ ₹{supplement.marketPricePerKg}/kg
                                  </p>
                                  <Badge
                                    className={cn(
                                      "px-2 py-0.5 mt-1 border-none text-[9px] font-bold",
                                      supplement.isSustainable
                                        ? "bg-emerald-500/10 text-emerald-500"
                                        : "bg-amber-500/10 text-amber-500",
                                    )}
                                  >
                                    {supplement.isSustainable
                                      ? "Sustainable ✓"
                                      : "Limited ⚠"}
                                  </Badge>
                                </div>
                              </div>
                            )}

                            {/* Grad-CAM Toggle */}
                            {hasGradcam && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => toggleCropExpand(key)}
                              >
                                <Bug className="w-3 h-3 mr-1.5" />
                                Grad-CAM Heatmaps
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                                )}
                              </Button>
                            )}
                          </div>

                          {/* Expanded: Grad-CAM Images */}
                          {isExpanded && hasGradcam && (
                            <div className="px-4 pb-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                {crop.species.gradcam_url && (
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold text-muted-foreground">
                                      Species Grad-CAM
                                    </p>
                                    <img
                                      src={resolveMLUrl(
                                        crop.species.gradcam_url,
                                      )}
                                      alt="Species Grad-CAM"
                                      className="w-full rounded-xl border border-border object-contain bg-black/10 max-h-[160px]"
                                    />
                                  </div>
                                )}
                                {crop.disease.gradcam_url && (
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold text-muted-foreground">
                                      Disease Grad-CAM
                                    </p>
                                    <img
                                      src={resolveMLUrl(
                                        crop.disease.gradcam_url,
                                      )}
                                      alt="Disease Grad-CAM"
                                      className="w-full rounded-xl border border-border object-contain bg-black/10 max-h-[160px]"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-30">
                  <BarChart2 className="w-16 h-16 mb-6" />
                  <p className="text-lg font-bold">
                    {scanError ?? t("upload.noResults")}
                  </p>
                  <p className="text-sm max-w-xs mx-auto">
                    {scanError
                      ? "Please retake the image and try again."
                      : t("upload.noResultsDesc")}
                  </p>
                </div>
              )}
            </CardContent>

            {hasResults && (
              <CardFooter className="p-6 sm:p-8 pt-0 gap-4 flex-col sm:flex-row">
                <Button
                  variant="outline"
                  onClick={exportToPdf}
                  className="flex-1 w-full h-12 sm:h-14 rounded-xl border-border font-bold"
                >
                  {t("upload.export")}
                </Button>
                <Button
                  variant="default"
                  onClick={() =>
                    currentGroupId && router.push(`/groups/${currentGroupId}`)
                  }
                  className="flex-1 w-full h-12 sm:h-14 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  View Full Report
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      {/* Camera Modal */}
      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />

      {/* Recent Upload History */}
      <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="p-6 sm:p-8 pb-3">
          <CardTitle className="text-xl sm:text-2xl font-bold">
            Recent Upload History
          </CardTitle>
          <CardDescription>Your latest group analysis results</CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8 pt-2">
          {isLoadingHistory ? (
            <div className="text-sm text-muted-foreground">
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="text-sm text-muted-foreground">No uploads yet.</div>
          ) : (
            <div className="space-y-3">
              {history.map((group) => {
                const stats = group.analysisResult?.aggregateStats;
                const fishCount = stats?.totalFishCount ?? 0;
                const speciesCount = stats?.speciesDistribution
                  ? Object.keys(stats.speciesDistribution).length
                  : 0;
                const topSpecies = stats?.speciesDistribution
                  ? Object.keys(stats.speciesDistribution)[0]
                  : null;
                const hasDisease = stats?.diseaseDetected ?? false;

                return (
                  <div
                    key={group.groupId}
                    className="rounded-xl border border-border/60 bg-muted/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-lg border border-border bg-primary/10 flex items-center justify-center text-primary">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {group.imageCount}{" "}
                            {group.imageCount === 1 ? "Image" : "Images"}
                            {fishCount > 0 && (
                              <span className="text-xs text-muted-foreground ml-1.5">
                                · {fishCount} fish
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(group.createdAt).toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "uppercase text-[10px] shrink-0",
                          group.status === "failed"
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : group.status === "completed"
                              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                              : group.status === "partial"
                                ? "bg-amber-500 hover:bg-amber-600 text-white"
                                : "bg-blue-500 hover:bg-blue-600 text-white",
                        )}
                      >
                        {group.status}
                      </Badge>
                    </div>
                    {stats && (
                      <div className="mt-3 text-xs text-muted-foreground grid grid-cols-2 gap-2">
                        <span>Fish: {fishCount}</span>
                        <span>Species: {speciesCount}</span>
                        {topSpecies && <span>Top: {topSpecies}</span>}
                        <span
                          className={
                            hasDisease ? "text-amber-500" : "text-emerald-500"
                          }
                        >
                          {hasDisease ? "⚠️ Disease detected" : "✓ Healthy"}
                        </span>
                      </div>
                    )}
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          try {
                            await deleteGroup(group.groupId);
                            setHistory((prev) =>
                              prev.filter((g) => g.groupId !== group.groupId),
                            );
                            toast.success("Removed from history");
                          } catch {
                            toast.error("Failed to remove from history");
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Remove
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => router.push(`/groups/${group.groupId}`)}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        View details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

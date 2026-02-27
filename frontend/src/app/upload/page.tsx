"use client"

import React, { useState, useCallback, useRef } from 'react';
import { Upload, Camera, FileText, CheckCircle2, AlertCircle, Trash2, Zap, Scale, BarChart2, TrendingUp, Info, MapPin, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getPresignedUrl, uploadToS3, analyzeImage } from "@/lib/api-client";
import type { FishAnalysisResult } from "@/lib/mock-api";
import { useLanguage } from "@/lib/i18n";
import CameraModal from "@/components/CameraModal";

type UploadStep = "idle" | "uploading" | "processing" | "done" | "error";

export default function UploadPage() {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<UploadStep>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [result, setResult] = useState<FishAnalysisResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      toast.error(t('upload.imageError'));
      return;
    }
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selectedFile);
    setResult(null);
    setStep("idle");

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocation(null)
      );
    }
  };

  // ── Camera handling ────────────────────────────────────────────────────────
  const handleCameraClick = () => {
    // On mobile, use the native file input with capture attribute
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      mobileFileInputRef.current?.click();
    } else {
      // On desktop, open our camera modal
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        toast.error(t('camera.httpsRequired'));
        return;
      }
      setShowCamera(true);
    }
  };

  const handleCameraCapture = (capturedFile: File) => {
    handleFile(capturedFile);
    setShowCamera(false);
  };

  // ── Full Upload + Analyze Flow ───────────────────────────────────────────────
  const startAnalysis = async () => {
    if (!file) return;

    try {
      setStep("uploading");
      setUploadProgress(0);
      const { uploadUrl, imageId } = await getPresignedUrl(
        file.name,
        file.type,
        location?.lat,
        location?.lng
      );

      await uploadToS3(uploadUrl, file, (pct) => setUploadProgress(pct));
      setUploadProgress(100);

      setStep("processing");
      setAnalysisProgress(0);
      const progressInterval = setInterval(() => {
        setAnalysisProgress((prev) => {
          if (prev >= 85) { clearInterval(progressInterval); return prev; }
          return prev + 10;
        });
      }, 250);

      const { analysisResult } = await analyzeImage(imageId);
      clearInterval(progressInterval);
      setAnalysisProgress(100);
      setResult(analysisResult);
      setStep("done");
      toast.success(t('upload.success'));
    } catch (err) {
      setStep("error");
      toast.error(err instanceof Error ? err.message : t('upload.error'));
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep("idle");
    setUploadProgress(0);
    setAnalysisProgress(0);
    setLocation(null);
  };

  const isAnalyzing = step === "uploading" || step === "processing";
  const isDisabled = isAnalyzing;

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-10">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('upload.title')}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">{t('upload.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column: Upload */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-3xl border-2 border-dashed border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden transition-all duration-300">
            <CardContent className="p-0">
              {!preview ? (
                <div
                  className={cn(
                    "flex flex-col items-center justify-center p-6 sm:p-12 text-center min-h-[300px] sm:min-h-[400px] transition-all duration-300 cursor-pointer",
                    dragActive ? "bg-primary/5 scale-[0.99]" : "bg-transparent"
                  )}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className={cn(
                    "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 text-primary transition-all duration-300",
                    dragActive ? "bg-primary text-white scale-110" : "bg-primary/10"
                  )}>
                    <Upload className="w-8 h-8 sm:w-10 sm:h-10" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2">
                    {dragActive ? t('upload.dropHere') : t('upload.dragDrop')}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8 max-w-xs mx-auto">
                    {t('upload.hint')}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4" onClick={(e) => e.stopPropagation()}>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl h-10 sm:h-12 px-5 sm:px-6 bg-primary font-bold text-xs sm:text-sm"
                    >
                      {t('upload.browse')}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl h-10 sm:h-12 px-5 sm:px-6 border-border font-bold text-xs sm:text-sm"
                      onClick={handleCameraClick}
                    >
                      <Camera className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                      {t('upload.camera')}
                    </Button>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    accept="image/*"
                  />
                  {/* Mobile camera file input with capture attribute */}
                  <input
                    type="file"
                    ref={mobileFileInputRef}
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    accept="image/*"
                    capture="environment"
                  />
                </div>
              ) : (
                <div className="relative group">
                  <img
                    src={preview}
                    alt="Catch Preview"
                    className="w-full h-auto max-h-[400px] sm:max-h-[550px] object-contain rounded-t-3xl bg-black/20"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <Button
                      variant="secondary"
                      className="rounded-xl font-bold bg-white text-black text-xs sm:text-sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isDisabled}
                    >
                      {t('upload.replace')}
                    </Button>
                    <Button
                      variant="destructive"
                      className="rounded-xl font-bold text-xs sm:text-sm"
                      onClick={reset}
                      disabled={isDisabled}
                    >
                      <Trash2 className="mr-2 w-4 h-4" />
                      {t('upload.remove')}
                    </Button>
                  </div>
                  {location && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-mono">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      {location.lat.toFixed(4)}°N, {location.lng.toFixed(4)}°E
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    accept="image/*"
                  />
                </div>
              )}
            </CardContent>

            {preview && step === "idle" && !result && (
              <CardFooter className="p-4 sm:p-6 border-t border-border bg-card/50 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span className="truncate max-w-[150px] sm:max-w-none">
                    {file?.name} · {(((file?.size || 0) / 1024 / 1024) < 1)
                      ? `${((file?.size || 0) / 1024).toFixed(0)} KB`
                      : `${((file?.size || 0) / 1024 / 1024).toFixed(2)} MB`}
                  </span>
                </div>
                <Button
                  onClick={startAnalysis}
                  className="w-full sm:w-auto rounded-xl h-12 px-8 bg-primary font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                  {t('upload.startAnalysis')}
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
                  {t('upload.uploading')}
                </span>
                <span className="text-primary font-bold">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-3 rounded-full bg-primary/10" />
            </Card>
          )}

          {step === "processing" && (
            <Card className="rounded-3xl border-border bg-card/50 backdrop-blur-sm p-6 space-y-4">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary fill-primary animate-pulse" />
                  {t('upload.processing')}
                </span>
                <span className="text-primary font-bold">{analysisProgress}%</span>
              </div>
              <Progress value={analysisProgress} className="h-3 rounded-full bg-primary/10" />
              <p className="text-xs text-muted-foreground text-center italic animate-pulse">
                {t('upload.pipeline')}
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
                  <h4 className="font-bold text-blue-500">{t('upload.tips')}</h4>
                  <ul className="text-sm text-blue-400/80 leading-relaxed space-y-1">
                    <li>• {t('upload.tip1')}</li>
                    <li>• {t('upload.tip2')}</li>
                    <li>• {t('upload.tip3')}</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-5 space-y-6">
          <Card className={cn(
            "rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm h-full flex flex-col transition-all duration-500",
            !result && "opacity-50 grayscale pointer-events-none"
          )}>
            <CardHeader className="p-6 sm:p-8">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-bold">{t('upload.results')}</CardTitle>
                  <CardDescription>{t('upload.resultsBy')}</CardDescription>
                </div>
                {result && (
                  <Badge className={cn(
                    "px-3 sm:px-4 py-1.5 rounded-full border-none text-[10px] sm:text-xs",
                    result.isSustainable ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                  )}>
                    {result.isSustainable ? t('upload.sustainableBadge') : t('upload.limitedBadge')}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 pt-0 flex-1 space-y-8">
              {result ? (
                <>
                  {/* Species */}
                  <div className="space-y-6">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('upload.species')}</span>
                        <h2 className="text-2xl sm:text-4xl font-bold text-primary">{result.species}</h2>
                        <p className="text-xs text-muted-foreground italic">{result.scientificName}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('upload.confidence')}</span>
                        <p className="text-xl font-bold">{(result.confidence * 100).toFixed(1)}%</p>
                      </div>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 sm:p-5 rounded-2xl bg-muted/30 border border-border/50 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Scale className="w-4 h-4" />
                          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">{t('upload.weight')}</span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">
                          {result.measurements ? (result.measurements.weight_g / 1000).toFixed(2) : result.weightEstimate.toFixed(2)} KG
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          Length: {result.measurements?.length_mm ?? "—"} mm
                        </p>
                      </div>
                      <div className="p-4 sm:p-5 rounded-2xl bg-muted/30 border border-border/50 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <BarChart2 className="w-4 h-4" />
                          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">{t('upload.quality')}</span>
                        </div>
                        <p className={cn(
                          "text-xl sm:text-2xl font-bold",
                          result.qualityGrade === 'Premium' ? "text-emerald-500" :
                            result.qualityGrade === 'Standard' ? "text-amber-500" : "text-red-500"
                        )}>{result.qualityGrade}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">{t('upload.qualityBasis')}</p>
                      </div>
                    </div>

                    {/* Market Price */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-primary font-bold">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-[10px] sm:text-xs uppercase tracking-wider">{t('upload.marketValue')}</span>
                        </div>
                        <p className="text-2xl sm:text-3xl font-bold">
                          ₹{result.marketEstimate?.estimated_value ?? Math.round(result.marketPriceEstimate * result.weightEstimate)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @ ₹{result.marketEstimate?.price_per_kg ?? result.marketPriceEstimate}/kg
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{t('upload.legalSize')}</p>
                        <Badge className={cn(
                          "px-3 py-1 mt-1 border-none text-[10px] font-bold",
                          result.compliance?.is_legal_size ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                        )}>
                          {result.compliance?.is_legal_size ? `≥${result.compliance.min_legal_size_mm}mm ✓` : t('upload.belowLimit')}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Sustainability */}
                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{t('upload.sustainability')}</h4>
                    <div className="flex gap-4 p-4 rounded-xl bg-muted/20 border border-border/50">
                      {result.isSustainable ? (
                        <>
                          <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                          <p className="text-sm leading-relaxed">{t('upload.sustainable')}</p>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                          <p className="text-sm leading-relaxed">{t('upload.notSustainable')}</p>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-30">
                  <BarChart2 className="w-16 h-16 mb-6" />
                  <p className="text-lg font-bold">{t('upload.noResults')}</p>
                  <p className="text-sm max-w-xs mx-auto">{t('upload.noResultsDesc')}</p>
                </div>
              )}
            </CardContent>

            {result && (
              <CardFooter className="p-6 sm:p-8 pt-0 gap-4">
                <Button className="flex-1 h-12 sm:h-14 rounded-xl bg-primary font-bold shadow-lg shadow-primary/20">
                  {t('upload.save')}
                </Button>
                <Button variant="outline" className="flex-1 h-12 sm:h-14 rounded-xl border-border font-bold">
                  {t('upload.export')}
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
    </div>
  );
}

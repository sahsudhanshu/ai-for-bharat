"use client";

import React, { useState, useCallback, useRef } from "react";
import { Upload, Trash2, Zap, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createGroupPresignedUrls,
  uploadGroupToS3,
  analyzeGroup,
  type GroupRecord,
} from "@/lib/api-client";
import type { GroupAnalysis } from "@/lib/mock-api";

type UploadStep = "idle" | "uploading" | "processing" | "done" | "error";

export default function UploadGroupPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [step, setStep] = useState<UploadStep>("idle");
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [groupId, setGroupId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<GroupAnalysis | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (droppedFiles.length > 0) addFiles(droppedFiles);
  }, []);

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(f => f.type.startsWith("image/"));
    if (validFiles.length !== newFiles.length) {
      toast.error("Some files were skipped (only images allowed)");
    }
    
    setFiles(prev => [...prev, ...validFiles]);
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setPreviews(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = async () => {
    if (files.length === 0) return;

    try {
      setStep("uploading");
      setUploadProgress({});

      const fileMetadata = files.map(f => ({ fileName: f.name, fileType: f.type }));
      const { groupId: newGroupId, presignedUrls } = await createGroupPresignedUrls(fileMetadata);
      setGroupId(newGroupId);

      await uploadGroupToS3(presignedUrls, files, (index, pct) => {
        setUploadProgress(prev => ({ ...prev, [index]: pct }));
      });

      setStep("processing");
      const { analysisResult: result } = await analyzeGroup(newGroupId, files.length);
      setAnalysisResult(result);
      setStep("done");
      toast.success(`Analysis complete! ${result.aggregateStats.totalFishCount} fish detected.`);
    } catch (err) {
      setStep("error");
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const reset = () => {
    setFiles([]);
    setPreviews([]);
    setStep("idle");
    setUploadProgress({});
    setGroupId(null);
    setAnalysisResult(null);
  };

  const overallProgress = Object.keys(uploadProgress).length > 0
    ? Math.round(Object.values(uploadProgress).reduce((a, b) => a + b, 0) / files.length)
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Multi-Image Group Analysis</h1>
        <p className="text-muted-foreground">Upload multiple fish images for batch analysis</p>
      </div>

      <Card className="rounded-3xl border-2 border-dashed">
        <CardContent className="p-8">
          {files.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center p-12 text-center min-h-[300px] cursor-pointer transition-all",
                dragActive && "bg-primary/5 scale-[0.99]"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all",
                dragActive ? "bg-primary text-white scale-110" : "bg-primary/10 text-primary"
              )}>
                <Upload className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold mb-2">
                {dragActive ? "Drop images here" : "Upload Multiple Images"}
              </h3>
              <p className="text-sm text-muted-foreground mb-8 max-w-xs">
                Select or drag multiple fish images for batch analysis
              </p>
              <Button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="rounded-xl">
                Browse Files
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
                accept="image/*"
                multiple
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">{files.length} Images Selected</h3>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={step !== "idle"}>
                  Add More
                </Button>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {previews.map((preview, idx) => (
                  <div key={idx} className="relative group">
                    <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-32 object-cover rounded-xl border" />
                    {step === "idle" && (
                      <button
                        onClick={() => removeFile(idx)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {step === "uploading" && uploadProgress[idx] !== undefined && (
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                        <div className="text-white text-sm font-bold">{uploadProgress[idx]}%</div>
                      </div>
                    )}
                    {step === "uploading" && uploadProgress[idx] === 100 && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {step === "idle" && (
                <Button onClick={startAnalysis} className="w-full h-12 rounded-xl" size="lg">
                  Start Analysis <Zap className="ml-2 w-4 h-4 fill-white" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {step === "uploading" && (
        <Card className="rounded-3xl">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Uploading Images
              </span>
              <span className="text-primary font-bold">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {step === "processing" && (
        <Card className="rounded-3xl">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 font-medium">
                <Zap className="w-4 h-4 text-primary fill-primary animate-pulse" />
                Processing Images
              </span>
            </div>
            <Progress value={85} className="h-3" />
            <p className="text-xs text-muted-foreground text-center italic">
              Running ML analysis on all images...
            </p>
          </CardContent>
        </Card>
      )}

      {step === "done" && analysisResult && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>Group analysis completed successfully</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <div className="text-2xl font-bold text-primary">{analysisResult.aggregateStats.totalFishCount}</div>
                <div className="text-xs text-muted-foreground">Total Fish</div>
              </div>
              <div className="p-4 rounded-xl bg-muted/20 border">
                <div className="text-2xl font-bold">{Object.keys(analysisResult.aggregateStats.speciesDistribution).length}</div>
                <div className="text-xs text-muted-foreground">Species</div>
              </div>
              <div className="p-4 rounded-xl bg-muted/20 border">
                <div className="text-2xl font-bold">{analysisResult.aggregateStats.totalEstimatedWeight.toFixed(1)} kg</div>
                <div className="text-xs text-muted-foreground">Est. Weight</div>
              </div>
              <div className="p-4 rounded-xl bg-muted/20 border">
                <div className="text-2xl font-bold">₹{analysisResult.aggregateStats.totalEstimatedValue}</div>
                <div className="text-xs text-muted-foreground">Est. Value</div>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-3">Species Distribution</h4>
              <div className="space-y-2">
                {Object.entries(analysisResult.aggregateStats.speciesDistribution).map(([species, count]) => (
                  <div key={species} className="flex justify-between items-center p-3 rounded-lg bg-muted/20">
                    <span className="font-medium">{species}</span>
                    <Badge>{count} fish</Badge>
                  </div>
                ))}
              </div>
            </div>

            {analysisResult.aggregateStats.diseaseDetected && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-500/10 text-amber-600">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Disease detected in some fish</span>
              </div>
            )}

            <div className="flex gap-4">
              <Button onClick={reset} variant="outline" className="flex-1">
                New Analysis
              </Button>
              <Button onClick={() => groupId && router.push(`/groups/${groupId}`)} className="flex-1">
                View Details
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "error" && (
        <Card className="rounded-3xl border-red-500/50">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">Upload Failed</h3>
            <p className="text-sm text-muted-foreground mb-4">Please try again</p>
            <Button onClick={reset}>Start Over</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

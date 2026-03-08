"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, ArrowLeft, Download, Bug, Scale, TrendingUp, MapPin, Bot,
  ChevronLeft, ChevronRight, Eye, ChevronDown, ChevronUp, Images, Sparkles, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getGroupDetails, type GroupRecord } from "@/lib/api-client";
import { resolveMLUrl } from "@/lib/constants";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

// Dynamic imports for map components
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });

// Helper function to generate supplement data
function generateSupplement(speciesLabel: string) {
  const SPECIES_DATA = [
    { name: "Indian Pomfret", scientific: "Pampus argenteus", minSize: 150, pricePerKg: 650 },
    { name: "Indian Mackerel", scientific: "Rastrelliger kanagurta", minSize: 100, pricePerKg: 220 },
    { name: "Kingfish", scientific: "Scomberomorus commerson", minSize: 350, pricePerKg: 480 },
    { name: "Yellowfin Tuna", scientific: "Thunnus albacares", minSize: 450, pricePerKg: 420 },
    { name: "Indo-Pacific Swordfish", scientific: "Xiphias gladius", minSize: 1200, pricePerKg: 820 },
    { name: "Seer Fish", scientific: "Scomberomorus guttatus", minSize: 300, pricePerKg: 850 },
    { name: "Hilsa Shad", scientific: "Tenualosa ilisha", minSize: 250, pricePerKg: 700 },
  ];

  const matchSpecies = (label: string) => {
    if (!label) return SPECIES_DATA[0];
    const lower = label.toLowerCase();
    return SPECIES_DATA.find(s =>
      lower.includes(s.name.split(" ")[0].toLowerCase()) ||
      s.name.toLowerCase().includes(lower)
    ) ?? SPECIES_DATA[0];
  };

  const matched = matchSpecies(speciesLabel);
  // deterministic mock generation based on label length to prevent jitter
  const length_mm = matched.minSize + ((speciesLabel.length * 17) % 200);
  const weight_kg = ((length_mm / 1000) ** 3 * 1e6 * 0.014) / 1000;
  const estimatedValue = Math.round(weight_kg * matched.pricePerKg);
  const qualityGrade = weight_kg > (matched.minSize / 1000) * 1.5 ? "Premium" : "Standard";

  return { weight_kg, estimatedValue, qualityGrade };
}

export default function HistoryDetailView({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analysisTime, setAnalysisTime] = useState<number | null>(null);

  // Split view state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [expandedCrops, setExpandedCrops] = useState<Set<string>>(new Set(['yolo_overview']));

  const YOLO_CONFIDENCE_THRESHOLD = 0.30;

  useEffect(() => {
    const loadGroupDetails = async () => {
      try {
        setIsLoading(true);
        const data = await getGroupDetails(groupId);
        setGroup(data);

        // Calculate analysis time if available
        if (data.createdAt && data.analysisResult?.processedAt) {
          const start = new Date(data.createdAt).getTime();
          const end = new Date(data.analysisResult.processedAt).getTime();
          setAnalysisTime(Math.round((end - start) / 1000));
        }
      } catch (err) {
        console.error("Failed to load group details", err);
        toast.error("Failed to load group details");
      } finally {
        setIsLoading(false);
      }
    };
    loadGroupDetails();
  }, [groupId]);

  const toggleCropExpand = (key: string) => {
    setExpandedCrops(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportToPdf = async () => {
    if (!group?.analysisResult) return;
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let cursorY = 20;

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("OceanAI - Group Analysis Report", 14, cursorY);

      cursorY += 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, cursorY);
      cursorY += 5;
      doc.text(`Group ID: ${groupId}`, 14, cursorY);
      cursorY += 5;
      doc.text(`Analysis Date: ${new Date(group.createdAt).toLocaleString()}`, 14, cursorY);

      if (group.latitude && group.longitude) {
        cursorY += 5;
        doc.text(`Location: ${group.latitude.toFixed(6)}, ${group.longitude.toFixed(6)} (Ocean)`, 14, cursorY);
      }

      cursorY += 12;
      doc.setDrawColor(200);
      doc.line(14, cursorY, pageWidth - 14, cursorY);
      cursorY += 10;

      const stats = group.analysisResult.aggregateStats;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text("Aggregate Statistics", 14, cursorY);
      cursorY += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Fish Detected: ${stats.totalFishCount}`, 18, cursorY);
      cursorY += 6;
      doc.text(`Total Estimated Weight: ${stats.totalEstimatedWeight.toFixed(2)} kg`, 18, cursorY);
      cursorY += 6;
      doc.text(`Total Estimated Value: ₹${stats.totalEstimatedValue.toLocaleString()}`, 18, cursorY);
      cursorY += 10;

      const allCrops = group.analysisResult.images.flatMap((img, imgIdx) =>
        Object.entries(img.crops).map(([key, crop]) => ({ key: `${imgIdx}_${key}`, imageIndex: imgIdx, crop }))
      );

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Individual Fish Detections (${allCrops.length} total)`, 14, cursorY);
      cursorY += 8;

      for (let i = 0; i < allCrops.length; i++) {
        const { imageIndex, crop } = allCrops[i];
        const supplement = generateSupplement(crop.species.label);

        if (cursorY > pageHeight - 40) { doc.addPage(); cursorY = 20; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Fish #${i + 1} (Image ${imageIndex + 1}) - ${crop.species.label}`, 18, cursorY);
        cursorY += 6;
        doc.setFont("helvetica", "normal");
        doc.text(`Disease: ${crop.disease.label} (${(crop.disease.confidence * 100).toFixed(1)}%)`, 22, cursorY);
        cursorY += 5;
        doc.text(`Weight: ${supplement.weight_kg.toFixed(2)} kg  |  Value: ₹${supplement.estimatedValue.toLocaleString()}`, 22, cursorY);
        cursorY += 8;
      }

      doc.save(`oceanai-group-${groupId.slice(0, 8)}-${Date.now()}.pdf`);
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    }
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!group?.analysisResult) return;
    const maxIdx = group.analysisResult.images.length - 1;
    if (direction === 'prev') setSelectedImageIndex(Math.max(0, selectedImageIndex - 1));
    else setSelectedImageIndex(Math.min(maxIdx, selectedImageIndex + 1));
  };


  // Derived state for the currently selected image
  const currentImages = group?.analysisResult?.images ?? [];
  const currentImageResult = currentImages[selectedImageIndex] || null;

  const cropEntries = useMemo(() => {
    if (!currentImageResult?.crops) return [];
    return Object.entries(currentImageResult.crops as Record<string, any>)
      .filter(([, crop]) => crop.yolo_confidence >= YOLO_CONFIDENCE_THRESHOLD)
      .sort((a, b) => b[1].species.confidence - a[1].species.confidence);
  }, [currentImageResult]);

  const topSpeciesName = useMemo(() => {
    if (cropEntries.length === 0) return '';
    return cropEntries[0][1].species.label;
  }, [cropEntries]);


  if (isLoading) {
    return (
      <div className="h-full min-h-0 flex flex-col items-center justify-center text-center">
        <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
        <p className="text-muted-foreground animate-pulse">Loading analysis history...</p>
      </div>
    );
  }

  if (!group || !group.analysisResult) {
    return (
      <div className="h-full min-h-0 flex flex-col items-center justify-center text-center">
        <p className="text-muted-foreground mb-4">Analysis not found or pending</p>
        <Button onClick={onBack} className="rounded-xl">
          Back to History
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col animate-fade-in-up" style={{ animationDuration: '0.4s' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl mr-1 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 hidden sm:flex">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold leading-tight truncate">Past Analysis</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground/80 truncate">
              {new Date(group.createdAt).toLocaleString()} · {currentImages.length} {currentImages.length === 1 ? 'image' : 'images'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToPdf}
            className="h-8 rounded-xl border-border/20 text-xs font-medium hover:bg-muted/20"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">

        {/* ── LEFT: Image carousel + Analysis Details ── */}
        <div className="flex flex-col min-h-0 gap-3 w-full">

          {/* Current Image Viewer */}
          <div className="relative rounded-2xl overflow-hidden border border-border/15 bg-card/30 backdrop-blur-sm flex-shrink-0 animate-slide-in-left">
            {group.presignedViewUrls?.[selectedImageIndex] || currentImageResult?.yolo_image_url ? (
              <img
                src={group.presignedViewUrls?.[selectedImageIndex] || resolveMLUrl(currentImageResult!.yolo_image_url)}
                alt={`Image ${selectedImageIndex + 1}`}
                className="w-full h-auto max-h-[250px] sm:max-h-[300px] object-contain bg-black/10 transition-opacity duration-300"
              />
            ) : (
              <div className="w-full h-[250px] flex items-center justify-center bg-black/5 text-muted-foreground text-sm">
                Image Preview Unavailable
              </div>
            )}

            {/* Navigation arrows */}
            {currentImages.length > 1 && (
              <>
                <button
                  onClick={() => navigateImage('prev')}
                  disabled={selectedImageIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all disabled:opacity-20"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigateImage('next')}
                  disabled={selectedImageIndex >= currentImages.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-all disabled:opacity-20"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {/* Dots */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                  {currentImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        selectedImageIndex === idx ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
            {/* Location overlay */}
            {group.latitude && group.longitude && (
              <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-[9px] font-mono">
                <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                {group.latitude.toFixed(4)}°N, {group.longitude.toFixed(4)}°E
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {currentImages.length > 1 && (
            <div className="flex gap-1.5 px-1 overflow-x-auto scrollbar-none shrink-0 animate-fade-in-up">
              {currentImages.map((img, idx) => {
                const imgUrl = group.presignedViewUrls?.[idx] || img.yolo_image_url;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={cn(
                      "shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-300 bg-black/5",
                      selectedImageIndex === idx
                        ? "border-primary ring-1 ring-primary/20 scale-[1.02]"
                        : "border-transparent opacity-50 hover:opacity-90"
                    )}
                  >
                    {imgUrl ? (
                      <img src={imgUrl === img.yolo_image_url ? resolveMLUrl(imgUrl) : imgUrl} alt="" className="w-12 h-12 object-cover" />
                    ) : (
                      <div className="w-12 h-12 bg-muted/20 flex items-center justify-center"><Images className="w-4 h-4 opacity-30" /></div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Scrollable details area */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 animate-fade-in-up pr-1">

            {/* Aggregate Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Card className="rounded-xl border-border/15 bg-card/20 backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="text-xl font-bold text-primary">{group.analysisResult.aggregateStats.totalFishCount}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">Total Fish</div>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-border/15 bg-card/20 backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="text-xl font-bold">{Object.keys(group.analysisResult.aggregateStats.speciesDistribution).length}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">Species</div>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-border/15 bg-card/20 backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="text-xl font-bold">{group.analysisResult.aggregateStats.totalEstimatedWeight.toFixed(1)} kg</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">Total Weight</div>
                </CardContent>
              </Card>
              <Card className="rounded-xl border-border/15 bg-card/20 backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="text-xl font-bold">₹{group.analysisResult.aggregateStats.totalEstimatedValue}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold">Total Value</div>
                </CardContent>
              </Card>
            </div>

            {/* Individual Fish Cards for Selected Image */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2 mb-2">
                <Search className="w-3.5 h-3.5" /> Detections for Image {selectedImageIndex + 1}
              </h3>

              {cropEntries.length > 0 ? cropEntries.map(([key, crop], idx) => {
                const supplement = generateSupplement(crop.species.label);
                const isExpanded = expandedCrops.has(key);
                const hasCropImg = !!crop.crop_url;
                const hasGradcam = !!crop.species.gradcam_url || !!crop.disease.gradcam_url;
                const diseaseIsHealthy = crop.disease.label.toLowerCase() === "healthy" || crop.disease.label.toLowerCase() === "healthy fish";

                return (
                  <div key={key} className="rounded-xl border border-border/15 bg-card/20 overflow-hidden transition-all duration-300 hover:border-border/30 hover:bg-card/40">
                    <div className="p-3 space-y-2">
                      <div className="flex gap-2.5">
                        {hasCropImg ? (
                          <img src={resolveMLUrl(crop.crop_url)} alt={crop.species.label}
                            className="w-16 h-16 rounded-xl border border-border/10 object-cover bg-black/10 shrink-0" />
                        ) : (
                          <div className="w-16 h-16 rounded-xl border border-border/10 bg-primary/5 flex items-center justify-center shrink-0">
                            <span className="text-2xl">🐟</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider">Fish #{idx + 1}</p>
                              <h3 className="text-sm font-bold text-foreground leading-tight truncate">{crop.species.label}</h3>
                            </div>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 border-primary/20 text-primary font-bold bg-primary/5">
                              {(crop.species.confidence * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <div className={cn(
                            "inline-flex self-start items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold",
                            diseaseIsHealthy ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600",
                          )}>
                            <span>{diseaseIsHealthy ? "✓" : "⚠"}</span>
                            {crop.disease.label}
                          </div>
                        </div>
                      </div>

                      {/* Inline stats */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/5">
                        <div className="text-center p-1.5 rounded-lg bg-muted/10 transition-colors hover:bg-muted/20">
                          <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wide">Weight</p>
                          <p className="text-xs font-bold text-foreground/90">{supplement.weight_kg.toFixed(1)} kg</p>
                        </div>
                        <div className="text-center p-1.5 rounded-lg bg-muted/10 transition-colors hover:bg-muted/20">
                          <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wide">Quality</p>
                          <p className={cn("text-xs font-bold", supplement.qualityGrade === "Premium" ? "text-emerald-500" : "text-foreground/90")}>{supplement.qualityGrade}</p>
                        </div>
                        <div className="text-center p-1.5 rounded-lg bg-muted/10 transition-colors hover:bg-muted/20">
                          <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wide">Value</p>
                          <p className="text-xs font-bold text-foreground/90">₹{supplement.estimatedValue}</p>
                        </div>
                      </div>

                      {/* Grad-CAM toggle */}
                      {hasGradcam && (
                        <Button variant="ghost" size="sm" className="w-full h-8 text-[10px] font-semibold text-muted-foreground hover:text-foreground mt-1 bg-muted/5 hover:bg-muted/20 rounded-lg" onClick={() => toggleCropExpand(key)}>
                          <Bug className="w-3 h-3 mr-1.5 text-primary/70" /> {isExpanded ? 'Hide' : 'Show'} Heatmap
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
                        </Button>
                      )}
                    </div>

                    {isExpanded && hasGradcam && (
                      <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-3 border-t border-border/5 bg-black/5">
                        {crop.species.gradcam_url && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest text-center">Species Heatmap</p>
                            <img src={resolveMLUrl(crop.species.gradcam_url)} alt="Species Grad-CAM" className="w-full rounded-xl border border-border/20 object-contain bg-black/10 max-h-[140px] shadow-sm hover:scale-[1.02] transition-transform" />
                          </div>
                        )}
                        {crop.disease.gradcam_url && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest text-center">Disease Heatmap</p>
                            <img src={resolveMLUrl(crop.disease.gradcam_url)} alt="Disease Grad-CAM" className="w-full rounded-xl border border-border/20 object-contain bg-black/10 max-h-[140px] shadow-sm hover:scale-[1.02] transition-transform" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-border/30 rounded-2xl bg-card/10">
                  <Images className="w-8 h-8 mb-3 text-muted-foreground/30" />
                  <p className="text-sm font-bold text-muted-foreground">No Fish Detected</p>
                  <p className="text-xs text-muted-foreground/60 max-w-[200px] mt-1">Detections fell below the minimum confidence threshold.</p>
                </div>
              )}
            </div>

            {/* Map (if available) placed at the bottom */}
            {group.latitude && group.longitude && (
              <Card className="rounded-2xl border-border/15 overflow-hidden">
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> Location Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="h-[200px] rounded-xl overflow-hidden border border-border/10 mb-2">
                    <MapContainer center={[group.latitude, group.longitude]} zoom={10} style={{ height: "100%", width: "100%" }} zoomControl={false}>
                      <TileLayer url="https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" attribution='Google Maps' />
                      <Marker position={[group.latitude, group.longitude]}>
                        <Popup>Scan location</Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/70 font-mono">Lat: {group.latitude.toFixed(4)}, Lng: {group.longitude.toFixed(4)}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => window.open(`https://www.google.com/maps?q=${group.latitude},${group.longitude}`, "_blank")}>Open Map</Button>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

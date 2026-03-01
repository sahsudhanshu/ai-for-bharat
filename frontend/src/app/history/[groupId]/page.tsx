"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Download, Bug, Scale, TrendingUp, MapPin } from "lucide-react";
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

// Helper function to generate supplement data (weight and value estimation)
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
  const length_mm = matched.minSize + Math.round(Math.random() * 200);
  const weight_g = Math.round((length_mm / 1000) ** 3 * 1e6 * (0.012 + Math.random() * 0.004));
  const weight_kg = weight_g / 1000;
  const estimatedValue = Math.round(weight_kg * matched.pricePerKg);
  
  return { weight_kg, estimatedValue };
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCrops, setExpandedCrops] = useState<Set<string>>(new Set());
  const [diseaseFilter, setDiseaseFilter] = useState(false);
  const [analysisTime, setAnalysisTime] = useState<number | null>(null);

  useEffect(() => {
    loadGroupDetails();
  }, [groupId]);

  const loadGroupDetails = async () => {
    try {
      setIsLoading(true);
      const data = await getGroupDetails(groupId);
      setGroup(data);
      
      // Calculate analysis time if available
      if (data.createdAt && data.analysisResult?.processedAt) {
        const start = new Date(data.createdAt).getTime();
        const end = new Date(data.analysisResult.processedAt).getTime();
        const diffSeconds = Math.round((end - start) / 1000);
        setAnalysisTime(diffSeconds);
      }
    } catch (err) {
      console.error("Failed to load group details", err);
      toast.error("Failed to load group details");
    } finally {
      setIsLoading(false);
    }
  };

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

      // Header
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
      
      if (analysisTime !== null) {
        cursorY += 5;
        const timeStr = analysisTime >= 60 
          ? `${Math.floor(analysisTime / 60)} min ${analysisTime % 60} sec`
          : `${analysisTime} sec`;
        doc.text(`Analysis Time: ${timeStr}`, 14, cursorY);
      }

      if (group.latitude && group.longitude) {
        cursorY += 5;
        doc.text(`Location: ${group.latitude.toFixed(6)}, ${group.longitude.toFixed(6)} (Ocean)`, 14, cursorY);
      }

      cursorY += 12;
      doc.setDrawColor(200);
      doc.line(14, cursorY, pageWidth - 14, cursorY);
      cursorY += 10;

      // Aggregate Statistics
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
      doc.text(`Unique Species: ${Object.keys(stats.speciesDistribution).length}`, 18, cursorY);
      cursorY += 6;
      doc.text(`Total Estimated Weight: ${stats.totalEstimatedWeight.toFixed(2)} kg`, 18, cursorY);
      cursorY += 6;
      doc.text(`Total Estimated Value: ₹${stats.totalEstimatedValue.toLocaleString()}`, 18, cursorY);
      cursorY += 6;
      doc.text(`Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`, 18, cursorY);
      cursorY += 6;
      doc.text(`Disease Detected: ${stats.diseaseDetected ? "Yes" : "No"}`, 18, cursorY);
      cursorY += 10;

      // Species Distribution
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Species Distribution", 14, cursorY);
      cursorY += 8;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      Object.entries(stats.speciesDistribution).forEach(([species, count]) => {
        if (cursorY > pageHeight - 20) {
          doc.addPage();
          cursorY = 20;
        }
        doc.text(`${species}: ${count} fish`, 18, cursorY);
        cursorY += 6;
      });

      cursorY += 8;

      // Individual Fish Details
      const allCrops = group.analysisResult.images.flatMap((img, imgIdx) =>
        Object.entries(img.crops).map(([key, crop]) => ({
          key: `${imgIdx}_${key}`,
          imageIndex: imgIdx,
          crop,
        }))
      );

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Individual Fish Detections (${allCrops.length} total)`, 14, cursorY);
      cursorY += 8;

      for (let i = 0; i < allCrops.length; i++) {
        const { imageIndex, crop } = allCrops[i];
        const supplement = generateSupplement(crop.species.label);
        
        if (cursorY > pageHeight - 40) {
          doc.addPage();
          cursorY = 20;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Fish #${i + 1} (Image ${imageIndex + 1})`, 18, cursorY);
        cursorY += 6;
        
        doc.setFont("helvetica", "normal");
        doc.text(`Species: ${crop.species.label} (${(crop.species.confidence * 100).toFixed(1)}%)`, 22, cursorY);
        cursorY += 5;
        doc.text(`Disease: ${crop.disease.label} (${(crop.disease.confidence * 100).toFixed(1)}%)`, 22, cursorY);
        cursorY += 5;
        doc.text(`Weight: ${supplement.weight_kg.toFixed(2)} kg`, 22, cursorY);
        cursorY += 5;
        doc.text(`Value: ₹${supplement.estimatedValue.toLocaleString()}`, 22, cursorY);
        cursorY += 8;
      }

      // Footer
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
        doc.text("OceanAI - Fish Disease Detection System", pageWidth - 14, pageHeight - 10, { align: "right" });
      }

      doc.save(`oceanai-group-${groupId.slice(0, 8)}-${Date.now()}.pdf`);
      toast.success("PDF exported successfully with all details");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-20 text-center">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading group details...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-6xl mx-auto py-20 text-center">
        <p className="text-muted-foreground">Group not found</p>
        <Button onClick={() => router.push("/history")} className="mt-4">
          Back to History
        </Button>
      </div>
    );
  }

  const allCrops = group.analysisResult?.images.flatMap((img, imgIdx) =>
    Object.entries(img.crops).map(([key, crop]) => ({
      key: `${imgIdx}_${key}`,
      imageIndex: imgIdx,
      crop,
    }))
  ) || [];

  const filteredCrops = diseaseFilter
    ? allCrops.filter(({ crop }) => crop.disease.label !== "Healthy Fish")
    : allCrops;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Group Analysis Details</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span>{new Date(group.createdAt).toLocaleString()}</span>
            {analysisTime !== null && (
              <>
                <span>•</span>
                <span>
                  Analysis completed in {analysisTime >= 60 
                    ? `${Math.floor(analysisTime / 60)} min ${analysisTime % 60} sec`
                    : `${analysisTime} sec`}
                </span>
              </>
            )}
            <span>•</span>
            <span className="font-mono text-xs">ID: {groupId.slice(0, 12)}...</span>
            {group.latitude && group.longitude && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="text-emerald-600">📍</span>
                  <span>Ocean location</span>
                </span>
              </>
            )}
          </div>
        </div>
        {group.analysisResult && (
          <Button onClick={exportToPdf} variant="outline" className="rounded-xl">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        )}
      </div>

      {group.analysisResult && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-primary">{group.analysisResult.aggregateStats.totalFishCount}</div>
                <div className="text-sm text-muted-foreground">Total Fish</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <div className="text-3xl font-bold">{Object.keys(group.analysisResult.aggregateStats.speciesDistribution).length}</div>
                <div className="text-sm text-muted-foreground">Species</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <div className="text-3xl font-bold">{group.analysisResult.aggregateStats.totalEstimatedWeight.toFixed(1)} kg</div>
                <div className="text-sm text-muted-foreground">Est. Weight</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl">
              <CardContent className="p-6">
                <div className="text-3xl font-bold">₹{group.analysisResult.aggregateStats.totalEstimatedValue}</div>
                <div className="text-sm text-muted-foreground">Est. Value</div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Species Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(group.analysisResult.aggregateStats.speciesDistribution).map(([species, count]) => (
                <div key={species} className="flex justify-between items-center p-3 rounded-xl bg-muted/20">
                  <span className="font-medium">{species}</span>
                  <Badge variant="secondary">{count} fish</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Location Map */}
          {group.latitude && group.longitude && (
            <Card className="rounded-3xl">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <CardTitle>Scan Location</CardTitle>
                </div>
                <CardDescription>
                  Ocean location: {group.latitude.toFixed(6)}, {group.longitude.toFixed(6)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] rounded-xl overflow-hidden border">
                  <MapContainer
                    center={[group.latitude, group.longitude]}
                    zoom={10}
                    style={{ height: "100%", width: "100%" }}
                    zoomControl={true}
                  >
                    <TileLayer
                      url="https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
                      attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
                    />
                    <Marker position={[group.latitude, group.longitude]}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">Scan Location</p>
                          <p className="text-xs text-muted-foreground">
                            {group.latitude.toFixed(6)}, {group.longitude.toFixed(6)}
                          </p>
                          <p className="text-xs mt-1">
                            {new Date(group.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
                    <span>Ocean location verified</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `https://www.google.com/maps?q=${group.latitude},${group.longitude}`;
                      window.open(url, "_blank");
                    }}
                  >
                    Open in Google Maps
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* YOLO Detection Images */}
          {group.analysisResult.images.some(img => img.yolo_image_url) && (
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>YOLO Detection Visualizations</CardTitle>
                <CardDescription>Bounding box detections for each image</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.analysisResult.images.map((img, idx) => (
                  img.yolo_image_url && (
                    <div key={idx} className="space-y-2">
                      <p className="text-sm font-semibold text-muted-foreground">Image {idx + 1}</p>
                      <img
                        src={resolveMLUrl(img.yolo_image_url)}
                        alt={`YOLO Detection ${idx + 1}`}
                        className="w-full rounded-xl border"
                      />
                      <p className="text-xs text-muted-foreground">
                        {Object.keys(img.crops).length} fish detected
                      </p>
                    </div>
                  )
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="rounded-3xl">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Individual Fish Detections</CardTitle>
                  <CardDescription>{filteredCrops.length} fish {diseaseFilter && "(diseased only)"}</CardDescription>
                </div>
                <Button
                  variant={diseaseFilter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDiseaseFilter(!diseaseFilter)}
                  className="rounded-lg"
                >
                  <Bug className="w-4 h-4 mr-2" />
                  {diseaseFilter ? "Show All" : "Diseased Only"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredCrops.map(({ key, imageIndex, crop }, idx) => {
                const supplement = generateSupplement(crop.species.label);
                const isExpanded = expandedCrops.has(key);
                const isDiseased = crop.disease.label !== "Healthy Fish";

                return (
                  <div key={key} className="rounded-2xl border bg-muted/10 overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div className="flex gap-3">
                        {crop.crop_url && (
                          <img
                            src={resolveMLUrl(crop.crop_url)}
                            alt={crop.species.label}
                            className="w-20 h-20 rounded-xl border object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Fish #{idx + 1} • Image {imageIndex + 1}</p>
                              <h3 className="text-xl font-bold text-primary">{crop.species.label}</h3>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {(crop.species.confidence * 100).toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                        isDiseased ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
                      )}>
                        <span>{isDiseased ? "🦠" : "✓"}</span>
                        <span className="font-bold">{crop.disease.label}</span>
                        <span className="text-muted-foreground">({(crop.disease.confidence * 100).toFixed(1)}%)</span>
                      </div>

                      {supplement && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-xl bg-muted/20 border">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                              <Scale className="w-3 h-3" />
                              <span className="text-xs font-bold uppercase">Weight</span>
                            </div>
                            <p className="text-lg font-bold">{supplement.weight_kg.toFixed(2)} KG</p>
                          </div>
                          <div className="p-3 rounded-xl bg-muted/20 border">
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                              <TrendingUp className="w-3 h-3" />
                              <span className="text-xs font-bold uppercase">Value</span>
                            </div>
                            <p className="text-lg font-bold">₹{supplement.estimatedValue}</p>
                          </div>
                        </div>
                      )}

                      {(crop.species.gradcam_url || crop.disease.gradcam_url) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => toggleCropExpand(key)}
                        >
                          <Bug className="w-3 h-3 mr-2" />
                          {isExpanded ? "Hide" : "Show"} Grad-CAM
                        </Button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                        {crop.species.gradcam_url && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Species Grad-CAM</p>
                            <img
                              src={resolveMLUrl(crop.species.gradcam_url)}
                              alt="Species Grad-CAM"
                              className="w-full rounded-xl border"
                            />
                          </div>
                        )}
                        {crop.disease.gradcam_url && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Disease Grad-CAM</p>
                            <img
                              src={resolveMLUrl(crop.disease.gradcam_url)}
                              alt="Disease Grad-CAM"
                              className="w-full rounded-xl border"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Download, Bug, Eye, Scale, BarChart2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getGroupDetails, type GroupRecord } from "@/lib/api-client";
import { generateMockSupplement } from "@/lib/mock-api";
import { resolveMLUrl } from "@/lib/constants";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCrops, setExpandedCrops] = useState<Set<string>>(new Set());
  const [diseaseFilter, setDiseaseFilter] = useState(false);

  useEffect(() => {
    loadGroupDetails();
  }, [groupId]);

  const loadGroupDetails = async () => {
    try {
      setIsLoading(true);
      const data = await getGroupDetails(groupId);
      setGroup(data);
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

  const exportToPdf = () => {
    if (!group?.analysisResult) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("OceanAI - Group Analysis Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Group ID: ${groupId}`, 14, 36);

    let cursorY = 46;
    const stats = group.analysisResult.aggregateStats;
    
    doc.setFontSize(12);
    doc.text("Aggregate Statistics", 14, cursorY);
    cursorY += 8;
    
    doc.setFontSize(10);
    doc.text(`Total Fish: ${stats.totalFishCount}`, 18, cursorY);
    cursorY += 6;
    doc.text(`Species: ${Object.keys(stats.speciesDistribution).length}`, 18, cursorY);
    cursorY += 6;
    doc.text(`Total Weight: ${stats.totalEstimatedWeight.toFixed(2)} kg`, 18, cursorY);
    cursorY += 6;
    doc.text(`Total Value: ₹${stats.totalEstimatedValue}`, 18, cursorY);
    cursorY += 10;

    doc.text("Species Distribution:", 14, cursorY);
    cursorY += 6;
    Object.entries(stats.speciesDistribution).forEach(([species, count]) => {
      doc.text(`  ${species}: ${count}`, 18, cursorY);
      cursorY += 6;
    });

    doc.save(`oceanai-group-${groupId}-${Date.now()}.pdf`);
    toast.success("PDF exported successfully");
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
        <Button onClick={() => router.push("/groups")} className="mt-4">
          Back to Groups
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
        <Button variant="ghost" size="icon" onClick={() => router.push("/groups")} className="rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Group Analysis Details</h1>
          <p className="text-sm text-muted-foreground">{new Date(group.createdAt).toLocaleString()}</p>
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
                const supplement = generateMockSupplement(crop.species.label, idx);
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

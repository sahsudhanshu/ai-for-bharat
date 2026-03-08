"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, Images, Trash2, Download, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getGroups, deleteGroup, type GroupRecord } from "@/lib/api-client";
import { resolveMLUrl } from "@/lib/constants";
import { jsPDF } from "jspdf";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgentFirstStore } from "@/lib/stores/agent-first-store";
import HistoryDetailView from "./HistoryDetailView";

export default function HistoryComponent() {
  const router = useRouter();
  const store = useAgentFirstStore();
  const setActiveComponent = store.setActiveComponent;
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Sync selectedGroupId from store props
  useEffect(() => {
    if (store.componentProps?.selectedGroupId) {
      setSelectedGroupId(store.componentProps.selectedGroupId);
    }
  }, [store.componentProps?.selectedGroupId]);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setIsLoading(true);
      const response = await getGroups(50);
      const items = response.groups || (response as any).items || [];
      setGroups(items);
    } catch (err) {
      console.error("Failed to load groups", err);
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    try {
      await deleteGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.groupId !== groupId));
      toast.success("Removed from history");
    } catch {
      toast.error("Failed to remove from history");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500 text-white";
      case "processing":
        return "bg-blue-500 text-white";
      case "partial":
        return "bg-amber-500 text-white";
      case "failed":
        return "bg-red-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };



  const handleExportPdf = (group: GroupRecord) => {
    if (!group.analysisResult) {
      toast.error("No analysis data to export");
      return;
    }
    try {
      const doc = new jsPDF();
      const stats = group.analysisResult.aggregateStats;
      let y = 20;
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("OceanAI - Analysis Report", 14, y); y += 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y); y += 5;
      doc.text(`Group ID: ${group.groupId}`, 14, y); y += 5;
      doc.text(`Date: ${new Date(group.createdAt).toLocaleString()}`, 14, y); y += 5;
      doc.text(`Images: ${group.imageCount}`, 14, y); y += 10;
      doc.setDrawColor(200); doc.line(14, y, 196, y); y += 8;
      doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
      doc.text("Summary", 14, y); y += 8;
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      doc.text(`Total Fish: ${stats.totalFishCount}`, 18, y); y += 6;
      doc.text(`Species: ${Object.keys(stats.speciesDistribution).length}`, 18, y); y += 6;
      doc.text(`Est. Weight: ${stats.totalEstimatedWeight.toFixed(2)} kg`, 18, y); y += 6;
      doc.text(`Est. Value: ₹${stats.totalEstimatedValue.toLocaleString()}`, 18, y); y += 6;
      doc.text(`Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`, 18, y); y += 6;
      doc.text(`Disease: ${stats.diseaseDetected ? 'Yes' : 'No'}`, 18, y); y += 10;
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text("Species Distribution", 14, y); y += 7;
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      Object.entries(stats.speciesDistribution).forEach(([sp, cnt]) => {
        doc.text(`${sp}: ${cnt} fish`, 18, y); y += 6;
      });
      doc.save(`oceanai-${group.groupId.slice(0, 8)}.pdf`);
      toast.success("PDF exported!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export PDF");
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading history...</p>
        </div>
      </div>
    );
  }

  // --- Helper to show stacked images ---
  const ThumbnailStack = ({ group }: { group: GroupRecord }) => {
    const images = group.analysisResult?.images ?? [];
    if (images.length === 0) {
      return (
        <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
          <Images className="w-8 h-8 text-primary/50" />
        </div>
      );
    }

    if (images.length === 1) {
      const url = group.presignedViewUrls?.[0] || images[0].yolo_image_url;
      return (
        <div className="w-16 h-16 rounded-xl bg-black/10 shrink-0 overflow-hidden border border-border/20 shadow-sm">
          {url ? (
            <img src={url === images[0].yolo_image_url ? resolveMLUrl(url) : url} alt="Catch" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10">
              <Images className="w-6 h-6 text-primary/40" />
            </div>
          )}
        </div>
      );
    }

    // Multiple images (Stack effect)
    const displayImages = images.slice(0, 3);
    const presignedUrls = group.presignedViewUrls || [];

    return (
      <div className="relative w-16 h-16 shrink-0 z-0">
        {displayImages.map((img, idx) => {
          // Stack offsets
          const isLast = idx === displayImages.length - 1;
          const offsetClasses = [
            "z-30 translate-x-0 translate-y-0 relative",
            "z-20 translate-x-1.5 -translate-y-1.5 absolute top-0 left-0 scale-95 opacity-80",
            "z-10 translate-x-3 -translate-y-3 absolute top-0 left-0 scale-90 opacity-60",
          ];
          const imgUrl = presignedUrls[idx] || img.yolo_image_url;
          return (
            <div key={idx} className={cn(
              "w-14 h-14 rounded-lg bg-card shadow-sm border border-border/40 overflow-hidden transition-all",
              offsetClasses[idx]
            )}>
              {imgUrl ? (
                <img src={imgUrl === img.yolo_image_url ? resolveMLUrl(imgUrl) : imgUrl} alt="Catch" className="w-full h-full object-cover bg-black/5" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted/50">
                  <Images className="w-4 h-4 text-muted-foreground/30" />
                </div>
              )}
              {/* Overlay count on last item if > 3 */}
              {isLast && images.length > 3 && idx === 2 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                  <span className="text-white text-[10px] font-bold">+{images.length - 3}</span>
                </div>
              )}
            </div>
          );
        }).reverse()} {/* Reverse so the first image is visually on top (z-index handlings) */}
      </div>
    );
  };

  if (selectedGroupId) {
    return (
      <div className="w-full h-full min-h-0">
        <HistoryDetailView groupId={selectedGroupId} onBack={() => setSelectedGroupId(null)} />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="max-w-6xl mx-auto space-y-6 p-6 pb-20">
        <div>
          <h1 className="text-3xl font-bold">History</h1>
          <p className="text-muted-foreground">Your past analysis sessions</p>
        </div>

        {groups.length === 0 ? (
          <Card className="rounded-3xl">
            <CardContent className="p-20 text-center">
              <Images className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-bold mb-2">No history yet</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Upload images to start analysing your catch
              </p>
              <Button onClick={() => setActiveComponent('upload')}>Upload Now</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {groups.map((group) => {
              const stats = group.analysisResult?.aggregateStats;
              const fishCount = stats?.totalFishCount ?? 0;
              const speciesCount = stats?.speciesDistribution
                ? Object.keys(stats.speciesDistribution).length
                : 0;

              return (
                <Card
                  key={group.groupId}
                  className="rounded-2xl hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <ThumbnailStack group={group} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">
                              {group.imageCount}{" "}
                              {group.imageCount === 1 ? "Image" : "Images"}
                            </h3>
                            <Badge
                              className={cn(
                                "uppercase text-xs",
                                getStatusColor(group.status),
                              )}
                            >
                              {group.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {new Date(group.createdAt).toLocaleString()}
                          </p>
                          {stats && (
                            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                              <span>🐟 {fishCount} fish</span>
                              <span>📊 {speciesCount} species</span>
                              {stats.diseaseDetected && (
                                <span className="text-amber-600">
                                  ⚠️ Disease detected
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">

                        {group.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg text-muted-foreground hover:text-foreground"
                            onClick={() => handleExportPdf(group)}
                            title="Export as PDF"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">Export</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(group.groupId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg text-primary hover:bg-primary/10"
                          onClick={() => {
                            const summary = `Group ${group.groupId.slice(0, 8)}, ${group.imageCount} images, status: ${group.status}, created ${new Date(group.createdAt).toLocaleDateString()}`;
                            (window as any).__agentChatInject?.(`Analyze my catch scan: ${summary}. What species were detected? Any diseases? Give me insights.`);
                          }}
                        >
                          <Sparkles className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Ask AI</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedGroupId(group.groupId)}
                          className="rounded-lg"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

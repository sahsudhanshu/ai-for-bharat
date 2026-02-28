"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, Images, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getGroups, deleteGroup, type GroupRecord } from "@/lib/api-client";

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-20 text-center">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
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
            <Button onClick={() => router.push("/upload")}>Upload Now</Button>
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
                      <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Images className="w-8 h-8 text-primary" />
                      </div>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(group.groupId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/groups/${group.groupId}`)}
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
  );
}

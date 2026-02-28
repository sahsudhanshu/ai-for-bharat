"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  TrendingUp,
  Calendar,
  Download,
  Search,
  Filter,
  Fish,
  Scale,
  DollarSign,
  Anchor,
  ArrowUpRight,
  MoreVertical,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getAnalytics, getGroups, getPrimaryCrop } from "@/lib/api-client";
import type { AnalyticsResponse, GroupRecord } from "@/lib/api-client";
import { generateMockSupplement } from "@/lib/mock-api";
import { toast } from "sonner";

const PIE_COLORS = ["#3b82f6", "#065f46", "#d97706", "#334155"];

function StatSkeleton() {
  return (
    <Card className="rounded-3xl border-border/50 bg-card/50 p-6">
      <Skeleton className="h-12 w-12 rounded-2xl mb-4" />
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-32" />
    </Card>
  );
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card
      className={cn("rounded-3xl border-border/50 bg-card/50 p-8", className)}
    >
      <Skeleton className="h-6 w-40 mb-2" />
      <Skeleton className="h-4 w-56 mb-8" />
      <Skeleton className="h-[300px] w-full rounded-xl" />
    </Card>
  );
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChartTab, setActiveChartTab] = useState("revenue");

  useEffect(() => {
    const load = async () => {
      try {
        const [analyticsData, groupsData] = await Promise.all([
          getAnalytics(),
          getGroups(20),
        ]);
        setAnalytics(analyticsData);
        setGroups(groupsData.groups || []);
      } catch (err) {
        toast.error("Failed to load analytics. Showing demo data.");
        console.error(err);
      } finally {
        setIsLoadingAnalytics(false);
        setIsLoadingGroups(false);
      }
    };
    load();
  }, []);

  // Client-side search filter on the group history
  const filteredGroups = groups.filter((group) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    
    // Search in aggregate stats if analysis is complete
    if (group.analysisResult) {
      const stats = group.analysisResult.aggregateStats;
      const speciesNames = Object.keys(stats.speciesDistribution).join(" ").toLowerCase();
      if (speciesNames.includes(q)) return true;
      if (stats.diseaseDetected && "disease".includes(q)) return true;
    }
    
    // Search by status
    if (group.status.toLowerCase().includes(q)) return true;
    
    return false;
  });

  const earningsData = analytics?.weeklyTrend ?? [];
  const speciesData = analytics?.speciesBreakdown ?? [];
  const pieData = speciesData.map((s, i) => ({
    ...s,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const summaryStats = analytics
    ? [
        {
          label: "Monthly Earnings",
          value: `₹${analytics.totalEarnings.toLocaleString("en-IN")}`,
          trend: "+12.5%",
          icon: DollarSign,
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
        },
        {
          label: "Total Catch",
          value: `${((analytics.avgWeight / 1000) * analytics.totalCatches).toFixed(0)} kg`,
          trend: "+5.2%",
          icon: Scale,
          color: "text-blue-500",
          bg: "bg-blue-500/10",
        },
        {
          label: "Top Species",
          value: analytics.topSpecies.split(" ").slice(0, 2).join(" "),
          trend: "Trending",
          icon: Fish,
          color: "text-amber-500",
          bg: "bg-amber-500/10",
        },
        {
          label: "Total Catches",
          value: `${analytics.totalCatches}`,
          trend: "+2.1%",
          icon: Anchor,
          color: "text-purple-500",
          bg: "bg-purple-500/10",
        },
      ]
    : [];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Analytics & History
          </h1>
          <p className="text-muted-foreground">
            Detailed insights into your fishing performance and market activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-border bg-card/50"
          >
            <Calendar className="mr-2 w-4 h-4" />
            Last 30 Days
          </Button>
          <Button className="rounded-xl bg-primary font-bold shadow-lg shadow-primary/20">
            <Download className="mr-2 w-4 h-4" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoadingAnalytics
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : summaryStats.map((stat, i) => (
              <Card
                key={i}
                className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden"
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`${stat.bg} p-3 rounded-2xl ${stat.color}`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500/10 text-emerald-500 border-none"
                    >
                      {stat.trend}
                      <ArrowUpRight className="ml-1 w-3 h-3" />
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Earnings Chart */}
        {isLoadingAnalytics ? (
          <ChartSkeleton className="lg:col-span-8" />
        ) : (
          <Card className="lg:col-span-8 rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm p-8">
            <CardHeader className="p-0 mb-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">
                  Earnings Overview
                </CardTitle>
                <CardDescription>
                  {activeChartTab === "revenue"
                    ? "Daily revenue for the current week"
                    : "Daily catch weight (kg)"}
                </CardDescription>
              </div>
              <Tabs
                defaultValue="revenue"
                onValueChange={setActiveChartTab}
                className="w-[200px]"
              >
                <TabsList className="grid w-full grid-cols-2 bg-muted/30 rounded-xl">
                  <TabsTrigger
                    value="revenue"
                    className="rounded-lg text-xs font-bold"
                  >
                    Revenue
                  </TabsTrigger>
                  <TabsTrigger
                    value="catch"
                    className="rounded-lg text-xs font-bold"
                  >
                    Catch (kg)
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <div className="h-[300px] sm:h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={earningsData}>
                  <defs>
                    <linearGradient id="colorMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fontWeight: 500 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "12px",
                    }}
                    itemStyle={{ color: "#f8fafc", fontWeight: "bold" }}
                  />
                  <Area
                    type="monotone"
                    dataKey={
                      activeChartTab === "revenue" ? "earnings" : "catches"
                    }
                    stroke="#3b82f6"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorMain)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Species Distribution */}
        {isLoadingAnalytics ? (
          <ChartSkeleton className="lg:col-span-4" />
        ) : (
          <Card className="lg:col-span-4 rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm p-8 flex flex-col">
            <CardHeader className="p-0 mb-8">
              <CardTitle className="text-xl font-bold">
                Catch Distribution
              </CardTitle>
              <CardDescription>Species breakdown by volume</CardDescription>
            </CardHeader>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="h-[220px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={8}
                      dataKey="count"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "12px",
                      }}
                      itemStyle={{ color: "#f8fafc", fontWeight: "bold" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold">
                    {pieData[0]?.percentage ?? 0}%
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Top Species
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full mt-6">
                {pieData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-bold text-muted-foreground truncate tracking-tight">
                      {item.name}
                    </span>
                    <span className="text-xs font-bold ml-auto">
                      {item.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Group History Table */}
      <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="p-6 sm:p-8 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold">Analysis History</CardTitle>
              <CardDescription>
                Review your group analysis results
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by species or status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 w-full sm:w-64 bg-muted/30 border-none rounded-xl"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl border-border shrink-0"
              >
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingGroups ? (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">
                Loading analysis history...
              </span>
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-[750px]">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="pl-8 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                        Group
                      </TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
                        Fish Count
                      </TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
                        Species
                      </TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
                        Disease
                      </TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
                        Date
                      </TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-widest text-muted-foreground text-center">
                        Status
                      </TableHead>
                      <TableHead className="pr-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-12 text-muted-foreground"
                        >
                          {searchQuery
                            ? "No matches found."
                            : "No analysis history yet. Upload your first group!"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGroups.map((group) => {
                        const stats = group.analysisResult?.aggregateStats;
                        const fishCount = stats?.totalFishCount ?? 0;
                        const speciesCount = stats ? Object.keys(stats.speciesDistribution).length : 0;
                        const topSpecies = stats ? Object.keys(stats.speciesDistribution)[0] : "—";
                        const hasDisease = stats?.diseaseDetected ?? false;
                        
                        return (
                          <TableRow
                            key={group.groupId}
                            className="border-border/50 hover:bg-muted/10 group transition-colors cursor-pointer"
                            onClick={() => window.location.href = `/groups/${group.groupId}`}
                          >
                            <TableCell className="pl-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                  <Fish className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-bold text-base">
                                    {group.imageCount} {group.imageCount === 1 ? "Image" : "Images"}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    Group ID: {group.groupId.slice(0, 8)}...
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-bold text-foreground/80">
                              {fishCount} fish
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-sm">{topSpecies}</span>
                                {speciesCount > 1 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    +{speciesCount - 1} more
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full border-none px-3 py-1 text-[10px] font-bold uppercase",
                                  hasDisease
                                    ? "bg-amber-500/10 text-amber-500"
                                    : "bg-emerald-500/10 text-emerald-500",
                                )}
                              >
                                {hasDisease ? "Detected" : "Healthy"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-medium">
                              {new Date(group.createdAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "rounded-lg border-none px-2 py-0.5 text-[10px] font-bold uppercase",
                                  group.status === "completed"
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : group.status === "processing"
                                      ? "bg-blue-500/10 text-blue-500"
                                      : group.status === "partial"
                                        ? "bg-amber-500/10 text-amber-500"
                                        : group.status === "failed"
                                          ? "bg-red-500/10 text-red-500"
                                          : "bg-gray-500/10 text-gray-500",
                                )}
                              >
                                {group.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="pr-8 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl opacity-0 lg:group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
        <CardHeader className="p-6 sm:p-8 border-t border-border/50 bg-muted/10">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-sm text-muted-foreground font-medium">
              Showing {filteredGroups.length} of {groups.length} groups
            </span>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                className="flex-1 sm:flex-none rounded-xl h-10 border-border text-xs font-bold"
                disabled
              >
                Previous
              </Button>
              <Button
                variant="outline"
                className="flex-1 sm:flex-none rounded-xl h-10 border-border text-xs font-bold"
              >
                Next Page
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

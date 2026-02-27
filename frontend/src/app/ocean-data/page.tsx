"use client"

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Waves, Thermometer, Fish, Filter, Info, ChevronRight,
  TrendingUp, Calendar, Droplets, Maximize2, Navigation,
  Crosshair, Satellite, Loader2, MapPin
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMapData } from "@/lib/api-client";
import type { MapMarker } from "@/lib/api-client";
import { FISH_SPECIES } from "@/lib/constants";
import 'leaflet/dist/leaflet.css';

// ── Dynamic imports for Leaflet components (avoids SSR issues) ────────────────
// NOTE: useMapEvents is a React hook and CANNOT be dynamically imported.
// It must be used inside a component that is itself loaded client-side.
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(m => m.Circle), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });
const ScaleControl = dynamic(() => import('react-leaflet').then(m => m.ScaleControl), { ssr: false });
const ZoomControl = dynamic(() => import('react-leaflet').then(m => m.ZoomControl), { ssr: false });

// ── MapEvents component (must be a fully client-side module, not dynamic hook) ─
// We use a lazy-loaded wrapper instead of dynamically importing the hook.
const MapEventsWrapper = dynamic(
  () => import('@/components/map/MapEventsWrapper'),
  { ssr: false }
);

// ── Static ocean zone data ─────────────────────────────────────────────────────
const ZONES = [
  { id: 1, name: "Konkan North", lat: 18.52, lng: 72.5, species: "Pomfret", density: "High", temp: "28°C", status: "Optimal", radius: 55000 },
  { id: 2, name: "Ratnagiri Basin", lat: 17.0, lng: 73.0, species: "Kingfish", density: "Medium", temp: "27.5°C", status: "Stable", radius: 45000 },
  { id: 3, name: "Goa Offshore", lat: 15.4, lng: 73.4, species: "Mackerel", density: "Very High", temp: "29°C", status: "Optimal", radius: 60000 },
  { id: 4, name: "Malabar Coast", lat: 11.2, lng: 75.5, species: "Tuna", density: "Low", temp: "30.1°C", status: "Monitoring", radius: 40000 },
];

const MAP_URLS = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};

export default function OceanDataPage() {
  const [activeLayer, setActiveLayer] = useState('distribution');
  const [timeRange, setTimeRange] = useState([50]);
  const [mapType, setMapType] = useState<keyof typeof MAP_URLS>('dark');
  const [mousePos, setMousePos] = useState({ lat: 16.0, lng: 72.0 });
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch dynamic user markers from backend ─────────────────────────────────
  useEffect(() => {
    const fetchMarkers = async () => {
      setIsLoading(true);
      try {
        const { markers: data } = await getMapData({
          species: selectedSpecies !== "all" ? selectedSpecies : undefined,
        });
        setMarkers(data);
      } catch (err) {
        console.error("Failed to load map data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMarkers();
  }, [selectedSpecies]);

  const getMarkerColor = (grade?: string) => {
    if (grade === "Premium") return "#10b981";
    if (grade === "Standard") return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ocean Intelligence Map</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Real-time visualization of sea conditions and your catch distribution.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl border-border bg-card/50 text-xs sm:text-sm">
            <Calendar className="mr-2 w-4 h-4" />
            Seasonal Forecast
          </Button>
          <Button className="rounded-xl bg-primary font-bold shadow-lg shadow-primary/20 text-xs sm:text-sm">
            Export Data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 h-auto lg:h-[calc(100vh-280px)] min-h-[500px] lg:min-h-[600px]">
        {/* Sidebar Controls */}
        <div className="lg:col-span-3 space-y-6 flex flex-col h-full order-2 lg:order-1">
          <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm p-4 sm:p-6 space-y-6">
            {/* Map Layers */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Map Layers</h3>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                {[
                  { id: 'distribution', label: 'Distribution', icon: Fish },
                  { id: 'temp', label: 'Temperature', icon: Thermometer },
                  { id: 'currents', label: 'Currents', icon: Waves },
                  { id: 'salinity', label: 'Salinity', icon: Droplets },
                ].map((layer) => (
                  <Button
                    key={layer.id}
                    variant={activeLayer === layer.id ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-2 sm:gap-3 rounded-xl h-10 sm:h-12 transition-all text-xs sm:text-sm",
                      activeLayer === layer.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground"
                    )}
                    onClick={() => setActiveLayer(layer.id)}
                  >
                    <layer.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="font-semibold">{layer.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Species Filter */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Filter Catches</h3>
              <Select value={selectedSpecies} onValueChange={setSelectedSpecies}>
                <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-none text-xs font-semibold">
                  <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Species" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Species</SelectItem>
                  {FISH_SPECIES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Horizon */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Time Horizon</h3>
                <span className="text-xs font-bold text-primary">Now</span>
              </div>
              <Slider value={timeRange} onValueChange={setTimeRange} max={100} step={1} className="py-2 sm:py-4" />
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                <span>Past 24h</span>
                <span>Forecast 48h</span>
              </div>
            </div>
          </Card>

          {/* Live Zone Insights */}
          <Card className="rounded-3xl border-none bg-primary/5 flex-1 overflow-hidden flex flex-col min-h-[300px]">
            <CardHeader className="p-4 sm:p-6 pb-2">
              <CardTitle className="text-base sm:text-lg font-bold">Live Zone Insights</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-3 sm:space-y-4">
                {/* User catch markers summary */}
                {isLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading your catch data...
                  </div>
                ) : markers.length > 0 && (
                  <div className="p-3 sm:p-4 rounded-2xl bg-card border border-border/50 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-primary">Your Catches</h4>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{markers.length} recorded locations</p>
                      </div>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-none text-[10px] h-5">Active</Badge>
                    </div>
                    <div className="flex justify-between text-[10px] sm:text-xs font-medium">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-500" />
                        {[...new Set(markers.map(m => m.species).filter(Boolean))].slice(0, 3).join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                {ZONES.map((zone) => (
                  <div key={zone.id} className="p-3 sm:p-4 rounded-2xl bg-card border border-border/50 space-y-2 sm:space-y-3 hover:border-primary/30 transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm sm:text-base font-bold group-hover:text-primary transition-colors">{zone.name}</h4>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{zone.lat}°N, {zone.lng}°E</p>
                      </div>
                      <Badge variant="outline" className={cn(
                        "rounded-full border-none text-[10px] h-5",
                        zone.status === 'Optimal' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                      )}>{zone.status}</Badge>
                    </div>
                    <div className="flex justify-between text-[10px] sm:text-xs font-medium">
                      <span className="flex items-center gap-1"><Fish className="w-3 h-3 text-primary" /> {zone.species}</span>
                      <span className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-red-500" /> {zone.temp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Map Container */}
        <div className="lg:col-span-9 relative rounded-3xl overflow-hidden border border-border/50 bg-muted/20 shadow-2xl h-[400px] sm:h-[500px] lg:h-full order-1 lg:order-2">
          <MapContainer
            center={[16.0, 72.0]}
            zoom={6}
            zoomControl={false}
            className="w-full h-full z-10"
            style={{ background: '#0f172a' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url={MAP_URLS[mapType]}
            />
            <ZoomControl position="bottomright" />
            <ScaleControl position="bottomright" />
            <MapEventsWrapper onMouseMove={setMousePos} />

            {/* Static ocean zone circles */}
            {ZONES.map((zone) => (
              <Circle
                key={zone.id}
                center={[zone.lat, zone.lng]}
                radius={zone.radius}
                pathOptions={{
                  fillColor: zone.status === 'Optimal' ? '#10b981' : '#f59e0b',
                  fillOpacity: 0.15,
                  color: zone.status === 'Optimal' ? '#10b981' : '#f59e0b',
                  weight: 1,
                  opacity: 0.4,
                }}
              >
                <Popup className="rounded-xl overflow-hidden">
                  <div className="p-2 space-y-2 min-w-[180px]">
                    <h3 className="font-bold text-base">{zone.name}</h3>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p><strong className="text-foreground">Primary Species:</strong> {zone.species}</p>
                      <p><strong className="text-foreground">Density:</strong> {zone.density}</p>
                      <p><strong className="text-foreground">Sea Temp:</strong> {zone.temp}</p>
                      <p><strong className="text-foreground">Status:</strong> {zone.status}</p>
                    </div>
                    <Button size="sm" className="w-full mt-2 h-8 rounded-lg text-[11px] font-bold">View Details</Button>
                  </div>
                </Popup>
              </Circle>
            ))}

            {/* Dynamic user catch markers */}
            {markers.map((marker) => (
              <Circle
                key={marker.imageId}
                center={[marker.latitude, marker.longitude]}
                radius={8000}
                pathOptions={{
                  fillColor: getMarkerColor(marker.qualityGrade),
                  fillOpacity: 0.8,
                  color: getMarkerColor(marker.qualityGrade),
                  weight: 2,
                  opacity: 1,
                }}
              >
                <Popup>
                  <div className="p-2 space-y-1.5 min-w-[160px]">
                    <p className="font-bold text-sm">{marker.species ?? "Unknown Species"}</p>
                    <p className="text-xs text-muted-foreground">Grade: <strong>{marker.qualityGrade ?? "—"}</strong></p>
                    {marker.weight_g && (
                      <p className="text-xs text-muted-foreground">Weight: <strong>{(marker.weight_g / 1000).toFixed(2)} kg</strong></p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{new Date(marker.createdAt).toLocaleDateString()}</p>
                  </div>
                </Popup>
              </Circle>
            ))}
          </MapContainer>

          {/* Floating UI: Recommendation Card */}
          <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-20 space-y-3 sm:space-y-4 pointer-events-none max-w-[200px] sm:max-w-none">
            <Card className="hidden sm:block p-4 rounded-2xl bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl pointer-events-auto w-64">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-500">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm">Recommended Zone</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                High skipjack tuna migration in <strong>Malabar Basin</strong>. Conditions optimal for next 6 hours.
              </p>
              <Button size="sm" className="w-full rounded-xl bg-primary font-bold h-9">
                Get Coordinates
                <ChevronRight className="ml-1 w-3 h-3" />
              </Button>
            </Card>

            {/* Map Type Switcher */}
            <div className="flex flex-col gap-2 pointer-events-auto items-end">
              <div className="flex bg-card/80 backdrop-blur-xl border border-border/50 rounded-xl overflow-hidden shadow-xl mb-2">
                {(["dark", "satellite", "light"] as const).map((type, i) => (
                  <Button
                    key={type}
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "h-8 sm:h-10 px-2 sm:px-3 rounded-none gap-2",
                      i > 0 && "border-l border-border/50",
                      mapType === type && "bg-primary/20 text-primary"
                    )}
                    onClick={() => setMapType(type)}
                  >
                    {type === 'satellite' ? (
                      <Satellite className="w-3 h-3" />
                    ) : (
                      <div className={cn("w-3 h-3 rounded-full border", type === 'dark' ? "bg-slate-900 border-white/20" : "bg-slate-100 border-black/20")} />
                    )}
                    <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider capitalize">{type}</span>
                  </Button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {[Maximize2, Navigation, Crosshair].map((Icon, i) => (
                  <Button
                    key={i}
                    size="icon"
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-card/80 backdrop-blur-xl border border-border/50 text-foreground hover:bg-muted shadow-xl"
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Coordinate Tracker */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-white flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span>{mousePos.lat.toFixed(4)}°N, {mousePos.lng.toFixed(4)}°E</span>
            </div>
          </div>

          {/* Legend Bar */}
          <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 z-20 pointer-events-auto">
            <Card className="flex items-center gap-4 sm:gap-6 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl">
              <div className="flex flex-col gap-1">
                <span className="text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Catch Quality</span>
                <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-bold">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Premium</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Standard</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Low</span>
                </div>
              </div>
              <div className="hidden sm:block h-8 w-[1px] bg-border" />
              <div className="hidden sm:flex gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Your Catches</span>
                  <span className="text-sm font-bold flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {markers.length} Mapped
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/30 backdrop-blur-sm rounded-3xl">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm font-medium text-muted-foreground">Loading catch data...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

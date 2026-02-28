"use client"

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Waves, Thermometer, Fish, Filter, ChevronRight,
  TrendingUp, Calendar, Droplets, Maximize2, Navigation,
  Crosshair, Loader2, MapPin, Wind, X, AlertTriangle,
  Anchor, ArrowUpRight, ArrowDownRight, Minus, Heart,
  Sun, Moon, CloudRain, Clock, Compass
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMapData } from "@/lib/api-client";
import type { MapMarker } from "@/lib/api-client";
import { FISH_SPECIES } from "@/lib/constants";
import { useLanguage } from "@/lib/i18n";
import {
  fetchLiveAlerts,
  getActiveAlerts,
  computeSafetyStatus,
  getSeverityColor,
} from "@/lib/alerts";
import type { DisasterAlert } from "@/lib/alerts";
import { OCEAN_CATCH_DATA, ZONE_INSIGHTS } from "@/lib/ocean-mock-data";
import type { OceanCatchPoint } from "@/lib/ocean-mock-data";
import 'leaflet/dist/leaflet.css';

// ── Dynamic imports ───────────────────────────────────────────────────────────
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(m => m.Circle), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });
const ScaleControl = dynamic(() => import('react-leaflet').then(m => m.ScaleControl), { ssr: false });
const ZoomControl = dynamic(() => import('react-leaflet').then(m => m.ZoomControl), { ssr: false });
const MapEventsWrapper = dynamic(() => import('@/components/map/MapEventsWrapper'), { ssr: false });
const UserLocationMarker = dynamic(() => import('@/components/map/UserLocationMarker'), { ssr: false });
const SearchThisArea = dynamic(() => import('@/components/map/SearchThisArea'), { ssr: false });
const DisasterAlertBanner = dynamic(() => import('@/components/map/DisasterAlertBanner'), { ssr: false });

// ── Map Config ────────────────────────────────────────────────────────────────
const MAP_URL = "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}";

// India bounds — restrict panning to Indian subcontinent + surrounding ocean
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [4.0, 64.0],   // SW corner
  [38.0, 100.0],  // NE corner
];
const INDIA_CENTER: [number, number] = [16.0, 76.0];

const OPENWEATHER_LAYER_BY_ACTIVE_LAYER: Record<string, string | null> = {
  distribution: null,
  temp: "temp_new",
  currents: "wind_new",
  salinity: "pressure_new",
};

// ── Weather Scale Configs ─────────────────────────────────────────────────────
const WEATHER_SCALES: Record<string, { label: string; unit: string; stops: { color: string; value: string }[] } | null> = {
  distribution: null,
  temp: {
    label: "Temperature", unit: "°C",
    stops: [
      { color: "#821692", value: "-40" }, { color: "#0000ff", value: "-20" },
      { color: "#00d4ff", value: "0" }, { color: "#00ff00", value: "10" },
      { color: "#ffff00", value: "20" }, { color: "#ff8c00", value: "30" },
      { color: "#ff0000", value: "40" },
    ],
  },
  currents: {
    label: "Wind Speed", unit: "m/s",
    stops: [
      { color: "#ffffff", value: "0" }, { color: "#aef1f9", value: "5" },
      { color: "#4dc9f6", value: "10" }, { color: "#1a9edb", value: "15" },
      { color: "#ff8c00", value: "25" }, { color: "#ff0000", value: "35" },
      { color: "#8b0000", value: "50" },
    ],
  },
  salinity: {
    label: "Pressure", unit: "hPa",
    stops: [
      { color: "#0000ff", value: "950" }, { color: "#00bfff", value: "980" },
      { color: "#00ff00", value: "1000" }, { color: "#ffff00", value: "1013" },
      { color: "#ff8c00", value: "1030" }, { color: "#ff0000", value: "1050" },
      { color: "#8b0000", value: "1080" },
    ],
  },
};

interface ClickedWeather {
  lat: number; lng: number;
  temp?: number; feelsLike?: number; wind?: number; windDeg?: number;
  humidity?: number; description?: string; icon?: string; loading: boolean;
}

/* ── Per-marker weather popup ─────────────────────────────────────────────── */
function CatchWeatherPopup({ marker }: { marker: MapMarker }) {
  const [weather, setWeather] = useState<any>(null);
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;

  useEffect(() => {
    if (!apiKey) return;
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${marker.latitude}&lon=${marker.longitude}&appid=${apiKey}&units=metric`)
      .then(r => r.json()).then(setWeather).catch(console.error);
  }, [marker, apiKey]);

  return (
    <div className="p-2 space-y-2 min-w-[200px]">
      <h3 className="font-bold text-base text-primary mr-2">{marker.species ?? "Unknown Species"}</h3>
      <div className="flex gap-2 text-xs">
        <Badge variant="outline" className="border-none bg-primary/10 text-primary">{marker.qualityGrade ?? "Standard"}</Badge>
        {marker.weight_g && <Badge variant="outline" className="border-none bg-muted">{`${(marker.weight_g / 1000).toFixed(2)} kg`}</Badge>}
      </div>
      {weather?.main ? (
        <div className="pt-2 mt-2 border-t border-border/50 space-y-1 text-[11px] text-muted-foreground">
          <div className="flex justify-between"><span>Conditions:</span><span className="text-foreground capitalize">{weather.weather[0]?.description}</span></div>
          <div className="flex justify-between"><span>Temp:</span><span className="text-foreground font-semibold">{weather.main.temp}°C</span></div>
          <div className="flex justify-between"><span>Wind:</span><span className="text-foreground">{weather.wind.speed} m/s</span></div>
        </div>
      ) : (
        <div className="pt-2 text-[10px] text-muted-foreground italic">{apiKey ? "Loading weather..." : "Weather API key missing"}</div>
      )}
      <p className="text-[9px] text-muted-foreground pt-2 text-right">{new Date(marker.createdAt).toLocaleDateString()}</p>
    </div>
  );
}

/* ── Ocean catch popup (hides user details) ───────────────────────────────── */
function OceanCatchPopup({ pt }: { pt: OceanCatchPoint }) {
  const ageH = Math.round((Date.now() - new Date(pt.timestamp).getTime()) / 3600000);
  return (
    <div className="p-2.5 space-y-2 min-w-[220px]">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Fish className="w-3.5 h-3.5" /> {pt.species}
        </h3>
        <Badge variant="outline" className={cn(
          "border-none text-[10px] h-5",
          pt.qualityGrade === "Premium" ? "bg-emerald-500/15 text-emerald-400"
            : pt.qualityGrade === "Standard" ? "bg-amber-500/15 text-amber-400"
              : "bg-red-500/15 text-red-400"
        )}>{pt.qualityGrade}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="flex items-center gap-1"><Anchor className="w-3 h-3 text-blue-400" /><span className="text-muted-foreground">Weight:</span><span className="font-bold">{pt.weight_kg} kg</span></div>
        <div className="flex items-center gap-1"><Droplets className="w-3 h-3 text-cyan-400" /><span className="text-muted-foreground">Depth:</span><span className="font-bold">{pt.depth_m}m</span></div>
        <div className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-red-400" /><span className="text-muted-foreground">Water:</span><span className="font-bold">{pt.waterTemp}°C</span></div>
        <div className="flex items-center gap-1"><Heart className="w-3 h-3 text-emerald-400" /><span className="text-muted-foreground">Fresh:</span><span className="font-bold">{pt.freshness}</span></div>
      </div>
      <div className="pt-1.5 border-t border-border/50 flex justify-between text-[10px] text-muted-foreground">
        <span>{pt.catchMethod}</span>
        <span>{ageH}h ago</span>
      </div>
    </div>
  );
}

/* ── Weather scale legend ─────────────────────────────────────────────────── */
function WeatherScaleLegend({ scale }: { scale: { label: string; unit: string; stops: { color: string; value: string }[] } }) {
  const gradient = scale.stops.map(s => s.color).join(", ");
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest">{scale.label} ({scale.unit})</span>
      <div className="h-3 w-full rounded-full" style={{ background: `linear-gradient(to right, ${gradient})` }} />
      <div className="flex justify-between text-[8px] font-bold text-white/60">
        {scale.stops.map((s, i) => <span key={i}>{s.value}</span>)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════════ */
export default function OceanDataPage() {
  const { t } = useLanguage();
  const [activeLayer, setActiveLayer] = useState('distribution');
  const [mousePos, setMousePos] = useState({ lat: 16.0, lng: 72.0 });
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [clickedWeather, setClickedWeather] = useState<ClickedWeather | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const openWeatherApiKey = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY || "";

  // ── Alerts (live from OpenWeatherMap) ────────────────────────────────────────
  const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const activeAlerts = useMemo(() => getActiveAlerts(alerts), [alerts]);
  const safetyStatus = useMemo(() => {
    if (!userLocation) return null;
    return computeSafetyStatus(userLocation.lat, userLocation.lng, activeAlerts);
  }, [userLocation, activeAlerts]);

  // Fetch live alerts on mount
  useEffect(() => {
    if (!openWeatherApiKey) { setAlertsLoading(false); return; }
    fetchLiveAlerts(openWeatherApiKey)
      .then(setAlerts)
      .catch(console.error)
      .finally(() => setAlertsLoading(false));
    const interval = setInterval(() => {
      fetchLiveAlerts(openWeatherApiKey).then(setAlerts).catch(console.error);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [openWeatherApiKey]);

  // ── Map bounds ──────────────────────────────────────────────────────────────
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);

  const validMarkers = useMemo(
    () => markers.filter(m => Number.isFinite(m.latitude) && Number.isFinite(m.longitude)),
    [markers]
  );

  const visibleMarkers = useMemo(() => {
    if (!mapBounds) return validMarkers;
    return validMarkers.filter(m =>
      m.latitude >= mapBounds.south && m.latitude <= mapBounds.north &&
      m.longitude >= mapBounds.west && m.longitude <= mapBounds.east
    );
  }, [validMarkers, mapBounds]);



  const openWeatherLayer = useMemo(() => {
    const layer = OPENWEATHER_LAYER_BY_ACTIVE_LAYER[activeLayer];
    if (!layer || !openWeatherApiKey) return null;
    return `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${openWeatherApiKey}`;
  }, [activeLayer, openWeatherApiKey]);

  const currentScale = useMemo(() => WEATHER_SCALES[activeLayer], [activeLayer]);

  const handleMapReady = useCallback((map: any) => { mapInstanceRef.current = map; }, []);

  const handleFullscreen = useCallback(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
    }
  }, []);

  const handleLocateUser = useCallback(() => {
    if (!mapInstanceRef.current) return;
    if (userLocation) {
      mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 10, { duration: 1.5 });
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => mapInstanceRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 10, { duration: 1.5 }),
        () => { }
      );
    }
  }, [userLocation]);

  const handleResetView = useCallback(() => {
    if (!mapInstanceRef.current) return;
    if (userLocation) {
      mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 9, { duration: 1.2 });
    } else {
      mapInstanceRef.current.flyTo(INDIA_CENTER, 5, { duration: 1.2 });
    }
  }, [userLocation]);

  const mouseMoveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMouseMove = useCallback((pos: { lat: number; lng: number }) => {
    if (mouseMoveTimer.current) clearTimeout(mouseMoveTimer.current);
    mouseMoveTimer.current = setTimeout(() => setMousePos(pos), 50);
  }, []);

  const handleMapClick = useCallback(async (pos: { lat: number; lng: number }) => {
    if (!openWeatherApiKey) return;
    setClickedWeather({ lat: pos.lat, lng: pos.lng, loading: true });
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${pos.lat}&lon=${pos.lng}&appid=${openWeatherApiKey}&units=metric`);
      const data = await res.json();
      setClickedWeather({
        lat: pos.lat, lng: pos.lng,
        temp: data.main?.temp, feelsLike: data.main?.feels_like,
        wind: data.wind?.speed, windDeg: data.wind?.deg,
        humidity: data.main?.humidity,
        description: data.weather?.[0]?.description,
        icon: data.weather?.[0]?.icon, loading: false,
      });
    } catch { setClickedWeather(null); }
  }, [openWeatherApiKey]);

  const handleMoveEnd = useCallback((bounds: { north: number; south: number; east: number; west: number }) => {
    setMapBounds(bounds);
  }, []);

  const handleLocationFound = useCallback((lat: number, lng: number) => {
    setUserLocation({ lat, lng });
  }, []);

  useEffect(() => {
    const fetchMarkers = async () => {
      setIsLoading(true);
      try {
        const { markers: data } = await getMapData({ species: selectedSpecies !== "all" ? selectedSpecies : undefined });
        setMarkers(data);
      } catch (err) { console.error("Failed to load map data:", err); }
      finally { setIsLoading(false); }
    };
    fetchMarkers();
  }, [selectedSpecies]);

  const getMarkerColor = (grade?: string) => {
    if (grade === "Premium") return "#10b981";
    if (grade === "Standard") return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-10">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">{t('ocean.title')}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{t('ocean.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl border-border bg-card/50 text-xs h-9">
            <Calendar className="mr-1.5 w-3.5 h-3.5" />Forecast
          </Button>
          <Button className="rounded-xl bg-primary font-bold shadow-lg shadow-primary/20 text-xs h-9">Export</Button>
        </div>
      </div>

      {/* ── Alert Banner (map page) ───────────────────────────────────── */}
      {showAlerts && activeAlerts.length > 0 && (
        <DisasterAlertBanner alerts={activeAlerts} safetyStatus={safetyStatus} />
      )}

      {/* ── Main Grid ────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 sm:gap-6 lg:h-[calc(100vh-260px)] lg:min-h-[550px]">

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-4 order-2 lg:order-1 lg:overflow-y-auto lg:max-h-full">
          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm p-3 sm:p-4 space-y-4">
            {/* Layers */}
            <div className="space-y-2.5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Map Layers</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
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
                      "w-full justify-start gap-2 rounded-xl h-9 transition-all text-xs",
                      activeLayer === layer.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground"
                    )}
                    onClick={() => setActiveLayer(layer.id)}
                  >
                    <layer.icon className="w-4 h-4" />
                    <span className="font-semibold truncate">{layer.label}</span>
                  </Button>
                ))}
                <Button
                  variant={showAlerts ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2 rounded-xl h-9 transition-all text-xs",
                    showAlerts ? "bg-red-500/10 text-red-400 border border-red-500/20" : "text-muted-foreground"
                  )}
                  onClick={() => setShowAlerts(!showAlerts)}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-semibold">Alerts</span>
                  {activeAlerts.length > 0 && (
                    <span className={cn("ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                      showAlerts ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"
                    )}>{activeAlerts.length}</span>
                  )}
                </Button>
              </div>
            </div>

            {/* Species Filter */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Filter Catches</h3>
              <Select value={selectedSpecies} onValueChange={setSelectedSpecies}>
                <SelectTrigger className="h-9 rounded-xl bg-muted/30 border-none text-xs font-semibold">
                  <Filter className="w-3 h-3 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="All Species" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Species</SelectItem>
                  {FISH_SPECIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>


          </Card>

          {/* ── Fisherman Tools ─────────────────────────────────────── */}
          <Card className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm p-3 sm:p-4 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" /> Fisherman Tools
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-amber-500/8 border border-amber-500/15 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400">Sunrise</span>
                </div>
                <p className="text-xs font-bold text-foreground">06:32 AM</p>
                <p className="text-[9px] text-muted-foreground">Sunset 06:18 PM</p>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-500/8 border border-indigo-500/15 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[10px] font-bold text-indigo-400">Moon</span>
                </div>
                <p className="text-xs font-bold text-foreground">Waxing Crescent</p>
                <p className="text-[9px] text-muted-foreground">32% illuminated</p>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-500/8 border border-cyan-500/15 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Waves className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[10px] font-bold text-cyan-400">Tide</span>
                </div>
                <p className="text-xs font-bold text-foreground">High → 2.1m</p>
                <p className="text-[9px] text-muted-foreground">Next low: 3:45 PM</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400">Best Time</span>
                </div>
                <p className="text-xs font-bold text-foreground">5:30 – 8:00 AM</p>
                <p className="text-[9px] text-muted-foreground">High activity window</p>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/8 border border-blue-500/15 flex items-center gap-2.5">
              <CloudRain className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-foreground">Sea State: Moderate</p>
                <p className="text-[9px] text-muted-foreground">Wave height 1.2m • Wind NW 15 km/h • Visibility 8 km</p>
              </div>
            </div>
          </Card>

          {/* ── Live Zone Insights ───────────────────────────────────── */}
          <Card className="rounded-2xl border-none bg-primary/5 flex-1 overflow-hidden flex flex-col min-h-0 lg:min-h-[280px]">
            <CardHeader className="p-3 sm:p-4 pb-1">
              <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                <Anchor className="w-4 h-4 text-primary" />
                Live Zone Insights
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 px-3 sm:px-4 pb-3 sm:pb-4">
              <div className="space-y-2.5">
                {ZONE_INSIGHTS.map((zone, i) => (
                  <div key={i} className="p-3 rounded-xl bg-card border border-border/50 space-y-2 hover:border-primary/20 transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-foreground truncate">{zone.zone}</h4>
                        <p className="text-[9px] text-muted-foreground font-mono">{zone.region}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className={cn(
                          "border-none text-[9px] h-4 px-1.5",
                          zone.healthStatus === "Healthy" ? "bg-emerald-500/15 text-emerald-400"
                            : zone.healthStatus === "Moderate" ? "bg-amber-500/15 text-amber-400"
                              : "bg-red-500/15 text-red-400"
                        )}>{zone.healthStatus}</Badge>
                        {zone.trend === "up" ? <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                          : zone.trend === "down" ? <ArrowDownRight className="w-3 h-3 text-red-500" />
                            : <Minus className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {zone.topSpecies.map(sp => (
                        <span key={sp} className="px-1.5 py-0.5 rounded-md bg-primary/8 text-primary text-[9px] font-semibold">{sp}</span>
                      ))}
                    </div>
                    <div className="flex gap-3 text-[9px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Thermometer className="w-2.5 h-2.5" />{zone.avgTemp}°C</span>
                      <span className="flex items-center gap-0.5"><Fish className="w-2.5 h-2.5" />{zone.catchCount} catches</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{zone.advisory}</p>
                  </div>
                ))}

                {/* User's own catches summary */}
                {!isLoading && validMarkers.length > 0 && (
                  <div className="p-3 rounded-xl bg-primary/8 border border-primary/15 space-y-1.5">
                    <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" /> Your Catches
                    </h4>
                    <p className="text-[10px] text-muted-foreground">{validMarkers.length} recorded locations</p>
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      {[...new Set(validMarkers.map(m => m.species).filter(Boolean))].slice(0, 4).map(sp => (
                        <span key={sp} className="px-1.5 py-0.5 rounded-md bg-card text-foreground font-medium">{sp}</span>
                      ))}
                    </div>
                  </div>
                )}
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading catch data...
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* ── Map ──────────────────────────────────────────────────── */}
        <div ref={mapContainerRef} className="lg:col-span-9 xl:col-span-9 relative rounded-2xl overflow-hidden border border-border/50 bg-muted/20 shadow-2xl h-[50vh] sm:h-[55vh] lg:h-full order-1 lg:order-2 min-h-[320px]">
          <MapContainer
            center={INDIA_CENTER}
            zoom={5}
            zoomControl={false}
            maxBounds={INDIA_BOUNDS}
            maxBoundsViscosity={0.8}
            minZoom={4}
            className="w-full h-full z-10"
            style={{ background: '#0a1628' }}
          >
            <TileLayer attribution="&copy; Google Maps" url={MAP_URL} maxZoom={20} />
            <ZoomControl position="bottomright" />
            <ScaleControl position="bottomright" />
            <MapEventsWrapper onMouseMove={handleMouseMove} onClick={handleMapClick} onMapReady={handleMapReady} onMoveEnd={handleMoveEnd} />
            <UserLocationMarker onLocationFound={handleLocationFound} showRadius={true} autoCenter={false} />
            <SearchThisArea />

            {/* Disaster Alert Zones */}
            {showAlerts && activeAlerts.map(alert => (
              <Circle key={alert.id} center={[alert.lat, alert.lng]} radius={alert.radiusKm * 1000}
                pathOptions={{ fillColor: getSeverityColor(alert.severity), fillOpacity: 0.12, color: getSeverityColor(alert.severity), weight: 2, opacity: 0.6, dashArray: "6 4" }}>
                <Popup className="rounded-xl overflow-hidden shadow-xl p-0">
                  <div className="p-3 space-y-1.5 min-w-[200px]">
                    <h3 className="font-bold text-sm">{alert.title}</h3>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                    <div className="flex gap-2 text-[10px] font-bold">
                      <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: getSeverityColor(alert.severity) + "20", color: getSeverityColor(alert.severity) }}>
                        {alert.severity === "red" ? "🔴 High" : alert.severity === "orange" ? "🟠 Moderate" : "🟡 Advisory"}
                      </span>
                      <span className="text-muted-foreground">{alert.radiusKm}km</span>
                    </div>
                  </div>
                </Popup>
              </Circle>
            ))}

            {/* ── Ocean Catch Points (always show all) ────────────── */}
            {OCEAN_CATCH_DATA.map(pt => (
              <Circle key={pt.id} center={[pt.latitude, pt.longitude]} radius={20000}
                pathOptions={{
                  fillColor: getMarkerColor(pt.qualityGrade), fillOpacity: 0.7,
                  color: getMarkerColor(pt.qualityGrade), weight: 2, opacity: 1,
                }}>
                <Popup className="rounded-xl overflow-hidden shadow-xl p-0">
                  <OceanCatchPopup pt={pt} />
                </Popup>
              </Circle>
            ))}

            {/* User's own catch markers */}
            {visibleMarkers.map(marker => (
              <Circle key={marker.imageId} center={[Number(marker.latitude), Number(marker.longitude)]} radius={25000}
                pathOptions={{ fillColor: getMarkerColor(marker.qualityGrade), fillOpacity: 0.6, color: getMarkerColor(marker.qualityGrade), weight: 2, opacity: 1 }}>
                <Popup className="rounded-xl overflow-hidden shadow-xl p-0">
                  <CatchWeatherPopup marker={marker} />
                </Popup>
              </Circle>
            ))}

            {/* Clicked Weather Pin */}
            {clickedWeather && (
              <Marker position={[clickedWeather.lat, clickedWeather.lng]}>
                <Popup className="rounded-xl overflow-hidden shadow-xl p-0">
                  <div className="p-3 space-y-2 min-w-[220px]">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-primary flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />Weather at Point</h3>
                      <button onClick={() => setClickedWeather(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{clickedWeather.lat.toFixed(4)}°N, {clickedWeather.lng.toFixed(4)}°E</p>
                    {clickedWeather.loading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="w-3 h-3 animate-spin" /> Fetching weather...</div>
                    ) : (
                      <div className="space-y-1.5 pt-1 border-t border-border/50">
                        {clickedWeather.icon && (
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`https://openweathermap.org/img/wn/${clickedWeather.icon}@2x.png`} alt="" className="w-8 h-8" />
                            <span className="text-xs capitalize text-foreground font-semibold">{clickedWeather.description}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          <div className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-red-400" /><span className="text-muted-foreground">Temp:</span><span className="font-bold text-foreground">{clickedWeather.temp?.toFixed(1)}°C</span></div>
                          <div className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-orange-400" /><span className="text-muted-foreground">Feels:</span><span className="font-bold text-foreground">{clickedWeather.feelsLike?.toFixed(1)}°C</span></div>
                          <div className="flex items-center gap-1"><Wind className="w-3 h-3 text-blue-400" /><span className="text-muted-foreground">Wind:</span><span className="font-bold text-foreground">{clickedWeather.wind} m/s</span></div>
                          <div className="flex items-center gap-1"><Droplets className="w-3 h-3 text-cyan-400" /><span className="text-muted-foreground">Humidity:</span><span className="font-bold text-foreground">{clickedWeather.humidity}%</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}

            {openWeatherLayer && (
              <TileLayer key={`owm-${activeLayer}`} attribution='&copy; OpenWeatherMap' url={openWeatherLayer} opacity={0.85} />
            )}
          </MapContainer>

          {/* ── Floating UI ──────────────────────────────────────── */}
          <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-20 space-y-3 pointer-events-none max-w-[180px] sm:max-w-[240px]">
            <Card className="hidden md:block p-3 sm:p-4 rounded-2xl bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl pointer-events-auto w-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-500"><TrendingUp className="w-3.5 h-3.5" /></div>
                <h4 className="font-bold text-xs sm:text-sm">Recommended Zone</h4>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-3 leading-relaxed">
                High skipjack tuna migration in <strong>Malabar Basin</strong>. Optimal for next 6h.
              </p>
              <Button size="sm" className="w-full rounded-xl bg-primary font-bold h-8 text-xs">
                Get Coordinates <ChevronRight className="ml-1 w-3 h-3" />
              </Button>
            </Card>

            <div className="flex flex-col gap-1.5 pointer-events-auto items-end">
              <Button size="icon" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-card/80 backdrop-blur-xl border border-border/50 text-foreground hover:bg-muted shadow-xl" onClick={handleFullscreen} title="Fullscreen">
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button size="icon" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-card/80 backdrop-blur-xl border border-border/50 text-foreground hover:bg-muted shadow-xl" onClick={handleLocateUser} title="My Location">
                <Navigation className="w-4 h-4" />
              </Button>
              <Button size="icon" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-card/80 backdrop-blur-xl border border-border/50 text-foreground hover:bg-muted shadow-xl" onClick={handleResetView} title="Reset View">
                <Crosshair className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Coordinate Tracker */}
          <div className="absolute top-3 left-3 z-20 pointer-events-none">
            <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[9px] sm:text-[10px] font-mono text-white flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {mousePos.lat.toFixed(4)}°N, {mousePos.lng.toFixed(4)}°E
            </div>
          </div>

          {/* ── Legend + Weather Scale ──────────────────────────── */}
          <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 z-[1000] pointer-events-auto max-w-[380px]">
            <div className="flex flex-col gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/15 shadow-2xl">
              <div className="flex items-center gap-3 sm:gap-5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">Quality</span>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-white">
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Premium</span>
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Standard</span>
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Low</span>
                  </div>
                </div>
                <div className="hidden sm:block h-6 w-[1px] bg-white/20" />
                <div className="hidden sm:flex flex-col gap-0.5">
                  <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">Catches</span>
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {OCEAN_CATCH_DATA.length + validMarkers.length}
                  </span>
                </div>
              </div>
              {showAlerts && activeAlerts.length > 0 && (
                <div className="flex items-center gap-2 pt-1.5 border-t border-white/10">
                  <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">Alerts</span>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-white">
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />High</span>
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Mod</span>
                    <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />Adv</span>
                  </div>
                </div>
              )}
              {currentScale && (
                <div className="pt-1.5 border-t border-white/10">
                  <WeatherScaleLegend scale={currentScale} />
                </div>
              )}
            </div>
          </div>

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/30 backdrop-blur-sm rounded-2xl">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-xs font-medium text-muted-foreground">Loading...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

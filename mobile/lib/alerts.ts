/**
 * Real-time disaster alert system for mobile.
 * Same logic as web — fetches live weather from OpenWeatherMap
 * for Indian coastal monitoring stations and derives alerts.
 */

export type AlertType = "cyclone" | "storm" | "heavy_rain" | "strong_wind" | "high_wave";
export type AlertSeverity = "red" | "orange" | "yellow";

export interface DisasterAlert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    description: string;
    lat: number;
    lng: number;
    radiusKm: number;
    expiresAt: string;
    source: string;
}

interface MonitoringStation {
    id: string;
    name: string;
    region: string;
    lat: number;
    lng: number;
}

const MONITORING_STATIONS: MonitoringStation[] = [
    { id: "ms-mum", name: "Mumbai Offshore", region: "Maharashtra Coast", lat: 18.85, lng: 72.20 },
    { id: "ms-goa", name: "Goa Offshore", region: "Goa Coast", lat: 15.40, lng: 73.30 },
    { id: "ms-kch", name: "Kochi Offshore", region: "Kerala Coast", lat: 9.90, lng: 75.80 },
    { id: "ms-guj", name: "Porbandar Offshore", region: "Gujarat Coast", lat: 21.50, lng: 69.10 },
    { id: "ms-vis", name: "Visakhapatnam Offshore", region: "Andhra Coast", lat: 17.50, lng: 83.80 },
    { id: "ms-chn", name: "Chennai Offshore", region: "Tamil Nadu Coast", lat: 13.00, lng: 80.80 },
    { id: "ms-kol", name: "Kolkata Offshore", region: "West Bengal Coast", lat: 21.30, lng: 88.70 },
    { id: "ms-man", name: "Mangaluru Offshore", region: "Karnataka Coast", lat: 12.80, lng: 74.60 },
    { id: "ms-par", name: "Paradip Offshore", region: "Odisha Coast", lat: 20.20, lng: 87.10 },
    { id: "ms-kan", name: "Kanniyakumari", region: "Southern Tip", lat: 8.00, lng: 77.50 },
];

const THRESHOLDS = {
    wind: { advisory: 10, moderate: 15, high: 20 },
    rain: { advisory: 5, moderate: 10, high: 25 },
    visibility: { advisory: 5000, moderate: 2000, high: 500 },
    gust: { advisory: 15, moderate: 22, high: 30 },
};

export function getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
        case "red": return "#ef4444";
        case "orange": return "#f97316";
        case "yellow": return "#eab308";
    }
}

export function getAlertIcon(type: AlertType): string {
    switch (type) {
        case "cyclone": return "🌀";
        case "storm": return "⛈️";
        case "heavy_rain": return "🌧️";
        case "strong_wind": return "💨";
        case "high_wave": return "🌊";
    }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeSafetyStatus(userLat: number, userLng: number, alerts: DisasterAlert[]): "SAFE" | "UNSAFE" {
    for (const alert of alerts) {
        if (new Date(alert.expiresAt).getTime() < Date.now()) continue;
        if (haversineKm(userLat, userLng, alert.lat, alert.lng) <= alert.radiusKm) return "UNSAFE";
    }
    return "SAFE";
}

function deriveAlert(station: MonitoringStation, weather: any): DisasterAlert | null {
    const wind = weather.wind?.speed ?? 0;
    const gust = weather.wind?.gust ?? 0;
    const rain1h = weather.rain?.["1h"] ?? 0;
    const visibility = weather.visibility ?? 10000;
    const weatherId = weather.weather?.[0]?.id ?? 800;
    const desc = weather.weather?.[0]?.description ?? "";
    const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600000).toISOString();

    if (weatherId >= 200 && weatherId <= 232) {
        const severity: AlertSeverity = wind >= THRESHOLDS.wind.high ? "red" : wind >= THRESHOLDS.wind.moderate ? "orange" : "yellow";
        return {
            id: `live-${station.id}-storm`, type: wind >= THRESHOLDS.wind.high ? "cyclone" : "storm", severity,
            title: `${wind >= THRESHOLDS.wind.high ? "Severe Storm" : "Thunderstorm"} – ${station.region}`,
            description: `Active ${desc} near ${station.name}. Wind: ${(wind * 3.6).toFixed(0)} km/h.`,
            lat: station.lat, lng: station.lng, radiusKm: severity === "red" ? 200 : 120,
            expiresAt: hoursFromNow(6), source: "OpenWeatherMap",
        };
    }

    if (wind >= THRESHOLDS.wind.advisory || gust >= THRESHOLDS.gust.advisory) {
        const severity: AlertSeverity = wind >= THRESHOLDS.wind.high ? "red" : wind >= THRESHOLDS.wind.moderate ? "orange" : "yellow";
        return {
            id: `live-${station.id}-wind`, type: "strong_wind", severity,
            title: `Wind Warning – ${station.region}`,
            description: `Wind: ${(wind * 3.6).toFixed(0)} km/h at ${station.name}.`,
            lat: station.lat, lng: station.lng, radiusKm: severity === "red" ? 180 : 80,
            expiresAt: hoursFromNow(4), source: "OpenWeatherMap",
        };
    }

    if (rain1h >= THRESHOLDS.rain.advisory || (weatherId >= 502 && weatherId <= 531)) {
        const severity: AlertSeverity = rain1h >= THRESHOLDS.rain.high ? "red" : rain1h >= THRESHOLDS.rain.moderate ? "orange" : "yellow";
        return {
            id: `live-${station.id}-rain`, type: "heavy_rain", severity,
            title: `Heavy Rain – ${station.region}`,
            description: `${rain1h > 0 ? `${rain1h.toFixed(1)} mm/h` : "Heavy precipitation"} near ${station.name}.`,
            lat: station.lat, lng: station.lng, radiusKm: 100,
            expiresAt: hoursFromNow(3), source: "OpenWeatherMap",
        };
    }

    if (visibility <= THRESHOLDS.visibility.advisory) {
        const severity: AlertSeverity = visibility <= THRESHOLDS.visibility.high ? "red" : visibility <= THRESHOLDS.visibility.moderate ? "orange" : "yellow";
        return {
            id: `live-${station.id}-vis`, type: "high_wave", severity,
            title: `Low Visibility – ${station.region}`,
            description: `Visibility: ${(visibility / 1000).toFixed(1)} km at ${station.name}.`,
            lat: station.lat, lng: station.lng, radiusKm: 80,
            expiresAt: hoursFromNow(3), source: "OpenWeatherMap",
        };
    }
    return null;
}

let _cache: { alerts: DisasterAlert[]; at: number } | null = null;

export async function fetchLiveAlerts(apiKey: string): Promise<DisasterAlert[]> {
    if (_cache && Date.now() - _cache.at < 300000) return _cache.alerts;
    if (!apiKey) return [];
    try {
        const results = await Promise.allSettled(
            MONITORING_STATIONS.map(async (s) => {
                const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${s.lat}&lon=${s.lng}&appid=${apiKey}&units=metric`);
                if (!res.ok) return null;
                return deriveAlert(s, await res.json());
            })
        );
        const alerts = results
            .filter((r): r is PromiseFulfilledResult<DisasterAlert | null> => r.status === "fulfilled")
            .map(r => r.value).filter((a): a is DisasterAlert => a !== null);
        _cache = { alerts, at: Date.now() };
        return alerts;
    } catch { return _cache?.alerts ?? []; }
}

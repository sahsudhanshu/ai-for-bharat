/**
 * Ocean mock data for mobile — realistic dummy catches + zone insights.
 * Mirrors the web frontend's ocean-mock-data.ts.
 */

export interface OceanCatchPoint {
    id: string;
    species: string;
    qualityGrade: "Premium" | "Standard" | "Low";
    weight_kg: number;
    depth_m: number;
    waterTemp_c: number;
    freshness: string;
    catchMethod: string;
    latitude: number;
    longitude: number;
    timestamp: string;
}

export interface ZoneInsight {
    zone: string;
    region: string;
    topSpecies: string[];
    avgTemp: number;
    catchCount: number;
    healthStatus: "Healthy" | "Moderate" | "Stressed";
    trend: "up" | "down" | "stable";
    advisory: string;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

export const OCEAN_CATCH_DATA: OceanCatchPoint[] = [
    { id: "oc-1", species: "Tuna", qualityGrade: "Premium", weight_kg: 8.5, depth_m: 80, waterTemp_c: 26.5, freshness: "Excellent", catchMethod: "Long Line", latitude: 15.8, longitude: 72.0, timestamp: hoursAgo(3) },
    { id: "oc-2", species: "Pomfret", qualityGrade: "Premium", weight_kg: 1.2, depth_m: 25, waterTemp_c: 27.8, freshness: "Fresh", catchMethod: "Gill Net", latitude: 16.5, longitude: 73.1, timestamp: hoursAgo(5) },
    { id: "oc-3", species: "Mackerel", qualityGrade: "Standard", weight_kg: 0.6, depth_m: 15, waterTemp_c: 28.2, freshness: "Fresh", catchMethod: "Ring Seine", latitude: 14.2, longitude: 73.5, timestamp: hoursAgo(8) },
    { id: "oc-4", species: "Sardine", qualityGrade: "Standard", weight_kg: 0.3, depth_m: 10, waterTemp_c: 28.5, freshness: "Good", catchMethod: "Purse Seine", latitude: 12.5, longitude: 74.8, timestamp: hoursAgo(2) },
    { id: "oc-5", species: "Seer Fish", qualityGrade: "Premium", weight_kg: 4.2, depth_m: 45, waterTemp_c: 26.0, freshness: "Excellent", catchMethod: "Trolling", latitude: 17.2, longitude: 72.5, timestamp: hoursAgo(6) },
    { id: "oc-6", species: "Ribbon Fish", qualityGrade: "Low", weight_kg: 0.8, depth_m: 35, waterTemp_c: 27.0, freshness: "Acceptable", catchMethod: "Trawl", latitude: 15.0, longitude: 73.8, timestamp: hoursAgo(12) },
    { id: "oc-7", species: "Kingfish", qualityGrade: "Premium", weight_kg: 6.5, depth_m: 60, waterTemp_c: 25.8, freshness: "Excellent", catchMethod: "Trolling", latitude: 13.5, longitude: 80.5, timestamp: hoursAgo(4) },
    { id: "oc-8", species: "Prawns", qualityGrade: "Standard", weight_kg: 2.0, depth_m: 20, waterTemp_c: 28.8, freshness: "Fresh", catchMethod: "Trawl", latitude: 16.0, longitude: 73.2, timestamp: hoursAgo(7) },
    { id: "oc-9", species: "Crab", qualityGrade: "Premium", weight_kg: 1.5, depth_m: 8, waterTemp_c: 29.0, freshness: "Live", catchMethod: "Trap", latitude: 9.5, longitude: 76.2, timestamp: hoursAgo(1) },
    { id: "oc-10", species: "Squid", qualityGrade: "Standard", weight_kg: 1.8, depth_m: 55, waterTemp_c: 25.5, freshness: "Fresh", catchMethod: "Jigging", latitude: 10.5, longitude: 75.5, timestamp: hoursAgo(9) },
    { id: "oc-11", species: "Tuna", qualityGrade: "Standard", weight_kg: 5.0, depth_m: 90, waterTemp_c: 25.0, freshness: "Good", catchMethod: "Long Line", latitude: 8.5, longitude: 76.8, timestamp: hoursAgo(11) },
    { id: "oc-12", species: "Pomfret", qualityGrade: "Standard", weight_kg: 0.9, depth_m: 18, waterTemp_c: 28.0, freshness: "Fresh", catchMethod: "Gill Net", latitude: 19.5, longitude: 72.2, timestamp: hoursAgo(4) },
    { id: "oc-13", species: "Mackerel", qualityGrade: "Premium", weight_kg: 0.7, depth_m: 12, waterTemp_c: 28.3, freshness: "Excellent", catchMethod: "Ring Seine", latitude: 13.0, longitude: 80.8, timestamp: hoursAgo(3) },
    { id: "oc-14", species: "Hilsa", qualityGrade: "Premium", weight_kg: 1.1, depth_m: 22, waterTemp_c: 27.5, freshness: "Fresh", catchMethod: "Gill Net", latitude: 21.5, longitude: 88.5, timestamp: hoursAgo(6) },
    { id: "oc-15", species: "Barramundi", qualityGrade: "Standard", weight_kg: 3.2, depth_m: 30, waterTemp_c: 27.8, freshness: "Good", catchMethod: "Cast Net", latitude: 11.0, longitude: 79.8, timestamp: hoursAgo(10) },
];

export const ZONE_INSIGHTS: ZoneInsight[] = [
    { zone: "Arabian Sea — Konkan", region: "15°N – 18°N, 72°E – 73°E", topSpecies: ["Pomfret", "Mackerel", "Sardine"], avgTemp: 27.4, catchCount: 3, healthStatus: "Healthy", trend: "up", advisory: "Good conditions for gill net fishing. Sardine schools spotted near Ratnagiri." },
    { zone: "Goa Deep Water", region: "14°N – 16°N, 73°E – 74°E", topSpecies: ["Tuna", "Seer Fish", "Prawns"], avgTemp: 26.8, catchCount: 4, healthStatus: "Healthy", trend: "up", advisory: "Excellent deep-water trolling conditions. Tuna migrating southward." },
    { zone: "Bay of Bengal – East Coast", region: "12°N – 14°N, 80°E – 82°E", topSpecies: ["Kingfish", "Mackerel"], avgTemp: 27.0, catchCount: 2, healthStatus: "Moderate", trend: "stable", advisory: "Moderate swells expected. Best fishing before noon." },
    { zone: "Lakshadweep Sea", region: "8°N – 12°N, 72°E – 77°E", topSpecies: ["Tuna", "Squid", "Crab"], avgTemp: 28.2, catchCount: 3, healthStatus: "Healthy", trend: "up", advisory: "Warm currents bringing skipjack tuna near coral reefs." },
];

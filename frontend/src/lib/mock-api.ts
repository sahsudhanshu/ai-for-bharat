/**
 * Mock API responses for demo mode.
 * All functions accept the same signature as the real API client
 * and return realistic data with simulated network delays.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FishAnalysisResult {
  species: string;
  scientificName: string;
  confidence: number;
  qualityGrade: "Premium" | "Standard" | "Low";
  isSustainable: boolean;
  measurements: {
    length_mm: number;
    weight_g: number;
    width_mm: number;
  };
  compliance: {
    is_legal_size: boolean;
    min_legal_size_mm: number;
  };
  marketEstimate: {
    price_per_kg: number;
    estimated_value: number;
  };
  // Convenience alias used by UI
  weightEstimate: number;
  weightConfidence: number;
  marketPriceEstimate: number;
  timestamp: string;
  debugUrls?: {
    yoloImageUrl: string | null;
    cropImageUrl: string | null;
    gradcamUrl: string | null;
  };
}

// ── Mock data pools ───────────────────────────────────────────────────────────

export const SPECIES_DATA: { name: string; scientific: string; minSize: number; pricePerKg: number }[] = [
  { name: "Indian Pomfret", scientific: "Pampus argenteus", minSize: 150, pricePerKg: 650 },
  { name: "Indian Mackerel", scientific: "Rastrelliger kanagurta", minSize: 100, pricePerKg: 220 },
  { name: "Kingfish", scientific: "Scomberomorus commerson", minSize: 350, pricePerKg: 480 },
  { name: "Yellowfin Tuna", scientific: "Thunnus albacares", minSize: 450, pricePerKg: 420 },
  { name: "Indo-Pacific Swordfish", scientific: "Xiphias gladius", minSize: 1200, pricePerKg: 820 },
  { name: "Seer Fish", scientific: "Scomberomorus guttatus", minSize: 300, pricePerKg: 850 },
  { name: "Hilsa Shad", scientific: "Tenualosa ilisha", minSize: 250, pricePerKg: 700 },
];

const CATCH_HISTORY_SPECIES = ["Pomfret", "Kingfish", "Tuna", "Mackerel", "Seer Fish", "Hilsa"];
const GRADES: ("Premium" | "Standard" | "Low")[] = ["Premium", "Standard", "Low"];
const STATUSES = ["Sold", "Stored", "Rejected"] as const;

// ── Mock functions ────────────────────────────────────────────────────────────

export const analyzeCatch = async (_imageFile: File): Promise<FishAnalysisResult> => {
  await new Promise((r) => setTimeout(r, 2500));

  const fishData = SPECIES_DATA[Math.floor(Math.random() * SPECIES_DATA.length)];
  const length_mm = fishData.minSize + Math.random() * 200;
  const weight_g = (length_mm / 1000) ** 3 * 1e6 * (0.01 + Math.random() * 0.005);
  const confidence = 0.85 + Math.random() * 0.13;
  const grade = GRADES[Math.floor(Math.random() * 2.5)] ?? "Standard";
  const isSustainable = length_mm >= fishData.minSize;
  const estimatedValue = (weight_g / 1000) * fishData.pricePerKg;

  return {
    species: fishData.name,
    scientificName: fishData.scientific,
    confidence,
    qualityGrade: grade,
    isSustainable,
    measurements: {
      length_mm: Math.round(length_mm),
      weight_g: Math.round(weight_g),
      width_mm: Math.round(length_mm * 0.35),
    },
    compliance: {
      is_legal_size: isSustainable,
      min_legal_size_mm: fishData.minSize,
    },
    marketEstimate: {
      price_per_kg: fishData.pricePerKg,
      estimated_value: Math.round(estimatedValue),
    },
    // UI aliases
    weightEstimate: Math.round(weight_g) / 1000,
    weightConfidence: 0.78 + Math.random() * 0.15,
    marketPriceEstimate: fishData.pricePerKg,
    timestamp: new Date().toISOString(),
  };
};

export const getMarketPrices = async () => {
  await new Promise((r) => setTimeout(r, 500));
  return SPECIES_DATA.map((s) => ({
    species: s.name,
    price: s.pricePerKg + Math.round((Math.random() - 0.5) * 50),
    trend: ["up", "down", "stable"][Math.floor(Math.random() * 3)],
  }));
};

export const getChatbotResponse = async (query: string): Promise<string> => {
  await new Promise((r) => setTimeout(r, 1500));
  const lowerQ = query.toLowerCase();

  if (lowerQ.includes("pomfret") || lowerQ.includes("identification"))
    return "Based on current ocean temperatures, Indian Pomfret (Pampus argenteus) migration is shifting towards the north-west coast near Raigad. I recommend focusing your efforts between 17°–19°N latitude for optimal yield this week.";
  if (lowerQ.includes("weather") || lowerQ.includes("sea"))
    return "Weather patterns indicate a high-pressure system moving in tomorrow. Seas will be calm (0.8m waves) with excellent visibility. Best fishing window: 0400–0900 IST. Return before 1400 as afternoon conditions deteriorate.";
  if (lowerQ.includes("price") || lowerQ.includes("market"))
    return "Pomfret is trading at ₹640–₹680/kg at Vashi APMC today — 12% above the weekly average. Kingfish is at ₹490/kg with upward momentum. I recommend selling Pomfret now and holding Kingfish for 2 more days.";
  if (lowerQ.includes("sustainable") || lowerQ.includes("regulation"))
    return "For the Konkan coast fishery, legal minimum sizes are: Pomfret ≥150mm, Kingfish ≥350mm, Tuna ≥450mm. The current ban period near Zone B ends March 15. Our AI automatically flags undersized catch — please release those immediately.";
  if (lowerQ.includes("quality") || lowerQ.includes("freshness"))
    return "To maintain Premium grade: ice fish immediately at 0–4°C. Gut larger species within 2 hours. Avoid cross-contamination with damaged catch. Premium-grade fish commands ₹120–200/kg more than Standard — a significant income boost!";

  const fallback = [
    "Based on seasonal patterns, skipjack tuna migration is now peaking in the Malabar Basin. Current conditions are optimal — 29°C surface temp, salinity 34 PSU. Zone C shows the highest density index (0.87).",
    "The species you asked about is currently in season and sustainable to harvest in your region. Current stock health is Good. I recommend staying within the 12-nautical-mile zone for best results.",
    "The freshness window for your catch is optimal right now. Delaying sale by 4+ hours could reduce your grade from Premium to Standard, reducing value by up to ₹150/kg.",
    "I found 3 verified buyers near Sassoon Dock interested in Hilsa. The highest bid is ₹720/kg (20% above market). Would you like me to generate their contact details?",
  ];
  return fallback[Math.floor(Math.random() * fallback.length)];
};

export const getMockChatHistory = (): ChatMessage[] => {
  const now = Date.now();
  return [
    {
      chatId: "hist_1",
      userId: "usr_demo_001",
      message: "What fish should I catch today?",
      response:
        "Based on today's ocean conditions, I recommend targeting Indian Pomfret in the Konkan North zone. Density index is High (0.92) and sea temp is ideal at 27°C.",
      timestamp: new Date(now - 86400000 * 2).toISOString(),
    },
    {
      chatId: "hist_2",
      userId: "usr_demo_001",
      message: "What are current Kingfish prices?",
      response:
        "Kingfish is trading at ₹490/kg at Vashi APMC today with a 5% upward trend. Premium grade commands ₹520/kg. Best buyer: Seafresh Exports Ltd.",
      timestamp: new Date(now - 86400000).toISOString(),
    },
  ];
};

export interface ChatMessage {
  chatId: string;
  userId: string;
  message: string;
  response: string;
  timestamp: string;
}

export const getMockImages = (): { items: MockImageRecord[]; lastKey?: string } => {
  const items: MockImageRecord[] = Array.from({ length: 10 }, (_, i) => {
    const speciesEntry = SPECIES_DATA[i % SPECIES_DATA.length];
    const weight_g = 200 + i * 150 + Math.random() * 300;
    return {
      imageId: `img_demo_${i + 1}`,
      userId: "usr_demo_001",
      s3Path: `s3://demo-bucket/uploads/demo_${i + 1}.jpg`,
      status: "completed",
      analysisResult: {
        species: speciesEntry.name,
        scientificName: speciesEntry.scientific,
        confidence: 0.88 + Math.random() * 0.1,
        qualityGrade: GRADES[i % 3],
        isSustainable: i % 4 !== 0,
        measurements: {
          length_mm: 150 + i * 12,
          weight_g: Math.round(weight_g),
          width_mm: 80 + i * 4,
        },
        compliance: { is_legal_size: i % 4 !== 0, min_legal_size_mm: speciesEntry.minSize },
        marketEstimate: {
          price_per_kg: speciesEntry.pricePerKg,
          estimated_value: Math.round((weight_g / 1000) * speciesEntry.pricePerKg),
        },
        weightEstimate: weight_g / 1000,
        weightConfidence: 0.82,
        marketPriceEstimate: speciesEntry.pricePerKg,
        timestamp: new Date(Date.now() - 86400000 * i).toISOString(),
      } as FishAnalysisResult,
      latitude: 16.0 + Math.random() * 4,
      longitude: 72.0 + Math.random() * 4,
      createdAt: new Date(Date.now() - 86400000 * i).toISOString(),
    };
  });
  return { items };
};

export interface MockImageRecord {
  imageId: string;
  userId: string;
  s3Path: string;
  status: string;
  analysisResult?: FishAnalysisResult;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

export const getMockMapData = () => ({
  markers: [
    { imageId: "m1", latitude: 18.52, longitude: 72.5, species: "Indian Pomfret", qualityGrade: "Premium", weight_g: 345, createdAt: new Date().toISOString() },
    { imageId: "m2", latitude: 17.0, longitude: 73.0, species: "Kingfish", qualityGrade: "Standard", weight_g: 1200, createdAt: new Date().toISOString() },
    { imageId: "m3", latitude: 15.4, longitude: 73.4, species: "Indian Mackerel", qualityGrade: "Premium", weight_g: 180, createdAt: new Date().toISOString() },
    { imageId: "m4", latitude: 11.2, longitude: 75.5, species: "Yellowfin Tuna", qualityGrade: "Standard", weight_g: 2800, createdAt: new Date().toISOString() },
    { imageId: "m5", latitude: 14.8, longitude: 74.1, species: "Seer Fish", qualityGrade: "Premium", weight_g: 980, createdAt: new Date().toISOString() },
    { imageId: "m6", latitude: 19.1, longitude: 72.9, species: "Hilsa Shad", qualityGrade: "Low", weight_g: 420, createdAt: new Date().toISOString() },
  ],
});

export const getMockAnalytics = () => ({
  totalImages: 148,
  totalCatches: 148,
  totalEarnings: 42850,
  avgWeight: 850,
  topSpecies: "Indian Pomfret",
  weeklyTrend: [
    { date: "Mon", earnings: 4500, catches: 8 },
    { date: "Tue", earnings: 5200, catches: 10 },
    { date: "Wed", earnings: 4800, catches: 9 },
    { date: "Thu", earnings: 6100, catches: 12 },
    { date: "Fri", earnings: 5900, catches: 11 },
    { date: "Sat", earnings: 8400, catches: 16 },
    { date: "Sun", earnings: 7200, catches: 14 },
  ],
  speciesBreakdown: [
    { name: "Pomfret", count: 52, percentage: 35 },
    { name: "Kingfish", count: 37, percentage: 25 },
    { name: "Tuna", count: 30, percentage: 20 },
    { name: "Other", count: 29, percentage: 20 },
  ],
  qualityDistribution: [
    { grade: "Premium", count: 88 },
    { grade: "Standard", count: 45 },
    { grade: "Low", count: 15 },
  ],
});

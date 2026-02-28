/**
 * Mock API responses for demo mode.
 * All functions accept the same signature as the real API client
 * and return realistic data with simulated network delays.
 */

// ── ML API Response Types (YOLO + Species + Disease model) ─────────────────

export interface MLPrediction {
  label: string;
  confidence: number;
  gradcam_url: string;
}

export interface MLCropResult {
  bbox: number[];
  crop_url: string;
  species: MLPrediction;
  disease: MLPrediction;
  yolo_confidence: number;
}

export interface MLAnalysisResponse {
  crops: Record<string, MLCropResult>;
  yolo_image_url: string;
}

/** Mock supplementary data per crop (fields not provided by ML API) */
export interface MockCropSupplement {
  scientificName: string;
  qualityGrade: "Premium" | "Standard" | "Low";
  isSustainable: boolean;
  weight_kg: number;
  length_mm: number;
  marketPricePerKg: number;
  estimatedValue: number;
}

/** @deprecated Use MLAnalysisResponse instead */
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
  { name: "Pangasius", scientific: "Pangasianodon hypophthalmus", minSize: 200, pricePerKg: 180 },
  { name: "Rohu", scientific: "Labeo rohita", minSize: 250, pricePerKg: 200 },
  { name: "Catla", scientific: "Catla catla", minSize: 300, pricePerKg: 220 },
  { name: "Tilapia", scientific: "Oreochromis niloticus", minSize: 150, pricePerKg: 160 },
  { name: "Sardine", scientific: "Sardinella longiceps", minSize: 80, pricePerKg: 120 },
  { name: "Barramundi", scientific: "Lates calcarifer", minSize: 300, pricePerKg: 450 },
];

const DISEASES = ["Healthy", "White Tail Disease", "Epizootic Ulcerative Syndrome", "Bacterial Gill Disease", "Fin Rot"];
const GRADES: ("Premium" | "Standard" | "Low")[] = ["Premium", "Standard", "Low"];

// ── Mock Supplement Generator ────────────────────────────────────────────────

/** Deterministic pseudo-random based on string hash */
function seededRandom(seed: number): number {
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

/** Generate mock supplementary data for a crop (deterministic by species + index) */
export function generateMockSupplement(speciesLabel: string, cropIndex: number = 0): MockCropSupplement {
  const match = SPECIES_DATA.find(s =>
    s.name.toLowerCase() === speciesLabel.toLowerCase() ||
    s.name.toLowerCase().includes(speciesLabel.toLowerCase()) ||
    speciesLabel.toLowerCase().includes(s.name.toLowerCase())
  );
  const data = match || { name: speciesLabel, scientific: `${speciesLabel} sp.`, minSize: 150, pricePerKg: 300 };

  const hash = speciesLabel.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + cropIndex * 137;
  const r1 = seededRandom(hash);
  const r2 = seededRandom(hash + 31);
  const r3 = seededRandom(hash + 67);

  const length_mm = data.minSize + r1 * 200;
  const weight_g = (length_mm / 1000) ** 3 * 1e6 * (0.01 + r2 * 0.005);
  const grade = GRADES[Math.floor(r3 * 2.5)] ?? "Standard";

  return {
    scientificName: data.scientific,
    qualityGrade: grade,
    isSustainable: length_mm >= data.minSize,
    weight_kg: Math.round(weight_g) / 1000,
    length_mm: Math.round(length_mm),
    marketPricePerKg: data.pricePerKg,
    estimatedValue: Math.round((weight_g / 1000) * data.pricePerKg),
  };
}

const CATCH_HISTORY_SPECIES = ["Pomfret", "Kingfish", "Tuna", "Mackerel", "Seer Fish", "Hilsa"];
const STATUSES = ["Sold", "Stored", "Rejected"] as const;

// ── Mock functions ────────────────────────────────────────────────────────────

/** @deprecated Use analyzeCatchML instead */
export const analyzeCatch = async (_imageFile: File): Promise<FishAnalysisResult> => {
  await new Promise((r) => setTimeout(r, 2500));

  const fishData = SPECIES_DATA[Math.floor(Math.random() * SPECIES_DATA.length)];
  const length_mm = fishData.minSize + Math.random() * 200;
  const weight_g = (length_mm / 1000) ** 3 * 1e6 * (0.01 + Math.random() * 0.005);
  const confidence = 0.85 + Math.random() * 0.13;
  const grades: ("Premium" | "Standard" | "Low")[] = ["Premium", "Standard", "Low"];
  const grade = grades[Math.floor(Math.random() * 2.5)] ?? "Standard";
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
    weightEstimate: Math.round(weight_g) / 1000,
    weightConfidence: 0.78 + Math.random() * 0.15,
    marketPriceEstimate: fishData.pricePerKg,
    timestamp: new Date().toISOString(),
  };
};

/** Generate mock ML analysis response (new crops-based format) */
export const analyzeCatchML = async (): Promise<MLAnalysisResponse> => {
  await new Promise((r) => setTimeout(r, 2500));
  const numCrops = 1 + Math.floor(Math.random() * 2);
  const crops: Record<string, MLCropResult> = {};

  for (let i = 0; i < numCrops; i++) {
    const species = SPECIES_DATA[Math.floor(Math.random() * SPECIES_DATA.length)];
    const disease = DISEASES[Math.floor(Math.random() * DISEASES.length)];
    crops[`crop_${i}`] = {
      bbox: [Math.round(Math.random() * 50), Math.round(Math.random() * 100), Math.round(500 + Math.random() * 500), Math.round(200 + Math.random() * 200)],
      crop_url: "",
      species: { label: species.name, confidence: 0.5 + Math.random() * 0.48, gradcam_url: "" },
      disease: { label: disease, confidence: 0.3 + Math.random() * 0.6, gradcam_url: "" },
      yolo_confidence: 0.4 + Math.random() * 0.55,
    };
  }

  return { crops, yolo_image_url: "" };
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
    const disease = DISEASES[i % DISEASES.length];
    return {
      imageId: `img_demo_${i + 1}`,
      userId: "usr_demo_001",
      s3Path: `s3://demo-bucket/uploads/demo_${i + 1}.jpg`,
      status: "completed",
      analysisResult: {
        crops: {
          crop_0: {
            bbox: [10, 20, 500, 300],
            crop_url: "",
            species: { label: speciesEntry.name, confidence: 0.88 + (i * 0.01), gradcam_url: "" },
            disease: { label: disease, confidence: 0.4 + (i * 0.05), gradcam_url: "" },
            yolo_confidence: 0.7 + (i * 0.02),
          },
        },
        yolo_image_url: "",
      } as MLAnalysisResponse,
      latitude: 16.0 + i * 0.3,
      longitude: 72.0 + i * 0.3,
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
  analysisResult?: MLAnalysisResponse;
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

// ── Group-based Multi-Image Mock Data ─────────────────────────────────────────

export interface GroupAnalysis {
  images: Array<{
    imageIndex: number;
    s3Key: string;
    crops: Record<string, MLCropResult>;
    yolo_image_url: string;
    error?: string;
  }>;
  aggregateStats: {
    totalFishCount: number;
    speciesDistribution: Record<string, number>;
    averageConfidence: number;
    diseaseDetected: boolean;
    totalEstimatedWeight: number;
    totalEstimatedValue: number;
  };
  processedAt: string;
}

export const getMockGroupAnalysis = async (imageCount: number = 3): Promise<GroupAnalysis> => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const species = ["Bangus", "Tilapia", "Indian Mackerel", "Yellowfin Tuna", "Seer Fish"];
  const diseases = ["Healthy Fish", "Healthy Fish", "Healthy Fish", "Parasitic Disease", "Fungal Infection"];
  
  const images = Array.from({ length: imageCount }, (_, imageIndex) => {
    const cropCount = Math.floor(Math.random() * 4) + 2;
    const crops: Record<string, MLCropResult> = {};
    
    for (let i = 0; i < cropCount; i++) {
      const speciesLabel = species[Math.floor(Math.random() * species.length)];
      const diseaseLabel = diseases[Math.floor(Math.random() * diseases.length)];
      
      crops[`crop_${imageIndex}_${i}`] = {
        bbox: [100 + i * 50, 100, 200 + i * 50, 200],
        crop_url: `/static/crops/demo_${imageIndex}_${i}.jpg`,
        disease: {
          confidence: 0.85 + Math.random() * 0.1,
          gradcam_url: `/static/gradcam/demo_${imageIndex}_${i}_disease.jpg`,
          label: diseaseLabel,
        },
        species: {
          confidence: 0.88 + Math.random() * 0.1,
          gradcam_url: `/static/gradcam/demo_${imageIndex}_${i}_species.jpg`,
          label: speciesLabel,
        },
        yolo_confidence: 0.92 + Math.random() * 0.05,
      };
    }
    
    return {
      imageIndex,
      s3Key: `groups/demo_group/image_${imageIndex}.jpg`,
      crops,
      yolo_image_url: `/static/yolo_outputs/demo_${imageIndex}_yolo.jpg`,
    };
  });
  
  const allCrops = images.flatMap(img => Object.values(img.crops));
  const totalFishCount = allCrops.length;
  const speciesDistribution: Record<string, number> = {};
  let totalConfidence = 0;
  let diseaseDetected = false;
  
  allCrops.forEach(crop => {
    speciesDistribution[crop.species.label] = (speciesDistribution[crop.species.label] || 0) + 1;
    totalConfidence += crop.species.confidence;
    if (crop.disease.label !== "Healthy Fish") diseaseDetected = true;
  });
  
  return {
    images,
    aggregateStats: {
      totalFishCount,
      speciesDistribution,
      averageConfidence: totalConfidence / totalFishCount,
      diseaseDetected,
      totalEstimatedWeight: totalFishCount * 1.2,
      totalEstimatedValue: totalFishCount * 450,
    },
    processedAt: new Date().toISOString(),
  };
};

// Persistent store for demo groups (survives page refresh via localStorage)
const DEMO_GROUPS_STORAGE_KEY = 'ocean_ai_group_history';

function loadPersistedGroups(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DEMO_GROUPS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistGroups(groups: any[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEMO_GROUPS_STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

// Initialize from localStorage on module load
let demoGroupsStore: any[] = loadPersistedGroups();

export const getMockGroups = () => {
  // Only return dynamically created groups from the current session
  // No static mock data - all data should come from the real database
  const allGroups = [...demoGroupsStore].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  console.log('getMockGroups called - returning', allGroups.length, 'groups (fallback mode)');
  console.log('Dynamic groups:', demoGroupsStore.length);
  
  return {
    groups: allGroups,
    lastKey: undefined,
  };
};

export const addDemoGroup = (group: any) => {
  console.log('Adding demo group to store:', group);
  // Avoid duplicates
  demoGroupsStore = demoGroupsStore.filter(g => g.groupId !== group.groupId);
  demoGroupsStore.unshift(group);
  // Keep max 50 groups to avoid localStorage overflow
  if (demoGroupsStore.length > 50) demoGroupsStore = demoGroupsStore.slice(0, 50);
  persistGroups(demoGroupsStore);
  console.log('Demo groups store now has:', demoGroupsStore.length, 'groups (persisted)');
};

export const removeDemoGroup = (groupId: string) => {
  demoGroupsStore = demoGroupsStore.filter(g => g.groupId !== groupId);
  persistGroups(demoGroupsStore);
};

export const getMockGroupDetails = (groupId: string) => {
  // Refresh from localStorage in case another tab added groups
  demoGroupsStore = loadPersistedGroups();
  // Check if it's a dynamically created group
  const dynamicGroup = demoGroupsStore.find(g => g.groupId === groupId);
  if (dynamicGroup) {
    return {
      ...dynamicGroup,
      updatedAt: dynamicGroup.createdAt,
      presignedViewUrls: dynamicGroup.s3Keys.map((_: string, i: number) => `/demo/image_${i}.jpg`),
    };
  }
  
  // Return static mock data for demo groups
  return {
    groupId,
    userId: "demo_user",
    imageCount: 3,
    s3Keys: ["groups/demo/image_0.jpg", "groups/demo/image_1.jpg", "groups/demo/image_2.jpg"],
    status: "completed" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analysisResult: {
      images: [],
      aggregateStats: {
        totalFishCount: 8,
        speciesDistribution: { "Bangus": 3, "Tilapia": 5 },
        averageConfidence: 0.92,
        diseaseDetected: false,
        totalEstimatedWeight: 9.6,
        totalEstimatedValue: 3600,
      },
      processedAt: new Date().toISOString(),
    },
    presignedViewUrls: [
      "/demo/image_0.jpg",
      "/demo/image_1.jpg",
      "/demo/image_2.jpg",
    ],
  };
};

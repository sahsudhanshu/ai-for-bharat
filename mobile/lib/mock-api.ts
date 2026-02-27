/**
 * Mock API — React Native port of the web mock-api.ts
 * Returns realistic data with simulated network delays.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FishAnalysisResult {
    species: string;
    scientificName: string;
    confidence: number;
    qualityGrade: 'Premium' | 'Standard' | 'Low';
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

export interface ChatMessage {
    chatId: string;
    userId: string;
    message: string;
    response: string;
    timestamp: string;
}

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

// ── Mock data pools ───────────────────────────────────────────────────────────

const SPECIES_DATA = [
    { name: 'Indian Pomfret', scientific: 'Pampus argenteus', minSize: 150, pricePerKg: 650 },
    { name: 'Indian Mackerel', scientific: 'Rastrelliger kanagurta', minSize: 100, pricePerKg: 220 },
    { name: 'Kingfish', scientific: 'Scomberomorus commerson', minSize: 350, pricePerKg: 480 },
    { name: 'Yellowfin Tuna', scientific: 'Thunnus albacares', minSize: 450, pricePerKg: 420 },
    { name: 'Indo-Pacific Swordfish', scientific: 'Xiphias gladius', minSize: 1200, pricePerKg: 820 },
    { name: 'Seer Fish', scientific: 'Scomberomorus guttatus', minSize: 300, pricePerKg: 850 },
    { name: 'Hilsa Shad', scientific: 'Tenualosa ilisha', minSize: 250, pricePerKg: 700 },
];

const GRADES: ('Premium' | 'Standard' | 'Low')[] = ['Premium', 'Standard', 'Low'];

// ── Mock functions ────────────────────────────────────────────────────────────

function delay(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

export const analyzeCatch = async (): Promise<FishAnalysisResult> => {
    await delay(2500);
    const fishData = SPECIES_DATA[Math.floor(Math.random() * SPECIES_DATA.length)];
    const length_mm = fishData.minSize + Math.random() * 200;
    const weight_g = (length_mm / 1000) ** 3 * 1e6 * (0.01 + Math.random() * 0.005);
    const confidence = 0.85 + Math.random() * 0.13;
    const grade = GRADES[Math.floor(Math.random() * 2.5)] ?? 'Standard';
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

export const getChatbotResponse = async (query: string): Promise<string> => {
    await delay(1500);
    const lowerQ = query.toLowerCase();

    if (lowerQ.includes('pomfret') || lowerQ.includes('identification'))
        return 'Based on current ocean temperatures, Indian Pomfret (Pampus argenteus) migration is shifting towards the north-west coast near Raigad. Focus between 17°–19°N latitude for optimal yield this week.';
    if (lowerQ.includes('weather') || lowerQ.includes('sea'))
        return 'High-pressure system moving in tomorrow. Seas will be calm (0.8m waves) with excellent visibility. Best fishing window: 0400–0900 IST. Return before 1400 as afternoon conditions deteriorate.';
    if (lowerQ.includes('price') || lowerQ.includes('market'))
        return 'Pomfret is trading at ₹640–₹680/kg at Vashi APMC today — 12% above the weekly average. Kingfish at ₹490/kg with upward momentum. Recommend selling Pomfret now, hold Kingfish 2 more days.';
    if (lowerQ.includes('sustainable') || lowerQ.includes('regulation'))
        return 'For Konkan coast: Pomfret ≥150mm, Kingfish ≥350mm, Tuna ≥450mm. Current ban near Zone B ends March 15. Our AI automatically flags undersized catch — please release those immediately.';
    if (lowerQ.includes('quality') || lowerQ.includes('freshness'))
        return 'To maintain Premium grade: ice fish immediately at 0–4°C. Gut larger species within 2 hours. Avoid cross-contamination. Premium-grade fish commands ₹120–200/kg more than Standard!';
    if (lowerQ.includes('today') || lowerQ.includes('catch'))
        return 'Based on seasonal patterns, skipjack tuna migration is peaking in the Malabar Basin. Conditions are optimal — 29°C surface temp, salinity 34 PSU. Zone C shows highest density index (0.87).';

    const fallback = [
        'The species you asked about is currently in season and sustainable to harvest in your region. Current stock health is Good. Recommend staying within 12 nautical miles for best results.',
        'The freshness window for your catch is optimal right now. Delaying sale 4+ hours could reduce grade from Premium to Standard, reducing value by up to ₹150/kg.',
        'I found 3 verified buyers near Sassoon Dock interested in Hilsa. Highest bid is ₹720/kg (20% above market). Want me to generate their contact details?',
        'Best fishing today: 5:00–8:00 AM in Zone A (17.5°N, 72.8°E). Moderate current, 1.2m waves. Target: Indian Pomfret and Kingfish.',
    ];
    return fallback[Math.floor(Math.random() * fallback.length)];
};

export const getMockChatHistory = (): ChatMessage[] => {
    const now = Date.now();
    return [
        {
            chatId: 'hist_1',
            userId: 'usr_demo_001',
            message: 'What fish should I catch today?',
            response: 'Based on today\'s ocean conditions, I recommend targeting Indian Pomfret in the Konkan North zone. Density index is High (0.92) and sea temp is ideal at 27°C.',
            timestamp: new Date(now - 86400000 * 2).toISOString(),
        },
        {
            chatId: 'hist_2',
            userId: 'usr_demo_001',
            message: 'What are current Kingfish prices?',
            response: 'Kingfish is trading at ₹490/kg at Vashi APMC today with a 5% upward trend. Premium grade commands ₹520/kg. Best buyer: Seafresh Exports Ltd.',
            timestamp: new Date(now - 86400000).toISOString(),
        },
    ];
};

export const getMockImages = (): { items: MockImageRecord[]; lastKey?: string } => {
    const items: MockImageRecord[] = Array.from({ length: 10 }, (_, i) => {
        const speciesEntry = SPECIES_DATA[i % SPECIES_DATA.length];
        const weight_g = 200 + i * 150 + Math.random() * 300;
        return {
            imageId: `img_demo_${i + 1}`,
            userId: 'usr_demo_001',
            s3Path: `s3://demo-bucket/uploads/demo_${i + 1}.jpg`,
            status: 'completed',
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

export const getMockMapData = () => ({
    markers: [
        { imageId: 'm1', latitude: 18.52, longitude: 72.5, species: 'Indian Pomfret', qualityGrade: 'Premium', weight_g: 345, createdAt: new Date().toISOString() },
        { imageId: 'm2', latitude: 17.0, longitude: 73.0, species: 'Kingfish', qualityGrade: 'Standard', weight_g: 1200, createdAt: new Date().toISOString() },
        { imageId: 'm3', latitude: 15.4, longitude: 73.4, species: 'Indian Mackerel', qualityGrade: 'Premium', weight_g: 180, createdAt: new Date().toISOString() },
        { imageId: 'm4', latitude: 11.2, longitude: 75.5, species: 'Yellowfin Tuna', qualityGrade: 'Standard', weight_g: 2800, createdAt: new Date().toISOString() },
        { imageId: 'm5', latitude: 14.8, longitude: 74.1, species: 'Seer Fish', qualityGrade: 'Premium', weight_g: 980, createdAt: new Date().toISOString() },
        { imageId: 'm6', latitude: 19.1, longitude: 72.9, species: 'Hilsa Shad', qualityGrade: 'Low', weight_g: 420, createdAt: new Date().toISOString() },
        { imageId: 'm7', latitude: 12.9, longitude: 74.8, species: 'Kingfish', qualityGrade: 'Premium', weight_g: 1500, createdAt: new Date().toISOString() },
        { imageId: 'm8', latitude: 20.1, longitude: 72.8, species: 'Indian Pomfret', qualityGrade: 'Standard', weight_g: 280, createdAt: new Date().toISOString() },
    ],
});

export const getMockAnalytics = () => ({
    totalImages: 148,
    totalCatches: 148,
    totalEarnings: 42850,
    avgWeight: 850,
    topSpecies: 'Indian Pomfret',
    weeklyTrend: [
        { date: 'Mon', earnings: 4500, catches: 8 },
        { date: 'Tue', earnings: 5200, catches: 10 },
        { date: 'Wed', earnings: 4800, catches: 9 },
        { date: 'Thu', earnings: 6100, catches: 12 },
        { date: 'Fri', earnings: 5900, catches: 11 },
        { date: 'Sat', earnings: 8400, catches: 16 },
        { date: 'Sun', earnings: 7200, catches: 14 },
    ],
    speciesBreakdown: [
        { name: 'Pomfret', count: 52, percentage: 35 },
        { name: 'Kingfish', count: 37, percentage: 25 },
        { name: 'Tuna', count: 30, percentage: 20 },
        { name: 'Other', count: 29, percentage: 20 },
    ],
    qualityDistribution: [
        { grade: 'Premium', count: 88 },
        { grade: 'Standard', count: 45 },
        { grade: 'Low', count: 15 },
    ],
});

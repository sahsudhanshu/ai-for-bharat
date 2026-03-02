/**
 * Shared types for the OceanAI app.
 */

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

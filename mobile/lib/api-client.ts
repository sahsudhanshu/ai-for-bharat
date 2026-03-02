/**
 * API client for OceanAI backend — React Native port of the web api-client.ts
 * Uses AsyncStorage for token management. Demo mode when EXPO_PUBLIC_API_URL not set.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AGENT_BASE_URL, IS_AGENT_CONFIGURED, DEMO_JWT, IS_DEMO_MODE, ENDPOINTS } from './constants';
import type { FishAnalysisResult, ChatMessage } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

export interface PresignedUrlResponse {
    uploadUrl: string;
    imageId: string;
    s3Path: string;
}

export interface AnalyzeImageResponse {
    imageId: string;
    analysisResult: FishAnalysisResult;
}

export interface MLApiCrop {
    bbox: number[];
    crop_url: string;
    species: {
        label: string;
        confidence: number;
        gradcam_url: string;
    };
    disease: {
        label: string;
        confidence: number;
        gradcam_url: string;
    };
    yolo_confidence: number;
}

export interface MLApiResponse {
    crops: Record<string, MLApiCrop>;
    yolo_image_url: string;
}

export interface MapMarker {
    imageId: string;
    latitude: number;
    longitude: number;
    species?: string;
    qualityGrade?: string;
    weight_g?: number;
    createdAt: string;
}

export interface MapDataResponse {
    markers: MapMarker[];
}

export type { ChatMessage } from './types';

export interface SendChatResponse {
    chatId: string;
    response: string;
    timestamp: string;
}

export interface Conversation {
    conversationId: string;
    title: string;
    language: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface ConversationMessage {
    messageId: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface UnifiedMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: string;
}

export interface ImageRecord {
    imageId: string;
    userId: string;
    s3Path: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    analysisResult?: FishAnalysisResult;
    latitude?: number;
    longitude?: number;
    createdAt: string;
}

export interface AnalyticsResponse {
    totalImages: number;
    totalCatches: number;
    totalEarnings: number;
    avgWeight: number;
    topSpecies: string;
    weeklyTrend: { date: string; earnings: number; catches: number }[];
    speciesBreakdown: { name: string; count: number; percentage: number }[];
    qualityDistribution: { grade: string; count: number }[];
}

// ── Core fetch helper ─────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
    try {
        const token = await AsyncStorage.getItem('ocean_ai_token');
        return token || DEMO_JWT;
    } catch {
        return DEMO_JWT;
    }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getToken();
    const url = `${API_BASE_URL}${path}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string>),
    };

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
        let message = `API error ${res.status}`;
        try {
            const body = await res.json();
            message = body.message || body.error || message;
        } catch { /* ignore */ }
        throw new ApiError(res.status, message);
    }

    return res.json() as Promise<T>;
}

/**
 * Fetch helper for the Python agent (LangGraph).
 * Same pattern as apiFetch but hits the agent URL.
 */
async function agentFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getToken();
    const url = `${AGENT_BASE_URL}${path}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string>),
    };

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
        let message = `Agent API error ${res.status}`;
        try {
            const body = await res.json();
            message = body.message || body.error || body.detail || message;
        } catch { /* ignore */ }
        throw new ApiError(res.status, message);
    }

    return res.json() as Promise<T>;
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getPresignedUrl(
    fileName: string,
    fileType: string,
    latitude?: number,
    longitude?: number,
): Promise<PresignedUrlResponse> {
    if (IS_DEMO_MODE) {
        throw new ApiError(0, 'Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable uploads.');
    }
    return apiFetch<PresignedUrlResponse>(ENDPOINTS.presignedUrl, {
        method: 'POST',
        body: JSON.stringify({ fileName, fileType, latitude, longitude }),
    });
}

/**
 * Upload image to S3 via presigned URL.
 * In demo mode, simulates progress without actual upload.
 */
export function uploadToS3(
    url: string,
    fileUri: string,
    fileType: string,
    onProgress?: (pct: number) => void,
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!url) {
            reject(new Error('No upload URL provided. Backend API may not be configured.'));
            return;
        }
        // Real S3 upload using React Native fetch
        fetch(fileUri)
            .then((r) => r.blob())
            .then((blob) =>
                fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': fileType },
                    body: blob,
                })
            )
            .then((res) => {
                if (res.ok) { onProgress?.(100); resolve(); }
                else reject(new Error(`S3 upload failed: ${res.status}`));
            })
            .catch(reject);
    });
}

export async function analyzeImage(imageId: string): Promise<AnalyzeImageResponse> {
    if (IS_DEMO_MODE) {
        throw new ApiError(0, 'Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable cloud analysis.');
    }
    return apiFetch<AnalyzeImageResponse>(ENDPOINTS.analyzeImage(imageId), { method: 'POST' });
}

/**
 * Analyze image using ML API (returns raw ML response with crops, gradcam, etc.)
 */
export async function analyzeImageML(imageId: string): Promise<MLApiResponse> {
    if (IS_DEMO_MODE) {
        throw new ApiError(0, 'Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable ML analysis.');
    }
    return apiFetch<MLApiResponse>(ENDPOINTS.analyzeImage(imageId), { method: 'POST' });
}

/**
 * Convert ML API response to FishAnalysisResult (uses first/best crop)
 */
export function mlResponseToAnalysisResult(mlResponse: MLApiResponse): FishAnalysisResult {
    const crops = Object.values(mlResponse.crops);
    if (crops.length === 0) {
        throw new Error('No fish detected in image');
    }

    // Use the crop with highest YOLO confidence
    const bestCrop = crops.reduce((best, curr) => 
        curr.yolo_confidence > best.yolo_confidence ? curr : best
    );

    // Weight and price are not available from the ML API — mark as unavailable (0)
    const estimatedWeight = 0;
    const estimatedPricePerKg = 0;
    const estimatedLength = 0;
    const minLegalSize = 150;

    return {
        species: bestCrop.species.label,
        scientificName: '',
        confidence: bestCrop.species.confidence,
        measurements: {
            length_mm: 0,
            weight_g: 0,
            width_mm: 0,
        },
        qualityGrade: bestCrop.disease.label === 'Healthy Fish' ? 'Premium' : 'Standard',
        marketEstimate: {
            price_per_kg: 0,
            estimated_value: 0,
        },
        compliance: {
            is_legal_size: false,
            min_legal_size_mm: minLegalSize,
        },
        isSustainable: bestCrop.disease.label === 'Healthy Fish',
        weightEstimate: 0,
        weightConfidence: 0,
        marketPriceEstimate: 0,
        timestamp: new Date().toISOString(),
    };
}

export async function getImages(
    limit = 20,
    lastKey?: string,
): Promise<{ items: ImageRecord[]; lastKey?: string }> {
    if (IS_DEMO_MODE) {
        return { items: [] };
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (lastKey) params.set('lastKey', lastKey);
    return apiFetch(`${ENDPOINTS.getImages}?${params}`);
}

export async function getMapData(
    filters?: { species?: string; from?: string; to?: string },
): Promise<MapDataResponse> {
    if (IS_DEMO_MODE) {
        return { markers: [] };
    }
    const params = new URLSearchParams();
    if (filters?.species) params.set('species', filters.species);
    const query = params.toString() ? `?${params}` : '';
    return apiFetch(`${ENDPOINTS.getMapData}${query}`);
}

export async function sendChat(message: string, overrideChatId?: string, language?: string): Promise<SendChatResponse> {
    if (IS_AGENT_CONFIGURED) {
        if (overrideChatId) {
            const res = await agentFetch<{ success: boolean; response: { content: string, messageId: string } }>(`/conversations/${overrideChatId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ message, language }),
            });
            return { chatId: overrideChatId, response: res.response.content, timestamp: new Date().toISOString() };
        }
        return agentFetch<SendChatResponse>('/chat', {
            method: 'POST',
            body: JSON.stringify({ message, language }),
        });
    }
    if (IS_DEMO_MODE) {
        throw new ApiError(0, 'Chat is not available. Configure EXPO_PUBLIC_AGENT_URL or EXPO_PUBLIC_API_URL.');
    }
    return apiFetch<SendChatResponse>(ENDPOINTS.sendChat, {
        method: 'POST',
        body: JSON.stringify({ message }),
    });
}

export async function getChatHistory(limit = 30, overrideChatId?: string): Promise<UnifiedMessage[]> {
    if (IS_AGENT_CONFIGURED) {
        if (overrideChatId) {
            const res = await agentFetch<{ messages: ConversationMessage[] }>(`/conversations/${overrideChatId}/messages?limit=${limit}`);
            return res.messages.map(m => ({
                id: m.messageId,
                role: m.role,
                text: m.content,
                timestamp: m.timestamp
            }));
        }
        // Fallback for old /chat endpoint
        const oldLog = await agentFetch<ChatMessage[]>(`/chat?limit=${limit}`);
        return oldLog.map(m => ({
            id: m.chatId,
            role: 'assistant' as const,
            text: m.response,
            timestamp: m.timestamp
        }));
    }
    if (IS_DEMO_MODE) {
        return [];
    }
    const apiLog = await apiFetch<ChatMessage[]>(`${ENDPOINTS.getChatHistory}?limit=${limit}`);
    return apiLog.map(m => ({
        id: m.chatId,
        role: 'assistant' as const,
        text: m.response,
        timestamp: m.timestamp
    }));
}

export async function synthesizeSpeech(text: string, languageCode: string): Promise<{ audioBase64: string }> {
    if (IS_DEMO_MODE) {
        return { audioBase64: "" };
    }
    return apiFetch<{ audioBase64: string }>('/tts', {
        method: 'POST',
        body: JSON.stringify({ text, languageCode })
    });
}

export async function createConversation(title: string = "New Chat", language: string = "en"): Promise<Conversation> {
    if (IS_AGENT_CONFIGURED) {
        const res = await agentFetch<{ conversation: Conversation }>('/conversations', {
            method: 'POST',
            body: JSON.stringify({ title, language })
        });
        return res.conversation;
    }
    throw new ApiError(0, 'Chat is not available. Configure EXPO_PUBLIC_AGENT_URL.');
}

export async function getConversationsList(): Promise<Conversation[]> {
    if (IS_AGENT_CONFIGURED) {
        const res = await agentFetch<{ conversations: Conversation[] }>('/conversations?limit=20');
        return res.conversations;
    }
    return [];
}

export async function getAnalytics(): Promise<AnalyticsResponse> {
    if (IS_DEMO_MODE) {
        throw new ApiError(0, 'Analytics not available. Backend API is not configured.');
    }
    return apiFetch<AnalyticsResponse>(ENDPOINTS.getAnalytics);
}

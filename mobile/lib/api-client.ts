/**
 * API client for OceanAI backend — React Native port of the web api-client.ts
 * Uses AsyncStorage for token management. Demo mode when EXPO_PUBLIC_API_URL not set.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AGENT_BASE_URL, IS_AGENT_CONFIGURED, DEMO_JWT, IS_DEMO_MODE, ENDPOINTS } from './constants';
import * as Mock from './mock-api';

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
    analysisResult: Mock.FishAnalysisResult;
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

export type { ChatMessage } from './mock-api';

export interface SendChatResponse {
    chatId: string;
    response: string;
    timestamp: string;
}

export interface ImageRecord {
    imageId: string;
    userId: string;
    s3Path: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    analysisResult?: Mock.FishAnalysisResult;
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

function delay(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getPresignedUrl(
    fileName: string,
    fileType: string,
    latitude?: number,
    longitude?: number,
): Promise<PresignedUrlResponse> {
    if (IS_DEMO_MODE) {
        await delay(400);
        const id = `demo_${Date.now()}`;
        return { uploadUrl: '', imageId: id, s3Path: `s3://demo-bucket/uploads/${id}.jpg` };
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
            // Demo mode — simulate progress
            let pct = 0;
            const interval = setInterval(() => {
                pct = Math.min(pct + 20, 100);
                onProgress?.(pct);
                if (pct === 100) { clearInterval(interval); resolve(); }
            }, 200);
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
        const mockResult = await Mock.analyzeCatch();
        return { imageId, analysisResult: mockResult };
    }
    return apiFetch<AnalyzeImageResponse>(ENDPOINTS.analyzeImage(imageId), { method: 'POST' });
}

export async function getImages(
    limit = 20,
    lastKey?: string,
): Promise<{ items: ImageRecord[]; lastKey?: string }> {
    if (IS_DEMO_MODE) {
        await delay(600);
        return Mock.getMockImages() as any;
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (lastKey) params.set('lastKey', lastKey);
    return apiFetch(`${ENDPOINTS.getImages}?${params}`);
}

export async function getMapData(
    filters?: { species?: string; from?: string; to?: string },
): Promise<MapDataResponse> {
    if (IS_DEMO_MODE) {
        await delay(500);
        return Mock.getMockMapData();
    }
    const params = new URLSearchParams();
    if (filters?.species) params.set('species', filters.species);
    const query = params.toString() ? `?${params}` : '';
    return apiFetch(`${ENDPOINTS.getMapData}${query}`);
}

export async function sendChat(message: string): Promise<SendChatResponse> {
    if (IS_AGENT_CONFIGURED) {
        return agentFetch<SendChatResponse>('/chat', {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
    }
    if (IS_DEMO_MODE) {
        const response = await Mock.getChatbotResponse(message);
        return { chatId: `demo_${Date.now()}`, response, timestamp: new Date().toISOString() };
    }
    return apiFetch<SendChatResponse>(ENDPOINTS.sendChat, {
        method: 'POST',
        body: JSON.stringify({ message }),
    });
}

export async function getChatHistory(limit = 30): Promise<Mock.ChatMessage[]> {
    if (IS_AGENT_CONFIGURED) {
        return agentFetch<Mock.ChatMessage[]>(`/chat?limit=${limit}`);
    }
    if (IS_DEMO_MODE) {
        await delay(400);
        return Mock.getMockChatHistory();
    }
    return apiFetch<Mock.ChatMessage[]>(`${ENDPOINTS.getChatHistory}?limit=${limit}`);
}

export async function getAnalytics(): Promise<AnalyticsResponse> {
    if (IS_DEMO_MODE) {
        await delay(700);
        return Mock.getMockAnalytics();
    }
    return apiFetch<AnalyticsResponse>(ENDPOINTS.getAnalytics);
}

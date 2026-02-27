/**
 * Typed API client for OceanAI backend (AWS API Gateway → Lambda).
 *
 * Demo mode: When NEXT_PUBLIC_API_URL is not set, every function returns
 * realistic mock data so the UI works without a deployed backend.
 *
 * Real mode: Injects the Cognito JWT (or demo token) as a Bearer token,
 * calls the real Lambda endpoints, and throws typed ApiError on failure.
 */

import { API_BASE_URL, DEMO_JWT, IS_DEMO_MODE, ENDPOINTS } from "./constants";
import * as Mock from "./mock-api";

// ── Types ─────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message);
        this.name = "ApiError";
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

export interface ChatMessage {
    chatId: string;
    userId: string;
    message: string;
    response: string;
    timestamp: string;
}

export interface SendChatResponse {
    chatId: string;
    response: string;
    timestamp: string;
}

export interface ImageRecord {
    imageId: string;
    userId: string;
    s3Path: string;
    status: "pending" | "processing" | "completed" | "failed";
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

/**
 * Get the current auth token.
 * This reads from localStorage (set by auth-context) or falls back to demo token.
 */
function getToken(): string {
    if (typeof window === "undefined") return DEMO_JWT;
    return localStorage.getItem("ocean_ai_token") || DEMO_JWT;
}

async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
        ...(options.headers as Record<string, string>),
    };

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
        let message = `API error ${res.status}`;
        try {
            const body = await res.json();
            message = body.message || body.error || message;
        } catch {
            // ignore parse error
        }
        throw new ApiError(res.status, message);
    }

    return res.json() as Promise<T>;
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Request a presigned S3 URL for direct client-side upload.
 */
export async function getPresignedUrl(
    fileName: string,
    fileType: string,
    latitude?: number,
    longitude?: number
): Promise<PresignedUrlResponse> {
    if (IS_DEMO_MODE) {
        await delay(400);
        const id = `demo_${Date.now()}`;
        return {
            uploadUrl: "",
            imageId: id,
            s3Path: `s3://demo-bucket/uploads/${id}.jpg`,
        };
    }
    return apiFetch<PresignedUrlResponse>(ENDPOINTS.presignedUrl, {
        method: "POST",
        body: JSON.stringify({ fileName, fileType, latitude, longitude }),
    });
}

/**
 * Upload a file directly to S3 via the presigned URL.
 * Accepts an optional `onProgress` callback (0–100).
 */
export function uploadToS3(
    url: string,
    file: File,
    onProgress?: (pct: number) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!url) {
            // Demo mode — simulate upload
            let pct = 0;
            const interval = setInterval(() => {
                pct = Math.min(pct + 20, 100);
                onProgress?.(pct);
                if (pct === 100) {
                    clearInterval(interval);
                    resolve();
                }
            }, 200);
            return;
        }
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("S3 upload network error"));
        xhr.send(file);
    });
}

/**
 * Trigger ML analysis on an already-uploaded image.
 */
export async function analyzeImage(imageId: string): Promise<AnalyzeImageResponse> {
    if (IS_DEMO_MODE) {
        const mockResult = await Mock.analyzeCatch(new File([], "demo.jpg"));
        return { imageId, analysisResult: mockResult };
    }
    return apiFetch<AnalyzeImageResponse>(ENDPOINTS.analyzeImage(imageId), {
        method: "POST",
    });
}

/**
 * Fetch the current user's catch images (paginated).
 */
export async function getImages(limit = 20, lastKey?: string): Promise<{ items: ImageRecord[]; lastKey?: string }> {
    if (IS_DEMO_MODE) {
        await delay(600);
        return Mock.getMockImages();
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (lastKey) params.set("lastKey", lastKey);
    return apiFetch(`${ENDPOINTS.getImages}?${params}`);
}

/**
 * Fetch map markers (user catch locations with lat/lng).
 */
export async function getMapData(filters?: { species?: string; from?: string; to?: string }): Promise<MapDataResponse> {
    if (IS_DEMO_MODE) {
        await delay(500);
        return Mock.getMockMapData();
    }
    const params = new URLSearchParams();
    if (filters?.species) params.set("species", filters.species);
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    const query = params.toString() ? `?${params}` : "";
    return apiFetch(`${ENDPOINTS.getMapData}${query}`);
}

/**
 * Send a chat message and receive an AI response.
 */
export async function sendChat(message: string): Promise<SendChatResponse> {
    if (IS_DEMO_MODE) {
        const response = await Mock.getChatbotResponse(message);
        return { chatId: `demo_${Date.now()}`, response, timestamp: new Date().toISOString() };
    }
    return apiFetch<SendChatResponse>(ENDPOINTS.sendChat, {
        method: "POST",
        body: JSON.stringify({ message }),
    });
}

/**
 * Fetch chat history for the current user.
 */
export async function getChatHistory(limit = 30): Promise<ChatMessage[]> {
    if (IS_DEMO_MODE) {
        await delay(400);
        return Mock.getMockChatHistory();
    }
    return apiFetch<ChatMessage[]>(`${ENDPOINTS.getChatHistory}?limit=${limit}`);
}

/**
 * Fetch analytics summary for the current user.
 */
export async function getAnalytics(): Promise<AnalyticsResponse> {
    if (IS_DEMO_MODE) {
        await delay(700);
        return Mock.getMockAnalytics();
    }
    return apiFetch<AnalyticsResponse>(ENDPOINTS.getAnalytics);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function delay(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

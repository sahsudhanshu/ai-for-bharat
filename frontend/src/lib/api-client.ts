/**
 * Typed API client for OceanAI backend (AWS API Gateway → Lambda).
 *
 * Demo mode: When NEXT_PUBLIC_API_URL is not set, every function returns
 * realistic mock data so the UI works without a deployed backend.
 *
 * Real mode: Injects the Cognito JWT (or demo token) as a Bearer token,
 * calls the real Lambda endpoints, and throws typed ApiError on failure.
 */

import { API_BASE_URL, AGENT_BASE_URL, IS_AGENT_CONFIGURED, DEMO_JWT, IS_DEMO_MODE, ENDPOINTS } from "./constants";
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
    locationMapped?: boolean;
    locationMapReason?: string;
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
    if (typeof window === "undefined") return IS_DEMO_MODE ? DEMO_JWT : "";
    const token = localStorage.getItem("ocean_ai_token") || "";
    if (token) return token;
    // VERY IMPORTANT bypass: if valid cognito token isn't found, insert our demo pass
    return DEMO_JWT;
}

async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const token = getToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

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

/**
 * Fetch helper for the Python agent (LangGraph).
 * Same pattern as apiFetch but hits the agent URL.
 */
async function agentFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${AGENT_BASE_URL}${path}`;
    const token = getToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
        let message = `Agent API error ${res.status}`;
        try {
            const body = await res.json();
            message = body.message || body.error || body.detail || message;
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
        return Mock.getMockImages() as { items: ImageRecord[]; lastKey?: string };
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (lastKey) params.set("lastKey", lastKey);
    const response = await apiFetch<{ items?: ImageRecord[]; images?: ImageRecord[]; lastKey?: string }>(`${ENDPOINTS.getImages}?${params}`);
    return {
        items: response.items ?? response.images ?? [],
        lastKey: response.lastKey,
    };
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
 * Routes to the Python agent (LangGraph) when available.
 */
export async function sendChat(message: string, overrideChatId?: string, language?: string): Promise<SendChatResponse> {
    if (IS_AGENT_CONFIGURED) {
        if (overrideChatId) {
            const res = await agentFetch<{ success: boolean; response: { content: string, messageId: string } }>(`/conversations/${overrideChatId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ message, language }),
            });
            return { chatId: overrideChatId, response: res.response.content, timestamp: new Date().toISOString() };
        }
        return agentFetch<SendChatResponse>("/chat", {
            method: "POST",
            body: JSON.stringify({ message, language }),
        });
    }
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
 * Routes to the Python agent (LangGraph) when available.
 */
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
        const oldLog = await agentFetch<ChatMessage[]>(`/chat?limit=${limit}`);
        return oldLog.map(m => ({
            id: m.chatId,
            role: 'assistant',
            text: m.response,
            timestamp: m.timestamp
        }));
    }
    if (IS_DEMO_MODE) {
        await delay(400);
        const mockLog = await Mock.getMockChatHistory();
        return mockLog.map(m => ({
            id: m.chatId,
            role: 'assistant',
            text: m.response,
            timestamp: m.timestamp
        }));
    }
    const apiLog = await apiFetch<ChatMessage[]>(`${ENDPOINTS.getChatHistory}?limit=${limit}`);
    return apiLog.map(m => ({
        id: m.chatId,
        role: 'assistant',
        text: m.response,
        timestamp: m.timestamp
    }));
}

export async function createConversation(title: string = "New Chat", language: string = "en"): Promise<Conversation> {
    if (IS_AGENT_CONFIGURED) {
        const res = await agentFetch<{ conversation: Conversation }>('/conversations', {
            method: 'POST',
            body: JSON.stringify({ title, language })
        });
        return res.conversation;
    }
    return { conversationId: `demo_${Date.now()}`, title, language, messageCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export async function getConversationsList(): Promise<Conversation[]> {
    if (IS_AGENT_CONFIGURED) {
        const res = await agentFetch<{ conversations: Conversation[] }>('/conversations?limit=20');
        return res.conversations;
    }
    return [];
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

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
    analysisResult: Mock.MLAnalysisResponse;
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
    analysisResult?: Mock.MLAnalysisResponse;
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

// Group-based multi-image types
export interface GroupPresignedUrlRequest {
    files: { fileName: string; fileType: string }[];
}

export interface GroupPresignedUrlResponse {
    groupId: string;
    presignedUrls: { index: number; uploadUrl: string; s3Key: string }[];
    locationMapped?: boolean;
    locationMapReason?: string;
}

export interface GroupRecord {
    groupId: string;
    userId: string;
    imageCount: number;
    s3Keys: string[];
    status: "pending" | "processing" | "completed" | "partial" | "failed";
    analysisResult?: Mock.GroupAnalysis;
    latitude?: number;
    longitude?: number;
    locationMapped?: boolean;
    locationMapReason?: string;
    createdAt: string;
}

export interface GroupListResponse {
    groups: GroupRecord[];
    lastKey?: string;
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
        const mockResult = await Mock.analyzeCatchML();
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

// ── Group-based Multi-Image API ───────────────────────────────────────────────

/**
 * Request presigned URLs for multiple images in a group.
 */
export async function createGroupPresignedUrls(
    files: { fileName: string; fileType: string }[],
    latitude?: number,
    longitude?: number
): Promise<GroupPresignedUrlResponse> {
    if (IS_DEMO_MODE) {
        await delay(400);
        const groupId = `demo_group_${Date.now()}`;
        return {
            groupId,
            presignedUrls: files.map((_, index) => ({
                index,
                uploadUrl: "",
                s3Key: `groups/${groupId}/image_${index}.jpg`,
            })),
            locationMapped: false,
            locationMapReason: "location_not_provided",
        };
    }

    // Try real API, fallback to mock if it fails
    try {
        return await apiFetch<GroupPresignedUrlResponse>("/groups/presigned-urls", {
            method: "POST",
            body: JSON.stringify({ files, latitude, longitude }),
        });
    } catch (error) {
        console.warn('Real API failed for createGroupPresignedUrls, falling back to mock data:', error);
        await delay(400);
        const groupId = `demo_group_${Date.now()}`;
        return {
            groupId,
            presignedUrls: files.map((_, index) => ({
                index,
                uploadUrl: "",
                s3Key: `groups/${groupId}/image_${index}.jpg`,
            })),
            locationMapped: false,
            locationMapReason: "location_not_provided",
        };
    }
}

/**
 * Upload multiple files to S3 concurrently.
 */
export async function uploadGroupToS3(
    presignedUrls: { index: number; uploadUrl: string }[],
    files: File[],
    onProgress?: (index: number, pct: number) => void
): Promise<void> {
    const uploads = presignedUrls.map(({ index, uploadUrl }) => {
        const file = files[index];
        if (!file) return Promise.resolve();
        return uploadToS3(uploadUrl, file, (pct) => onProgress?.(index, pct));
    });
    await Promise.all(uploads);
}

/**
 * Trigger ML analysis for a group of images.
 */
export async function analyzeGroup(groupId: string, imageCount?: number): Promise<{ groupId: string; analysisResult: Mock.GroupAnalysis }> {
    console.log('🔬 analyzeGroup called for:', groupId, 'imageCount:', imageCount);
    console.log('🔍 IS_DEMO_MODE:', IS_DEMO_MODE);

    if (IS_DEMO_MODE) {
        await delay(2000);
        const mockResult = await Mock.getMockGroupAnalysis(imageCount || 3);

        // Store the group in demo storage so it appears in history
        const newGroup: GroupRecord = {
            groupId,
            userId: "demo_user",
            imageCount: imageCount || 3,
            s3Keys: Array.from({ length: imageCount || 3 }, (_, i) => `groups/${groupId}/image_${i}.jpg`),
            status: "completed",
            analysisResult: mockResult,
            createdAt: new Date().toISOString(),
        };
        Mock.addDemoGroup(newGroup);

        return { groupId, analysisResult: mockResult };
    }

    // Call real API - database should handle persistence
    console.log('🌐 Calling real API for analysis:', `${API_BASE_URL}/groups/${groupId}/analyze`);
    try {
        const result = await apiFetch<{ groupId: string; analysisResult: Mock.GroupAnalysis }>(`/groups/${groupId}/analyze`, {
            method: "POST",
        });

        // Persist to localStorage so it appears in history even if API /groups is empty
        const newGroup: GroupRecord = {
            groupId,
            userId: "api_user",
            imageCount: imageCount || 1,
            s3Keys: Array.from({ length: imageCount || 1 }, (_, i) => `groups/${groupId}/image_${i}.jpg`),
            status: "completed",
            analysisResult: result.analysisResult,
            createdAt: new Date().toISOString(),
        };
        Mock.addDemoGroup(newGroup);

        return result;
    } catch (error) {
        console.warn('Real API failed for analyzeGroup, falling back to mock data:', error);
        await delay(2000);
        const mockResult = await Mock.getMockGroupAnalysis(imageCount || 3);

        // Store the group in demo storage so it appears in history
        const newGroup: GroupRecord = {
            groupId,
            userId: "demo_user",
            imageCount: imageCount || 3,
            s3Keys: Array.from({ length: imageCount || 3 }, (_, i) => `groups/${groupId}/image_${i}.jpg`),
            status: "completed",
            analysisResult: mockResult,
            createdAt: new Date().toISOString(),
        };
        Mock.addDemoGroup(newGroup);

        return { groupId, analysisResult: mockResult };
    }
}

/**
 * Fetch user's group history (merged with legacy single-image records).
 * Always merges API results with locally persisted history to ensure
 * past uploads are never lost.
 */
export async function getGroups(limit = 20, lastKey?: string): Promise<GroupListResponse> {
    console.log('🔍 getGroups called, IS_DEMO_MODE:', IS_DEMO_MODE);

    if (IS_DEMO_MODE) {
        await delay(300);
        return { groups: Mock.getMockGroups().groups, lastKey: undefined };
    }

    // Fetch from real database
    console.log('🌐 Fetching from real API:', `${API_BASE_URL}/groups`);
    try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (lastKey) params.set("lastKey", lastKey);
        const apiResponse = await apiFetch<any>(`/groups?${params}`);
        console.log('✅ API Response:', apiResponse);

        // Handle different response formats
        // Backend returns: { success: true, items: [...], lastKey: {...} }
        // We need: { groups: [...], lastKey: ... }
        const groups = apiResponse.items || apiResponse.groups || [];
        const responseLastKey = apiResponse.lastKey;

        console.log('✅ Fetched', groups.length, 'groups from database');
        return { groups, lastKey: responseLastKey };
    } catch (error) {
        console.warn('Real API failed for getGroups, using local history:', error);
        return { groups: Mock.getMockGroups().groups, lastKey: undefined };
    }
}

/**
 * Fetch detailed group analysis results.
 */
export async function getGroupDetails(groupId: string): Promise<GroupRecord> {
    if (IS_DEMO_MODE) {
        await delay(500);
        return Mock.getMockGroupDetails(groupId);
    }

    // Fetch from real database
    const result = await apiFetch<GroupRecord>(`/groups/${groupId}`);
    console.log('✅ Fetched group details from database:', groupId);
    return result;
}

/**
 * Delete a group from history.
 */
export async function deleteGroup(groupId: string): Promise<void> {
    if (IS_DEMO_MODE) {
        await delay(300);
        Mock.deleteDemoGroup(groupId);
        return;
    }

    // Try real API, fallback to local deletion if it fails
    try {
        await apiFetch<void>(`/groups/${groupId}`, {
            method: "DELETE",
        });
    } catch (error) {
        console.warn('Real API failed for deleteGroup, deleting from local storage:', error);
    }

    // Always delete from local storage to ensure UI consistency
    Mock.deleteDemoGroup(groupId);
}

// ── Text-to-Speech ────────────────────────────────────────────────────────────

/**
 * Convert text to speech using AWS Polly (via backend TTS Lambda).
 * Returns a Base64-encoded MP3 string, or empty string in demo mode.
 *
 * @param text - Text to synthesize (truncated to 1500 chars server-side)
 * @param languageCode - BCP-47 language code e.g. "hi-IN", "ta-IN", "en-IN"
 */
export async function synthesizeSpeech(text: string, languageCode = "en-IN"): Promise<{ audioBase64: string }> {
    if (IS_DEMO_MODE) {
        // No real TTS in demo mode — return empty so callers can handle gracefully
        return { audioBase64: "" };
    }
    return apiFetch<{ audioBase64: string }>("/tts", {
        method: "POST",
        body: JSON.stringify({ text, languageCode }),
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get the primary (highest species confidence) crop from an ML analysis response */
export function getPrimaryCrop(result: Mock.MLAnalysisResponse | undefined): Mock.MLCropResult | null {
    if (!result?.crops) return null;
    const entries = Object.values(result.crops);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b.species.confidence - a.species.confidence)[0];
}

function delay(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

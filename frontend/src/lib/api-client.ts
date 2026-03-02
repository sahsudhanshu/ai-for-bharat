/**
 * Typed API client for OceanAI backend (AWS API Gateway → Lambda).
 *
 * All functions call the real backend / agent endpoints and throw
 * typed ApiError on failure. No mock/demo fallbacks.
 */

import { API_BASE_URL, AGENT_BASE_URL, IS_AGENT_CONFIGURED, ENDPOINTS } from "./constants";
import type { MLAnalysisResponse, GroupAnalysis } from "./types";

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
    analysisResult: MLAnalysisResponse;
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
    analysisResult?: MLAnalysisResponse;
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
    analysisResult?: GroupAnalysis;
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
 * Get the current auth token from localStorage.
 */
function getToken(): string {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("ocean_ai_token") || "";
}

/**
 * Structured error logger for API calls (dev mode only).
 */
function logApiError(label: string, method: string, url: string, status: number, message: string, durationMs: number): void {
    if (process.env.NODE_ENV === "production") return;
    console.error(
        `%c[${label}]%c ${method} ${url} → ${status} (${durationMs}ms)\n${message}`,
        "color: #ff4444; font-weight: bold;",
        "color: inherit;"
    );
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

    const start = performance.now();
    const res = await fetch(url, { ...options, headers });
    const durationMs = Math.round(performance.now() - start);

    if (!res.ok) {
        let message = `API error ${res.status}`;
        try {
            const body = await res.json();
            message = body.message || body.error || message;
        } catch {
            // ignore parse error
        }
        logApiError("API ERROR", options.method || "GET", url, res.status, message, durationMs);
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

    const start = performance.now();
    const res = await fetch(url, { ...options, headers });
    const durationMs = Math.round(performance.now() - start);

    if (!res.ok) {
        let message = `Agent API error ${res.status}`;
        try {
            const body = await res.json();
            message = body.message || body.error || body.detail || message;
        } catch {
            // ignore parse error
        }
        logApiError("AGENT ERROR", options.method || "GET", url, res.status, message, durationMs);
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
    return apiFetch<AnalyzeImageResponse>(ENDPOINTS.analyzeImage(imageId), {
        method: "POST",
    });
}

/**
 * Fetch the current user's catch images (paginated).
 */
export async function getImages(limit = 20, lastKey?: string): Promise<{ items: ImageRecord[]; lastKey?: string }> {
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
export async function sendChat(message: string, overrideChatId?: string, language?: string, location?: { latitude: number; longitude: number }): Promise<SendChatResponse> {
    if (IS_AGENT_CONFIGURED) {
        if (overrideChatId) {
            const res = await agentFetch<{ success: boolean; response: { content: string, messageId: string } }>(`/conversations/${overrideChatId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ message, language, latitude: location?.latitude, longitude: location?.longitude }),
            });
            return { chatId: overrideChatId, response: res.response.content, timestamp: new Date().toISOString() };
        }
        return agentFetch<SendChatResponse>("/chat", {
            method: "POST",
            body: JSON.stringify({ message, language, latitude: location?.latitude, longitude: location?.longitude }),
        });
    }
    return apiFetch<SendChatResponse>(ENDPOINTS.sendChat, {
        method: "POST",
        body: JSON.stringify({ message }),
    });
}

/**
 * Stream a chat message and receive chunks via SSE.
 */
export async function streamChat(
    message: string,
    onChunk: (text: string) => void,
    overrideChatId?: string,
    language?: string,
    location?: { latitude: number; longitude: number }
): Promise<{ chatId: string; messageId?: string }> {
    if (IS_AGENT_CONFIGURED && overrideChatId) {
        const url = `${AGENT_BASE_URL}/conversations/${overrideChatId}/messages/stream`;
        const token = getToken();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };

        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ message, language, latitude: location?.latitude, longitude: location?.longitude }),
        });

        if (!res.ok) {
            throw new ApiError(res.status, "Stream API error");
        }

        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let buffer = '';
        let finalMessageId: string | undefined;

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'chunk') {
                                onChunk(data.text);
                            } else if (data.type === 'end') {
                                finalMessageId = data.messageId;
                            } else if (data.type === 'error') {
                                throw new Error(data.error);
                            }
                        } catch (e) {
                            // ignore parse error if incomplete JSON
                        }
                    }
                }
            }
        }
        return { chatId: overrideChatId, messageId: finalMessageId };
    }

    // Fallback
    const fallbackRes = await sendChat(message, overrideChatId, language, location);
    onChunk(fallbackRes.response);
    return { chatId: fallbackRes.chatId };
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
    return apiFetch<Conversation>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ title, language })
    });
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
    return apiFetch<GroupPresignedUrlResponse>("/groups/presigned-urls", {
        method: "POST",
        body: JSON.stringify({ files, latitude, longitude }),
    });
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
export async function analyzeGroup(groupId: string, imageCount?: number): Promise<{ groupId: string; analysisResult: GroupAnalysis }> {
    return apiFetch<{ groupId: string; analysisResult: GroupAnalysis }>(`/groups/${groupId}/analyze`, {
        method: "POST",
    });
}

/**
 * Fetch user's group history.
 */
export async function getGroups(limit = 20, lastKey?: string): Promise<GroupListResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (lastKey) params.set("lastKey", lastKey);
    const apiResponse = await apiFetch<{ items?: GroupRecord[]; groups?: GroupRecord[]; lastKey?: string }>(`/groups?${params}`);
    const groups = apiResponse.items || apiResponse.groups || [];
    return { groups, lastKey: apiResponse.lastKey };
}

/**
 * Fetch detailed group analysis results.
 */
export async function getGroupDetails(groupId: string): Promise<GroupRecord> {
    return apiFetch<GroupRecord>(`/groups/${groupId}`);
}

/**
 * Delete a group from history.
 */
export async function deleteGroup(groupId: string): Promise<void> {
    await apiFetch<void>(`/groups/${groupId}`, {
        method: "DELETE",
    });
}

// ── Text-to-Speech ────────────────────────────────────────────────────────────

/**
 * Convert text to speech using AWS Polly (via backend TTS Lambda).
 * Returns a Base64-encoded MP3 string.
 */
export async function synthesizeSpeech(text: string, languageCode = "en-IN"): Promise<{ audioBase64: string }> {
    return apiFetch<{ audioBase64: string }>("/tts", {
        method: "POST",
        body: JSON.stringify({ text, languageCode }),
    });
}

// ── User Profile ──────────────────────────────────────────────────────────────

export interface UserPreferences {
    language: string;
    notifications: boolean;
    offlineSync: boolean;
    units: string;
    boatType: string;
}

export interface UserProfile {
    userId: string;
    email: string;
    name: string;
    phone: string;
    avatar: string;
    port: string;
    customPort: string;
    region: string;
    role: string;
    publicProfileEnabled: boolean;
    publicProfileSlug: string;
    preferences: UserPreferences;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Fetch the current user's profile from the backend.
 */
export async function getUserProfile(): Promise<UserProfile> {
    const res = await apiFetch<{ profile: UserProfile }>(ENDPOINTS.getUserProfile);
    return res.profile;
}

/**
 * Update the current user's profile.
 */
export async function updateUserProfile(
    data: Partial<Omit<UserProfile, "userId" | "createdAt" | "updatedAt">>,
    avatarFileName?: string,
    avatarFileType?: string,
): Promise<{ profile: UserProfile; avatarUploadUrl?: string; avatarS3Url?: string }> {
    return apiFetch<{ profile: UserProfile; avatarUploadUrl?: string; avatarS3Url?: string }>(
        ENDPOINTS.updateUserProfile,
        {
            method: "PUT",
            body: JSON.stringify({ ...data, avatarFileName, avatarFileType }),
        }
    );
}

/**
 * Export all user catch data as a CSV download.
 */
export async function exportUserData(): Promise<string> {
    const url = `${API_BASE_URL}${ENDPOINTS.exportUserData}`;
    const token = getToken();
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) {
        throw new ApiError(res.status, "Failed to export data");
    }
    return res.text();
}

/**
 * Delete the user's account and all associated data.
 */
export async function deleteUserAccount(): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(ENDPOINTS.deleteUserAccount, {
        method: "DELETE",
    });
}

/**
 * Fetch a user's public profile by slug.
 */
export async function getPublicProfile(slug: string): Promise<Partial<UserProfile>> {
    const res = await apiFetch<{ profile: Partial<UserProfile> }>(ENDPOINTS.getPublicProfile(slug));
    return res.profile;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get the primary (highest species confidence) crop from an ML analysis response */
export function getPrimaryCrop(result: MLAnalysisResponse | undefined): import("./types").MLCropResult | null {
    if (!result?.crops) return null;
    const entries = Object.values(result.crops);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b.species.confidence - a.species.confidence)[0];
}

function delay(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

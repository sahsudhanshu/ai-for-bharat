/**
 * API client for OceanAI backend — React Native port of the web api-client.ts
 * Uses AsyncStorage for token management. Demo mode when EXPO_PUBLIC_API_URL not set.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  API_BASE_URL,
  AGENT_BASE_URL,
  IS_AGENT_CONFIGURED,
  DEMO_JWT,
  IS_DEMO_MODE,
  ENDPOINTS,
} from "./constants";
import { handleApiError } from "./error-handler";
import type {
  FishAnalysisResult,
  ChatMessage,
  GroupAnalysis,
  UserProfile,
  PublicProfile,
  UserPreferences,
} from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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

// ── Group-based Multi-Image Types ────────────────────────────────────────────

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
  presignedViewUrls?: string[];
  status: "pending" | "processing" | "completed" | "partial" | "failed";
  analysisResult?: GroupAnalysis;
  latitude?: number;
  longitude?: number;
  locationMapped?: boolean;
  locationMapReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GroupListResponse {
  groups: GroupRecord[];
  lastKey?: string;
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

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  language: "en",
  notifications: true,
  offlineSync: true,
  units: "kg",
};

const DEFAULT_PUBLIC_PROFILE: PublicProfile = {
  slug: "profile-unavailable",
  userId: "unknown",
  name: "Anonymous Fisher",
  role: "Fisherman",
  port: "Unknown",
  isPublic: false,
  showStats: false,
  createdAt: new Date().toISOString(),
};

export type { ChatMessage } from "./types";

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
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface UnifiedMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface ImageRecord {
  imageId: string;
  userId: string;
  s3Path: string;
  status: "pending" | "processing" | "completed" | "failed";
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
    const token = await AsyncStorage.getItem("ocean_ai_token");
    if (!token) {
      console.warn("No token found in AsyncStorage, using demo JWT");
    }
    return token || DEMO_JWT;
  } catch (error) {
    console.error("Failed to retrieve token from AsyncStorage:", error);
    return DEMO_JWT;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  try {
    const token = await getToken();
    const url = `${API_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    };

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      let message = `API error ${res.status}`;
      try {
        const body = await res.json();
        message = body.message || body.error || message;
      } catch {
        /* ignore */
      }
      const error = new ApiError(res.status, message);
      await handleApiError(error);
      throw error; // This line won't be reached if handleApiError redirects
    }

    return res.json() as Promise<T>;
  } catch (error) {
    await handleApiError(error);
    throw error;
  }
}

/**
 * Fetch helper for the Python agent (LangGraph).
 * Same pattern as apiFetch but hits the agent URL.
 */
async function agentFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  try {
    const token = await getToken();
    const url = `${AGENT_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    };

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      let message = `Agent API error ${res.status}`;
      try {
        const body = await res.json();
        message = body.message || body.error || body.detail || message;
      } catch {
        /* ignore */
      }
      const error = new ApiError(res.status, message);
      await handleApiError(error);
      throw error;
    }

    return res.json() as Promise<T>;
  } catch (error) {
    await handleApiError(error);
    throw error;
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function getPresignedUrl(
  fileName: string,
  fileType: string,
  latitude?: number,
  longitude?: number,
): Promise<PresignedUrlResponse> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable uploads.",
    );
  }
  return apiFetch<PresignedUrlResponse>(ENDPOINTS.presignedUrl, {
    method: "POST",
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
      reject(
        new Error("No upload URL provided. Backend API may not be configured."),
      );
      return;
    }
    // Real S3 upload using React Native fetch
    fetch(fileUri)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Failed to read file: ${r.status}`);
        }
        return r.blob();
      })
      .then((blob) =>
        fetch(url, {
          method: "PUT",
          headers: { "Content-Type": fileType },
          body: blob,
        }),
      )
      .then((res) => {
        if (res.ok) {
          onProgress?.(100);
          resolve();
        } else {
          reject(new Error(`S3 upload failed: ${res.status}`));
        }
      })
      .catch((error) => {
        reject(new Error(`Upload error: ${error.message || "Unknown error"}`));
      });
  });
}

export async function analyzeImage(
  imageId: string,
): Promise<AnalyzeImageResponse> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable cloud analysis.",
    );
  }
  return apiFetch<AnalyzeImageResponse>(ENDPOINTS.analyzeImage(imageId), {
    method: "POST",
  });
}

/**
 * Analyze image using ML API (returns raw ML response with crops, gradcam, etc.)
 */
export async function analyzeImageML(imageId: string): Promise<MLApiResponse> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable ML analysis.",
    );
  }
  return apiFetch<MLApiResponse>(ENDPOINTS.analyzeImage(imageId), {
    method: "POST",
  });
}

/**
 * Convert ML API response to FishAnalysisResult (uses first/best crop)
 */
export function mlResponseToAnalysisResult(
  mlResponse: MLApiResponse,
): FishAnalysisResult {
  const crops = Object.values(mlResponse.crops);
  if (crops.length === 0) {
    throw new Error("No fish detected in image");
  }

  // Use the crop with highest YOLO confidence
  const bestCrop = crops.reduce((best, curr) =>
    curr.yolo_confidence > best.yolo_confidence ? curr : best,
  );

  // Weight and price are not available from the ML API — mark as unavailable (0)
  const estimatedWeight = 0;
  const estimatedPricePerKg = 0;
  const estimatedLength = 0;
  const minLegalSize = 150;

  return {
    species: bestCrop.species.label,
    scientificName: "",
    confidence: bestCrop.species.confidence,
    measurements: {
      length_mm: 0,
      weight_g: 0,
      width_mm: 0,
    },
    qualityGrade:
      bestCrop.disease.label === "Healthy Fish" ? "Premium" : "Standard",
    marketEstimate: {
      price_per_kg: 0,
      estimated_value: 0,
    },
    compliance: {
      is_legal_size: false,
      min_legal_size_mm: minLegalSize,
    },
    isSustainable: bestCrop.disease.label === "Healthy Fish",
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
  if (lastKey) params.set("lastKey", lastKey);
  return apiFetch(`${ENDPOINTS.getImages}?${params}`);
}

export async function getMapData(filters?: {
  species?: string;
  from?: string;
  to?: string;
}): Promise<MapDataResponse> {
  if (IS_DEMO_MODE) {
    return { markers: [] };
  }
  const params = new URLSearchParams();
  if (filters?.species) params.set("species", filters.species);
  const query = params.toString() ? `?${params}` : "";
  return apiFetch(`${ENDPOINTS.getMapData}${query}`);
}

export async function sendChat(
  message: string,
  overrideChatId?: string,
  language?: string,
): Promise<SendChatResponse> {
  if (IS_AGENT_CONFIGURED) {
    if (overrideChatId) {
      const res = await agentFetch<{
        success: boolean;
        response: { content: string; messageId: string };
      }>(`/conversations/${overrideChatId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message, language }),
      });
      return {
        chatId: overrideChatId,
        response: res.response.content,
        timestamp: new Date().toISOString(),
      };
    }
    return agentFetch<SendChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, language }),
    });
  }
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Chat is not available. Configure EXPO_PUBLIC_AGENT_URL or EXPO_PUBLIC_API_URL.",
    );
  }
  return apiFetch<SendChatResponse>(ENDPOINTS.sendChat, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function getChatHistory(
  limit = 30,
  overrideChatId?: string,
): Promise<UnifiedMessage[]> {
  if (IS_AGENT_CONFIGURED) {
    if (overrideChatId) {
      const res = await agentFetch<{ messages: ConversationMessage[] }>(
        `/conversations/${overrideChatId}/messages?limit=${limit}`,
      );
      return res.messages.map((m) => ({
        id: m.messageId,
        role: m.role,
        text: m.content,
        timestamp: m.timestamp,
      }));
    }
    // Fallback for old /chat endpoint
    const oldLog = await agentFetch<ChatMessage[]>(`/chat?limit=${limit}`);
    return oldLog.map((m) => ({
      id: m.chatId,
      role: "assistant" as const,
      text: m.response,
      timestamp: m.timestamp,
    }));
  }
  if (IS_DEMO_MODE) {
    return [];
  }
  const apiLog = await apiFetch<ChatMessage[]>(
    `${ENDPOINTS.getChatHistory}?limit=${limit}`,
  );
  return apiLog.map((m) => ({
    id: m.chatId,
    role: "assistant" as const,
    text: m.response,
    timestamp: m.timestamp,
  }));
}

export async function synthesizeSpeech(
  text: string,
  languageCode: string,
): Promise<{ audioBase64: string }> {
  if (IS_DEMO_MODE) {
    return { audioBase64: "" };
  }
  return apiFetch<{ audioBase64: string }>("/tts", {
    method: "POST",
    body: JSON.stringify({ text, languageCode }),
  });
}

export async function createConversation(
  title: string = "New Chat",
  language: string = "en",
): Promise<Conversation> {
  if (IS_AGENT_CONFIGURED) {
    const res = await agentFetch<{ conversation: Conversation }>(
      "/conversations",
      {
        method: "POST",
        body: JSON.stringify({ title, language }),
      },
    );
    return res.conversation;
  }
  throw new ApiError(
    0,
    "Chat is not available. Configure EXPO_PUBLIC_AGENT_URL.",
  );
}

export async function getConversationsList(): Promise<Conversation[]> {
  if (IS_AGENT_CONFIGURED) {
    const res = await agentFetch<{ conversations: Conversation[] }>(
      "/conversations?limit=20",
    );
    return res.conversations;
  }
  return [];
}

export async function getAnalytics(): Promise<AnalyticsResponse> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Analytics not available. Backend API is not configured.",
    );
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
  longitude?: number,
): Promise<GroupPresignedUrlResponse> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable group uploads.",
    );
  }
  return apiFetch<GroupPresignedUrlResponse>("/groups/presigned-urls", {
    method: "POST",
    body: JSON.stringify({ files, latitude, longitude }),
  });
}

/**
 * Upload multiple files to S3 concurrently via presigned URLs.
 */
export async function uploadGroupToS3(
  presignedUrls: { index: number; uploadUrl: string }[],
  fileUris: string[],
  fileTypes: string[],
  onProgress?: (index: number, pct: number) => void,
): Promise<void> {
  const uploads = presignedUrls.map(({ index, uploadUrl }) => {
    const fileUri = fileUris[index];
    const fileType = fileTypes[index];
    if (!fileUri) return Promise.resolve();
    return uploadToS3(uploadUrl, fileUri, fileType, (pct) =>
      onProgress?.(index, pct),
    );
  });
  await Promise.all(uploads);
}

/**
 * Trigger ML analysis for a group of images.
 */
export async function analyzeGroup(
  groupId: string,
): Promise<{ groupId: string; analysisResult: GroupAnalysis }> {
  if (IS_DEMO_MODE) {
    throw new ApiError(
      0,
      "Backend API is not configured. Set EXPO_PUBLIC_API_URL to enable group analysis.",
    );
  }
  return apiFetch<{ groupId: string; analysisResult: GroupAnalysis }>(
    `/groups/${groupId}/analyze`,
    {
      method: "POST",
    },
  );
}

/**
 * Fetch user's group history.
 */
export async function getGroups(
  limit = 20,
  lastKey?: string,
): Promise<GroupListResponse> {
  if (IS_DEMO_MODE) {
    return { groups: [] };
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (lastKey) params.set("lastKey", lastKey);
  
  // Backend returns { items: [...], lastKey?: string }
  const apiResponse = await apiFetch<{
    items: GroupRecord[];
    lastKey?: string;
  }>(`/groups?${params}`);
  
  // Map items to groups for consistency with frontend
  return { 
    groups: apiResponse.items || [], 
    lastKey: apiResponse.lastKey 
  };
}

/**
 * Fetch detailed group analysis results.
 */
export async function getGroupDetails(groupId: string): Promise<GroupRecord> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Backend API is not configured.");
  }
  return apiFetch<GroupRecord>(`/groups/${groupId}`);
}

/**
 * Delete a group from history.
 */
export async function deleteGroup(groupId: string): Promise<void> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Backend API is not configured.");
  }
  await apiFetch<void>(`/groups/${groupId}`, {
    method: "DELETE",
  });
}

// ── Avatar Management API ─────────────────────────────────────────────────────

/**
 * Get presigned URL for avatar upload
 */
export async function getAvatarPresignedUrl(
  fileName: string,
  fileType: string,
): Promise<{ uploadUrl: string; s3Key: string; avatarUrl: string }> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Avatar upload not available in demo mode");
  }
  return apiFetch("/user/avatar/presigned-url", {
    method: "POST",
    body: JSON.stringify({ fileName, fileType }),
  });
}

/**
 * Update user's avatar URL after successful upload
 */
export async function updateAvatarUrl(avatarUrl: string): Promise<void> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Avatar updates not available in demo mode");
  }
  await apiFetch("/user/avatar", {
    method: "PUT",
    body: JSON.stringify({ avatarUrl }),
  });
}

// ── Profile Management API ───────────────────────────────────────────────────

/**
 * Get user profile (includes embedded preferences)
 */
export async function getUserProfile(): Promise<UserProfile> {
  if (IS_DEMO_MODE) {
    return {
      userId: "demo-user",
      email: "demo@oceanai.com",
      name: "Demo Fisherman",
      phone: "+91 9876543210",
      port: "Mumbai",
      role: "Fisherman",
      publicProfileEnabled: false,
      preferences: {
        language: "en",
        notifications: true,
        offlineSync: true,
        units: "kg",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  
  // Backend returns { profile: {...} }
  const response = await apiFetch<{ profile: UserProfile }>("/user/profile");
  return response.profile;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  profile: Partial<UserProfile>,
): Promise<UserProfile> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Profile updates not available in demo mode");
  }
  
  // Backend returns { profile: {...} }
  const response = await apiFetch<{ profile: UserProfile }>("/user/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
  return response.profile;
}

// ── Public Profile API ────────────────────────────────────────────────────────

/**
 * Get user's public profile settings
 */
export async function getPublicProfile(): Promise<PublicProfile> {
  if (IS_DEMO_MODE) {
    return {
      slug: "demo-fisherman",
      userId: "demo-user",
      name: "Demo Fisherman",
      role: "Fisherman",
      port: "Mumbai",
      isPublic: false,
      showStats: false,
      createdAt: new Date().toISOString(),
    };
  }
  try {
    return await apiFetch<PublicProfile>("/user/public");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      console.warn(
        "Public profile not found (404). Returning default public profile.",
      );
      return DEFAULT_PUBLIC_PROFILE;
    }
    throw error;
  }
}

/**
 * Update public profile settings
 */
export async function updatePublicProfile(settings: {
  isPublic: boolean;
  showStats: boolean;
}): Promise<PublicProfile> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Public profile updates not available in demo mode");
  }
  return apiFetch<PublicProfile>("/user/public", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

/**
 * Generate a unique slug for public profile
 */
export async function generatePublicSlug(): Promise<{
  slug: string;
  url: string;
}> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Slug generation not available in demo mode");
  }
  return apiFetch<{ slug: string; url: string }>(
    "/user/public/generate-slug",
    {
      method: "POST",
    },
  );
}

/**
 * Get public profile by slug (for viewing others' profiles)
 */
export async function getPublicProfileBySlug(
  slug: string,
): Promise<PublicProfile> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Public profiles not available in demo mode");
  }
  try {
    return await apiFetch<PublicProfile>(`/user/public/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      console.warn(
        `Public profile for slug ${slug} not found (404). Returning default public profile.`,
      );
      return DEFAULT_PUBLIC_PROFILE;
    }
    throw error;
  }
}

// ── User Preferences API ──────────────────────────────────────────────────────

/**
 * Get user preferences (now embedded in profile, this is a convenience wrapper)
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  if (IS_DEMO_MODE) {
    return {
      language: "en",
      notifications: true,
      offlineSync: true,
      units: "kg",
    };
  }
  try {
    const profile = await getUserProfile();
    return profile.preferences || DEFAULT_USER_PREFERENCES;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      console.warn(
        "Preferences not found (404). Returning default preferences.",
      );
      return DEFAULT_USER_PREFERENCES;
    }
    throw error;
  }
}

/**
 * Update user preferences (updates the profile with new preferences)
 */
export async function updateUserPreferences(
  preferences: Partial<UserPreferences>,
): Promise<UserPreferences> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Preferences updates not available in demo mode");
  }
  
  // Get current profile to merge preferences
  const currentProfile = await getUserProfile();
  const updatedPreferences = {
    ...currentProfile.preferences,
    ...preferences,
  };
  
  // Update profile with new preferences
  const updatedProfile = await updateUserProfile({
    preferences: updatedPreferences,
  });
  
  return updatedProfile.preferences;
}

/**
 * Change password
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Password change not available in demo mode");
  }
  await apiFetch("/user/password", {
    method: "POST",
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

// ── Data Export API ───────────────────────────────────────────────────────────

/**
 * Export user data
 */
export async function exportUserData(
  options: import("./types").DataExportOptions,
): Promise<{ downloadUrl: string; fileSize: number }> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Data export not available in demo mode");
  }
  return apiFetch("/export/data", {
    method: "POST",
    body: JSON.stringify(options),
  });
}

// ── Account Management API ────────────────────────────────────────────────────

/**
 * Delete user account
 */
export async function deleteUserAccount(): Promise<void> {
  if (IS_DEMO_MODE) {
    throw new ApiError(0, "Account deletion not available in demo mode");
  }
  await apiFetch("/account", { method: "DELETE" });
}

// ── Weather and Ocean Data API ────────────────────────────────────────────────

/**
 * Get weather data for a location
 */
export async function getWeatherData(
  latitude: number,
  longitude: number,
): Promise<import("./types").WeatherData> {
  if (IS_DEMO_MODE) {
    return {
      location: { latitude, longitude },
      temperature: 28,
      windSpeed: 15,
      windDirection: 180,
      waveHeight: 1.5,
      visibility: 10,
      seaState: "Moderate",
      timestamp: new Date().toISOString(),
    };
  }
  return apiFetch(`/weather?lat=${latitude}&lng=${longitude}`);
}

/**
 * Get fishing zones in a region
 */
export async function getFishingZones(region: {
  latitude: number;
  longitude: number;
  radius: number;
}): Promise<import("./types").FishingZone[]> {
  if (IS_DEMO_MODE) {
    return [];
  }
  const { latitude, longitude, radius } = region;
  return apiFetch(`/zones?lat=${latitude}&lng=${longitude}&radius=${radius}`);
}

/**
 * Get disaster alerts in a region
 */
export async function getDisasterAlerts(region: {
  latitude: number;
  longitude: number;
  radius: number;
}): Promise<import("./types").DisasterAlert[]> {
  if (IS_DEMO_MODE) {
    return [];
  }
  const { latitude, longitude, radius } = region;
  return apiFetch(`/alerts?lat=${latitude}&lng=${longitude}&radius=${radius}`);
}

/**
 * Get tide data for a location
 */
export async function getTideData(
  latitude: number,
  longitude: number,
  date: string,
): Promise<{ high: string[]; low: string[] }> {
  if (IS_DEMO_MODE) {
    return {
      high: ["06:30", "18:45"],
      low: ["00:15", "12:30"],
    };
  }
  return apiFetch(`/tides?lat=${latitude}&lng=${longitude}&date=${date}`);
}

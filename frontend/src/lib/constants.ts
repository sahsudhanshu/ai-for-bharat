/**
 * App-wide constants and API configuration.
 * Set NEXT_PUBLIC_API_URL in .env.local to point to your deployed API Gateway.
 * If unset, all API calls fall back to mock data (demo mode).
 *
 * Set NEXT_PUBLIC_AGENT_URL for the Python agent (LangGraph chatbot).
 * Defaults to http://localhost:8000 for local development.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Agent (Python FastAPI) base URL — used for chat routes */
export const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8001";

/** Whether the LangGraph agent is available */
export const IS_AGENT_CONFIGURED = true;

/** Demo JWT that bypasses Cognito verification on the Lambda side */
export const DEMO_JWT = "demo_jwt_token_fisherman_001";

/** Whether we are in demo mode (no real backend configured) */
export const IS_DEMO_MODE = !API_BASE_URL;

// Log configuration on module load
if (typeof window !== 'undefined') {
    console.log('🔧 API Configuration:');
    console.log('  API_BASE_URL:', API_BASE_URL || '(not set)');
    console.log('  IS_DEMO_MODE:', IS_DEMO_MODE);
    console.log('  AGENT_BASE_URL:', AGENT_BASE_URL);
}

/** API endpoint paths */
export const ENDPOINTS = {
  presignedUrl: "/images/presigned-url",
  analyzeImage: (imageId: string) => `/images/${imageId}/analyze`,
  getImages: "/images",
  getMapData: "/map",
  sendChat: "/chat",
  getChatHistory: "/chat",
  getAnalytics: "/analytics",
} as const;

/** ML Model API base URL for resolving static asset URLs (crop images, grad-cam, etc.) */
export const ML_BASE_URL = process.env.NEXT_PUBLIC_ML_BASE_URL ?? "https://kyanmahajan-fish-pred.hf.space";

/** Resolve ML API relative URL to absolute URL */
export function resolveMLUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${ML_BASE_URL}${path}`;
}

/** App metadata */
export const APP_NAME = "OceanAI";
export const APP_TAGLINE = "AI-Powered Fisherman's Assistant";

/** Supported Indian languages */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "ml", label: "മലയാളം (Malayalam)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
  { code: "or", label: "ଓଡ଼ିଆ (Odia)" },
] as const;

/** Common fish species for filters */
export const FISH_SPECIES = [
  "Pomfret",
  "Indian Mackerel",
  "Kingfish",
  "Tuna",
  "Seer Fish",
  "Hilsa",
  "Sardine",
  "Rohu",
  "Catla",
  "Barramundi",
] as const;

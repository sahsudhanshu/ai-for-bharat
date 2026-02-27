// ── Color Palette (Dark Mode SaaS) ────────────────────────────────────────────
export const COLORS = {
  // Primary ocean blue
  primary: '#1e40af',
  primaryLight: '#3b82f6',
  primaryDark: '#0f3460',

  // Secondary forest green
  secondary: '#047857',
  secondaryLight: '#10b981',

  // Accent warm gold
  accent: '#d97706',
  accentLight: '#f59e0b',

  // Backgrounds
  bgDark: '#0f172a',
  bgCard: '#1e293b',
  bgSurface: '#334155',

  // Text
  textPrimary: '#f8fafc',
  textSecondary: '#e2e8f0',
  textMuted: '#94a3b8',
  textSubtle: '#64748b',

  // Borders
  border: '#334155',
  borderLight: '#475569',

  // Status colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Quality grades
  premium: '#10b981',
  standard: '#f59e0b',
  low: '#ef4444',

  // Transparent
  overlay: 'rgba(15, 23, 42, 0.8)',
  cardOverlay: 'rgba(30, 41, 59, 0.95)',
} as const;

// ── Typography ─────────────────────────────────────────────────────────────────
export const FONTS = {
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 28,
    '3xl': 34,
    '4xl': 42,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
};

// ── Spacing ────────────────────────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

// ── Border Radius ──────────────────────────────────────────────────────────────
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 999,
};

// ── API Configuration ──────────────────────────────────────────────────────────
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
export const AGENT_BASE_URL = process.env.EXPO_PUBLIC_AGENT_URL || '';
export const IS_AGENT_CONFIGURED = !!AGENT_BASE_URL;
export const IS_DEMO_MODE = !API_BASE_URL;
export const DEMO_JWT = 'demo_token_ocean_ai_bharat';

export const ENDPOINTS = {
  presignedUrl: '/images/presigned-url',
  analyzeImage: (id: string) => `/images/${id}/analyze`,
  getImages: '/images',
  getMapData: '/map/markers',
  sendChat: '/chat',
  getChatHistory: '/chat/history',
  getAnalytics: '/analytics',
};

// ── App Config ───────────────────────────────────────────────────────────────
export const APP_NAME = 'OceanAI';
export const APP_TAGLINE = 'AI for Bharat Fishermen';

export const FISH_SPECIES = [
  'Indian Pomfret',
  'Indian Mackerel',
  'Kingfish',
  'Yellowfin Tuna',
  'Seer Fish',
  'Hilsa Shad',
  'All Species',
];

export const INDIAN_LANGUAGES = [
  'English',
  'Hindi',
  'Marathi',
  'Gujarati',
  'Tamil',
  'Telugu',
  'Kannada',
  'Malayalam',
  'Bengali',
  'Odia',
];

// Default map center — Indian west coast
export const DEFAULT_MAP_REGION = {
  latitude: 15.5,
  longitude: 73.8,
  latitudeDelta: 8,
  longitudeDelta: 6,
};

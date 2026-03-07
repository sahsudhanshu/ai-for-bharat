/**
 * Local History Service
 *
 * Persists offline analysis results to AsyncStorage so they are visible
 * in the History tab even without an internet connection. Pending records
 * are automatically synced to the backend when connectivity is restored.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OfflineDetectionResult } from "./offline-inference";
import type { OfflineAnalysisData } from "./analysis-store";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LocalHistoryRecord {
  /** Client-generated unique ID */
  id: string;
  syncStatus: "pending" | "synced" | "failed";
  /** Remote ID returned by the backend after a successful sync */
  remoteId?: string;
  createdAt: string;
  imageUri: string;
  location?: { lat: number; lng: number } | null;
  processingTime: number;
  /** Full detection results (serialised, cropUri / gradcamUri may be stale) */
  detections: OfflineDetectionResult[];
  /** Pre-computed summary fields for fast card rendering */
  fishCount: number;
  avgConfidence: number;
  speciesDistribution: Record<string, number>;
  diseaseDetected: boolean;
}

export interface OfflineAnalysisSyncPayload {
  localId: string;
  createdAt: string;
  imageUri: string;
  location?: { lat: number; lng: number } | null;
  processingTime: number;
  fishCount: number;
  avgConfidence: number;
  speciesDistribution: Record<string, number>;
  diseaseDetected: boolean;
  detections: Array<{
    species: string;
    speciesConfidence: number;
    disease: string;
    diseaseConfidence: number;
    qualityGrade: string;
    isLegalSize: boolean;
    minLegalSize: number;
    bbox: number[];
  }>;
}

// ── Internal storage helpers ──────────────────────────────────────────────────

const STORAGE_KEY = "ocean_ai_local_history";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function computeSummary(detections: OfflineDetectionResult[]) {
  const fishCount = detections.length;
  const avgConfidence =
    fishCount > 0
      ? detections.reduce((s, d) => s + d.speciesConfidence, 0) / fishCount
      : 0;
  const speciesDistribution = detections.reduce<Record<string, number>>(
    (acc, d) => {
      acc[d.species] = (acc[d.species] || 0) + 1;
      return acc;
    },
    {},
  );
  const diseaseDetected = detections.some((d) => d.disease !== "Healthy Fish");
  return { fishCount, avgConfidence, speciesDistribution, diseaseDetected };
}

async function readAll(): Promise<LocalHistoryRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalHistoryRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(records: LocalHistoryRecord[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Persist a completed offline analysis. Returns the new record. */
export async function saveLocalAnalysis(
  data: OfflineAnalysisData,
): Promise<LocalHistoryRecord> {
  const existing = await readAll();
  const summary = computeSummary(data.offlineResults);
  const record: LocalHistoryRecord = {
    id: generateId(),
    syncStatus: "pending",
    createdAt: new Date().toISOString(),
    imageUri: data.imageUri,
    location: data.location,
    processingTime: data.processingTime,
    detections: data.offlineResults,
    ...summary,
  };
  // Newest first; keep at most 200 entries to bound storage
  await writeAll([record, ...existing].slice(0, 200));
  return record;
}

/** Return all locally stored records (pending + failed + synced). */
export async function getLocalHistory(): Promise<LocalHistoryRecord[]> {
  return readAll();
}

/** Return only records that have not yet been successfully synced. */
export async function getPendingLocalRecords(): Promise<LocalHistoryRecord[]> {
  const records = await readAll();
  return records.filter(
    (r) => r.syncStatus === "pending" || r.syncStatus === "failed",
  );
}

/** Delete a record from local storage. */
export async function deleteLocalRecord(id: string): Promise<void> {
  const records = await readAll();
  await writeAll(records.filter((r) => r.id !== id));
}

/** Mark a record as successfully synced (optionally store the remote ID). */
export async function markLocalRecordSynced(
  id: string,
  remoteId?: string,
): Promise<void> {
  const records = await readAll();
  await writeAll(
    records.map((r) =>
      r.id === id ? { ...r, syncStatus: "synced" as const, remoteId } : r,
    ),
  );
}

/** Mark a record as failed (will be retried on the next sync). */
export async function markLocalRecordFailed(id: string): Promise<void> {
  const records = await readAll();
  await writeAll(
    records.map((r) =>
      r.id === id ? { ...r, syncStatus: "failed" as const } : r,
    ),
  );
}

/**
 * Attempt to sync all pending/failed local records to the backend.
 * Called by SyncService when the device comes back online.
 */
export async function syncLocalHistory(): Promise<void> {
  const pending = await getPendingLocalRecords();
  if (pending.length === 0) return;

  // Dynamic import avoids a circular dep with api-client
  const { saveOfflineAnalysis } = await import("./api-client");

  for (const record of pending) {
    try {
      const payload: OfflineAnalysisSyncPayload = {
        localId: record.id,
        createdAt: record.createdAt,
        imageUri: record.imageUri,
        location: record.location,
        processingTime: record.processingTime,
        fishCount: record.fishCount,
        avgConfidence: record.avgConfidence,
        speciesDistribution: record.speciesDistribution,
        diseaseDetected: record.diseaseDetected,
        detections: record.detections.map((d) => ({
          species: d.species,
          speciesConfidence: d.speciesConfidence,
          disease: d.disease,
          diseaseConfidence: d.diseaseConfidence,
          qualityGrade: d.qualityGrade,
          isLegalSize: d.isLegalSize,
          minLegalSize: d.minLegalSize,
          bbox: d.bbox,
        })),
      };
      const result = await saveOfflineAnalysis(payload);
      await markLocalRecordSynced(record.id, result?.remoteId);
    } catch {
      await markLocalRecordFailed(record.id);
    }
  }
}

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

export interface LocalDetection {
  species: string;
  speciesConfidence: number;
  disease: string;
  diseaseConfidence: number;
  qualityGrade: string;
  isLegalSize: boolean;
  minLegalSize: number;
  bbox: number[];
  weightG: number;
  lengthMm: number;
  pricePerKg: number;
  estimatedValue: number;
}

/** One image inside a group offline session */
export interface LocalGroupImage {
  /** Client-generated ID for this individual image */
  localImageId: string;
  /** Local file URI — used to upload to S3 on sync */
  imageUri: string;
  fileType: string;
  detections: LocalDetection[];
}

export interface LocalHistoryRecord {
  /** Client-generated unique ID for the session */
  id: string;
  /** "single" = one image, "group" = batch of images */
  sessionType: "single" | "group";
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  /** Remote ID returned by backend after successful sync */
  remoteId?: string;
  createdAt: string;
  location?: { lat: number; lng: number } | null;
  processingTime: number;

  // ── Single-image fields ───────────────────────────────────────────
  /** Only present when sessionType == "single" */
  imageUri?: string;
  fileType?: string;
  /** Full detection results */
  detections?: LocalDetection[];

  // ── Group fields ──────────────────────────────────────────────────
  /** Only present when sessionType == "group" */
  images?: LocalGroupImage[];

  // ── Pre-computed summary (both types) ────────────────────────────
  fishCount: number;
  avgConfidence: number;
  speciesDistribution: Record<string, number>;
  diseaseDetected: boolean;
}

// ── Backward-compat alias used by existing sync code in api-client ────────────

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
  detections: LocalDetection[];
}

// ── Internal storage helpers ──────────────────────────────────────────────────

const STORAGE_KEY = "ocean_ai_local_history";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function toLocalDetection(d: OfflineDetectionResult): LocalDetection {
  return {
    species: d.species,
    speciesConfidence: d.speciesConfidence,
    disease: d.disease,
    diseaseConfidence: d.diseaseConfidence,
    qualityGrade: d.qualityGrade,
    isLegalSize: d.isLegalSize,
    minLegalSize: d.minLegalSize,
    bbox: d.bbox,
    // Only persist weight when the user has manually entered a measurement.
    // bbox-estimated weights are excluded to avoid showing inaccurate data.
    weightG: d.weightUserEntered ? d.weightG : 0,
    lengthMm: d.lengthMm,
    pricePerKg: d.pricePerKg,
    // Prices are unavailable in offline mode.
    estimatedValue: 0,
  };
}

function computeSummary(detections: LocalDetection[]) {
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

function computeGroupSummary(images: LocalGroupImage[]) {
  const allDetections = images.flatMap((img) => img.detections);
  return computeSummary(allDetections);
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

/** Persist a completed single-image offline analysis. */
export async function saveLocalAnalysis(
  data: OfflineAnalysisData,
): Promise<LocalHistoryRecord> {
  const existing = await readAll();
  const detections = data.offlineResults.map(toLocalDetection);
  const summary = computeSummary(detections);
  const record: LocalHistoryRecord = {
    id: generateId(),
    sessionType: "single",
    syncStatus: "pending",
    createdAt: new Date().toISOString(),
    imageUri: data.imageUri,
    fileType: "image/jpeg",
    location: data.location,
    processingTime: data.processingTime,
    detections,
    ...summary,
  };
  await writeAll([record, ...existing].slice(0, 200));
  return record;
}

/** Persist a completed group (multi-image) offline analysis. */
export async function saveLocalGroupAnalysis(
  images: Array<{
    imageUri: string;
    fileType: string;
    detections: OfflineDetectionResult[];
  }>,
  opts: {
    location?: { lat: number; lng: number } | null;
    processingTime: number;
  },
): Promise<LocalHistoryRecord> {
  const existing = await readAll();
  const localImages: LocalGroupImage[] = images.map((img) => ({
    localImageId: generateId(),
    imageUri: img.imageUri,
    fileType: img.fileType || "image/jpeg",
    detections: img.detections.map(toLocalDetection),
  }));
  const summary = computeGroupSummary(localImages);
  const record: LocalHistoryRecord = {
    id: generateId(),
    sessionType: "group",
    syncStatus: "pending",
    createdAt: new Date().toISOString(),
    images: localImages,
    location: opts.location,
    processingTime: opts.processingTime,
    ...summary,
  };
  await writeAll([record, ...existing].slice(0, 200));
  return record;
}

/** Return all locally stored records. */
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

/**
 * Update the weight for a single fish detection in a persisted local record.
 * Called after the user manually enters measurements in the detail screen.
 */
export async function updateLocalDetectionWeight(
  localRecordId: string,
  fishIndex: number,
  weightG: number,
): Promise<void> {
  const records = await readAll();
  const updated = records.map((r) => {
    if (r.id !== localRecordId) return r;
    const dets = r.detections ? [...r.detections] : [];
    if (dets[fishIndex]) {
      dets[fishIndex] = { ...dets[fishIndex], weightG };
    }
    // Recompute total weight for the summary shown in HistoryCard
    return { ...r, detections: dets };
  });
  await writeAll(updated);
}

/** Mark a record as successfully synced. */
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

/** Mark a record as failed. */
export async function markLocalRecordFailed(id: string): Promise<void> {
  const records = await readAll();
  await writeAll(
    records.map((r) =>
      r.id === id ? { ...r, syncStatus: "failed" as const } : r,
    ),
  );
}

/** Mark a record as currently syncing (prevents double-sync). */
export async function markLocalRecordSyncing(id: string): Promise<void> {
  const records = await readAll();
  await writeAll(
    records.map((r) =>
      r.id === id ? { ...r, syncStatus: "syncing" as const } : r,
    ),
  );
}

/**
 * Attempt to sync all pending/failed local records to the backend.
 *
 * Two-phase protocol per record:
 *   1. POST /sync/offline-session/prepare  → get presigned S3 PUT URLs
 *   2. PUT  images directly to S3
 *   3. POST /sync/offline-session/commit   → write to DynamoDB tables
 */
export async function syncLocalHistory(): Promise<void> {
  const pending = await getPendingLocalRecords();
  if (pending.length === 0) return;

  const { syncOfflineSession, uploadToS3, saveWeightEstimate } = await import("./api-client");

  for (const record of pending) {
    if (record.syncStatus === "syncing") continue;

    try {
      await markLocalRecordSyncing(record.id);

      if (record.sessionType !== "group") {
        // ── Single image ───────────────────────────────────────────────────

        const prepare = await syncOfflineSession("prepare", {
          sessionType: "single",
          files: [{ fileName: `offline_${record.id}.jpg`, fileType: record.fileType || "image/jpeg" }],
          location: record.location,
        });

        let s3Key: string | undefined;
        if (record.imageUri && prepare.presignedUrls?.[0]) {
          try {
            await uploadToS3(
              prepare.presignedUrls[0].uploadUrl,
              record.imageUri,
              record.fileType || "image/jpeg",
            );
            s3Key = prepare.presignedUrls[0].s3Key;
          } catch (e) {
            console.warn("[syncLocalHistory] Image S3 upload failed, continuing:", e);
          }
        }

        const result = await syncOfflineSession("commit", {
          sessionType: "single",
          sessionId: prepare.sessionId,
          localId: record.id,
          createdAt: record.createdAt,
          location: record.location,
          processingTime: record.processingTime,
          detections: record.detections || [],
          fishCount: record.fishCount,
          avgConfidence: record.avgConfidence,
          speciesDistribution: record.speciesDistribution,
          diseaseDetected: record.diseaseDetected,
          s3Key,
        });

        const remoteId = result?.remoteId ?? result?.imageId;
        await markLocalRecordSynced(record.id, remoteId);

        // Push any user-entered fish weights now that we have a cloud ID.
        if (remoteId) {
          for (let i = 0; i < (record.detections || []).length; i++) {
            const det = record.detections![i];
            if (det.weightG > 0) {
              saveWeightEstimate({
                groupId: remoteId,
                imageUri: record.imageUri || "",
                fishIndex: i,
                species: det.species,
                weightG: det.weightG,
                timestamp: record.createdAt,
              }).catch((e) =>
                console.warn(`[syncLocalHistory] Weight sync failed fish ${i}:`, e),
              );
            }
          }
        }

      } else {
        // ── Group ──────────────────────────────────────────────────────────

        const images = record.images || [];
        const prepare = await syncOfflineSession("prepare", {
          sessionType: "group",
          files: images.map((img, i) => ({
            fileName: `offline_${record.id}_${i}.jpg`,
            fileType: img.fileType || "image/jpeg",
          })),
          location: record.location,
        });

        const s3Keys: (string | null)[] = await Promise.all(
          images.map(async (img, i) => {
            const slot = prepare.presignedUrls?.[i];
            if (!slot || !img.imageUri) return null;
            try {
              await uploadToS3(slot.uploadUrl, img.imageUri, img.fileType || "image/jpeg");
              return slot.s3Key as string;
            } catch (e) {
              console.warn(`[syncLocalHistory] Group image ${i} S3 upload failed:`, e);
              return null;
            }
          }),
        );

        const result = await syncOfflineSession("commit", {
          sessionType: "group",
          sessionId: prepare.sessionId,
          localGroupId: record.id,
          createdAt: record.createdAt,
          location: record.location,
          processingTime: record.processingTime,
          images: images.map((img, i) => ({
            imageIndex: i,
            localImageId: img.localImageId,
            s3Key: s3Keys[i] || null,
            detections: img.detections,
          })),
        });

        const remoteGroupId = result?.remoteId ?? result?.groupId;
        await markLocalRecordSynced(record.id, remoteGroupId);

        // Push any user-entered fish weights now that we have a cloud group ID.
        if (remoteGroupId) {
          for (const img of (record.images || [])) {
            for (let i = 0; i < img.detections.length; i++) {
              const det = img.detections[i];
              if (det.weightG > 0) {
                saveWeightEstimate({
                  groupId: remoteGroupId,
                  imageUri: img.imageUri,
                  fishIndex: i,
                  species: det.species,
                  weightG: det.weightG,
                  timestamp: record.createdAt,
                }).catch((e) =>
                  console.warn(`[syncLocalHistory] Weight sync failed:`, e),
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(`[syncLocalHistory] Failed to sync ${record.id}:`, err);
      await markLocalRecordFailed(record.id);
    }
  }
}

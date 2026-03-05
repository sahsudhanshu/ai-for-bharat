/**
 * Offline Queue Service
 * Manages pending operations when offline and syncs them when connection restores
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { toastService } from "./toast-service";

const QUEUE_KEY = "offline_queue";
const MAX_QUEUE_SIZE = 100;

export interface QueuedOperation {
  id: string;
  type:
    | "history_delete"
    | "history_create"
    | "preferences_update"
    | "profile_update"
    | "avatar_update";
  data: any;
  timestamp: number;
  retryCount: number;
}

class OfflineQueue {
  private queue: QueuedOperation[] = [];
  private isProcessing = false;
  private listeners: Array<(queue: QueuedOperation[]) => void> = [];

  async initialize() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(
          `[OfflineQueue] Loaded ${this.queue.length} pending operations`,
        );
      }
    } catch (error) {
      console.error("[OfflineQueue] Failed to load queue:", error);
    }
  }

  async add(type: QueuedOperation["type"], data: any): Promise<void> {
    const operation: QueuedOperation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(operation);

    // Limit queue size
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    }

    await this.save();
    this.notifyListeners();

    console.log(`[OfflineQueue] Added ${type} operation to queue`);
  }

  async remove(id: string): Promise<void> {
    this.queue = this.queue.filter((op) => op.id !== id);
    await this.save();
    this.notifyListeners();
  }

  async clear(): Promise<void> {
    this.queue = [];
    await this.save();
    this.notifyListeners();
  }

  getQueue(): QueuedOperation[] {
    return [...this.queue];
  }

  getCount(): number {
    return this.queue.length;
  }

  subscribe(listener: (queue: QueuedOperation[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.getQueue()));
  }

  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error("[OfflineQueue] Failed to save queue:", error);
    }
  }

  async processQueue(isOnline: boolean): Promise<void> {
    if (!isOnline || this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`[OfflineQueue] Processing ${this.queue.length} operations...`);

    const operations = [...this.queue];
    let successCount = 0;
    let failCount = 0;

    for (const operation of operations) {
      try {
        await this.executeOperation(operation);
        await this.remove(operation.id);
        successCount++;
      } catch (error) {
        console.error(
          `[OfflineQueue] Failed to execute ${operation.type}:`,
          error,
        );

        // Increment retry count
        operation.retryCount++;

        // Remove if max retries exceeded (3 attempts)
        if (operation.retryCount >= 3) {
          console.warn(
            `[OfflineQueue] Max retries exceeded for ${operation.id}, removing`,
          );
          await this.remove(operation.id);
          failCount++;
        }
      }
    }

    this.isProcessing = false;

    if (successCount > 0) {
      toastService.success(
        `Synced ${successCount} pending change${successCount > 1 ? "s" : ""}`,
      );
    }

    if (failCount > 0) {
      toastService.warning(
        `${failCount} operation${failCount > 1 ? "s" : ""} failed to sync`,
      );
    }

    console.log(
      `[OfflineQueue] Processing complete: ${successCount} success, ${failCount} failed`,
    );
  }

  private async executeOperation(operation: QueuedOperation): Promise<void> {
    const {
      deleteGroup,
      updateUserPreferences,
      updateUserProfile,
      updateAvatarUrl,
    } = await import("./api-client");

    switch (operation.type) {
      case "history_delete":
        await deleteGroup(operation.data.groupId);
        break;

      case "preferences_update":
        await updateUserPreferences(operation.data);
        break;

      case "profile_update":
        await updateUserProfile(operation.data);
        break;

      case "avatar_update":
        await updateAvatarUrl(operation.data.avatarUrl);
        break;

      case "history_create":
        // History creation is handled by the upload flow
        // This is just for tracking purposes
        break;

      default:
        console.warn(
          `[OfflineQueue] Unknown operation type: ${operation.type}`,
        );
    }
  }
}

export const offlineQueue = new OfflineQueue();

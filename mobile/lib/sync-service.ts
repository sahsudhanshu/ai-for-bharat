import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { updateUserProfile, updateUserPreferences, updateAvatarUrl } from './api-client';
import type { SyncQueueItem } from './types';

const SYNC_QUEUE_KEY = 'ocean_ai_sync_queue';
const MAX_RETRY_COUNT = 3;

export class SyncService {
  private static isSyncing = false;
  private static listeners: Array<(status: SyncStatus) => void> = [];
  private static netInfoUnsubscribe: (() => void) | null = null;

  /**
   * Initialize sync service and start listening for connectivity
   */
  static async initialize(): Promise<void> {
    // Clean up existing listener if any
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }

    // Listen for connectivity changes
    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && !this.isSyncing) {
        this.syncPendingChanges();
      }
    });

    // Sync on app startup if connected
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      this.syncPendingChanges();
    }
  }

  /**
   * Cleanup sync service
   */
  static cleanup(): void {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    this.listeners = [];
  }

  /**
   * Queue a change for syncing
   */
  static async queueChange(
    type: SyncQueueItem['type'],
    payload: any
  ): Promise<void> {
    const item: SyncQueueItem = {
      id: `${type}-${Date.now()}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    };

    const queue = await this.getQueue();
    queue.push(item);
    await this.saveQueue(queue);

    this.notifyListeners();

    // Try to sync immediately if online
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      this.syncPendingChanges();
    }
  }

  /**
   * Sync all pending changes
   */
  static async syncPendingChanges(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.notifyListeners();

    try {
      const queue = await this.getQueue();
      const pending = queue.filter((item) => item.status === 'pending');

      for (const item of pending) {
        try {
          await this.syncItem(item);
          item.status = 'completed';
        } catch (error) {
          item.retryCount++;
          if (item.retryCount >= MAX_RETRY_COUNT) {
            item.status = 'failed';
            item.error = error instanceof Error ? error.message : 'Unknown error';
          }
        }
      }

      // Remove completed items, keep failed for manual retry
      const updatedQueue = queue.filter((item) => item.status !== 'completed');
      await this.saveQueue(updatedQueue);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Sync a single item
   */
  private static async syncItem(item: SyncQueueItem): Promise<void> {
    switch (item.type) {
      case 'profile_update':
        await updateUserProfile(item.payload);
        break;
      case 'preferences_update':
        await updateUserPreferences(item.payload);
        break;
      case 'avatar_upload':
        await updateAvatarUrl(item.payload.avatarUrl);
        break;
      default:
        throw new Error(`Unknown sync type: ${item.type}`);
    }
  }

  /**
   * Get sync queue from storage
   */
  private static async getQueue(): Promise<SyncQueueItem[]> {
    try {
      const json = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return json ? JSON.parse(json) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save sync queue to storage
   */
  private static async saveQueue(queue: SyncQueueItem[]): Promise<void> {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  }

  /**
   * Get sync status
   */
  static async getSyncStatus(): Promise<SyncStatus> {
    const queue = await this.getQueue();
    const pending = queue.filter((item) => item.status === 'pending').length;
    const failed = queue.filter((item) => item.status === 'failed').length;

    const completedItems = queue.filter((item) => item.status === 'completed');
    const lastSyncItem = completedItems.length > 0
      ? completedItems.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
      : null;

    return {
      pending,
      failed,
      syncing: this.isSyncing,
      lastSync: lastSyncItem?.timestamp || undefined,
    };
  }

  /**
   * Clear sync queue
   */
  static async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
    this.notifyListeners();
  }

  /**
   * Subscribe to sync status changes
   */
  static subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners of status change
   */
  private static notifyListeners(): void {
    this.getSyncStatus().then((status) => {
      this.listeners.forEach((listener) => listener(status));
    });
  }
}

export interface SyncStatus {
  pending: number;
  failed: number;
  syncing: boolean;
  lastSync?: string;
}

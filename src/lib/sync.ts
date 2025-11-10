/**
 * Background Sync Service - IndexedDB to Supabase Synchronization
 *
 * This module implements background sync from local IndexedDB to Supabase cloud storage.
 * It runs as a polling service that periodically pushes unsynced data to the server.
 *
 * ## Sync Strategy: Polling (Not Real-Time)
 * We use polling instead of real-time sync because:
 * - Simpler implementation (no WebSocket/SSE complexity)
 * - Lower server costs (no persistent connections)
 * - Sufficient for MVP use case (delay acceptable)
 * - Works reliably across network changes and sleep/wake cycles
 * - Easier to debug and reason about
 *
 * ## Sync Flow:
 * 1. Timer fires based on feature flag interval (default 30 seconds)
 * 2. Query IndexedDB for unsynced items (where syncedAt is null)
 * 3. Push each item to Supabase via upsert
 * 4. Mark items as synced in IndexedDB with timestamp
 * 5. On error, item remains unsynced and will retry next cycle
 *
 * ## Hub Context:
 * - Hub ID is required for all sync operations (determines ownership)
 * - Hub ID comes from localStorage via createPersonalHub module
 * - Sync service listens for 'hubChanged' events to switch context
 * - No sync occurs without an active hub
 *
 * ## Conflict Resolution:
 * - Last-write-wins (server is authoritative)
 * - No download sync yet (Phase 1 is push-only)
 * - Future: Implement bidirectional sync with conflict detection
 *
 * ## Error Handling:
 * - Network errors: Item stays unsynced, will retry on next cycle
 * - Auth errors: Sync stops, user must re-authenticate
 * - Partial failures: Successfully synced items are marked, others retry
 *
 * @see src/lib/storage.ts for IndexedDB operations
 * @see src/lib/supabase.ts for cloud sync functions
 * @see src/lib/featureFlags.ts for sync interval configuration
 */
import { getUnsyncedTodos, getUnsyncedTableRows, markTodoSynced, markTableRowSynced } from './storage';
import { syncTodo, syncTableRow, isSupabaseConfigured, getCurrentUser } from './supabase';
import { getActiveHubId } from './createPersonalHub';
import { getSyncInterval } from './featureFlags';

/** Timer ID for the polling interval (null when not running) */
let syncInterval: number | null = null;

/** Current hub ID for sync operations (null when no hub selected) */
let currentHubId: string | null = null;

/**
 * Initialize sync service with active hub from localStorage
 */
export function initializeSync() {
  // Try to load hub ID from localStorage
  const savedHubId = getActiveHubId();
  if (savedHubId) {
    currentHubId = savedHubId;
    console.log('[Sync] Initialized with hub:', savedHubId);
  }

  // Listen for hub changes
  if (typeof window !== 'undefined') {
    window.addEventListener('hubChanged', ((event: CustomEvent) => {
      const { hubId } = event.detail;
      currentHubId = hubId;
      console.log('[Sync] Hub changed to:', hubId);

      // Restart sync with new hub
      if (hubId && isAutoSyncRunning()) {
        stopAutoSync();
        startAutoSync();
      }
    }) as EventListener);
  }
}

/**
 * Set the current hub ID for syncing
 */
export function setCurrentHub(hubId: string) {
  currentHubId = hubId;
  console.log('[Sync] Hub set to:', hubId);
}

/**
 * Get the current hub ID
 */
export function getCurrentHubId(): string | null {
  return currentHubId;
}

/**
 * Sync all unsynced data to Supabase
 */
export async function syncAll(): Promise<{
  todosSynced: number;
  tablesSynced: number;
  errors: Error[];
}> {
  if (!isSupabaseConfigured()) {
    return { todosSynced: 0, tablesSynced: 0, errors: [] };
  }

  if (!currentHubId) {
    return { todosSynced: 0, tablesSynced: 0, errors: [new Error('No hub selected')] };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { todosSynced: 0, tablesSynced: 0, errors: [new Error('Not authenticated')] };
  }

  const errors: Error[] = [];
  let todosSynced = 0;
  let tablesSynced = 0;

  // Sync todos
  try {
    const unsyncedTodos = await getUnsyncedTodos();

    for (const todo of unsyncedTodos) {
      try {
        await syncTodo(
          currentHubId,
          todo.moduleKey,
          todo.todoId,
          todo.completed,
          todo.notes
        );

        await markTodoSynced(todo.moduleKey, todo.todoId);
        todosSynced++;
      } catch (error) {
        errors.push(error as Error);
      }
    }
  } catch (error) {
    errors.push(error as Error);
  }

  // Sync table rows
  try {
    const unsyncedRows = await getUnsyncedTableRows();

    for (const row of unsyncedRows) {
      try {
        await syncTableRow(
          currentHubId,
          row.moduleKey,
          row.tableId,
          row.rowId,
          row.data
        );

        await markTableRowSynced(row.moduleKey, row.tableId, row.rowId);
        tablesSynced++;
      } catch (error) {
        errors.push(error as Error);
      }
    }
  } catch (error) {
    errors.push(error as Error);
  }

  return { todosSynced, tablesSynced, errors };
}

/**
 * Start automatic syncing with feature flag interval
 */
export function startAutoSync(intervalMs?: number) {
  if (syncInterval) {
    stopAutoSync();
  }

  // Use feature flag value if not provided
  const syncIntervalMs = intervalMs ?? getSyncInterval();

  console.log('[Sync] Starting auto-sync with interval:', syncIntervalMs, 'ms');

  // Initial sync
  syncAll().catch(console.error);

  // Set up interval
  syncInterval = window.setInterval(() => {
    if (navigator.onLine && isSupabaseConfigured()) {
      syncAll().catch(console.error);
    }
  }, syncIntervalMs);
}

/**
 * Stop automatic syncing
 */
export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Check if auto-sync is running
 */
export function isAutoSyncRunning(): boolean {
  return syncInterval !== null;
}

// Listen for online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Sync immediately when coming back online
    if (isSupabaseConfigured() && currentHubId) {
      syncAll().catch(console.error);
    }
  });
}

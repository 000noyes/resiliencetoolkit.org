/**
 * Background Sync Service - DISABLED
 *
 * Supabase sync removed - app is fully local only
 * All sync functions are now stubs that do nothing
 *
 * Original file preserved at bottom as comments for future restoration
 */

/** Timer ID stub (always null) */
let syncInterval: number | null = null;

/** Current hub ID stub (always null) */
let currentHubId: string | null = null;

/**
 * DISABLED - No sync to perform
 * @returns Promise that resolves immediately
 */
export async function syncAll(): Promise<void> {
  console.log('[Sync] syncAll() called but sync is disabled - data stays local only');
  return;
}

/**
 * DISABLED - No auto-sync
 */
export function startAutoSync(): void {
  console.log('[Sync] startAutoSync() called but sync is disabled');
  // Do nothing - no sync needed for local-only app
}

/**
 * DISABLED - No auto-sync to stop
 */
export function stopAutoSync(): void {
  console.log('[Sync] stopAutoSync() called but sync is disabled');
  // Do nothing - sync never starts
}

/**
 * DISABLED - Sync status always idle
 * @returns Always returns 'idle'
 */
export function getSyncStatus(): 'idle' | 'syncing' | 'error' {
  return 'idle';
}

/* ============================================================================
 * ORIGINAL SYNC IMPLEMENTATION COMMENTED OUT BELOW
 * ==========================================================================
 *
 * To restore Supabase sync functionality, uncomment the code below and remove
 * the stub functions above.
 *
 * Original sync.ts file (227 lines):
 * - Background polling service that syncs local IndexedDB to Supabase
 * - Functions: syncAll(), startAutoSync(), stopAutoSync()
 * - Syncs todos and table rows to Supabase
 * - Hub-based sync context
 * - Polling interval configurable via feature flags
 *
 * All functionality has been disabled - the app now stores data only in
 * IndexedDB with no cloud sync.
 *
 * ========================================================================== */

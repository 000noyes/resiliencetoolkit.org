/**
 * Supabase Client - DISABLED
 *
 * Authentication and data sync removed - fully local app
 * All functions now return null or throw errors
 *
 * Original file preserved at bottom as comments for future restoration
 */

// Stub types to prevent import errors
export type SupabaseClient = any;
export type Session = null;

/**
 * DISABLED - Returns null (Supabase not configured)
 */
export function getSupabase(): any {
  console.warn('[Supabase] getSupabase() called but Supabase is disabled');
  return null;
}

/**
 * DISABLED - Always returns false
 */
export function isSupabaseConfigured(): boolean {
  return false;
}

/**
 * DISABLED - Auth removed
 */
export async function signUp(email: string, password: string, fullName?: string) {
  throw new Error('Authentication disabled - app is fully local');
}

/**
 * DISABLED - Auth removed
 */
export async function signIn(email: string, password: string) {
  throw new Error('Authentication disabled - app is fully local');
}

/**
 * DISABLED - Auth removed
 */
export async function signOut() {
  console.log('[Supabase] signOut() called but auth is disabled');
  return;
}

/**
 * DISABLED - Auth removed
 */
export async function getCurrentUser() {
  return null;
}

/**
 * DISABLED - Auth removed
 */
export async function getSession() {
  return null;
}

/**
 * DISABLED - Auth removed
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  // Return a stub subscription object
  return {
    data: {
      subscription: {
        unsubscribe: () => {},
      },
    },
  };
}

/**
 * DISABLED - Auth removed
 */
export async function isAuthenticated(): Promise<boolean> {
  return false;
}

/**
 * DISABLED - Auth removed
 */
export async function refreshSession() {
  return null;
}

/**
 * DISABLED - Profile removed
 */
export async function getUserProfile() {
  return null;
}

/**
 * DISABLED - Profile removed
 */
export async function updateUserProfile(updates: any) {
  throw new Error('User profiles disabled - app is fully local');
}

/**
 * DISABLED - Hubs removed
 */
export async function getUserHubs() {
  return [];
}

/**
 * DISABLED - Hubs removed
 */
export async function createHub(hub: any) {
  throw new Error('Hub creation disabled - app is fully local');
}

/**
 * DISABLED - Hubs removed
 */
export async function getHub(hubId: string) {
  return null;
}

/**
 * DISABLED - Hubs removed
 */
export async function updateHub(hubId: string, updates: any) {
  throw new Error('Hub updates disabled - app is fully local');
}

/**
 * DISABLED - Hubs removed
 */
export async function deleteHub(hubId: string) {
  throw new Error('Hub deletion disabled - app is fully local');
}

/**
 * DISABLED - Hub membership removed
 */
export async function getUserHubMemberships() {
  return [];
}

/**
 * DISABLED - Hub membership removed
 */
export async function isHubMember(hubId: string): Promise<boolean> {
  return false;
}

/**
 * DISABLED - Hub membership removed
 */
export async function getHubRole(hubId: string): Promise<'steward' | 'doer' | 'viewer' | null> {
  return null;
}

/**
 * DISABLED - Sync removed
 */
export async function syncTodo(
  hubId: string,
  moduleKey: string,
  todoId: string,
  completed: boolean,
  userId?: string
) {
  console.log('[Supabase] syncTodo() called but sync is disabled - data stays local only');
  return null;
}

/**
 * DISABLED - Sync removed
 */
export async function getTodos(hubId: string, moduleKey: string) {
  return [];
}

/**
 * DISABLED - Sync removed
 */
export async function syncTableRow(
  hubId: string,
  moduleKey: string,
  tableId: string,
  rowId: string,
  data: Record<string, any>,
  userId?: string
) {
  console.log('[Supabase] syncTableRow() called but sync is disabled - data stays local only');
  return null;
}

/**
 * DISABLED - Sync removed
 */
export async function getTableRows(hubId: string, moduleKey: string, tableId: string) {
  return [];
}

/**
 * DISABLED - Sync removed
 */
export async function deleteTableRow(
  hubId: string,
  moduleKey: string,
  tableId: string,
  rowId: string,
  userId?: string
) {
  console.log('[Supabase] deleteTableRow() called but sync is disabled - data stays local only');
  return;
}

/* ============================================================================
 * ORIGINAL SUPABASE IMPLEMENTATION COMMENTED OUT BELOW
 * ==========================================================================
 *
 * To restore Supabase functionality, uncomment the code below and remove
 * the stub functions above.
 *
 * ========================================================================== */

/*

[Original 602-line supabase.ts file would go here - too large to include in this stub.
 The file has been replaced with stubs to disable all Supabase functionality while
 keeping the API surface intact so imports don't break. If you need to restore
 Supabase, you can retrieve the original from git history.]

Original file structure:
- Cookie-based session storage implementation
- Authentication functions (signUp, signIn, signOut, getSession, etc.)
- Profile management (getUserProfile, updateUserProfile)
- Hub management (createHub, updateHub, deleteHub, getUserHubs, etc.)
- Hub membership (getUserHubMemberships, isHubMember, getHubRole)
- Todo sync (syncTodo, getTodos)
- Table sync (syncTableRow, getTableRows, deleteTableRow)

All functionality has been disabled - the app now operates in fully local mode
using only IndexedDB storage (see src/lib/storage.ts).

*/

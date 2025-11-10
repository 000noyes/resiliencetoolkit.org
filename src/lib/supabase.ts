/**
 * Supabase Client - Client-Side Authentication and Data Sync
 *
 * This module provides a browser-compatible Supabase client for client-side operations.
 * It implements cookie-based session storage for SSR compatibility with Astro.
 *
 * ## Architecture:
 * - Cookie-based session storage (instead of localStorage) for SSR compatibility
 * - Automatic token refresh and session management
 * - Email/password authentication only (no OAuth in Phase 1)
 * - Row Level Security (RLS) enforced at database level
 *
 * ## Security Model:
 * - Sessions stored in httpOnly-compatible cookies (readable by client JS but sent in requests)
 * - RLS policies on Supabase ensure users can only access their own data
 * - Hub membership checked via database policies
 * - Server-side validation in middleware provides defense-in-depth
 *
 * ## Usage:
 * - Use this client for browser-side auth operations (signup, login, logout)
 * - Use supabase-server.ts for server-side operations (middleware, SSR)
 * - All sync functions assume user is authenticated (enforced by middleware)
 *
 * @see src/lib/supabase-server.ts for server-side Supabase client
 * @see src/middleware/index.ts for auth validation
 * @see docs/SUPABASE_SETUP.md for database schema and RLS policies
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client with cookie-based session storage
 *
 * ## Why Cookies Instead of localStorage?
 * Supabase's default storage is localStorage, which doesn't work with SSR.
 * We use cookies because:
 * 1. Cookies are sent with every request (accessible in middleware)
 * 2. Server-side code can read cookies via Astro.cookies API
 * 3. Allows session validation before page renders
 * 4. Compatible with both client and server rendering
 *
 * ## Cookie Configuration:
 * - `path=/` - Available site-wide
 * - `max-age=7 days` - Session expires after 1 week
 * - `SameSite=Lax` - CSRF protection, allows normal navigation
 * - No `Secure` flag (added in middleware for production)
 * - No `HttpOnly` flag (client JS needs to read for Supabase SDK)
 *
 * ## Security Notes:
 * - Cookies are readable by client JavaScript (required for SDK)
 * - XSS protection via Content-Security-Policy headers (middleware)
 * - Server validates sessions in middleware (defense-in-depth)
 * - Token refresh handled automatically by Supabase SDK
 *
 * @returns {SupabaseClient} Singleton Supabase client instance
 * @throws {Error} If environment variables are missing
 */
export function getSupabase(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase credentials. Please add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY to your .env file.'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Custom storage implementation using cookies for SSR compatibility
      storage: {
        getItem: (key: string) => {
          if (typeof document === 'undefined') return null;
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === key) {
              return decodeURIComponent(value);
            }
          }
          return null;
        },
        setItem: (key: string, value: string) => {
          if (typeof document === 'undefined') return;
          // Session cookie: 7 days, Lax same-site policy for CSRF protection
          document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        },
        removeItem: (key: string) => {
          if (typeof document === 'undefined') return;
          // Expire immediately to delete cookie
          document.cookie = `${key}=; path=/; max-age=0`;
        },
      },
    },
  });

  return supabaseClient;
}

/**
 * Check if Supabase is configured
 * @returns {boolean} True if both Supabase URL and anon key are configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
}

// ============================================================================
// AUTH FUNCTIONS
// These functions handle user authentication via Supabase Auth.
// All operations automatically persist sessions to cookies via custom storage.
// ============================================================================

/**
 * Sign up a new user with email and password
 *
 * Creates a new user account and triggers automatic profile creation via database trigger.
 * On success, the user is automatically logged in with a session cookie.
 *
 * @param {string} email - User's email address
 * @param {string} password - User's password (min 6 characters enforced by Supabase)
 * @param {string} [fullName] - Optional full name stored in user metadata
 * @returns {Promise} Supabase auth response with user and session
 * @throws {Error} If signup fails (duplicate email, weak password, etc.)
 */
export async function signUp(email: string, password: string, fullName?: string) {
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in an existing user with email and password
 *
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise} Supabase auth response with user and session
 * @throws {Error} If credentials are invalid
 */
export async function signIn(email: string, password: string) {
  const supabase = getSupabase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current user
 */
export async function getCurrentUser() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the current session
 */
export async function getSession() {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  const supabase = getSupabase();
  return supabase.auth.onAuthStateChange(callback);
}

/**
 * Check if user is authenticated (has valid session)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session;
}

/**
 * Refresh the current session
 * Useful for long-running sessions
 */
export async function refreshSession() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return data;
}

/**
 * Get user profile from public.profiles table
 */
export async function getUserProfile() {
  const supabase = getSupabase();
  const user = await getCurrentUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    // Profile might not exist yet (created by trigger)
    console.warn('[Supabase] Profile not found:', error);
    return null;
  }

  return data;
}

/**
 * Update user profile
 */
export async function updateUserProfile(updates: {
  full_name?: string;
  avatar_url?: string;
}) {
  const supabase = getSupabase();
  const user = await getCurrentUser();

  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// HUB FUNCTIONS
// ============================================================================

/**
 * Get all hubs for the current user
 */
export async function getUserHubs() {
  const supabase = getSupabase();
  const user = await getCurrentUser();

  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('hubs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Create a new hub
 */
export async function createHub(hub: {
  name: string;
  description?: string | null;
  location?: string | null;
  timezone?: string;
  settings?: Record<string, any>;
}) {
  const supabase = getSupabase();
  const user = await getCurrentUser();

  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('hubs')
    .insert({ ...hub, created_by: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get a specific hub
 */
export async function getHub(hubId: string) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('hubs')
    .select('*')
    .eq('id', hubId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a hub
 * Only stewards can update their hub (enforced by RLS policy)
 */
export async function updateHub(hubId: string, updates: {
  name?: string;
  description?: string | null;
  location?: string | null;
  timezone?: string;
  settings?: Record<string, any>;
}) {
  const supabase = getSupabase();
  const user = await getCurrentUser();

  if (!user) throw new Error('Not authenticated');

  // Sanitize inputs
  const sanitizedUpdates: Record<string, any> = {};

  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim();
    if (!trimmedName) throw new Error('Hub name cannot be empty');
    sanitizedUpdates.name = trimmedName;
  }

  if (updates.description !== undefined) {
    sanitizedUpdates.description = updates.description?.trim() || null;
  }

  if (updates.location !== undefined) {
    sanitizedUpdates.location = updates.location?.trim() || null;
  }

  if (updates.timezone !== undefined) {
    sanitizedUpdates.timezone = updates.timezone;
  }

  if (updates.settings !== undefined) {
    sanitizedUpdates.settings = updates.settings;
  }

  const { data, error } = await supabase
    .from('hubs')
    .update(sanitizedUpdates)
    .eq('id', hubId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a hub
 * Only the hub creator can delete their hub (enforced by RLS policy)
 */
export async function deleteHub(hubId: string) {
  const supabase = getSupabase();
  const user = await getCurrentUser();

  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('hubs')
    .delete()
    .eq('id', hubId);

  if (error) throw error;
}

/**
 * Get user's hub memberships with hub details
 */
export async function getUserHubMemberships() {
  const supabase = getSupabase();
  const user = await getCurrentUser();

  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('hub_members')
    .select(`
      id,
      role,
      joined_at,
      hubs:hub_id (
        id,
        name,
        description,
        location,
        settings,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Check if user is a member of a hub
 */
export async function isHubMember(hubId: string): Promise<boolean> {
  const supabase = getSupabase();
  const user = await getCurrentUser();

  if (!user) return false;

  const { data, error } = await supabase
    .from('hub_members')
    .select('id')
    .eq('hub_id', hubId)
    .eq('user_id', user.id)
    .single();

  return !error && !!data;
}

/**
 * Get user's role in a hub
 */
export async function getHubRole(hubId: string): Promise<'steward' | 'doer' | 'viewer' | null> {
  const supabase = getSupabase();
  const user = await getCurrentUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('hub_members')
    .select('role')
    .eq('hub_id', hubId)
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data?.role as 'steward' | 'doer' | 'viewer';
}

// ============================================================================
// TODO SYNC FUNCTIONS
// ============================================================================

/**
 * Sync a todo to Supabase
 */
export async function syncTodo(
  hubId: string,
  moduleKey: string,
  todoId: string,
  completed: boolean,
  notes?: string
) {
  const supabase = getSupabase();
  const user = await getCurrentUser();

  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('todos')
    .upsert({
      hub_id: hubId,
      user_id: user.id,
      module_key: moduleKey,
      todo_id: todoId,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get todos for a hub and module
 */
export async function getTodos(hubId: string, moduleKey: string) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('hub_id', hubId)
    .eq('module_key', moduleKey);

  if (error) throw error;
  return data;
}

// ============================================================================
// TABLE SYNC FUNCTIONS
// ============================================================================

/**
 * Sync an editable table row to Supabase
 */
export async function syncTableRow(
  hubId: string,
  moduleKey: string,
  tableId: string,
  rowId: string,
  data: Record<string, any>
) {
  const supabase = getSupabase();
  const user = await getCurrentUser();

  if (!user) throw new Error('Not authenticated');

  const { data: result, error } = await supabase
    .from('editable_tables')
    .upsert({
      hub_id: hubId,
      module_key: moduleKey,
      table_id: tableId,
      row_id: rowId,
      data,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Get table rows for a hub and table
 */
export async function getTableRows(hubId: string, moduleKey: string, tableId: string) {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('editable_tables')
    .select('*')
    .eq('hub_id', hubId)
    .eq('module_key', moduleKey)
    .eq('table_id', tableId);

  if (error) throw error;
  return data;
}

/**
 * Delete a table row from Supabase
 */
export async function deleteTableRow(
  hubId: string,
  moduleKey: string,
  tableId: string,
  rowId: string
) {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('editable_tables')
    .delete()
    .eq('hub_id', hubId)
    .eq('module_key', moduleKey)
    .eq('table_id', tableId)
    .eq('row_id', rowId);

  if (error) throw error;
}

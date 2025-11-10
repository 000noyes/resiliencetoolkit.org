/**
 * Server-side Supabase utilities
 *
 * This file provides server-side Supabase client functions that work with
 * Astro's cookie-based session management.
 */

import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/**
 * Create a Supabase client for server-side use with cookie access
 * This client can access the user's session via cookies
 */
export function createServerSupabaseClient(cookies: AstroCookies) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase credentials. Please add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY to your .env file.'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Don't persist session on server
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      // Read/write session from cookies
      storage: {
        getItem: (key: string) => {
          const cookie = cookies.get(key);
          if (!cookie?.value) {
            return null;
          }

          try {
            return decodeURIComponent(cookie.value);
          } catch (error) {
            console.warn('[Supabase Server] Failed to decode cookie value', { key, error });
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          cookies.set(key, encodeURIComponent(value), {
            path: '/',
            httpOnly: true,
            secure: import.meta.env.PROD,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 1 week
          });
        },
        removeItem: (key: string) => {
          cookies.delete(key, { path: '/' });
        },
      },
    },
  });
}

/**
 * Get the current session from cookies (server-side)
 */
export async function getServerSession(cookies: AstroCookies) {
  try {
    const supabase = createServerSupabaseClient(cookies);
    const storageKey = (supabase.auth as any).storageKey as string | undefined;
    if (storageKey) {
      const rawCookie = cookies.get(storageKey);
      console.debug('[Supabase Server] storageKey:', storageKey, 'cookiePresent:', Boolean(rawCookie?.value));
    } else {
      console.debug('[Supabase Server] Unable to determine storage key');
    }
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('[Supabase Server] Error getting session:', error);
    }

    if (session) {
      return session;
    }

    // Fallback: parse session directly from cookie when Supabase client fails
    if (storageKey) {
      const rawCookie = cookies.get(storageKey)?.value;
      if (rawCookie) {
        try {
          const decoded = decodeURIComponent(rawCookie);
          const payload = JSON.parse(decoded);
          console.debug('[Supabase Server] cookie payload', {
            keys: Object.keys(payload),
            hasSession: Boolean(payload.session),
            hasCurrentSession: Boolean((payload as any).currentSession),
          });
          const fallbackSession =
            payload.session ??
            payload.currentSession ??
            (payload.access_token && payload.refresh_token
              ? {
                  access_token: payload.access_token,
                  refresh_token: payload.refresh_token,
                  token_type: payload.token_type,
                  expires_at: payload.expires_at,
                  expires_in: payload.expires_in,
                  user: payload.user,
                }
              : null);

          if (fallbackSession?.access_token && fallbackSession?.refresh_token) {
            // Hydrate Supabase client for downstream usage
            const { data, error: setSessionError } = await supabase.auth.setSession({
              access_token: fallbackSession.access_token,
              refresh_token: fallbackSession.refresh_token,
            });

            if (setSessionError) {
              console.error('[Supabase Server] Error hydrating session from cookie:', setSessionError);
              return null;
            }

            return data.session ?? fallbackSession;
          }
        } catch (parseError) {
          console.error('[Supabase Server] Failed to parse session cookie fallback:', parseError);
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[Supabase Server] Exception getting session:', error);
    return null;
  }
}

/**
 * Get the current user from cookies (server-side)
 */
export async function getServerUser(cookies: AstroCookies) {
  try {
    const supabase = createServerSupabaseClient(cookies);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error('[Supabase Server] Error getting user:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('[Supabase Server] Exception getting user:', error);
    return null;
  }
}

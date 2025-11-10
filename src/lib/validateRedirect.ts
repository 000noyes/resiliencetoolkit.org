/**
 * URL Redirect Validator
 *
 * This module provides security utilities to validate redirect URLs
 * and prevent open redirect vulnerabilities.
 *
 * Security principles:
 * - Only allow internal redirects (same origin)
 * - Whitelist known safe paths
 * - Reject external URLs, javascript: URLs, data: URLs, etc.
 * - Sanitize and normalize paths
 */

/**
 * Allowed redirect paths (whitelist)
 * Add new routes here as they're created
 */
const ALLOWED_PATHS = [
  '/',
  '/dashboard',
  '/modules',
  '/modules/baseline-resilience',
  '/modules/emergency-preparedness',
  '/modules/knowing-your-community',
  '/library',
  '/about',
  '/support',
  '/introduction',
  '/map',
  '/downloads-and-templates',
  '/offline',
  '/auth/login',
  '/auth/signup',
];

/**
 * Path prefixes that are allowed (for dynamic routes)
 */
const ALLOWED_PREFIXES = [
  '/modules/',
  '/auth/',
];

/**
 * Check if a path is in the allowed list or matches an allowed prefix
 */
function isPathAllowed(path: string): boolean {
  // Exact match
  if (ALLOWED_PATHS.includes(path)) {
    return true;
  }

  // Prefix match
  return ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix));
}

/**
 * Normalize a path by removing duplicate slashes and resolving relative paths
 */
function normalizePath(path: string): string {
  // Remove duplicate slashes
  let normalized = path.replace(/\/+/g, '/');

  // Remove trailing slash (except for root)
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  // Resolve relative paths (prevent directory traversal)
  const parts = normalized.split('/').filter(part => part !== '.');
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      // Go up one level (but not above root)
      if (resolved.length > 0 && resolved[resolved.length - 1] !== '') {
        resolved.pop();
      }
    } else {
      resolved.push(part);
    }
  }

  return resolved.join('/') || '/';
}

/**
 * Check if a URL is safe for redirection
 * Returns the validated path if safe, null otherwise
 *
 * @param url - The URL to validate (can be relative or absolute)
 * @param currentOrigin - The current origin (e.g., 'https://example.com')
 * @returns Validated path or null if unsafe
 */
export function validateRedirectUrl(
  url: string | null | undefined,
  currentOrigin?: string
): string | null {
  // Reject null, undefined, or empty strings
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return null;
  }

  const trimmedUrl = url.trim();

  // Reject dangerous URL schemes
  const dangerousSchemes = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
  ];

  const lowerUrl = trimmedUrl.toLowerCase();
  for (const scheme of dangerousSchemes) {
    if (lowerUrl.startsWith(scheme)) {
      console.warn(`[Security] Rejected dangerous URL scheme: ${scheme}`);
      return null;
    }
  }

  // Handle absolute URLs
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    try {
      const parsedUrl = new URL(trimmedUrl);

      // Only allow same-origin redirects
      if (currentOrigin) {
        const currentOriginUrl = new URL(currentOrigin);
        if (parsedUrl.origin !== currentOriginUrl.origin) {
          console.warn('[Security] Rejected cross-origin redirect:', {
            requested: parsedUrl.origin,
            current: currentOriginUrl.origin,
          });
          return null;
        }
      }

      // Extract and validate the pathname
      const path = normalizePath(parsedUrl.pathname);
      return isPathAllowed(path) ? path : null;
    } catch (error) {
      console.warn('[Security] Invalid URL:', trimmedUrl);
      return null;
    }
  }

  // Handle protocol-relative URLs (//example.com)
  if (trimmedUrl.startsWith('//')) {
    console.warn('[Security] Rejected protocol-relative URL:', trimmedUrl);
    return null;
  }

  // Handle relative URLs (should start with /)
  if (!trimmedUrl.startsWith('/')) {
    // Prepend / to make it absolute from root
    const path = '/' + trimmedUrl;
    const normalized = normalizePath(path);
    return isPathAllowed(normalized) ? normalized : null;
  }

  // Normalize and validate the path
  const normalized = normalizePath(trimmedUrl);

  if (!isPathAllowed(normalized)) {
    console.warn('[Security] Path not in whitelist:', normalized);
    return null;
  }

  return normalized;
}

/**
 * Get a safe redirect URL from query parameters
 * Typically used like: /auth/login?redirect=/dashboard
 *
 * @param searchParams - URL search parameters
 * @param paramName - Name of the redirect parameter (default: 'redirect')
 * @param fallback - Fallback path if validation fails (default: '/dashboard')
 * @param currentOrigin - Current origin for validation
 * @returns Safe redirect path
 */
export function getSafeRedirect(
  searchParams: URLSearchParams,
  paramName: string = 'redirect',
  fallback: string = '/dashboard',
  currentOrigin?: string
): string {
  const requestedRedirect = searchParams.get(paramName);
  const validatedPath = validateRedirectUrl(requestedRedirect, currentOrigin);

  if (validatedPath) {
    return validatedPath;
  }

  // If requested redirect was provided but invalid, log it
  if (requestedRedirect) {
    console.warn('[Security] Invalid redirect requested, using fallback:', {
      requested: requestedRedirect,
      fallback,
    });
  }

  return fallback;
}

/**
 * Build a login URL with a redirect parameter
 *
 * @param redirectTo - Path to redirect to after login
 * @param currentOrigin - Current origin for validation
 * @returns Login URL with validated redirect parameter
 */
export function buildLoginUrl(redirectTo: string, currentOrigin?: string): string {
  const validatedPath = validateRedirectUrl(redirectTo, currentOrigin);

  if (validatedPath && validatedPath !== '/auth/login') {
    return `/auth/login?redirect=${encodeURIComponent(validatedPath)}`;
  }

  return '/auth/login';
}

/**
 * Add a new allowed path to the whitelist (for dynamic use cases)
 * Use sparingly - prefer static whitelist for security
 */
export function addAllowedPath(path: string): void {
  const normalized = normalizePath(path);
  if (!ALLOWED_PATHS.includes(normalized)) {
    ALLOWED_PATHS.push(normalized);
    console.log('[Security] Added path to whitelist:', normalized);
  }
}

/**
 * Add a new allowed prefix to the whitelist (for dynamic use cases)
 */
export function addAllowedPrefix(prefix: string): void {
  if (!ALLOWED_PREFIXES.includes(prefix)) {
    ALLOWED_PREFIXES.push(prefix);
    console.log('[Security] Added prefix to whitelist:', prefix);
  }
}

/**
 * Get all allowed paths (for debugging)
 */
export function getAllowedPaths(): readonly string[] {
  return Object.freeze([...ALLOWED_PATHS]);
}

/**
 * Get all allowed prefixes (for debugging)
 */
export function getAllowedPrefixes(): readonly string[] {
  return Object.freeze([...ALLOWED_PREFIXES]);
}

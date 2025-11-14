/**
 * Security Middleware - Local-Only App
 *
 * Adds security headers to all responses.
 * No authentication or authorization checks (app is fully local).
 *
 * Headers added:
 * - Content-Security-Policy: Prevents XSS attacks
 * - X-Frame-Options: Prevents clickjacking
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - Referrer-Policy: Controls referrer information
 * - Permissions-Policy: Controls browser features
 */

import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async (_context, next) => {

  // Process the request
  const response = await next();

  // Add security headers
  const headers = response.headers;

  // Content Security Policy - Local-only app
  // Allow resources from self and Umami analytics
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cloud.umami.is", // unsafe-inline/eval needed for Astro hydration
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api-gateway.umami.dev",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  headers.set('Content-Security-Policy', cspDirectives);

  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  headers.set('X-Content-Type-Options', 'nosniff');

  // Control referrer information
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Control browser features
  // Note: interest-cohort removed as it's deprecated in modern browsers
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self)'
  );

  // Strict Transport Security (HTTPS only)
  // Only enable in production with HTTPS
  if (import.meta.env.PROD) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
};

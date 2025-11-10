/**
 * Security Middleware
 *
 * 1. Auth protection for protected routes
 * 2. Adds security headers to all responses to protect against common attacks.
 *
 * Headers added:
 * - Content-Security-Policy: Prevents XSS attacks
 * - X-Frame-Options: Prevents clickjacking
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - Referrer-Policy: Controls referrer information
 * - Permissions-Policy: Controls browser features
 */

import type { MiddlewareHandler } from 'astro';
import { getServerSession } from '../lib/supabase-server';
import { isAuthRequired, isEarlyAccessRequired, checkEarlyAccess } from '../lib/featureFlags';
import { buildLoginUrl } from '../lib/validateRedirect';

export const onRequest: MiddlewareHandler = async (context, next) => {
  // Auth check for protected routes
  const pathname = context.url.pathname;

  // Routes that require auth check
  const protectedPaths = ['/modules', '/dashboard', '/settings'];
  const isProtectedRoute = protectedPaths.some(path => pathname.startsWith(path));

  // Routes that need session but NOT early access check (like pending page)
  const sessionOnlyPaths = ['/early-access-pending'];
  const needsSession = isProtectedRoute || sessionOnlyPaths.some(path => pathname.startsWith(path));

  if (needsSession) {
    const session = await getServerSession(context.cookies);

    // Only require auth for protected paths (not pending page)
    if (isProtectedRoute) {
      const authRequired = await isAuthRequired();

      if (authRequired && !session) {
        const loginUrl = buildLoginUrl(pathname);
        return context.redirect(loginUrl);
      }
    }

    // Store session in context.locals for all session-aware pages
    context.locals.session = session;

    // Early access check ONLY for protected routes (not pending page)
    if (isProtectedRoute && session) {
      const earlyAccessRequired = await isEarlyAccessRequired();

      if (earlyAccessRequired) {
        const hasEarlyAccess = await checkEarlyAccess(session.user.email);

        if (!hasEarlyAccess) {
          console.log(`[Middleware] User ${session.user.email} denied early access`);
          return context.redirect('/early-access-pending');
        }

        console.log(`[Middleware] User ${session.user.email} granted early access`);
      }
    }
  }

  // Process the request
  const response = await next();

  // Add security headers
  const headers = response.headers;

  // Content Security Policy
  // Allow resources from self, Supabase, Flagsmith, and Umami
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.flagsmith.com https://cloud.umami.is", // unsafe-inline/eval needed for Astro hydration
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.flagsmith.com https://edge.api.flagsmith.com https://*.supabase.co wss://*.supabase.co",
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
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
  );

  // Strict Transport Security (HTTPS only)
  // Only enable in production with HTTPS
  if (import.meta.env.PROD) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
};

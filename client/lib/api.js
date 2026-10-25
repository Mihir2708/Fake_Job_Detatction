/**
 * Unified API URL Resolver
 *
 * In Vercel Services mode:
 * 1. Server-side runtime (Next.js SSR / Server Actions / Route Handlers):
 *    Uses process.env.SERVER_URL injected by Vercel's service binding.
 * 2. Client-side browser:
 *    Uses '/api' (routed directly to the server service by Vercel top-level rewrites).
 * 3. Explicit override:
 *    Uses NEXT_PUBLIC_API_URL if defined.
 * 4. Local standalone development:
 *    Falls back to 'http://localhost:5000/api'.
 */
export function getApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // Client-side browser execution (routed via Vercel rewrites: /api/* -> server)
  if (typeof window !== 'undefined') {
    return '/api';
  }

  // Server-side runtime in Next.js (bound to server service by Vercel)
  if (process.env.SERVER_URL) {
    return `${process.env.SERVER_URL.replace(/\/$/, '')}/api`;
  }

  return 'http://localhost:5000/api';
}

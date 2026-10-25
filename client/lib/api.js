/**
 * Unified API URL Resolver for Client Components
 *
 * Priority:
 * 1. NEXT_PUBLIC_API_URL environment variable (configured in Vercel project settings or .env)
 * 2. In production without NEXT_PUBLIC_API_URL, fallback to '/api' (proxied by Next.js rewrites)
 * 3. In local development, fallback to 'http://localhost:5000/api'
 */
export function getApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return '/api';
  }

  return 'http://localhost:5000/api';
}

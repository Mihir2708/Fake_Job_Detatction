/**
 * urlIngestionService.js
 *
 * SSRF-safe URL fetcher for job posting URL submissions.
 *
 * Security controls implemented:
 *  - Only HTTP and HTTPS schemes permitted
 *  - Blocks private/loopback/link-local/APIPA IPv4 and IPv6 ranges
 *  - Blocks cloud metadata endpoints (169.254.169.254, etc.)
 *  - DNS resolution performed and revalidated before fetch
 *  - Strict timeout (10 s), response size limit (512 KB), redirect limit (3)
 *  - Content-Type must be text/html or application/xhtml+xml
 *  - Final URL after redirects is recorded and re-validated
 *  - Basic job content extraction from HTML (title, description snippets)
 *
 * These controls reduce but cannot fully eliminate SSRF risk in all environments.
 * For production deployments, network-level egress controls are also recommended.
 */

import dns from 'dns/promises';
import { logger } from '../utils/logger.js';

// ── Configuration ─────────────────────────────────────────────────────────────

const MAX_RESPONSE_BYTES = 512 * 1024; // 512 KB
const FETCH_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;

// ── SSRF Protection ───────────────────────────────────────────────────────────

/**
 * Returns true if the IP address string is a private, loopback, link-local,
 * APIPA, or cloud metadata address.
 *
 * @param {string} ip
 * @returns {boolean}
 */
const isPrivateIp = (ip) => {
  // IPv4 private/loopback/link-local ranges
  const ipv4Patterns = [
    /^127\./,                          // Loopback
    /^10\./,                           // RFC 1918
    /^172\.(1[6-9]|2\d|3[01])\./,     // RFC 1918
    /^192\.168\./,                     // RFC 1918
    /^169\.254\./,                     // Link-local / APIPA / AWS metadata
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
    /^0\./,                            // "This" network
    /^255\./,                          // Broadcast
    /^fe80:/i,                         // IPv6 link-local
    /^::1$/,                           // IPv6 loopback
    /^fc00:/i,                         // IPv6 ULA
    /^fd/i,                            // IPv6 ULA
  ];
  return ipv4Patterns.some((re) => re.test(ip));
};

/**
 * Resolves the hostname of a URL and validates that it does not point to
 * a private / internal IP address.
 *
 * @param {string} url
 * @returns {Promise<{ safe: boolean, reason?: string, resolvedIps?: string[] }>}
 */
const validateHostIsPublic = async (url) => {
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { safe: false, reason: `Invalid URL: "${url}"` };
  }

  // Block plain IP addresses that are private
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) || hostname.includes(':')) {
    if (isPrivateIp(hostname)) {
      return { safe: false, reason: `Direct IP address "${hostname}" is in a private/reserved range (SSRF protection).` };
    }
    return { safe: true, resolvedIps: [hostname] };
  }

  let resolvedIps = [];
  try {
    resolvedIps = await dns.resolve4(hostname);
  } catch {
    try {
      const v6 = await dns.resolve6(hostname);
      resolvedIps = v6;
    } catch {
      // Fallback to OS native resolver (getaddrinfo) for environments where raw DNS port 53 is blocked
      try {
        const lookupResults = await dns.lookup(hostname, { all: true });
        resolvedIps = (lookupResults || []).map((r) => r.address).filter(Boolean);
      } catch {
        return { safe: false, reason: `DNS resolution failed for "${hostname}". The domain may not exist.` };
      }
    }
  }

  if (resolvedIps.length === 0) {
    try {
      const lookupResults = await dns.lookup(hostname, { all: true });
      resolvedIps = (lookupResults || []).map((r) => r.address).filter(Boolean);
    } catch {
      return { safe: false, reason: `DNS resolution failed for "${hostname}". The domain may not exist.` };
    }
  }

  const privateIps = resolvedIps.filter(isPrivateIp);
  if (privateIps.length > 0) {
    return {
      safe: false,
      reason: `Hostname "${hostname}" resolves to private/reserved IP(s): ${privateIps.join(', ')} (SSRF protection).`,
    };
  }

  return { safe: true, resolvedIps };
};

/**
 * Validates that the URL scheme is http or https only.
 *
 * @param {string} url
 * @returns {{ valid: boolean, reason?: string }}
 */
const validateScheme = (url) => {
  try {
    const { protocol } = new URL(url);
    if (protocol !== 'http:' && protocol !== 'https:') {
      return { valid: false, reason: `Unsupported URL scheme "${protocol}". Only http and https are allowed.` };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: `"${url}" is not a valid URL.` };
  }
};

// ── Content Extraction ────────────────────────────────────────────────────────

/**
 * Extracts job-relevant text from raw HTML.
 * Uses simple regex-based extraction — does not execute JavaScript.
 *
 * @param {string} html
 * @param {number} maxLength
 * @returns {{ title: string, bodyText: string }}
 */
const extractTextFromHtml = (html, maxLength = 8000) => {
  if (!html) return { title: '', bodyText: '' };

  // Extract <title>
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Remove scripts, styles, nav, footer
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    // Strip all remaining HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Normalize whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    title,
    bodyText: cleaned.slice(0, maxLength),
  };
};

// ── Main Fetch Function ───────────────────────────────────────────────────────

/**
 * Safely fetches a job posting URL and returns extracted text content.
 *
 * @param {string} rawUrl - URL submitted by the user
 * @returns {Promise<object>}
 */
export const fetchJobPostingFromUrl = async (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      success: false,
      status: 'INVALID_INPUT',
      originalUrl: rawUrl,
      finalUrl: null,
      extractedTitle: null,
      extractedText: null,
      explanation: 'No URL provided.',
    };
  }

  const trimmedUrl = rawUrl.trim();

  // 1. Scheme validation
  const schemeCheck = validateScheme(trimmedUrl);
  if (!schemeCheck.valid) {
    return {
      success: false,
      status: 'INVALID_URL',
      originalUrl: trimmedUrl,
      finalUrl: null,
      extractedTitle: null,
      extractedText: null,
      explanation: schemeCheck.reason,
    };
  }

  // 2. SSRF host validation (DNS + IP range check)
  const hostCheck = await validateHostIsPublic(trimmedUrl);
  if (!hostCheck.safe) {
    logger.warn('[UrlIngestion] SSRF protection blocked request:', hostCheck.reason);
    return {
      success: false,
      status: 'BLOCKED_SSRF',
      originalUrl: trimmedUrl,
      finalUrl: null,
      extractedTitle: null,
      extractedText: null,
      explanation: `This URL cannot be fetched for security reasons: ${hostCheck.reason}`,
    };
  }

  // 3. Fetch with timeout and redirect limits
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  let redirectCount = 0;
  let currentUrl = trimmedUrl;

  const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
  };

  try {
    response = await fetch(currentUrl, {
      signal: controller.signal,
      redirect: 'manual', // Handle redirects manually to validate each hop
      headers: BROWSER_HEADERS,
    });

    // Follow redirects manually (up to MAX_REDIRECTS)
    while (response.status >= 300 && response.status < 400 && redirectCount < MAX_REDIRECTS) {
      const location = response.headers.get('location');
      if (!location) break;

      const nextUrl = new URL(location, currentUrl).toString();

      // Validate redirect target
      const redirectSchemeCheck = validateScheme(nextUrl);
      if (!redirectSchemeCheck.valid) {
        return {
          success: false,
          status: 'BLOCKED_REDIRECT',
          originalUrl: trimmedUrl,
          finalUrl: currentUrl,
          extractedTitle: null,
          extractedText: null,
          explanation: `Redirect to "${nextUrl}" was blocked: ${redirectSchemeCheck.reason}`,
        };
      }

      const redirectHostCheck = await validateHostIsPublic(nextUrl);
      if (!redirectHostCheck.safe) {
        return {
          success: false,
          status: 'BLOCKED_SSRF',
          originalUrl: trimmedUrl,
          finalUrl: currentUrl,
          extractedTitle: null,
          extractedText: null,
          explanation: `Redirect to "${nextUrl}" was blocked (SSRF protection): ${redirectHostCheck.reason}`,
        };
      }

      currentUrl = nextUrl;
      redirectCount++;
      response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: BROWSER_HEADERS,
      });
    }

    if (redirectCount >= MAX_REDIRECTS && response.status >= 300 && response.status < 400) {
      return {
        success: false,
        status: 'TOO_MANY_REDIRECTS',
        originalUrl: trimmedUrl,
        finalUrl: currentUrl,
        extractedTitle: null,
        extractedText: null,
        explanation: `Exceeded maximum redirect limit (${MAX_REDIRECTS}). The URL may be in a redirect loop.`,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        status: 'HTTP_ERROR',
        originalUrl: trimmedUrl,
        finalUrl: currentUrl,
        httpStatus: response.status,
        extractedTitle: null,
        extractedText: null,
        explanation: `The page returned HTTP ${response.status}. The job posting may have been removed or require authentication.`,
      };
    }

    // 4. Content-Type validation
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return {
        success: false,
        status: 'UNSUPPORTED_CONTENT_TYPE',
        originalUrl: trimmedUrl,
        finalUrl: currentUrl,
        extractedTitle: null,
        extractedText: null,
        explanation: `The URL returned content type "${contentType}" which is not supported for job text extraction. Only HTML pages are supported.`,
      };
    }

    // 5. Size-limited read
    const reader = response.body?.getReader();
    if (!reader) {
      return {
        success: false,
        status: 'READ_ERROR',
        originalUrl: trimmedUrl,
        finalUrl: currentUrl,
        extractedTitle: null,
        extractedText: null,
        explanation: 'Could not read response body from the URL.',
      };
    }

    let rawBytes = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawBytes += value.length;
      if (rawBytes > MAX_RESPONSE_BYTES) {
        reader.cancel();
        break;
      }
      chunks.push(value);
    }

    const html = new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    const { title, bodyText } = extractTextFromHtml(html);
    const hasSufficientText = Boolean(bodyText && bodyText.trim().length >= 30);
    const explanation = hasSufficientText
      ? `Job posting page fetched successfully from "${currentUrl}".`
      : `The page was fetched (${rawBytes} bytes), but readable job text could not be extracted because this job board uses client-side JavaScript rendering (Single Page Application like Naukri or Workday). Please copy and paste the job description text into the "Job Description" field.`;

    logger.info(`[UrlIngestion] Fetched: ${currentUrl} (${rawBytes} bytes, textLength: ${bodyText ? bodyText.length : 0})`);

    return {
      success: hasSufficientText,
      status: hasSufficientText ? 'OK' : 'CLIENT_RENDERED_SPA',
      originalUrl: trimmedUrl,
      finalUrl: currentUrl,
      httpStatus: response.status,
      redirects: redirectCount,
      extractedTitle: title || null,
      extractedText: hasSufficientText ? bodyText : null,
      bytesRead: rawBytes,
      explanation,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        status: 'TIMEOUT',
        originalUrl: trimmedUrl,
        finalUrl: currentUrl,
        extractedTitle: null,
        extractedText: null,
        explanation: `Request to "${trimmedUrl}" timed out after ${FETCH_TIMEOUT_MS / 1000} seconds.`,
      };
    }
    logger.warn('[UrlIngestion] Fetch error:', err.message);
    return {
      success: false,
      status: 'FETCH_ERROR',
      originalUrl: trimmedUrl,
      finalUrl: currentUrl,
      extractedTitle: null,
      extractedText: null,
      explanation: `Failed to fetch the URL: ${err.message}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

export default { fetchJobPostingFromUrl };

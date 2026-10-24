/**
 * domainVerificationService.js
 *
 * Performs technical domain verification:
 *  - DNS A/MX record resolution
 *  - HTTPS reachability check
 *  - RDAP (Registration Data Access Protocol) domain age retrieval
 *  - Free/public email provider detection
 *  - Lookalike / typosquatting domain detection
 *
 * All checks are best-effort. Failures are reported as SOURCE_UNAVAILABLE or
 * NOT_CHECKED, never as definitive proof the company is fake.
 */

import dns from 'dns/promises';
import { logger } from '../utils/logger.js';

// ── Constants ────────────────────────────────────────────────────────────────

/** Well-known free / public email providers. Not exhaustive. */
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'tutanota.com', 'tutamail.com',
  'zoho.com', 'yandex.com', 'yandex.ru',
  'mail.com', 'gmx.com', 'gmx.net', 'inbox.com',
  'rediffmail.com', 'sify.com',
]);

const FETCH_TIMEOUT_MS = 8000;
const RDAP_TIMEOUT_MS = 6000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a structured check result object.
 *
 * @param {object} fields
 * @returns {object}
 */
const mkResult = (fields) => ({
  status: 'NOT_CHECKED',
  evidence: null,
  sourceUrl: null,
  checkedAt: new Date().toISOString(),
  explanation: '',
  ...fields,
});

/**
 * Fetches a URL with a timeout using AbortController.
 * Returns null if the request fails or times out.
 *
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<Response|null>}
 */
const fetchWithTimeout = async (url, timeoutMs = FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Checks whether an email address uses a free / public provider.
 *
 * @param {string} email
 * @returns {{ isFreeEmail: boolean, domain: string, explanation: string }}
 */
export const checkFreeEmailProvider = (email) => {
  if (!email || typeof email !== 'string') {
    return { isFreeEmail: false, domain: '', explanation: 'No email address provided.' };
  }
  const parts = email.toLowerCase().split('@');
  if (parts.length !== 2 || !parts[1]) {
    return { isFreeEmail: false, domain: '', explanation: 'Email format could not be parsed.' };
  }
  const domain = parts[1].trim();
  const isFreeEmail = FREE_EMAIL_PROVIDERS.has(domain);
  return {
    isFreeEmail,
    domain,
    explanation: isFreeEmail
      ? `The recruiter email uses "${domain}", a free public email provider. Legitimate recruiters at established companies typically use corporate domains.`
      : `The recruiter email domain "${domain}" is not a known free public provider.`,
  };
};

/**
 * Resolves DNS A and MX records for a given domain.
 *
 * @param {string} domain
 * @returns {Promise<object>}
 */
export const resolveDnsRecords = async (domain) => {
  if (!domain) {
    return mkResult({ status: 'NOT_CHECKED', explanation: 'No domain provided for DNS lookup.' });
  }

  try {
    const [aRecords, mxRecords] = await Promise.allSettled([
      dns.resolve4(domain),
      dns.resolveMx(domain),
    ]);

    let aAddresses = aRecords.status === 'fulfilled' ? aRecords.value : [];
    const mxEntries = mxRecords.status === 'fulfilled' ? mxRecords.value : [];

    // Fallback to system resolver if resolve4 failed (e.g. Windows/network ECONNREFUSED on port 53)
    if (aAddresses.length === 0) {
      try {
        const lookupResults = await dns.lookup(domain, { all: true });
        aAddresses = (lookupResults || [])
          .filter((r) => r.family === 4)
          .map((r) => r.address);
      } catch {}
    }

    const hasA = aAddresses.length > 0;
    const hasMx = mxEntries.length > 0;

    if (!hasA && !hasMx) {
      return mkResult({
        status: 'NOT_FOUND',
        explanation: `No DNS A or MX records found for domain "${domain}". The domain may not exist or may not be actively used.`,
        evidence: { domain, aRecords: [], mxRecords: [] },
      });
    }

    return mkResult({
      status: 'VERIFIED',
      explanation: `DNS records found for "${domain}": ${aAddresses.length} A record(s), ${mxEntries.length} MX record(s).`,
      evidence: {
        domain,
        aRecords: aAddresses.slice(0, 3),
        mxRecords: mxEntries.slice(0, 3).map((m) => ({ exchange: m.exchange, priority: m.priority })),
      },
    });
  } catch (err) {
    logger.warn(`DNS lookup failed for domain "${domain}":`, err.message);
    return mkResult({
      status: 'SOURCE_UNAVAILABLE',
      explanation: `DNS lookup for "${domain}" failed: ${err.message}`,
    });
  }
};

/**
 * Checks whether a URL is reachable over HTTPS and returns HTTP status.
 *
 * @param {string} url - Full URL to check (must start with https://)
 * @returns {Promise<object>}
 */
export const checkWebsiteReachability = async (url) => {
  if (!url) {
    return mkResult({ status: 'NOT_CHECKED', explanation: 'No URL provided for reachability check.' });
  }

  try {
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!response) {
      return mkResult({
        status: 'SOURCE_UNAVAILABLE',
        sourceUrl: url,
        explanation: `The website "${url}" could not be reached (request timed out or network error).`,
      });
    }

    if (response.ok || (response.status >= 200 && response.status < 400)) {
      return mkResult({
        status: 'VERIFIED',
        sourceUrl: url,
        explanation: `Website "${url}" is reachable (HTTP ${response.status}).`,
        evidence: { httpStatus: response.status, finalUrl: response.url },
      });
    }

    return mkResult({
      status: 'SUSPICIOUS',
      sourceUrl: url,
      explanation: `Website "${url}" returned HTTP ${response.status}. The domain exists but the page may be unavailable or returning an error.`,
      evidence: { httpStatus: response.status },
    });
  } catch (err) {
    logger.warn(`Reachability check failed for "${url}":`, err.message);
    return mkResult({
      status: 'SOURCE_UNAVAILABLE',
      sourceUrl: url,
      explanation: `Could not complete reachability check for "${url}": ${err.message}`,
    });
  }
};

/**
 * Retrieves domain registration details via RDAP (Registration Data Access Protocol).
 * Falls back gracefully if the TLD does not support RDAP.
 *
 * @param {string} domain
 * @returns {Promise<object>}
 */
export const getRdapDomainInfo = async (domain) => {
  if (!domain) {
    return mkResult({ status: 'NOT_CHECKED', explanation: 'No domain provided for RDAP lookup.' });
  }

  const rdapBootstrapUrl = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
  try {
    const response = await fetchWithTimeout(rdapBootstrapUrl, RDAP_TIMEOUT_MS);
    if (!response) {
      return mkResult({
        status: 'SOURCE_UNAVAILABLE',
        sourceUrl: rdapBootstrapUrl,
        explanation: `RDAP lookup for "${domain}" timed out.`,
      });
    }

    if (!response.ok) {
      return mkResult({
        status: 'SOURCE_UNAVAILABLE',
        sourceUrl: rdapBootstrapUrl,
        explanation: `RDAP returned HTTP ${response.status} for domain "${domain}". Registration data unavailable.`,
      });
    }

    const data = await response.json();

    // Extract registration date from events
    const events = Array.isArray(data.events) ? data.events : [];
    const registrationEvent = events.find(
      (e) => e.eventAction === 'registration' || e.eventAction === 'created'
    );
    const expirationEvent = events.find(
      (e) => e.eventAction === 'expiration'
    );

    const registeredDate = registrationEvent?.eventDate || null;
    const expiresDate = expirationEvent?.eventDate || null;

    let ageExplanation = '';
    let ageWarning = false;

    if (registeredDate) {
      const regMs = new Date(registeredDate).getTime();
      const nowMs = Date.now();
      const ageYears = (nowMs - regMs) / (1000 * 60 * 60 * 24 * 365.25);
      if (ageYears < 0.5) {
        ageWarning = true;
        ageExplanation = `Domain registered very recently (${Math.round(ageYears * 12)} months ago). Newly registered domains used for recruitment are a potential warning signal.`;
      } else if (ageYears < 2) {
        ageExplanation = `Domain registered approximately ${Math.round(ageYears * 12)} months ago.`;
      } else {
        ageExplanation = `Domain has been registered for approximately ${Math.round(ageYears)} year(s), consistent with an established entity.`;
      }
    }

    const registrar = data.entities?.find((e) =>
      Array.isArray(e.roles) && e.roles.includes('registrar')
    )?.vcardArray?.[1]?.find(([k]) => k === 'fn')?.[3] || null;

    return mkResult({
      status: ageWarning ? 'SUSPICIOUS' : 'VERIFIED',
      sourceUrl: rdapBootstrapUrl,
      explanation: registeredDate
        ? ageExplanation
        : `RDAP returned data for "${domain}" but no registration date was found.`,
      evidence: {
        domain,
        registeredDate,
        expiresDate,
        registrar,
        rdapHandle: data.handle || null,
      },
    });
  } catch (err) {
    logger.warn(`RDAP lookup failed for "${domain}":`, err.message);
    return mkResult({
      status: 'SOURCE_UNAVAILABLE',
      sourceUrl: rdapBootstrapUrl,
      explanation: `RDAP lookup for "${domain}" failed: ${err.message}`,
    });
  }
};

/**
 * Detects suspicious lookalike domains by comparing two domain strings
 * for common typosquatting patterns (character substitution, addition, transposition).
 *
 * This is a heuristic, not a definitive check.
 *
 * @param {string} claimedDomain - Domain claimed by recruiter
 * @param {string} officialDomain - Known official domain of the company
 * @returns {{ isSuspicious: boolean, explanation: string }}
 */
export const detectLookalikeDomain = (claimedDomain, officialDomain) => {
  if (!claimedDomain || !officialDomain) {
    return { isSuspicious: false, explanation: 'Insufficient domain data for lookalike check.' };
  }

  const clean = (d) => d.toLowerCase().replace(/^www\./, '').split('.')[0];
  const a = clean(claimedDomain);
  const b = clean(officialDomain);

  if (a === b) {
    return { isSuspicious: false, explanation: 'Domain matches official company domain.' };
  }

  // Simple Levenshtein distance
  const levenshtein = (s, t) => {
    const dp = Array.from({ length: s.length + 1 }, (_, i) =>
      Array.from({ length: t.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= s.length; i++) {
      for (let j = 1; j <= t.length; j++) {
        dp[i][j] =
          s[i - 1] === t[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[s.length][t.length];
  };

  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);

  if (dist <= 2 && maxLen >= 4) {
    return {
      isSuspicious: true,
      explanation: `The recruiter domain "${claimedDomain}" is very similar to the official domain "${officialDomain}" (edit distance: ${dist}). This may indicate a typosquatting or impersonation attempt.`,
    };
  }

  return {
    isSuspicious: false,
    explanation: `The recruiter domain "${claimedDomain}" does not closely resemble the official domain "${officialDomain}".`,
  };
};

export default {
  checkFreeEmailProvider,
  resolveDnsRecords,
  checkWebsiteReachability,
  getRdapDomainInfo,
  detectLookalikeDomain,
};

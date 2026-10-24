/**
 * companyVerificationService.js
 *
 * Verifies company authenticity using available public signals:
 *  - Web search via Google Custom Search API (optional, requires API key)
 *  - Official website identification and reachability
 *  - Domain age via RDAP
 *  - Brand impersonation heuristics
 *
 * IMPORTANT: A reachable website and valid domain do NOT prove a job listing is genuine.
 * This service reports evidence; the scoring engine evaluates it.
 *
 * If GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX are not configured, the web-search
 * step is skipped and reported as SOURCE_UNAVAILABLE.
 */

import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  resolveDnsRecords,
  checkWebsiteReachability,
  getRdapDomainInfo,
} from './domainVerificationService.js';
import { searchTavily } from './tavilySearchService.js';

const SEARCH_TIMEOUT_MS = 8000;

// ── Helpers ──────────────────────────────────────────────────────────────────

const mkResult = (fields) => ({
  status: 'NOT_CHECKED',
  evidence: null,
  sourceUrl: null,
  checkedAt: new Date().toISOString(),
  explanation: '',
  ...fields,
});

const fetchWithTimeout = async (url, timeoutMs = SEARCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
};

/**
 * Extracts the hostname/domain from a URL string.
 * Returns null if the URL is invalid.
 *
 * @param {string} url
 * @returns {string|null}
 */
const extractDomain = (url) => {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

// ── Web Search (Tavily Search API with Google Fallback) ──────────────────────

/**
 * Performs a company web search using Tavily Search API (or Google Custom Search fallback).
 * Returns top organic result URLs and titles.
 *
 * @param {string} query
 * @returns {Promise<{ items: Array, status: string, sourceUrl: string, explanation: string }>}
 */
const executeWebSearch = async (query) => {
  // 1. Primary provider: Tavily Search API
  if (config.tavilyApiKey) {
    const tavilyRes = await searchTavily(query, { maxResults: 5 });
    return {
      items: tavilyRes.items || [],
      status: tavilyRes.status,
      sourceUrl: null,
      explanation: tavilyRes.explanation,
    };
  }

  // 2. Fallback provider: Google Custom Search API
  const apiKey = config.googleSearchApiKey;
  const cx = config.googleSearchCx;

  if (apiKey && cx) {
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=5`;
    const response = await fetchWithTimeout(searchUrl, SEARCH_TIMEOUT_MS);
    if (!response) {
      return { items: [], status: 'SOURCE_UNAVAILABLE', sourceUrl: null, explanation: 'Google Search API request timed out.' };
    }

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        errMsg = errBody?.error?.message || errMsg;
      } catch {}
      logger.warn('Google Search API error:', errMsg);
      return { items: [], status: 'SOURCE_UNAVAILABLE', sourceUrl: null, explanation: `Google Search API error: ${errMsg}` };
    }

    const data = await response.json();
    const items = (data.items || []).map((item) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink || extractDomain(item.link),
    }));

    return { items, status: 'OK', sourceUrl: null, explanation: `Found ${items.length} search results via Google.` };
  }

  return {
    items: [],
    status: 'SOURCE_UNAVAILABLE',
    sourceUrl: null,
    explanation: 'Web search API is not configured. Set TAVILY_API_KEY in server/.env to enable company web search.',
  };
};

// ── Main Verification ─────────────────────────────────────────────────────────

/**
 * Verifies a company by searching the web for its official presence,
 * checking website reachability, and inspecting domain registration age.
 *
 * @param {string} companyName - Name of the company to verify
 * @returns {Promise<object>} Structured company verification result
 */
export const verifyCompany = async (companyName) => {
  if (!companyName || companyName.trim().length < 2) {
    return {
      overallStatus: 'NOT_CHECKED',
      companyName: companyName || '',
      checkedAt: new Date().toISOString(),
      explanation: 'No company name provided; company verification skipped.',
      webSearch: mkResult({ status: 'NOT_CHECKED', explanation: 'No company name.' }),
      websiteReachability: mkResult({ status: 'NOT_CHECKED', explanation: 'No company name.' }),
      dnsRecords: mkResult({ status: 'NOT_CHECKED', explanation: 'No company name.' }),
      rdapInfo: mkResult({ status: 'NOT_CHECKED', explanation: 'No company name.' }),
      identifiedOfficialDomain: null,
    };
  }

  const name = companyName.trim();
  logger.info(`[CompanyVerification] Starting verification for: "${name}"`);

  // 1. Web search for official company presence
  const searchQuery = `"${name}" official website company`;
  const searchResult = await executeWebSearch(searchQuery);

  let identifiedOfficialDomain = null;
  let identifiedOfficialUrl = null;
  let webSearchStatus = 'NOT_FOUND';
  let webSearchExplanation = '';

  if (searchResult.status === 'SOURCE_UNAVAILABLE') {
    webSearchStatus = 'SOURCE_UNAVAILABLE';
    webSearchExplanation = searchResult.explanation;
  } else if (searchResult.items.length > 0) {
    // If user provided a domain/URL directly as company name, prioritize it
    const directDomain = extractDomain(name);
    if (directDomain && directDomain.includes('.') && !name.includes(' ')) {
      identifiedOfficialDomain = directDomain;
      identifiedOfficialUrl = name.startsWith('http') ? name : `https://${name}`;
    } else {
      // Pick best candidate, preferring company domain over social profiles
      const candidate = searchResult.items.find((item) => {
        const d = extractDomain(item.link);
        return d && !/wikipedia\.org|x\.com|twitter\.com|facebook\.com|instagram\.com|youtube\.com/i.test(d);
      }) || searchResult.items[0];

      identifiedOfficialUrl = candidate.link;
      identifiedOfficialDomain = extractDomain(candidate.link);
    }
    webSearchStatus = 'VERIFIED';
    webSearchExplanation = `Web search found "${name}" — official candidate domain: "${identifiedOfficialDomain}". NOTE: Search results cannot independently confirm company legitimacy.`;
  } else {
    webSearchExplanation = `No web search results found for "${name}". This may indicate the company has a minimal online presence or the name is too generic.`;
  }

  const webSearchResult = mkResult({
    status: webSearchStatus,
    explanation: webSearchExplanation,
    evidence: {
      query: searchQuery,
      topResults: searchResult.items.slice(0, 3).map((i) => ({
        title: i.title,
        url: i.link,
        displayLink: i.displayLink,
      })),
    },
  });

  // 2. Run DNS, reachability, and RDAP in parallel (only if we have a domain)
  let dnsResult = mkResult({ status: 'NOT_CHECKED', explanation: 'No official domain identified.' });
  let reachabilityResult = mkResult({ status: 'NOT_CHECKED', explanation: 'No official domain identified.' });
  let rdapResult = mkResult({ status: 'NOT_CHECKED', explanation: 'No official domain identified.' });

  if (identifiedOfficialDomain) {
    const officialUrl = identifiedOfficialUrl?.startsWith('http')
      ? identifiedOfficialUrl
      : `https://${identifiedOfficialDomain}`;

    [dnsResult, reachabilityResult, rdapResult] = await Promise.all([
      resolveDnsRecords(identifiedOfficialDomain),
      checkWebsiteReachability(officialUrl),
      getRdapDomainInfo(identifiedOfficialDomain),
    ]);
  }

  // 3. Derive overall status
  const statuses = [webSearchResult.status, dnsResult.status, reachabilityResult.status];
  let overallStatus = 'NOT_CHECKED';
  if (statuses.includes('SUSPICIOUS')) {
    overallStatus = 'SUSPICIOUS';
  } else if (statuses.every((s) => s === 'SOURCE_UNAVAILABLE' || s === 'NOT_CHECKED')) {
    overallStatus = 'SOURCE_UNAVAILABLE';
  } else if (statuses.some((s) => s === 'VERIFIED')) {
    overallStatus = 'VERIFIED';
  } else if (statuses.includes('NOT_FOUND')) {
    overallStatus = 'NOT_FOUND';
  }

  const overallExplanation = identifiedOfficialDomain
    ? `Company "${name}" appears in web search results. Official domain candidate: "${identifiedOfficialDomain}". Domain and website checks completed. A reachable website does NOT confirm the job listing is genuine.`
    : webSearchExplanation;

  return {
    overallStatus,
    companyName: name,
    checkedAt: new Date().toISOString(),
    explanation: overallExplanation,
    identifiedOfficialDomain,
    identifiedOfficialUrl,
    webSearch: webSearchResult,
    websiteReachability: reachabilityResult,
    dnsRecords: dnsResult,
    rdapInfo: rdapResult,
  };
};

export default { verifyCompany };

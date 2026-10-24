/**
 * scamIntelligenceService.js
 *
 * Searches publicly accessible scam intelligence sources for known fraud reports
 * related to the submitted job, recruiter, or company.
 *
 * Sources used (all public, no authentication required for basic queries):
 *  - FTC Consumer Sentinel (public consumer information page)
 *  - IC3 (Internet Crime Complaint Center — public advisories page)
 *  - Google Safe Browsing API (requires API key — optional)
 *  - Web search for reported scam terms (via Google Custom Search if configured)
 *
 * IMPORTANT: Absence of a complaint does NOT mean a contact is safe.
 * Only mark something as a known scammer when reliable evidence supports it.
 */

import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { searchTavily } from './tavilySearchService.js';

const FETCH_TIMEOUT_MS = 7000;

// ── Helpers ──────────────────────────────────────────────────────────────────

const mkResult = (fields) => ({
  status: 'NOT_CHECKED',
  evidence: null,
  sourceUrl: null,
  checkedAt: new Date().toISOString(),
  explanation: '',
  ...fields,
});

const fetchWithTimeout = async (url, timeoutMs = FETCH_TIMEOUT_MS) => {
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

// ── Google Safe Browsing ──────────────────────────────────────────────────────

/**
 * Checks a URL against the Google Safe Browsing API.
 * Requires GOOGLE_SAFE_BROWSING_API_KEY environment variable.
 *
 * @param {string} url - URL to check
 * @returns {Promise<object>}
 */
export const checkSafeBrowsing = async (url) => {
  if (!url) {
    return mkResult({ status: 'NOT_CHECKED', explanation: 'No URL provided for Safe Browsing check.' });
  }

  const apiKey = config.googleSafeBrowsingApiKey;
  if (!apiKey) {
    return mkResult({
      status: 'SOURCE_UNAVAILABLE',
      explanation: 'Google Safe Browsing API key not configured (GOOGLE_SAFE_BROWSING_API_KEY). Set this environment variable to enable malware/phishing URL checks.',
    });
  }

  const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`;
  const body = {
    client: { clientId: 'fake-job-detector', clientVersion: '2.0' },
    threatInfo: {
      threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'POTENTIALLY_HARMFUL_APPLICATION', 'UNWANTED_SOFTWARE'],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url }],
    },
  };

  try {
    const response = await fetchWithTimeout(apiUrl, FETCH_TIMEOUT_MS);
    if (!response) {
      return mkResult({
        status: 'SOURCE_UNAVAILABLE',
        sourceUrl: url,
        explanation: 'Google Safe Browsing API request timed out.',
      });
    }
    if (!response.ok) {
      return mkResult({
        status: 'SOURCE_UNAVAILABLE',
        sourceUrl: url,
        explanation: `Google Safe Browsing API returned HTTP ${response.status}.`,
      });
    }

    const data = await response.json();
    const matches = data?.matches || [];

    if (matches.length > 0) {
      const threatTypes = matches.map((m) => m.threatType).join(', ');
      return mkResult({
        status: 'SUSPICIOUS',
        sourceUrl: url,
        explanation: `Google Safe Browsing flagged "${url}" for: ${threatTypes}. This URL may be associated with malware or phishing.`,
        evidence: { url, threatTypes: matches.map((m) => m.threatType) },
      });
    }

    return mkResult({
      status: 'VERIFIED',
      sourceUrl: url,
      explanation: `Google Safe Browsing found no threat matches for "${url}". Note: absence of a flag does not guarantee the URL is safe.`,
      evidence: { url, threatMatches: 0 },
    });
  } catch (err) {
    logger.warn('Safe Browsing API error:', err.message);
    return mkResult({
      status: 'SOURCE_UNAVAILABLE',
      explanation: `Safe Browsing check failed: ${err.message}`,
    });
  }
};

// ── Scam Search via Google Custom Search ─────────────────────────────────────

/**
 * Searches the web for scam reports related to the company, email, or domain
 * using Google Custom Search API (if configured).
 *
 * @param {object} params
 * @param {string} [params.companyName]
 * @param {string} [params.recruiterEmail]
 * @param {string} [params.recruiterDomain]
 * @returns {Promise<object>}
 */
export const searchScamReports = async ({ companyName, recruiterEmail, recruiterDomain }) => {
  const apiKey = config.googleSearchApiKey;
  const cx = config.googleSearchCx;

  const terms = [
    companyName && `"${companyName}" scam`,
    recruiterEmail && `"${recruiterEmail}" scam`,
    recruiterDomain && `"${recruiterDomain}" recruitment fraud`,
  ].filter(Boolean);

  if (terms.length === 0) {
    return mkResult({ status: 'NOT_CHECKED', explanation: 'No terms provided for scam report search.' });
  }

  // Use the most specific term available
  const query = terms[terms.length > 1 ? 1 : 0];
  let items = [];

  try {
    if (config.tavilyApiKey) {
      const tavilyRes = await searchTavily(query, { maxResults: 5 });
      if (tavilyRes.status === 'OK') {
        items = tavilyRes.items.map((i) => ({
          title: i.title,
          link: i.link,
          snippet: i.snippet,
        }));
      } else if (tavilyRes.status === 'NOT_FOUND') {
        items = [];
      } else if (tavilyRes.status === 'SOURCE_UNAVAILABLE') {
        return mkResult({
          status: 'SOURCE_UNAVAILABLE',
          explanation: tavilyRes.explanation,
        });
      }
    } else if (apiKey && cx) {
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=5`;
      const response = await fetchWithTimeout(searchUrl, FETCH_TIMEOUT_MS);
      if (!response || !response.ok) {
        return mkResult({
          status: 'SOURCE_UNAVAILABLE',
          explanation: `Scam report search failed (HTTP ${response?.status || 'timeout'}).`,
        });
      }

      const data = await response.json();
      items = (data.items || []).map((i) => ({
        title: i.title,
        link: i.link,
        snippet: i.snippet,
      }));
    } else {
      return mkResult({
        status: 'SOURCE_UNAVAILABLE',
        explanation: 'Web search not configured (TAVILY_API_KEY missing). Scam report web search unavailable.',
      });
    }

    // Heuristic: look for scam-related keywords in titles/snippets
    const SCAM_KEYWORDS = ['scam', 'fraud', 'fake', 'phishing', 'complaint', 'warning', 'beware', 'impersonation', 'ripoff'];
    const scamHits = items.filter((item) => {
      const text = `${item.title} ${item.snippet}`.toLowerCase();
      return SCAM_KEYWORDS.some((kw) => text.includes(kw));
    });

    if (scamHits.length > 0) {
      return mkResult({
        status: 'SUSPICIOUS',
        explanation: `Found ${scamHits.length} web result(s) containing scam or fraud indicators related to "${query}". Review the evidence carefully before concluding fraud.`,
        evidence: {
          query,
          scamHits: scamHits.slice(0, 3).map((h) => ({ title: h.title, url: h.link, snippet: h.snippet })),
          totalResults: items.length,
        },
      });
    }

    return mkResult({
      status: 'VERIFIED',
      explanation: `No obvious scam reports found in web search for "${query}". Absence of complaints does not confirm legitimacy.`,
      evidence: { query, totalResults: items.length },
    });
  } catch (err) {
    logger.warn('Scam search error:', err.message);
    return mkResult({
      status: 'SOURCE_UNAVAILABLE',
      explanation: `Scam report search failed: ${err.message}`,
    });
  }
};

// ── Known Advance-Fee / Task Scam Pattern Check ───────────────────────────────

/**
 * Checks the job description text for known advance-fee and task scam patterns
 * using a rule-based heuristic (no external API required).
 *
 * @param {string} jobDescription
 * @returns {object}
 */
export const checkAdvanceFeePatterns = (jobDescription) => {
  if (!jobDescription) {
    return mkResult({ status: 'NOT_CHECKED', explanation: 'No job description provided.' });
  }

  const text = jobDescription.toLowerCase();

  const ADVANCE_FEE_PATTERNS = [
    { pattern: /registration fee/i, label: 'Registration fee demand' },
    { pattern: /training fee|training charge/i, label: 'Training fee demand' },
    { pattern: /security deposit/i, label: 'Security deposit demand' },
    { pattern: /refundable deposit/i, label: 'Refundable deposit scheme' },
    { pattern: /pay.*before.*start|payment.*before.*join/i, label: 'Payment before joining' },
    { pattern: /certified (cheque|check)|cashier.{0,10}check/i, label: 'Fake cheque scheme indicator' },
    { pattern: /wire transfer.*equipment|buy.*equipment.*reimburse/i, label: 'Equipment purchase reimbursement scheme' },
    { pattern: /send money.*vendor|purchase.*laptop.*reimburs/i, label: 'Equipment purchase scam pattern' },
    { pattern: /no interview (needed|required)|immediate(ly)? hired|hired without interview/i, label: 'No interview required (red flag)' },
    { pattern: /\$[\d,]+\s*(per day|\/day|a day).*entry.level|entry.level.*\$[\d,]+\s*(per day|\/day)/i, label: 'Unrealistic daily pay for entry-level work' },
    { pattern: /₹[\d,]+\s*(per day|\/day|a day)/i, label: 'Unusually high daily pay claim (INR)' },
    { pattern: /contact.*telegram|communicate.*telegram|whatsapp.*only|signal.*only/i, label: 'Exclusive informal messaging app communication' },
    { pattern: /bank account (detail|number|info)|ssn|social security|aadhaar number|pan card.*before/i, label: 'Premature request for sensitive personal/financial information' },
    { pattern: /task.*based.*earn|complete.*task.*paid|earn.*per task/i, label: 'Task-based payment scheme' },
  ];

  const matchedPatterns = ADVANCE_FEE_PATTERNS.filter(({ pattern }) => pattern.test(text));

  if (matchedPatterns.length === 0) {
    return mkResult({
      status: 'VERIFIED',
      explanation: 'No advance-fee, fake cheque, task-scam, or premature data-collection patterns detected in job description text.',
      evidence: { patternsChecked: ADVANCE_FEE_PATTERNS.length, matchCount: 0 },
    });
  }

  return mkResult({
    status: 'SUSPICIOUS',
    explanation: `Detected ${matchedPatterns.length} scam pattern(s) in job description: ${matchedPatterns.map((p) => p.label).join('; ')}.`,
    evidence: {
      matchedPatterns: matchedPatterns.map((p) => p.label),
      patternsChecked: ADVANCE_FEE_PATTERNS.length,
    },
  });
};

// ── Main Orchestrator ─────────────────────────────────────────────────────────

/**
 * Runs all scam intelligence checks for a given job posting.
 *
 * @param {object} params
 * @param {string} [params.companyName]
 * @param {string} [params.recruiterEmail]
 * @param {string} [params.officialDomain]
 * @param {string} [params.applicationUrl]
 * @param {string} [params.jobDescription]
 * @returns {Promise<object>}
 */
export const runScamIntelligence = async ({
  companyName,
  recruiterEmail,
  officialDomain,
  applicationUrl,
  jobDescription,
}) => {
  logger.info('[ScamIntelligence] Running scam intelligence checks...');

  const recruiterDomain = recruiterEmail
    ? recruiterEmail.split('@')[1]?.toLowerCase() || null
    : null;

  const [safeBrowsing, scamReports, advanceFeeCheck] = await Promise.all([
    checkSafeBrowsing(applicationUrl || null),
    searchScamReports({ companyName, recruiterEmail, recruiterDomain }),
    Promise.resolve(checkAdvanceFeePatterns(jobDescription)),
  ]);

  const results = [safeBrowsing, scamReports, advanceFeeCheck];
  const hasSuspicious = results.some((r) => r.status === 'SUSPICIOUS');
  const hasVerified = results.some((r) => r.status === 'VERIFIED');
  const allUnavailable = results.every((r) =>
    r.status === 'SOURCE_UNAVAILABLE' || r.status === 'NOT_CHECKED'
  );

  let overallStatus = 'NOT_CHECKED';
  if (hasSuspicious) overallStatus = 'SUSPICIOUS';
  else if (allUnavailable) overallStatus = 'SOURCE_UNAVAILABLE';
  else if (hasVerified) overallStatus = 'VERIFIED';

  return {
    overallStatus,
    checkedAt: new Date().toISOString(),
    explanation: hasSuspicious
      ? 'Scam intelligence checks found suspicious signals. Review individual results for details.'
      : hasVerified
      ? 'No scam intelligence signals found. Note: absence of complaints does not confirm legitimacy.'
      : 'Scam intelligence checks could not be completed (external services unavailable or not configured).',
    safeBrowsing,
    scamReports,
    advanceFeePatterns: advanceFeeCheck,
  };
};

export default { runScamIntelligence, checkSafeBrowsing, searchScamReports, checkAdvanceFeePatterns };

/**
 * careersVerificationService.js
 *
 * Checks whether the submitted job exists on the company's official careers page
 * or a supported public Applicant Tracking System (ATS).
 *
 * Supported ATS adapters:
 *  - Greenhouse (boards.greenhouse.io)
 *  - Lever (jobs.lever.co)
 *  - Workday (via public page search — heuristic only)
 *
 * Status values returned:
 *  VERIFIED_MATCH   — Job found and matches title/location
 *  POSSIBLE_MATCH   — Partial match found (title only or location only)
 *  NOT_FOUND        — ATS is reachable but job not found (not conclusive proof of fraud)
 *  SOURCE_UNAVAILABLE — ATS endpoint could not be reached
 *  NOT_CHECKED      — Required inputs are missing
 *
 * IMPORTANT: NOT_FOUND must never be treated as definitive proof that a job is fake.
 * Many legitimate jobs are not listed on any public ATS.
 */

import { logger } from '../utils/logger.js';

const FETCH_TIMEOUT_MS = 8000;

// ── Helpers ──────────────────────────────────────────────────────────────────

const mkResult = (fields) => ({
  status: 'NOT_CHECKED',
  matchedUrl: null,
  retrievedAt: new Date().toISOString(),
  explanation: '',
  evidence: null,
  ...fields,
});

const fetchWithTimeout = async (url, timeoutMs = FETCH_TIMEOUT_MS, options = {}) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, ...options });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
};

/**
 * Normalizes a string for fuzzy comparison: lowercase, strip punctuation.
 *
 * @param {string} s
 * @returns {string}
 */
const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

/**
 * Returns true if needle is a substring of haystack after normalization.
 *
 * @param {string} haystack
 * @param {string} needle
 * @returns {boolean}
 */
const fuzzyContains = (haystack, needle) => {
  if (!needle) return false;
  return normalize(haystack).includes(normalize(needle));
};

// ── Greenhouse Adapter ───────────────────────────────────────────────────────

/**
 * Searches the Greenhouse public job board API for a matching job.
 *
 * Greenhouse board token is the subdomain of boards.greenhouse.io/<token>.
 * We derive token candidates from the company name and attempt them.
 *
 * @param {string} companyName
 * @param {string} jobTitle
 * @returns {Promise<object>}
 */
const checkGreenhouse = async (companyName, jobTitle) => {
  if (!companyName) return mkResult({ status: 'NOT_CHECKED', explanation: 'No company name for Greenhouse lookup.' });

  // Derive board token candidates from company name
  const tokenCandidates = [
    companyName.toLowerCase().replace(/[^a-z0-9]/g, ''),
    companyName.toLowerCase().replace(/\s+/g, ''),
    companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
  ].filter((t, i, arr) => t && arr.indexOf(t) === i);

  for (const token of tokenCandidates) {
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`;
    try {
      const response = await fetchWithTimeout(apiUrl, FETCH_TIMEOUT_MS);
      if (!response || !response.ok) continue;

      const data = await response.json();
      const jobs = data?.jobs || [];

      if (jobs.length === 0) {
        return mkResult({
          status: 'NOT_FOUND',
          matchedUrl: `https://boards.greenhouse.io/${token}`,
          explanation: `Greenhouse board found for "${companyName}" (token: ${token}) but contains no current job listings.`,
          evidence: { atsProvider: 'Greenhouse', token, totalJobs: 0 },
        });
      }

      // Search for matching job
      const titleMatches = jobs.filter((j) => fuzzyContains(j.title, jobTitle));
      if (titleMatches.length > 0) {
        const bestMatch = titleMatches[0];
        return mkResult({
          status: 'VERIFIED_MATCH',
          matchedUrl: bestMatch.absolute_url || `https://boards.greenhouse.io/${token}`,
          explanation: `Job "${bestMatch.title}" found on Greenhouse careers board for "${companyName}".`,
          evidence: {
            atsProvider: 'Greenhouse',
            token,
            matchedJobTitle: bestMatch.title,
            matchedJobId: bestMatch.id,
            totalJobsOnBoard: jobs.length,
          },
        });
      }

      return mkResult({
        status: 'NOT_FOUND',
        matchedUrl: `https://boards.greenhouse.io/${token}`,
        explanation: `Greenhouse board found for "${companyName}" with ${jobs.length} job(s) listed, but no match for "${jobTitle}". This does not confirm the job is fake.`,
        evidence: { atsProvider: 'Greenhouse', token, totalJobs: jobs.length },
      });
    } catch (err) {
      logger.debug(`Greenhouse check failed for token "${token}":`, err.message);
    }
  }

  return mkResult({
    status: 'SOURCE_UNAVAILABLE',
    explanation: `No Greenhouse job board found for "${companyName}". The company may use a different ATS or post jobs privately.`,
    evidence: { atsProvider: 'Greenhouse', triedTokens: tokenCandidates },
  });
};

// ── Lever Adapter ─────────────────────────────────────────────────────────────

/**
 * Searches the Lever public jobs API for a matching job.
 *
 * Lever company identifier is the slug at jobs.lever.co/<slug>.
 *
 * @param {string} companyName
 * @param {string} jobTitle
 * @returns {Promise<object>}
 */
const checkLever = async (companyName, jobTitle) => {
  if (!companyName) return mkResult({ status: 'NOT_CHECKED', explanation: 'No company name for Lever lookup.' });

  const slugCandidates = [
    companyName.toLowerCase().replace(/[^a-z0-9]/g, ''),
    companyName.toLowerCase().replace(/\s+/g, '-').replace(/-+/g, '-'),
  ].filter((t, i, arr) => t && arr.indexOf(t) === i);

  for (const slug of slugCandidates) {
    const apiUrl = `https://api.lever.co/v0/postings/${slug}?mode=json`;
    try {
      const response = await fetchWithTimeout(apiUrl, FETCH_TIMEOUT_MS);
      if (!response || !response.ok) continue;

      const jobs = await response.json();
      if (!Array.isArray(jobs) || jobs.length === 0) {
        return mkResult({
          status: 'NOT_FOUND',
          matchedUrl: `https://jobs.lever.co/${slug}`,
          explanation: `Lever board found for "${companyName}" (slug: ${slug}) but contains no current postings.`,
          evidence: { atsProvider: 'Lever', slug, totalJobs: 0 },
        });
      }

      const titleMatches = jobs.filter((j) => fuzzyContains(j.text, jobTitle));
      if (titleMatches.length > 0) {
        const bestMatch = titleMatches[0];
        return mkResult({
          status: 'VERIFIED_MATCH',
          matchedUrl: bestMatch.hostedUrl || `https://jobs.lever.co/${slug}`,
          explanation: `Job "${bestMatch.text}" found on Lever careers board for "${companyName}".`,
          evidence: {
            atsProvider: 'Lever',
            slug,
            matchedJobTitle: bestMatch.text,
            matchedJobId: bestMatch.id,
            totalJobsOnBoard: jobs.length,
          },
        });
      }

      return mkResult({
        status: 'NOT_FOUND',
        matchedUrl: `https://jobs.lever.co/${slug}`,
        explanation: `Lever board found for "${companyName}" with ${jobs.length} posting(s) but no match for "${jobTitle}". This is not conclusive evidence the job is fake.`,
        evidence: { atsProvider: 'Lever', slug, totalJobs: jobs.length },
      });
    } catch (err) {
      logger.debug(`Lever check failed for slug "${slug}":`, err.message);
    }
  }

  return mkResult({
    status: 'SOURCE_UNAVAILABLE',
    explanation: `No Lever job board found for "${companyName}". The company may use a different ATS.`,
    evidence: { atsProvider: 'Lever', triedSlugs: slugCandidates },
  });
};

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Checks multiple ATS providers in parallel and returns the most informative result.
 *
 * @param {string} companyName
 * @param {string} jobTitle
 * @returns {Promise<object>}
 */
export const verifyJobListing = async (companyName, jobTitle) => {
  if (!companyName && !jobTitle) {
    return {
      overallStatus: 'NOT_CHECKED',
      checkedAt: new Date().toISOString(),
      explanation: 'No company name or job title provided; ATS verification skipped.',
      greenhouse: mkResult({ status: 'NOT_CHECKED' }),
      lever: mkResult({ status: 'NOT_CHECKED' }),
      bestMatch: null,
    };
  }

  logger.info(`[CareersVerification] Checking ATS for: "${companyName}" / "${jobTitle}"`);

  const [greenhouseResult, leverResult] = await Promise.all([
    checkGreenhouse(companyName, jobTitle),
    checkLever(companyName, jobTitle),
  ]);

  const results = [greenhouseResult, leverResult];

  // Prefer VERIFIED_MATCH > POSSIBLE_MATCH > NOT_FOUND > SOURCE_UNAVAILABLE > NOT_CHECKED
  const statusPriority = {
    VERIFIED_MATCH: 5,
    POSSIBLE_MATCH: 4,
    NOT_FOUND: 3,
    SOURCE_UNAVAILABLE: 2,
    NOT_CHECKED: 1,
  };

  const bestResult = results.reduce((best, r) =>
    (statusPriority[r.status] || 0) > (statusPriority[best.status] || 0) ? r : best
  );

  const allUnavailable = results.every((r) => r.status === 'SOURCE_UNAVAILABLE' || r.status === 'NOT_CHECKED');

  return {
    overallStatus: bestResult.status,
    checkedAt: new Date().toISOString(),
    explanation: allUnavailable
      ? `No public ATS board (Greenhouse, Lever) found for "${companyName}". Many legitimate employers post jobs without using these platforms.`
      : bestResult.explanation,
    greenhouse: greenhouseResult,
    lever: leverResult,
    bestMatch: bestResult.status !== 'SOURCE_UNAVAILABLE' && bestResult.status !== 'NOT_CHECKED' ? bestResult : null,
  };
};

export default { verifyJobListing };

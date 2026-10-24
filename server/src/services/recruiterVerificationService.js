/**
 * recruiterVerificationService.js
 *
 * Verifies recruiter and contact information:
 *  - Email domain match against identified company domain
 *  - Free / public email provider detection
 *  - Lookalike domain detection
 *  - Application URL reachability and domain consistency
 *
 * IMPORTANT: A Gmail address is a warning signal, not automatic proof of fraud —
 * especially for small businesses and independent recruiters.
 *
 * This service reports evidence; the riskScoringService evaluates it.
 */

import {
  checkFreeEmailProvider,
  checkWebsiteReachability,
  detectLookalikeDomain,
} from './domainVerificationService.js';
import { logger } from '../utils/logger.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const mkResult = (fields) => ({
  status: 'NOT_CHECKED',
  evidence: null,
  checkedAt: new Date().toISOString(),
  explanation: '',
  ...fields,
});

/**
 * Extracts hostname from a URL string. Returns null on failure.
 *
 * @param {string} url
 * @returns {string|null}
 */
const extractDomain = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

// ── Email Domain Check ────────────────────────────────────────────────────────

/**
 * Checks whether the recruiter's email domain matches the verified company domain.
 *
 * @param {string} recruiterEmail
 * @param {string|null} officialDomain - Known official domain from company verification
 * @returns {object}
 */
export const verifyEmailDomain = (recruiterEmail, officialDomain) => {
  if (!recruiterEmail) {
    return mkResult({
      status: 'NOT_CHECKED',
      explanation: 'No recruiter email provided.',
    });
  }

  const freeEmailCheck = checkFreeEmailProvider(recruiterEmail);
  const recruiterDomain = freeEmailCheck.domain;

  if (!recruiterDomain) {
    return mkResult({
      status: 'SUSPICIOUS',
      explanation: `The recruiter email "${recruiterEmail}" could not be parsed to extract a domain.`,
    });
  }

  if (freeEmailCheck.isFreeEmail) {
    let severity = 'WARNING';
    let explanation = freeEmailCheck.explanation;

    // Check if they're claiming to be from a large well-known company via Gmail
    if (officialDomain && officialDomain !== recruiterDomain) {
      explanation += ` The company's official domain appears to be "${officialDomain}", making this mismatch more significant.`;
    }

    return mkResult({
      status: 'SUSPICIOUS',
      evidence: {
        recruiterEmail,
        recruiterDomain,
        isFreeEmailProvider: true,
        officialDomain: officialDomain || null,
      },
      explanation,
    });
  }

  // Non-free email — compare against official domain
  if (!officialDomain) {
    return mkResult({
      status: 'NOT_CHECKED',
      evidence: { recruiterEmail, recruiterDomain, officialDomain: null },
      explanation: `Recruiter email uses domain "${recruiterDomain}" (not a public provider). No verified company domain available for comparison.`,
    });
  }

  // Direct match
  if (recruiterDomain === officialDomain || recruiterDomain.endsWith(`.${officialDomain}`)) {
    return mkResult({
      status: 'VERIFIED',
      evidence: {
        recruiterEmail,
        recruiterDomain,
        officialDomain,
        match: true,
      },
      explanation: `Recruiter email domain "${recruiterDomain}" matches the identified company domain "${officialDomain}".`,
    });
  }

  // Lookalike check
  const lookalike = detectLookalikeDomain(recruiterDomain, officialDomain);
  if (lookalike.isSuspicious) {
    return mkResult({
      status: 'SUSPICIOUS',
      evidence: {
        recruiterEmail,
        recruiterDomain,
        officialDomain,
        match: false,
        lookalikeSuspected: true,
      },
      explanation: lookalike.explanation,
    });
  }

  // Domain mismatch (not lookalike)
  return mkResult({
    status: 'SUSPICIOUS',
    evidence: {
      recruiterEmail,
      recruiterDomain,
      officialDomain,
      match: false,
    },
    explanation: `Recruiter email domain "${recruiterDomain}" does not match the identified company domain "${officialDomain}". This could indicate the recruiter is using a personal or unrelated domain.`,
  });
};

// ── Application URL Check ─────────────────────────────────────────────────────

/**
 * Checks the application URL for reachability and domain consistency with the company.
 *
 * @param {string} applicationUrl
 * @param {string|null} officialDomain
 * @returns {Promise<object>}
 */
export const verifyApplicationUrl = async (applicationUrl, officialDomain) => {
  if (!applicationUrl) {
    return mkResult({ status: 'NOT_CHECKED', explanation: 'No application URL provided.' });
  }

  const appDomain = extractDomain(applicationUrl);
  if (!appDomain) {
    return mkResult({
      status: 'SUSPICIOUS',
      explanation: `The application URL "${applicationUrl}" could not be parsed.`,
      evidence: { applicationUrl },
    });
  }

  // Check if it's a legitimate job board URL
  const KNOWN_JOB_BOARDS = new Set([
    'linkedin.com', 'indeed.com', 'glassdoor.com', 'naukri.com',
    'monster.com', 'ziprecruiter.com', 'dice.com', 'simplyhired.com',
    'greenhouse.io', 'lever.co', 'workday.com', 'taleo.net',
    'smartrecruiters.com', 'icims.com', 'jobs.com', 'careerbuilder.com',
    'wellfound.com', 'angel.co',
  ]);

  const isJobBoard = [...KNOWN_JOB_BOARDS].some(
    (board) => appDomain === board || appDomain.endsWith(`.${board}`)
  );

  // Reachability check
  const reachabilityResult = await checkWebsiteReachability(applicationUrl);

  let domainMatchStatus = 'NOT_CHECKED';
  let domainExplanation = '';

  if (officialDomain) {
    if (appDomain === officialDomain || appDomain.endsWith(`.${officialDomain}`)) {
      domainMatchStatus = 'VERIFIED';
      domainExplanation = `Application URL domain "${appDomain}" matches the company's official domain "${officialDomain}".`;
    } else if (isJobBoard) {
      domainMatchStatus = 'VERIFIED';
      domainExplanation = `Application URL is hosted on a recognised public job board (${appDomain}), which is standard.`;
    } else {
      const lookalike = detectLookalikeDomain(appDomain, officialDomain);
      if (lookalike.isSuspicious) {
        domainMatchStatus = 'SUSPICIOUS';
        domainExplanation = `Application URL domain "${appDomain}" is suspiciously similar to the official domain "${officialDomain}". ${lookalike.explanation}`;
      } else {
        domainMatchStatus = 'SUSPICIOUS';
        domainExplanation = `Application URL domain "${appDomain}" does not match the company's official domain "${officialDomain}" or a known job board.`;
      }
    }
  } else if (isJobBoard) {
    domainMatchStatus = 'VERIFIED';
    domainExplanation = `Application URL is hosted on a recognised public job board (${appDomain}).`;
  }

  return mkResult({
    status: domainMatchStatus === 'SUSPICIOUS' ? 'SUSPICIOUS' : reachabilityResult.status,
    evidence: {
      applicationUrl,
      appDomain,
      officialDomain: officialDomain || null,
      isKnownJobBoard: isJobBoard,
      domainMatchStatus,
      reachable: reachabilityResult.status === 'VERIFIED',
      httpStatus: reachabilityResult.evidence?.httpStatus || null,
    },
    explanation: domainExplanation || reachabilityResult.explanation,
  });
};

// ── Main Orchestrator ─────────────────────────────────────────────────────────

/**
 * Runs all recruiter and contact verification checks.
 *
 * @param {object} params
 * @param {string} [params.recruiterEmail]
 * @param {string} [params.recruiterName]
 * @param {string} [params.recruiterPhone]
 * @param {string} [params.applicationUrl]
 * @param {string|null} [params.officialDomain] - From companyVerificationService
 * @returns {Promise<object>}
 */
export const verifyRecruiter = async ({
  recruiterEmail,
  recruiterName,
  recruiterPhone,
  applicationUrl,
  officialDomain,
}) => {
  const hasAnyInput = recruiterEmail || recruiterName || recruiterPhone || applicationUrl;

  if (!hasAnyInput) {
    return {
      overallStatus: 'NOT_CHECKED',
      checkedAt: new Date().toISOString(),
      explanation: 'No recruiter or contact information provided; recruiter verification skipped.',
      emailDomain: mkResult({ status: 'NOT_CHECKED', explanation: 'No recruiter email.' }),
      applicationUrl: mkResult({ status: 'NOT_CHECKED', explanation: 'No application URL.' }),
      summary: [],
    };
  }

  logger.info(`[RecruiterVerification] Verifying recruiter: email=${recruiterEmail || 'N/A'}`);

  const [emailResult, appUrlResult] = await Promise.all([
    Promise.resolve(verifyEmailDomain(recruiterEmail, officialDomain)),
    verifyApplicationUrl(applicationUrl, officialDomain),
  ]);

  const results = [emailResult, appUrlResult];
  const hasSuspicious = results.some((r) => r.status === 'SUSPICIOUS');
  const hasVerified = results.some((r) => r.status === 'VERIFIED');
  const allNotChecked = results.every((r) => r.status === 'NOT_CHECKED');

  let overallStatus = 'NOT_CHECKED';
  if (hasSuspicious) overallStatus = 'SUSPICIOUS';
  else if (hasVerified) overallStatus = 'VERIFIED';
  else if (allNotChecked) overallStatus = 'NOT_CHECKED';
  else overallStatus = 'SOURCE_UNAVAILABLE';

  const summary = [];
  if (recruiterEmail) summary.push(`Email: ${recruiterEmail}`);
  if (recruiterName) summary.push(`Name: ${recruiterName}`);
  if (recruiterPhone) summary.push(`Phone: ${recruiterPhone}`);
  if (applicationUrl) summary.push(`Application URL: ${applicationUrl}`);

  return {
    overallStatus,
    checkedAt: new Date().toISOString(),
    explanation: hasSuspicious
      ? 'One or more recruiter contact signals are suspicious. Review details below.'
      : hasVerified
      ? 'Recruiter contact signals appear consistent with the identified company.'
      : 'Recruiter information could not be fully verified.',
    emailDomain: emailResult,
    applicationUrl: appUrlResult,
    summary,
    recruiterName: recruiterName || null,
    recruiterPhone: recruiterPhone || null,
  };
};

export default { verifyRecruiter, verifyEmailDomain, verifyApplicationUrl };

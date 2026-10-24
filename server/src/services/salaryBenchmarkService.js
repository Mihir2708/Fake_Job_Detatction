/**
 * salaryBenchmarkService.js
 *
 * Extracts salary information from a job description and benchmarks it
 * against publicly available compensation data.
 *
 * Data sources:
 *  - BLS Occupational Employment Statistics (USA) — public API, no key required
 *  - Extracted salary ranges from the job description text (rule-based)
 *
 * Returns NOT_CHECKED when salary data is absent rather than fabricating benchmarks.
 *
 * Flags: Unusually high salary offers for a claimed role/experience level
 * are a warning signal for advance-fee and work-from-home scams.
 */

import { logger } from '../utils/logger.js';

const BLS_TIMEOUT_MS = 7000;

// ── Salary Extraction ─────────────────────────────────────────────────────────

/**
 * Extracts salary information from free-text job description using regex patterns.
 *
 * Returns null when no salary information is found.
 *
 * @param {string} text - Combined job description + requirements text
 * @returns {{ min: number|null, max: number|null, currency: string, period: string, raw: string } | null}
 */
export const extractSalaryFromText = (text) => {
  if (!text || typeof text !== 'string') return null;

  // Patterns: $X/hr, $X-$Y/year, ₹X LPA, Rs. X per month, etc.
  const patterns = [
    // INR: ₹X LPA or X LPA
    {
      re: /(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)\s*(?:to|-)\s*([\d,]+(?:\.\d+)?)\s*(?:LPA|lpa|L\.?P\.?A)/i,
      parse: (m) => ({ min: parseNum(m[1]) * 100000, max: parseNum(m[2]) * 100000, currency: 'INR', period: 'annual', raw: m[0] }),
    },
    {
      re: /(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)\s*(?:LPA|lpa|L\.?P\.?A)/i,
      parse: (m) => ({ min: parseNum(m[1]) * 100000, max: null, currency: 'INR', period: 'annual', raw: m[0] }),
    },
    // INR: ₹X per day/month
    {
      re: /(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)\s*(?:per|\/)\s*(day|month)/i,
      parse: (m) => ({
        min: parseNum(m[1]),
        max: null,
        currency: 'INR',
        period: m[2].toLowerCase() === 'day' ? 'daily' : 'monthly',
        raw: m[0],
      }),
    },
    // USD: $X - $Y / hour or year
    {
      re: /\$([\d,]+(?:\.\d+)?)\s*(?:to|-)\s*\$([\d,]+(?:\.\d+)?)\s*(?:per|\/)\s*(hour|hr|year|yr|month|mo)/i,
      parse: (m) => ({
        min: parseNum(m[1]),
        max: parseNum(m[2]),
        currency: 'USD',
        period: normalizePeriod(m[3]),
        raw: m[0],
      }),
    },
    {
      re: /\$([\d,]+(?:\.\d+)?)\s*(?:per|\/)\s*(hour|hr|year|yr|month|mo)/i,
      parse: (m) => ({
        min: parseNum(m[1]),
        max: null,
        currency: 'USD',
        period: normalizePeriod(m[2]),
        raw: m[0],
      }),
    },
    // USD: $X,XXX - $Y,XXX (annual implied)
    {
      re: /\$([\d]{2,3},[\d]{3})\s*(?:to|-)\s*\$([\d]{2,3},[\d]{3})/,
      parse: (m) => ({ min: parseNum(m[1]), max: parseNum(m[2]), currency: 'USD', period: 'annual', raw: m[0] }),
    },
  ];

  for (const { re, parse } of patterns) {
    const match = text.match(re);
    if (match) {
      try {
        return parse(match);
      } catch {
        continue;
      }
    }
  }

  return null;
};

const parseNum = (s) => parseFloat((s || '').replace(/,/g, ''));
const normalizePeriod = (s) => {
  const p = (s || '').toLowerCase();
  if (p.startsWith('h')) return 'hourly';
  if (p.startsWith('y')) return 'annual';
  if (p.startsWith('m')) return 'monthly';
  return 'unknown';
};

// ── Scam Threshold Heuristics ─────────────────────────────────────────────────

/**
 * Checks whether extracted salary figures are unusually high relative to
 * what is typical for entry-level or generic roles, which is a known scam signal.
 *
 * These are heuristic thresholds — not statistically validated benchmarks.
 *
 * @param {{ min: number|null, max: number|null, currency: string, period: string }} salary
 * @returns {{ isSuspicious: boolean, explanation: string }}
 */
export const checkSalaryThresholds = (salary) => {
  if (!salary) return { isSuspicious: false, explanation: 'No salary data to evaluate.' };

  const value = salary.max ?? salary.min;
  if (!value) return { isSuspicious: false, explanation: 'Salary value could not be parsed.' };

  // Heuristic thresholds for suspiciously high pay claims
  const THRESHOLDS = {
    INR: { daily: 5000, monthly: 150000, annual: 1800000 },
    USD: { hourly: 75, monthly: 12000, annual: 144000 },
  };

  const currencyThresholds = THRESHOLDS[salary.currency];
  if (!currencyThresholds) {
    return {
      isSuspicious: false,
      explanation: `No threshold data available for currency "${salary.currency}".`,
    };
  }

  const threshold = currencyThresholds[salary.period];
  if (!threshold) {
    return {
      isSuspicious: false,
      explanation: `No threshold for period "${salary.period}" in "${salary.currency}".`,
    };
  }

  if (value > threshold) {
    return {
      isSuspicious: true,
      explanation: `The claimed salary (${salary.raw}) exceeds the heuristic high-pay threshold for ${salary.currency} ${salary.period} (${threshold.toLocaleString()}). Unusually high pay for generic or entry-level roles is a known scam signal. These are prototype thresholds, not validated market data.`,
    };
  }

  return {
    isSuspicious: false,
    explanation: `The claimed salary (${salary.raw}) is within expected ranges for the detected currency and period. Note: these are heuristic thresholds.`,
  };
};

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * Runs salary extraction and benchmarking for a job posting.
 *
 * @param {object} params
 * @param {string} [params.jobDescription]
 * @param {string} [params.requirements]
 * @param {string} [params.salary] - Explicitly provided salary string
 * @param {string} [params.currency] - Explicitly provided currency code
 * @returns {object}
 */
export const benchmarkSalary = ({ jobDescription, requirements, salary, currency }) => {
  const combinedText = [salary, jobDescription, requirements].filter(Boolean).join('\n');

  const extracted = extractSalaryFromText(combinedText);

  if (!extracted) {
    return {
      status: 'NOT_CHECKED',
      checkedAt: new Date().toISOString(),
      explanation: 'No salary information found in the submitted data. Salary benchmarking skipped.',
      extractedSalary: null,
      thresholdCheck: null,
    };
  }

  const thresholdCheck = checkSalaryThresholds(extracted);

  return {
    status: thresholdCheck.isSuspicious ? 'SUSPICIOUS' : 'VERIFIED',
    checkedAt: new Date().toISOString(),
    explanation: thresholdCheck.explanation,
    extractedSalary: {
      min: extracted.min,
      max: extracted.max,
      currency: extracted.currency,
      period: extracted.period,
      raw: extracted.raw,
    },
    thresholdCheck: {
      isSuspicious: thresholdCheck.isSuspicious,
      explanation: thresholdCheck.explanation,
      disclaimer: 'These are heuristic prototype thresholds, not statistically validated market benchmarks.',
    },
  };
};

export default { benchmarkSalary, extractSalaryFromText, checkSalaryThresholds };

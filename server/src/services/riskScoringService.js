/**
 * riskScoringService.js
 *
 * Deterministic, evidence-based risk scoring engine.
 *
 * Weights (maximum contribution per category):
 *  - Confirmed scam indicators (advance-fee patterns, safe browsing flags):  30 pts
 *  - Company & domain inconsistencies:                                        20 pts
 *  - Job listing verification (ATS match/miss):                              20 pts
 *  - Recruiter & contact inconsistencies:                                    15 pts
 *  - Salary & description warning signs:                                     15 pts
 *
 * Total maximum risk score: 100 points
 *
 * Verdict bands (prototype thresholds — not statistically validated):
 *  0–29:  LOWER_RISK
 *  30–59: CAUTION
 *  60–100: HIGH_RISK
 *
 * The final verdict can be INSUFFICIENT_INFORMATION when evidence coverage is too low
 * to produce a reliable numeric score, even if points are shown.
 *
 * Design rules:
 *  - No double-counting of correlated signals
 *  - No legitimacy points awarded simply for absence of scam signals
 *  - Missing/unavailable data → score 0 for that category, not penalised
 *  - Every score contribution is documented in the breakdown array
 */

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * Category weight ceilings.
 * Adjust these values to tune the scoring model.
 */
export const WEIGHT_CONFIG = {
  scamIndicators: 30,      // Advance-fee patterns, safe browsing, scam search results
  companyDomain: 20,       // Company not found, domain suspicious, very new domain
  jobListingVerification: 20, // ATS match or explicit not-found on reachable board
  recruiterContact: 15,    // Email domain mismatch, free email for large claimed company
  salaryDescription: 15,   // Salary too high, Gemini AI flags
};

/**
 * Verdict thresholds (prototype — not statistically validated probabilities).
 */
export const VERDICT_BANDS = [
  { max: 29, verdict: 'LOWER_RISK', label: 'Lower Risk' },
  { max: 59, verdict: 'CAUTION', label: 'Caution' },
  { max: 100, verdict: 'HIGH_RISK', label: 'High Risk' },
];

/**
 * Minimum evidence coverage (0–1) required to avoid INSUFFICIENT_INFORMATION verdict.
 */
const MIN_COVERAGE_FOR_VERDICT = 0.25;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Clamps a value between 0 and the given ceiling.
 *
 * @param {number} value
 * @param {number} ceiling
 * @returns {number}
 */
const clamp = (value, ceiling) => Math.min(Math.max(value, 0), ceiling);

/**
 * Creates a score contribution entry for the breakdown array.
 *
 * @param {object} fields
 * @returns {object}
 */
const contribution = (fields) => ({
  category: '',
  points: 0,
  maxPoints: 0,
  reason: '',
  evidenceStatus: 'NOT_CHECKED',
  ...fields,
});

// ── Category Scorers ──────────────────────────────────────────────────────────

/**
 * Scores confirmed scam indicator checks (max 30 pts).
 *
 * @param {object} scamIntelligence - From scamIntelligenceService
 * @param {object} geminiAnalysis - From geminiService
 * @returns {{ points: number, breakdown: object[], coverageWeight: number }}
 */
const scoreScamIndicators = (scamIntelligence, geminiAnalysis) => {
  const breakdown = [];
  let points = 0;
  let checkedCount = 0;
  const MAX = WEIGHT_CONFIG.scamIndicators;

  // Advance-fee patterns (text-based — always checked when description present)
  const afp = scamIntelligence?.advanceFeePatterns;
  if (afp) {
    checkedCount++;
    if (afp.status === 'SUSPICIOUS') {
      const pts = clamp(15, MAX - points);
      points += pts;
      breakdown.push(contribution({
        category: 'Scam Indicators',
        points: pts,
        maxPoints: 15,
        reason: `Advance-fee / scam patterns detected in job description: ${afp.evidence?.matchedPatterns?.join('; ') || 'multiple patterns'}`,
        evidenceStatus: 'SUSPICIOUS',
      }));
    } else if (afp.status === 'VERIFIED') {
      breakdown.push(contribution({
        category: 'Scam Indicators',
        points: 0,
        maxPoints: 15,
        reason: 'No advance-fee or task-scam patterns detected in job description.',
        evidenceStatus: 'VERIFIED',
      }));
    }
  }

  // Safe Browsing
  const sb = scamIntelligence?.safeBrowsing;
  if (sb && sb.status !== 'NOT_CHECKED' && sb.status !== 'SOURCE_UNAVAILABLE') {
    checkedCount++;
    if (sb.status === 'SUSPICIOUS') {
      const pts = clamp(12, MAX - points);
      points += pts;
      breakdown.push(contribution({
        category: 'Scam Indicators',
        points: pts,
        maxPoints: 12,
        reason: `Google Safe Browsing flagged the application URL for: ${sb.evidence?.threatTypes?.join(', ')}`,
        evidenceStatus: 'SUSPICIOUS',
      }));
    }
  }

  // Scam report search results
  const sr = scamIntelligence?.scamReports;
  if (sr && sr.status !== 'NOT_CHECKED' && sr.status !== 'SOURCE_UNAVAILABLE') {
    checkedCount++;
    if (sr.status === 'SUSPICIOUS') {
      const pts = clamp(8, MAX - points);
      points += pts;
      breakdown.push(contribution({
        category: 'Scam Indicators',
        points: pts,
        maxPoints: 8,
        reason: `Web search found scam-related reports: ${sr.evidence?.scamHits?.[0]?.title || 'see evidence'}`,
        evidenceStatus: 'SUSPICIOUS',
      }));
    }
  }

  // Gemini AI flags (from AI analysis)
  if (geminiAnalysis) {
    checkedCount++;
    if (geminiAnalysis.prediction === 'SUSPICIOUS' && (geminiAnalysis.riskLevel === 'HIGH' || geminiAnalysis.riskLevel === 'MEDIUM')) {
      // AI contributes up to 5 pts to scam indicators (avoid double-counting with domain checks)
      const pts = clamp(geminiAnalysis.riskLevel === 'HIGH' ? 5 : 3, MAX - points);
      points += pts;
      breakdown.push(contribution({
        category: 'Scam Indicators',
        points: pts,
        maxPoints: 5,
        reason: `Gemini AI analysis flagged the posting as SUSPICIOUS (risk: ${geminiAnalysis.riskLevel}). Reasons: ${geminiAnalysis.reasons?.slice(0, 2).join('; ')}`,
        evidenceStatus: 'SUSPICIOUS',
      }));
    }
  }

  return {
    points: clamp(points, MAX),
    breakdown,
    coverageWeight: checkedCount > 0 ? 1 : 0,
  };
};

/**
 * Scores company and domain verification findings (max 20 pts).
 *
 * @param {object} companyVerification - From companyVerificationService
 * @returns {{ points: number, breakdown: object[], coverageWeight: number }}
 */
const scoreCompanyDomain = (companyVerification) => {
  const breakdown = [];
  let points = 0;
  let checkedCount = 0;
  const MAX = WEIGHT_CONFIG.companyDomain;

  if (!companyVerification) {
    return { points: 0, breakdown: [], coverageWeight: 0 };
  }

  // Web search result
  const ws = companyVerification.webSearch;
  if (ws?.status !== 'NOT_CHECKED') {
    checkedCount++;
    if (ws?.status === 'NOT_FOUND') {
      const pts = clamp(8, MAX - points);
      points += pts;
      breakdown.push(contribution({
        category: 'Company & Domain',
        points: pts,
        maxPoints: 8,
        reason: `No web search results found for the claimed company. The company may not have a public online presence.`,
        evidenceStatus: 'NOT_FOUND',
      }));
    }
  }

  // RDAP domain age
  const rdap = companyVerification.rdapInfo;
  if (rdap?.status !== 'NOT_CHECKED' && rdap?.status !== 'SOURCE_UNAVAILABLE') {
    checkedCount++;
    if (rdap?.status === 'SUSPICIOUS') {
      const pts = clamp(8, MAX - points);
      points += pts;
      breakdown.push(contribution({
        category: 'Company & Domain',
        points: pts,
        maxPoints: 8,
        reason: `Domain registration date is very recent: ${rdap.explanation}`,
        evidenceStatus: 'SUSPICIOUS',
      }));
    }
  }

  // Website unreachable (minor signal — many legitimate companies have downtime)
  const reach = companyVerification.websiteReachability;
  if (reach?.status !== 'NOT_CHECKED' && reach?.status !== 'SOURCE_UNAVAILABLE') {
    checkedCount++;
    if (reach?.status === 'SUSPICIOUS') {
      const pts = clamp(4, MAX - points);
      points += pts;
      breakdown.push(contribution({
        category: 'Company & Domain',
        points: pts,
        maxPoints: 4,
        reason: `Identified company website returned an error: ${reach.explanation}`,
        evidenceStatus: 'SUSPICIOUS',
      }));
    }
  }

  return {
    points: clamp(points, MAX),
    breakdown,
    coverageWeight: checkedCount > 0 ? 1 : 0,
  };
};

/**
 * Scores job listing verification findings (max 20 pts).
 *
 * @param {object} careersVerification - From careersVerificationService
 * @returns {{ points: number, breakdown: object[], coverageWeight: number }}
 */
const scoreJobListing = (careersVerification) => {
  const breakdown = [];
  let points = 0;
  let checkedCount = 0;
  const MAX = WEIGHT_CONFIG.jobListingVerification;

  if (!careersVerification) return { points: 0, breakdown: [], coverageWeight: 0 };

  const gh = careersVerification.greenhouse;
  const lv = careersVerification.lever;
  const statuses = [gh?.status, lv?.status].filter(Boolean);

  checkedCount = statuses.filter((s) => s !== 'NOT_CHECKED').length;

  // VERIFIED_MATCH reduces risk — represented as 0 points (no risk contribution)
  if (statuses.includes('VERIFIED_MATCH')) {
    breakdown.push(contribution({
      category: 'Job Listing Verification',
      points: 0,
      maxPoints: MAX,
      reason: `Job posting found on official ATS (${careersVerification.bestMatch?.evidence?.atsProvider || 'ATS'}). This is a positive signal but does not guarantee the job is genuine.`,
      evidenceStatus: 'VERIFIED_MATCH',
    }));
    return { points: 0, breakdown, coverageWeight: 1 };
  }

  // NOT_FOUND on a reachable board is worth some points (but NOT definitive proof of fraud)
  const hasReachableBoard = statuses.includes('NOT_FOUND');
  if (hasReachableBoard) {
    const pts = clamp(10, MAX);
    points += pts;
    breakdown.push(contribution({
      category: 'Job Listing Verification',
      points: pts,
      maxPoints: MAX,
      reason: `Job title not found on a reachable ATS board (Greenhouse/Lever). This is a minor signal only — many legitimate jobs are not on these platforms.`,
      evidenceStatus: 'NOT_FOUND',
    }));
  } else if (statuses.every((s) => s === 'SOURCE_UNAVAILABLE')) {
    breakdown.push(contribution({
      category: 'Job Listing Verification',
      points: 0,
      maxPoints: MAX,
      reason: `No public ATS board found for this company. Cannot verify job listing. This is not evidence of fraud.`,
      evidenceStatus: 'SOURCE_UNAVAILABLE',
    }));
  }

  return {
    points: clamp(points, MAX),
    breakdown,
    coverageWeight: checkedCount > 0 ? 1 : 0,
  };
};

/**
 * Scores recruiter and contact verification findings (max 15 pts).
 *
 * @param {object} recruiterVerification - From recruiterVerificationService
 * @returns {{ points: number, breakdown: object[], coverageWeight: number }}
 */
const scoreRecruiterContact = (recruiterVerification) => {
  const breakdown = [];
  let points = 0;
  let checkedCount = 0;
  const MAX = WEIGHT_CONFIG.recruiterContact;

  if (!recruiterVerification) return { points: 0, breakdown: [], coverageWeight: 0 };

  const email = recruiterVerification.emailDomain;
  if (email?.status !== 'NOT_CHECKED') {
    checkedCount++;
    if (email?.status === 'SUSPICIOUS') {
      const isFreeEmail = email.evidence?.isFreeEmailProvider;
      const hasDomainMismatch = !isFreeEmail && email.evidence?.match === false;

      if (isFreeEmail) {
        const pts = clamp(7, MAX - points);
        points += pts;
        breakdown.push(contribution({
          category: 'Recruiter & Contact',
          points: pts,
          maxPoints: 7,
          reason: `Recruiter is using a free public email provider (${email.evidence?.recruiterDomain}). ${email.evidence?.officialDomain ? `Company official domain is "${email.evidence.officialDomain}".` : ''}`,
          evidenceStatus: 'SUSPICIOUS',
        }));
      }

      if (hasDomainMismatch) {
        const lookalike = email.evidence?.lookalikeSuspected;
        const pts = clamp(lookalike ? 12 : 8, MAX - points);
        points += pts;
        breakdown.push(contribution({
          category: 'Recruiter & Contact',
          points: pts,
          maxPoints: lookalike ? 12 : 8,
          reason: email.explanation,
          evidenceStatus: 'SUSPICIOUS',
        }));
      }
    } else if (email?.status === 'VERIFIED') {
      breakdown.push(contribution({
        category: 'Recruiter & Contact',
        points: 0,
        maxPoints: MAX,
        reason: `Recruiter email domain matches identified company domain.`,
        evidenceStatus: 'VERIFIED',
      }));
    }
  }

  // Application URL
  const appUrl = recruiterVerification.applicationUrl;
  if (appUrl?.status !== 'NOT_CHECKED' && appUrl?.status !== 'SOURCE_UNAVAILABLE') {
    checkedCount++;
    if (appUrl?.status === 'SUSPICIOUS') {
      const pts = clamp(5, MAX - points);
      points += pts;
      breakdown.push(contribution({
        category: 'Recruiter & Contact',
        points: pts,
        maxPoints: 5,
        reason: appUrl.explanation,
        evidenceStatus: 'SUSPICIOUS',
      }));
    }
  }

  return {
    points: clamp(points, MAX),
    breakdown,
    coverageWeight: checkedCount > 0 ? 1 : 0,
  };
};

/**
 * Scores salary and description warning signs (max 15 pts).
 *
 * @param {object} salaryBenchmark - From salaryBenchmarkService
 * @param {object} geminiAnalysis - From geminiService (for description flags)
 * @returns {{ points: number, breakdown: object[], coverageWeight: number }}
 */
const scoreSalaryDescription = (salaryBenchmark, geminiAnalysis) => {
  const breakdown = [];
  let points = 0;
  let checkedCount = 0;
  const MAX = WEIGHT_CONFIG.salaryDescription;

  // Salary threshold check
  if (salaryBenchmark && salaryBenchmark.status !== 'NOT_CHECKED') {
    checkedCount++;
    if (salaryBenchmark.status === 'SUSPICIOUS') {
      const pts = clamp(10, MAX - points);
      points += pts;
      breakdown.push(contribution({
        category: 'Salary & Description',
        points: pts,
        maxPoints: 10,
        reason: salaryBenchmark.explanation,
        evidenceStatus: 'SUSPICIOUS',
      }));
    } else if (salaryBenchmark.status === 'VERIFIED') {
      breakdown.push(contribution({
        category: 'Salary & Description',
        points: 0,
        maxPoints: 10,
        reason: salaryBenchmark.explanation,
        evidenceStatus: 'VERIFIED',
      }));
    }
  }

  // Gemini description flags (only INSUFFICIENT_INFORMATION is meaningful here)
  if (geminiAnalysis) {
    checkedCount++;
    if (geminiAnalysis.prediction === 'INSUFFICIENT_INFORMATION') {
      breakdown.push(contribution({
        category: 'Salary & Description',
        points: 0,
        maxPoints: 5,
        reason: 'Job description is too vague for AI analysis. Vague descriptions can be a warning signal but are not conclusive.',
        evidenceStatus: 'SUSPICIOUS',
      }));
    }
  }

  return {
    points: clamp(points, MAX),
    breakdown,
    coverageWeight: checkedCount > 0 ? 1 : 0,
  };
};

// ── Main Scoring Function ─────────────────────────────────────────────────────

/**
 * Computes the overall risk score and verdict from all verification results.
 *
 * @param {object} params
 * @param {object} [params.companyVerification]
 * @param {object} [params.careersVerification]
 * @param {object} [params.recruiterVerification]
 * @param {object} [params.scamIntelligence]
 * @param {object} [params.salaryBenchmark]
 * @param {object} [params.geminiAnalysis]
 * @returns {object} Scored result with breakdown
 */
export const computeRiskScore = ({
  companyVerification,
  careersVerification,
  recruiterVerification,
  scamIntelligence,
  salaryBenchmark,
  geminiAnalysis,
}) => {
  const scamScore = scoreScamIndicators(scamIntelligence, geminiAnalysis);
  const companyScore = scoreCompanyDomain(companyVerification);
  const listingScore = scoreJobListing(careersVerification);
  const recruiterScore = scoreRecruiterContact(recruiterVerification);
  const salaryScore = scoreSalaryDescription(salaryBenchmark, geminiAnalysis);

  const totalPoints = clamp(
    scamScore.points + companyScore.points + listingScore.points + recruiterScore.points + salaryScore.points,
    100
  );

  const allBreakdown = [
    ...scamScore.breakdown,
    ...companyScore.breakdown,
    ...listingScore.breakdown,
    ...recruiterScore.breakdown,
    ...salaryScore.breakdown,
  ];

  // Evidence coverage: proportion of categories that had at least one real check
  const coverageWeights = [
    scamScore.coverageWeight,
    companyScore.coverageWeight,
    listingScore.coverageWeight,
    recruiterScore.coverageWeight,
    salaryScore.coverageWeight,
  ];
  const coverage = coverageWeights.reduce((a, b) => a + b, 0) / coverageWeights.length;

  // Determine verdict
  let verdict, verdictLabel;
  if (coverage < MIN_COVERAGE_FOR_VERDICT) {
    verdict = 'INSUFFICIENT_INFORMATION';
    verdictLabel = 'Insufficient Information';
  } else {
    const band = VERDICT_BANDS.find((b) => totalPoints <= b.max) || VERDICT_BANDS[VERDICT_BANDS.length - 1];
    verdict = band.verdict;
    verdictLabel = band.label;
  }

  const categoryScores = {
    scamIndicators: { points: scamScore.points, max: WEIGHT_CONFIG.scamIndicators },
    companyDomain: { points: companyScore.points, max: WEIGHT_CONFIG.companyDomain },
    jobListingVerification: { points: listingScore.points, max: WEIGHT_CONFIG.jobListingVerification },
    recruiterContact: { points: recruiterScore.points, max: WEIGHT_CONFIG.recruiterContact },
    salaryDescription: { points: salaryScore.points, max: WEIGHT_CONFIG.salaryDescription },
  };

  return {
    riskScore: totalPoints,
    verdict,
    verdictLabel,
    evidenceCoverage: Math.round(coverage * 100),
    categoryScores,
    breakdown: allBreakdown,
    disclaimer:
      'These thresholds (0–29 Lower Risk, 30–59 Caution, 60–100 High Risk) are prototype heuristics and have not been statistically validated against a labelled dataset. They should not be treated as probabilities.',
    scoredAt: new Date().toISOString(),
  };
};

export default { computeRiskScore, WEIGHT_CONFIG, VERDICT_BANDS };

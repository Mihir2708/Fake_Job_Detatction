/**
 * Input validation utility for Job Analysis requests.
 * Extended to support new optional fields: jobUrl, salary, currency,
 * recruiterName, recruiterEmail, recruiterPhone, applicationSource.
 */

const MAX_LENGTHS = {
  jobTitle: 200,
  companyName: 200,
  location: 200,
  requirements: 5000,
  jobDescription: 15000,
  jobUrl: 2048,
  salary: 200,
  currency: 10,
  recruiterName: 200,
  recruiterEmail: 320,
  recruiterPhone: 30,
  applicationUrl: 2048,
  applicationSource: 200,
};

const MIN_JOB_DESCRIPTION_LENGTH = 30;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/.+/i;

/**
 * Validates and sanitizes a single optional string field.
 *
 * @param {unknown} value
 * @param {string} fieldName
 * @param {number} maxLength
 * @returns {{ error?: string, value: string }}
 */
const validateOptionalString = (value, fieldName, maxLength) => {
  if (value === undefined || value === null || value === '') {
    return { value: '' };
  }
  if (typeof value !== 'string') {
    return { error: `${fieldName} must be a string if provided.` };
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return { error: `${fieldName} cannot exceed ${maxLength} characters.` };
  }
  return { value: trimmed };
};

/**
 * Validates and sanitizes the input payload for POST /api/analysis/analyze.
 * Backward-compatible: existing fields (jobTitle, companyName, location, requirements, jobDescription) still work.
 *
 * @param {unknown} body - The raw request body
 * @returns {{ isValid: boolean, error?: string, sanitizedData?: object }}
 */
export const validateAnalyzeJobInput = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      error: 'Request body must be a JSON object containing job posting details.',
    };
  }

  const {
    jobTitle,
    companyName,
    jobDescription,
    requirements,
    location,
    // New optional fields
    jobUrl,
    salary,
    currency,
    recruiterName,
    recruiterEmail,
    recruiterPhone,
    applicationUrl,
    applicationSource,
  } = body;

  // 1. jobTitle is strictly required
  if (jobTitle === undefined || jobTitle === null || typeof jobTitle !== 'string' || jobTitle.trim().length === 0) {
    return {
      isValid: false,
      error: 'Job Title is required.',
    };
  }
  const trimmedJobTitle = jobTitle.trim();
  if (trimmedJobTitle.length > MAX_LENGTHS.jobTitle) {
    return {
      isValid: false,
      error: `Job Title cannot exceed ${MAX_LENGTHS.jobTitle} characters.`,
    };
  }

  // 2. companyName is strictly required
  if (companyName === undefined || companyName === null || typeof companyName !== 'string' || companyName.trim().length === 0) {
    return {
      isValid: false,
      error: 'Company Name is required.',
    };
  }
  const trimmedCompanyName = companyName.trim();
  if (trimmedCompanyName.length > MAX_LENGTHS.companyName) {
    return {
      isValid: false,
      error: `Company Name cannot exceed ${MAX_LENGTHS.companyName} characters.`,
    };
  }

  // 3. jobDescription is strictly required
  if (jobDescription === undefined || jobDescription === null) {
    return {
      isValid: false,
      error: 'Job Description is required.',
    };
  }
  if (typeof jobDescription !== 'string') {
    return {
      isValid: false,
      error: 'jobDescription must be a string.',
    };
  }
  const trimmedDescription = jobDescription.trim();
  if (trimmedDescription.length < MIN_JOB_DESCRIPTION_LENGTH) {
    return {
      isValid: false,
      error: `Job Description must contain meaningful content (minimum ${MIN_JOB_DESCRIPTION_LENGTH} characters).`,
    };
  }
  if (trimmedDescription.length > MAX_LENGTHS.jobDescription) {
    return {
      isValid: false,
      error: `Job Description exceeds the maximum allowed length of ${MAX_LENGTHS.jobDescription} characters.`,
    };
  }

  // 4. Safe jobUrl handling (optional — never throws error if missing or invalid)
  let trimmedJobUrl = '';
  if (typeof jobUrl === 'string' && URL_REGEX.test(jobUrl.trim())) {
    trimmedJobUrl = jobUrl.trim().slice(0, MAX_LENGTHS.jobUrl);
  }

  // Validate optional string fields
  const stringFields = [
    ['location', location],
    ['requirements', requirements],
    ['salary', salary],
    ['currency', currency],
    ['recruiterName', recruiterName],
    ['recruiterPhone', recruiterPhone],
    ['applicationSource', applicationSource],
  ];

  const sanitized = {};
  for (const [fieldName, value] of stringFields) {
    const result = validateOptionalString(value, fieldName, MAX_LENGTHS[fieldName]);
    if (result.error) return { isValid: false, error: result.error };
    sanitized[fieldName] = result.value;
  }

  // Validate recruiterEmail
  if (recruiterEmail !== undefined && recruiterEmail !== null && recruiterEmail !== '') {
    if (typeof recruiterEmail !== 'string') {
      return { isValid: false, error: 'recruiterEmail must be a string if provided.' };
    }
    const trimmedEmail = recruiterEmail.trim().toLowerCase();
    if (trimmedEmail.length > MAX_LENGTHS.recruiterEmail) {
      return { isValid: false, error: `recruiterEmail cannot exceed ${MAX_LENGTHS.recruiterEmail} characters.` };
    }
    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      return { isValid: false, error: 'recruiterEmail must be a valid email address if provided.' };
    }
    sanitized.recruiterEmail = trimmedEmail;
  } else {
    sanitized.recruiterEmail = '';
  }

  // Validate applicationUrl
  if (applicationUrl !== undefined && applicationUrl !== null && applicationUrl !== '') {
    if (typeof applicationUrl !== 'string') {
      return { isValid: false, error: 'applicationUrl must be a string if provided.' };
    }
    const trimmedAppUrl = applicationUrl.trim();
    if (trimmedAppUrl && !URL_REGEX.test(trimmedAppUrl)) {
      return { isValid: false, error: 'applicationUrl must be a valid http or https URL if provided.' };
    }
    if (trimmedAppUrl.length > MAX_LENGTHS.applicationUrl) {
      return { isValid: false, error: `applicationUrl cannot exceed ${MAX_LENGTHS.applicationUrl} characters.` };
    }
    sanitized.applicationUrl = trimmedAppUrl;
  } else {
    sanitized.applicationUrl = '';
  }

  return {
    isValid: true,
    sanitizedData: {
      // Existing fields
      jobTitle: trimmedJobTitle,
      companyName: trimmedCompanyName,
      jobDescription: trimmedDescription,
      requirements: sanitized.requirements,
      location: sanitized.location,
      // New optional fields
      jobUrl: trimmedJobUrl,
      salary: sanitized.salary,
      currency: sanitized.currency,
      recruiterName: sanitized.recruiterName,
      recruiterEmail: sanitized.recruiterEmail,
      recruiterPhone: sanitized.recruiterPhone,
      applicationUrl: sanitized.applicationUrl,
      applicationSource: sanitized.applicationSource,
    },
  };
};

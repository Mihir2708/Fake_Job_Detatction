/**
 * Input validation utility for Job Analysis requests
 */

const MAX_LENGTHS = {
  jobTitle: 200,
  companyName: 200,
  location: 200,
  requirements: 5000,
  jobDescription: 15000,
};

const MIN_JOB_DESCRIPTION_LENGTH = 30;

/**
 * Validates and sanitizes the input payload for POST /api/analysis/analyze
 *
 * @param {unknown} body - The raw request body
 * @returns {{ isValid: boolean, error?: string, sanitizedData?: { jobTitle: string, companyName: string, jobDescription: string, requirements: string, location: string } }}
 */
export const validateAnalyzeJobInput = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      error: 'Request body must be a JSON object containing job posting details.',
    };
  }

  const { jobTitle, companyName, jobDescription, requirements, location } = body;

  // jobDescription is strictly required and must be meaningful
  if (jobDescription === undefined || jobDescription === null) {
    return {
      isValid: false,
      error: 'jobDescription is required.',
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
      error: `jobDescription must contain meaningful content (minimum ${MIN_JOB_DESCRIPTION_LENGTH} characters).`,
    };
  }

  if (trimmedDescription.length > MAX_LENGTHS.jobDescription) {
    return {
      isValid: false,
      error: `jobDescription exceeds the maximum allowed length of ${MAX_LENGTHS.jobDescription} characters.`,
    };
  }

  // Validate optional jobTitle
  let trimmedTitle = '';
  if (jobTitle !== undefined && jobTitle !== null) {
    if (typeof jobTitle !== 'string') {
      return {
        isValid: false,
        error: 'jobTitle must be a string if provided.',
      };
    }
    trimmedTitle = jobTitle.trim();
    if (trimmedTitle.length > MAX_LENGTHS.jobTitle) {
      return {
        isValid: false,
        error: `jobTitle cannot exceed ${MAX_LENGTHS.jobTitle} characters.`,
      };
    }
  }

  // Validate optional companyName
  let trimmedCompany = '';
  if (companyName !== undefined && companyName !== null) {
    if (typeof companyName !== 'string') {
      return {
        isValid: false,
        error: 'companyName must be a string if provided.',
      };
    }
    trimmedCompany = companyName.trim();
    if (trimmedCompany.length > MAX_LENGTHS.companyName) {
      return {
        isValid: false,
        error: `companyName cannot exceed ${MAX_LENGTHS.companyName} characters.`,
      };
    }
  }

  // Validate optional location
  let trimmedLocation = '';
  if (location !== undefined && location !== null) {
    if (typeof location !== 'string') {
      return {
        isValid: false,
        error: 'location must be a string if provided.',
      };
    }
    trimmedLocation = location.trim();
    if (trimmedLocation.length > MAX_LENGTHS.location) {
      return {
        isValid: false,
        error: `location cannot exceed ${MAX_LENGTHS.location} characters.`,
      };
    }
  }

  // Validate optional requirements
  let trimmedRequirements = '';
  if (requirements !== undefined && requirements !== null) {
    if (typeof requirements !== 'string') {
      return {
        isValid: false,
        error: 'requirements must be a string if provided.',
      };
    }
    trimmedRequirements = requirements.trim();
    if (trimmedRequirements.length > MAX_LENGTHS.requirements) {
      return {
        isValid: false,
        error: `requirements cannot exceed ${MAX_LENGTHS.requirements} characters.`,
      };
    }
  }

  return {
    isValid: true,
    sanitizedData: {
      jobTitle: trimmedTitle,
      companyName: trimmedCompany,
      jobDescription: trimmedDescription,
      requirements: trimmedRequirements,
      location: trimmedLocation,
    },
  };
};

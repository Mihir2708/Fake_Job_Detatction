/**
 * Utility to parse and strictly validate Gemini AI job analysis responses.
 * Updated to support new redFlags and greenFlags fields.
 */

export const ALLOWED_PREDICTIONS = ['LIKELY_REAL', 'SUSPICIOUS', 'INSUFFICIENT_INFORMATION'];
export const ALLOWED_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'];

/**
 * Extracts JSON content from raw AI response text, stripping markdown code blocks if present.
 *
 * @param {string} rawText
 * @returns {any}
 */
export const extractJsonFromText = (rawText) => {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('AI returned an empty response.');
  }

  const trimmed = rawText.trim();

  // Strip markdown code fences if wrapped in ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const textToParse = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;

  try {
    return JSON.parse(textToParse);
  } catch (parseError) {
    throw new Error(`AI response is not valid JSON: ${parseError.message}`);
  }
};

/**
 * Parses and validates the structured response from Gemini against the required schema.
 * Now supports optional redFlags and greenFlags arrays.
 *
 * @param {string} rawResponseText - Raw text response from Gemini API
 * @returns {{
 *   prediction: 'LIKELY_REAL' | 'SUSPICIOUS' | 'INSUFFICIENT_INFORMATION',
 *   riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN',
 *   reasons: string[],
 *   redFlags: string[],
 *   greenFlags: string[],
 *   recommendation: string,
 *   limitations: string,
 *   confidence: null
 * }}
 */
export const parseAndValidateGeminiResponse = (rawResponseText) => {
  const parsed = extractJsonFromText(rawResponseText);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI response is not a valid JSON object.');
  }

  // 1. Validate prediction
  const rawPrediction = typeof parsed.prediction === 'string' ? parsed.prediction.trim().toUpperCase() : '';
  if (!ALLOWED_PREDICTIONS.includes(rawPrediction)) {
    throw new Error(
      `Invalid prediction value: "${parsed.prediction}". Must be one of: ${ALLOWED_PREDICTIONS.join(', ')}`
    );
  }

  // 2. Validate riskLevel
  const rawRiskLevel = typeof parsed.riskLevel === 'string' ? parsed.riskLevel.trim().toUpperCase() : '';
  if (!ALLOWED_RISK_LEVELS.includes(rawRiskLevel)) {
    throw new Error(
      `Invalid riskLevel value: "${parsed.riskLevel}". Must be one of: ${ALLOWED_RISK_LEVELS.join(', ')}`
    );
  }

  // 3. Validate reasons
  if (!Array.isArray(parsed.reasons) || parsed.reasons.length === 0) {
    throw new Error('AI response must contain a non-empty array of reasons.');
  }

  const validatedReasons = parsed.reasons
    .filter((reason) => typeof reason === 'string' && reason.trim().length > 0)
    .map((reason) => reason.trim());

  if (validatedReasons.length === 0) {
    throw new Error('AI response reasons must contain valid text strings.');
  }

  // 4. Parse optional redFlags (graceful fallback)
  const validatedRedFlags = Array.isArray(parsed.redFlags)
    ? parsed.redFlags.filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim())
    : [];

  // 5. Parse optional greenFlags (graceful fallback)
  const validatedGreenFlags = Array.isArray(parsed.greenFlags)
    ? parsed.greenFlags.filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim())
    : [];

  // 6. Validate recommendation
  if (typeof parsed.recommendation !== 'string' || !parsed.recommendation.trim()) {
    throw new Error('AI response must contain a non-empty recommendation string.');
  }

  // 7. Validate limitations
  if (typeof parsed.limitations !== 'string' || !parsed.limitations.trim()) {
    throw new Error('AI response must contain a non-empty limitations string.');
  }

  return {
    prediction: rawPrediction,
    riskLevel: rawRiskLevel,
    reasons: validatedReasons,
    redFlags: validatedRedFlags,
    greenFlags: validatedGreenFlags,
    recommendation: parsed.recommendation.trim(),
    limitations: parsed.limitations.trim(),
    confidence: null, // Confidence is strictly null as instructed
  };
};

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidateGeminiResponse, extractJsonFromText } from '../src/utils/responseParser.js';

test('extractJsonFromText - extracts plain JSON string', () => {
  const jsonStr = '{"prediction": "SUSPICIOUS"}';
  const result = extractJsonFromText(jsonStr);
  assert.equal(result.prediction, 'SUSPICIOUS');
});

test('extractJsonFromText - extracts JSON wrapped in markdown code fence', () => {
  const markdownWrapped = '```json\n{\n  "prediction": "LIKELY_REAL"\n}\n```';
  const result = extractJsonFromText(markdownWrapped);
  assert.equal(result.prediction, 'LIKELY_REAL');
});

test('extractJsonFromText - throws on invalid JSON syntax', () => {
  assert.throws(() => extractJsonFromText('{ invalid json'), /not valid JSON/i);
  assert.throws(() => extractJsonFromText(''), /empty response/i);
});

test('parseAndValidateGeminiResponse - parses valid SUSPICIOUS evaluation', () => {
  const validRaw = JSON.stringify({
    prediction: 'SUSPICIOUS',
    riskLevel: 'HIGH',
    reasons: [
      'The contact email uses a free Gmail domain (@gmail.com) despite claiming to represent a multinational corporation.',
      'The posting offers $75/hour for basic data entry tasks without technical requirements.',
      'The interview process is requested strictly through Telegram messaging.',
    ],
    recommendation: 'Do not send personal documents or banking information. Verify the opening on the employer official website.',
    limitations: 'This analysis is an automated assessment based on textual patterns and does not constitute conclusive legal proof.',
  });

  const parsed = parseAndValidateGeminiResponse(validRaw);
  assert.equal(parsed.prediction, 'SUSPICIOUS');
  assert.equal(parsed.riskLevel, 'HIGH');
  assert.equal(parsed.reasons.length, 3);
  assert.equal(parsed.confidence, null);
  assert.match(parsed.recommendation, /official website/i);
  assert.match(parsed.limitations, /automated assessment/i);
});

test('parseAndValidateGeminiResponse - parses valid LIKELY_REAL evaluation', () => {
  const validRaw = JSON.stringify({
    prediction: 'LIKELY_REAL',
    riskLevel: 'LOW',
    reasons: [
      'Realistic compensation aligned with market benchmarks.',
      'Detailed, domain-appropriate engineering requirements specified.',
    ],
    recommendation: 'Apply directly through the company careers portal.',
    limitations: 'AI cannot guarantee employment validity.',
  });

  const parsed = parseAndValidateGeminiResponse(validRaw);
  assert.equal(parsed.prediction, 'LIKELY_REAL');
  assert.equal(parsed.riskLevel, 'LOW');
  assert.equal(parsed.confidence, null);
});

test('parseAndValidateGeminiResponse - parses valid INSUFFICIENT_INFORMATION evaluation', () => {
  const validRaw = JSON.stringify({
    prediction: 'INSUFFICIENT_INFORMATION',
    riskLevel: 'UNKNOWN',
    reasons: [
      'The job description lacks details regarding company identity, responsibilities, or contact methods.',
    ],
    recommendation: 'Request a formal job description and official recruiter verification.',
    limitations: 'Insufficient data provided for risk evaluation.',
  });

  const parsed = parseAndValidateGeminiResponse(validRaw);
  assert.equal(parsed.prediction, 'INSUFFICIENT_INFORMATION');
  assert.equal(parsed.riskLevel, 'UNKNOWN');
  assert.equal(parsed.confidence, null);
});

test('parseAndValidateGeminiResponse - enforces confidence is always null', () => {
  const rawWithFakeConfidence = JSON.stringify({
    prediction: 'LIKELY_REAL',
    riskLevel: 'LOW',
    confidence: 0.95, // Even if the raw response has a confidence number
    reasons: ['Normal corporate listing'],
    recommendation: 'Apply online',
    limitations: 'No guarantee',
  });

  const parsed = parseAndValidateGeminiResponse(rawWithFakeConfidence);
  assert.equal(parsed.confidence, null);
});

test('parseAndValidateGeminiResponse - rejects invalid prediction enum', () => {
  const invalidPrediction = JSON.stringify({
    prediction: 'DEFINITELY_A_SCAM', // Not in allowed enum
    riskLevel: 'HIGH',
    reasons: ['Reason 1'],
    recommendation: 'Be careful',
    limitations: 'No guarantee',
  });

  assert.throws(() => parseAndValidateGeminiResponse(invalidPrediction), /Invalid prediction value/i);
});

test('parseAndValidateGeminiResponse - rejects invalid riskLevel enum', () => {
  const invalidRisk = JSON.stringify({
    prediction: 'SUSPICIOUS',
    riskLevel: 'EXTREME_DANGER', // Not in allowed enum
    reasons: ['Reason 1'],
    recommendation: 'Be careful',
    limitations: 'No guarantee',
  });

  assert.throws(() => parseAndValidateGeminiResponse(invalidRisk), /Invalid riskLevel value/i);
});

test('parseAndValidateGeminiResponse - rejects empty reasons array', () => {
  const emptyReasons = JSON.stringify({
    prediction: 'SUSPICIOUS',
    riskLevel: 'HIGH',
    reasons: [],
    recommendation: 'Be careful',
    limitations: 'No guarantee',
  });

  assert.throws(() => parseAndValidateGeminiResponse(emptyReasons), /non-empty array of reasons/i);
});

test('parseAndValidateGeminiResponse - rejects missing recommendation or limitations', () => {
  const missingRec = JSON.stringify({
    prediction: 'SUSPICIOUS',
    riskLevel: 'HIGH',
    reasons: ['Some reason'],
    limitations: 'Some limitation',
  });

  assert.throws(() => parseAndValidateGeminiResponse(missingRec), /non-empty recommendation/i);
});

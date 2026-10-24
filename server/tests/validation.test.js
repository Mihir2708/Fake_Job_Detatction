import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAnalyzeJobInput } from '../src/utils/validation.js';

test('validateAnalyzeJobInput - valid payload with only required jobDescription', () => {
  const input = {
    jobDescription: 'We are seeking a Full Stack Software Engineer to build scalable microservices and web interfaces using modern frameworks.',
  };

  const result = validateAnalyzeJobInput(input);
  assert.equal(result.isValid, true);
  assert.equal(result.error, undefined);
  assert.equal(result.sanitizedData.jobDescription, input.jobDescription);
  assert.equal(result.sanitizedData.jobTitle, '');
  assert.equal(result.sanitizedData.companyName, '');
  assert.equal(result.sanitizedData.requirements, '');
  assert.equal(result.sanitizedData.location, '');
});

test('validateAnalyzeJobInput - valid payload with all fields provided and trimmed', () => {
  const input = {
    jobTitle: '  Senior Backend Engineer  ',
    companyName: '  Acme Corp  ',
    jobDescription: '  We are looking for an experienced engineer to lead our database infrastructure and API performance optimizations.  ',
    requirements: '  5+ years Node.js, experience with distributed databases, strong communication skills.  ',
    location: '  Remote (US / Canada)  ',
  };

  const result = validateAnalyzeJobInput(input);
  assert.equal(result.isValid, true);
  assert.equal(result.sanitizedData.jobTitle, 'Senior Backend Engineer');
  assert.equal(result.sanitizedData.companyName, 'Acme Corp');
  assert.equal(result.sanitizedData.jobDescription, 'We are looking for an experienced engineer to lead our database infrastructure and API performance optimizations.');
  assert.equal(result.sanitizedData.requirements, '5+ years Node.js, experience with distributed databases, strong communication skills.');
  assert.equal(result.sanitizedData.location, 'Remote (US / Canada)');
});

test('validateAnalyzeJobInput - rejects non-object or null request body', () => {
  assert.equal(validateAnalyzeJobInput(null).isValid, false);
  assert.equal(validateAnalyzeJobInput(undefined).isValid, false);
  assert.equal(validateAnalyzeJobInput('string').isValid, false);
  assert.equal(validateAnalyzeJobInput([]).isValid, false);
  assert.equal(validateAnalyzeJobInput(123).isValid, false);
});

test('validateAnalyzeJobInput - rejects missing or undefined jobDescription', () => {
  const result = validateAnalyzeJobInput({ jobTitle: 'Developer' });
  assert.equal(result.isValid, false);
  assert.match(result.error, /jobDescription is required/i);
});

test('validateAnalyzeJobInput - rejects non-string jobDescription', () => {
  const result = validateAnalyzeJobInput({ jobDescription: 123456789 });
  assert.equal(result.isValid, false);
  assert.match(result.error, /must be a string/i);
});

test('validateAnalyzeJobInput - rejects jobDescription that is too short', () => {
  const result = validateAnalyzeJobInput({ jobDescription: 'Short job desc' });
  assert.equal(result.isValid, false);
  assert.match(result.error, /minimum 30 characters/i);
});

test('validateAnalyzeJobInput - rejects jobDescription exceeding maximum length', () => {
  const longDesc = 'A'.repeat(15001);
  const result = validateAnalyzeJobInput({ jobDescription: longDesc });
  assert.equal(result.isValid, false);
  assert.match(result.error, /exceeds the maximum allowed length/i);
});

test('validateAnalyzeJobInput - rejects non-string optional fields', () => {
  const baseDesc = 'Valid description that has more than thirty characters of meaningful content.';

  assert.equal(validateAnalyzeJobInput({ jobDescription: baseDesc, jobTitle: 999 }).isValid, false);
  assert.equal(validateAnalyzeJobInput({ jobDescription: baseDesc, companyName: { name: 'Acme' } }).isValid, false);
  assert.equal(validateAnalyzeJobInput({ jobDescription: baseDesc, requirements: ['Node'] }).isValid, false);
  assert.equal(validateAnalyzeJobInput({ jobDescription: baseDesc, location: true }).isValid, false);
});

test('validateAnalyzeJobInput - rejects optional fields exceeding maximum length', () => {
  const baseDesc = 'Valid description that has more than thirty characters of meaningful content.';
  const tooLongTitle = 'A'.repeat(201);

  const result = validateAnalyzeJobInput({ jobDescription: baseDesc, jobTitle: tooLongTitle });
  assert.equal(result.isValid, false);
  assert.match(result.error, /cannot exceed 200 characters/i);
});

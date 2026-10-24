import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  analyzeJob,
  getAnalysisHistory,
  getAnalysisById,
} from '../src/controllers/analysisController.js';
import { JobAnalysis } from '../src/models/JobAnalysis.js';
import { geminiService } from '../src/services/geminiService.js';

// Helper to create a mock Express response object
const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

// Helper to mock mongoose readyState
const setMongooseReadyState = (state) => {
  Object.defineProperty(mongoose.connection, 'readyState', {
    value: state,
    configurable: true,
    writable: true,
  });
};

test('analyzeJob - successful persistence after a valid analysis', async () => {
  setMongooseReadyState(1); // Connected

  let createCalledWith = null;
  const mockCreatedRecord = {
    _id: new mongoose.Types.ObjectId('671ac8e1234567890abcdef1'),
    createdAt: new Date('2026-10-25T00:00:00.000Z'),
  };

  const originalCreate = JobAnalysis.create;
  const originalAnalyze = geminiService.analyzeJobPosting;

  JobAnalysis.create = async (payload) => {
    createCalledWith = payload;
    return mockCreatedRecord;
  };

  geminiService.analyzeJobPosting = async () => {
    return {
      prediction: 'LIKELY_REAL',
      riskLevel: 'LOW',
      reasons: ['Standard corporate responsibilities', 'Transparent hiring flow'],
      recommendation: 'Apply through verified portal',
      limitations: 'Automated evaluation',
      confidence: null,
    };
  };

  try {
    const req = {
      body: {
        jobTitle: 'Software Architect',
        companyName: 'Open Enterprise Corp',
        jobDescription: 'Seeking an experienced Software Architect to design scalable cloud-native architectures.',
        requirements: '10+ years software engineering experience.',
        location: 'New York, NY',
      },
    };
    const res = createMockRes();

    await analyzeJob(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.prediction, 'LIKELY_REAL');
    assert.equal(res.body.data.id.toString(), '671ac8e1234567890abcdef1');
    assert.notEqual(createCalledWith, null);
    assert.equal(createCalledWith.jobTitle, 'Software Architect');
    assert.equal(createCalledWith.prediction, 'LIKELY_REAL');
    assert.equal(createCalledWith.confidence, null);
  } finally {
    JobAnalysis.create = originalCreate;
    geminiService.analyzeJobPosting = originalAnalyze;
  }
});

test('analyzeJob - no persistence when input validation fails', async () => {
  setMongooseReadyState(1);

  let createCalled = false;
  const originalCreate = JobAnalysis.create;
  JobAnalysis.create = async () => {
    createCalled = true;
  };

  try {
    const req = {
      body: {
        jobTitle: 'Engineer',
        companyName: 'Acme Corp',
        jobDescription: 'Too short', // Below 30 char minimum
      },
    };
    const res = createMockRes();

    await analyzeJob(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /minimum 30 characters/i);
    assert.equal(createCalled, false, 'JobAnalysis.create must not be called when validation fails');
  } finally {
    JobAnalysis.create = originalCreate;
  }
});

test('analyzeJob - no persistence when Gemini API analysis fails', async () => {
  setMongooseReadyState(1);

  let createCalled = false;
  const originalCreate = JobAnalysis.create;
  const originalAnalyze = geminiService.analyzeJobPosting;

  JobAnalysis.create = async () => {
    createCalled = true;
  };

  geminiService.analyzeJobPosting = async () => {
    const error = new Error('Gemini API quota exceeded');
    error.statusCode = 429;
    throw error;
  };

  try {
    const req = {
      body: {
        jobTitle: 'Backend Developer',
        companyName: 'Acme Corp',
        jobDescription: 'We are hiring a backend developer to build robust microservices and distributed APIs.',
      },
    };
    const res = createMockRes();

    await analyzeJob(req, res, () => {});

    assert.equal(res.statusCode, 429);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /quota/i);
    assert.equal(createCalled, false, 'JobAnalysis.create must not be called when Gemini analysis fails');
  } finally {
    JobAnalysis.create = originalCreate;
    geminiService.analyzeJobPosting = originalAnalyze;
  }
});

test('getAnalysisHistory - pagination and sanitization of invalid query parameters', async () => {
  setMongooseReadyState(1);

  let skipValue = null;
  let limitValue = null;

  const originalCount = JobAnalysis.countDocuments;
  const originalFind = JobAnalysis.find;

  JobAnalysis.countDocuments = async () => 35;
  JobAnalysis.find = () => ({
    sort: () => ({
      skip: (s) => {
        skipValue = s;
        return {
          limit: (l) => {
            limitValue = l;
            return {
              select: async () => [
                { _id: '1', jobTitle: 'Job 1', prediction: 'LIKELY_REAL', riskLevel: 'LOW' },
                { _id: '2', jobTitle: 'Job 2', prediction: 'SUSPICIOUS', riskLevel: 'HIGH' },
              ],
            };
          },
        };
      },
    }),
  });

  try {
    // Test 1: Valid pagination page=2&limit=10
    const req1 = { query: { page: '2', limit: '10' } };
    const res1 = createMockRes();

    await getAnalysisHistory(req1, res1, () => {});

    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.success, true);
    assert.equal(skipValue, 10);
    assert.equal(limitValue, 10);
    assert.equal(res1.body.pagination.currentPage, 2);
    assert.equal(res1.body.pagination.pageSize, 10);
    assert.equal(res1.body.pagination.totalRecords, 35);
    assert.equal(res1.body.pagination.totalPages, 4);

    // Test 2: Invalid pagination parameters (negative page, excessively large limit)
    const req2 = { query: { page: '-3', limit: '999' } };
    const res2 = createMockRes();

    await getAnalysisHistory(req2, res2, () => {});

    assert.equal(res2.statusCode, 200);
    assert.equal(skipValue, 0); // Defaulted to page 1 -> skip 0
    assert.equal(limitValue, 50); // Clamped to max 50
    assert.equal(res2.body.pagination.currentPage, 1);
    assert.equal(res2.body.pagination.pageSize, 50);
  } finally {
    JobAnalysis.countDocuments = originalCount;
    JobAnalysis.find = originalFind;
  }
});

test('getAnalysisHistory - empty history returns valid pagination structure', async () => {
  setMongooseReadyState(1);

  const originalCount = JobAnalysis.countDocuments;
  const originalFind = JobAnalysis.find;

  JobAnalysis.countDocuments = async () => 0;
  JobAnalysis.find = () => ({
    sort: () => ({
      skip: () => ({
        limit: () => ({
          select: async () => [],
        }),
      }),
    }),
  });

  try {
    const req = { query: {} };
    const res = createMockRes();

    await getAnalysisHistory(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, []);
    assert.equal(res.body.pagination.totalRecords, 0);
    assert.equal(res.body.pagination.totalPages, 1);
  } finally {
    JobAnalysis.countDocuments = originalCount;
    JobAnalysis.find = originalFind;
  }
});

test('getAnalysisById - successfully returns record for valid ObjectId', async () => {
  setMongooseReadyState(1);

  const validId = '671ac8e1234567890abcdef1';
  const mockRecord = {
    _id: validId,
    jobTitle: 'Security Analyst',
    companyName: 'Cyber Defense LLC',
    prediction: 'LIKELY_REAL',
    riskLevel: 'LOW',
    reasons: ['Reason 1'],
    recommendation: 'Verify through official channels',
    limitations: 'Automated test limitation',
    confidence: null,
  };

  const originalFindById = JobAnalysis.findById;
  JobAnalysis.findById = async (id) => {
    if (id === validId) return mockRecord;
    return null;
  };

  try {
    const req = { params: { id: validId } };
    const res = createMockRes();

    await getAnalysisById(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.jobTitle, 'Security Analyst');
  } finally {
    JobAnalysis.findById = originalFindById;
  }
});

test('getAnalysisById - returns 400 Bad Request for invalid MongoDB ObjectId format', async () => {
  setMongooseReadyState(1);

  let findByIdCalled = false;
  const originalFindById = JobAnalysis.findById;
  JobAnalysis.findById = async () => {
    findByIdCalled = true;
  };

  try {
    const req = { params: { id: 'invalid-id-not-hex' } };
    const res = createMockRes();

    await getAnalysisById(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid analysis id format/i);
    assert.equal(findByIdCalled, false, 'findById must not be called with an invalid ObjectId');
  } finally {
    JobAnalysis.findById = originalFindById;
  }
});

test('getAnalysisById - returns 404 when record does not exist', async () => {
  setMongooseReadyState(1);

  const nonExistentId = '671ac8e1234567890abcdef9';
  const originalFindById = JobAnalysis.findById;
  JobAnalysis.findById = async () => null;

  try {
    const req = { params: { id: nonExistentId } };
    const res = createMockRes();

    await getAnalysisById(req, res, () => {});

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /record not found/i);
  } finally {
    JobAnalysis.findById = originalFindById;
  }
});

test('Database safety - returns 503 Service Unavailable when MongoDB is disconnected', async () => {
  setMongooseReadyState(0); // Disconnected

  const req = { query: {}, params: { id: '671ac8e1234567890abcdef1' } };

  // Test history
  const resHistory = createMockRes();
  await getAnalysisHistory(req, resHistory, () => {});
  assert.equal(resHistory.statusCode, 503);
  assert.equal(resHistory.body.success, false);
  assert.match(resHistory.body.message, /database service is currently unavailable/i);

  // Test getById
  const resGetById = createMockRes();
  await getAnalysisById(req, resGetById, () => {});
  assert.equal(resGetById.statusCode, 503);
  assert.equal(resGetById.body.success, false);
  assert.match(resGetById.body.message, /database service is currently unavailable/i);
});

test('Database safety - handles internal database query errors safely without credential leaks', async () => {
  setMongooseReadyState(1);

  const originalCount = JobAnalysis.countDocuments;
  JobAnalysis.countDocuments = async () => {
    throw new Error('MongoServerSelectionError: connection timed out to mongodb+srv://secretUser:secretPass@cluster0.fir5dak.mongodb.net');
  };

  try {
    const req = { query: {} };
    const res = createMockRes();

    await getAnalysisHistory(req, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'An error occurred while retrieving analysis history.');
    // Assert credentials are NEVER in the client response
    assert.equal(JSON.stringify(res.body).includes('secretPass'), false);
    assert.equal(JSON.stringify(res.body).includes('cluster0'), false);
  } finally {
    JobAnalysis.countDocuments = originalCount;
  }
});

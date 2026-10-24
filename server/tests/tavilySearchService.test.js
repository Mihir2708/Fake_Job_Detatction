import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDomain, searchTavily } from '../src/services/tavilySearchService.js';
import { config } from '../src/config/env.js';

test('extractDomain - correctly extracts hostnames', () => {
  assert.equal(extractDomain('https://www.example.com/careers'), 'example.com');
  assert.equal(extractDomain('http://stripe.com'), 'stripe.com');
  assert.equal(extractDomain('sub.domain.org/path'), 'sub.domain.org');
  assert.equal(extractDomain(''), null);
  assert.equal(extractDomain(null), null);
});

test('searchTavily - rejects invalid or too short query', async () => {
  const res1 = await searchTavily('');
  assert.equal(res1.status, 'ERROR');
  assert.match(res1.explanation, /at least 2 characters/i);

  const res2 = await searchTavily('a');
  assert.equal(res2.status, 'ERROR');
});

test('searchTavily - handles missing API key cleanly', async () => {
  const origKey = config.tavilyApiKey;
  const origEnv = process.env.TAVILY_API_KEY;

  config.tavilyApiKey = '';
  process.env.TAVILY_API_KEY = '';

  const res = await searchTavily('valid search query');
  assert.equal(res.status, 'SOURCE_UNAVAILABLE');
  assert.match(res.explanation, /TAVILY_API_KEY/i);
  assert.equal(res.items.length, 0);

  // Restore keys
  config.tavilyApiKey = origKey;
  process.env.TAVILY_API_KEY = origEnv;
});

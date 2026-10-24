/**
 * tavilySearchService.js
 *
 * Official Tavily Search API integration for web search, company domain discovery,
 * and scam report intelligence.
 *
 * API Documentation: https://docs.tavily.com/
 * Endpoint: POST https://api.tavily.com/search
 */

import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RESULTS = 5;

/**
 * Extracts clean domain name from URL.
 *
 * @param {string} url
 * @returns {string|null}
 */
export const extractDomain = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

/**
 * Executes a web search using Tavily's Search API.
 *
 * @param {string} query - The search query
 * @param {object} [options]
 * @param {number} [options.maxResults=5] - Number of results to return (1-20)
 * @param {string} [options.searchDepth='basic'] - 'basic' (free plan) or 'advanced'
 * @param {boolean} [options.includeAnswer=false] - Whether to include AI synthesized answer
 * @returns {Promise<{
 *   status: 'OK' | 'SOURCE_UNAVAILABLE' | 'NOT_FOUND' | 'ERROR',
 *   query: string,
 *   items: Array<{ title: string, link: string, snippet: string, displayLink: string, score: number|null }>,
 *   answer?: string|null,
 *   explanation: string,
 *   responseTime?: number
 * }>}
 */
export const searchTavily = async (query, options = {}) => {
  const apiKey = config.tavilyApiKey || process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return {
      status: 'SOURCE_UNAVAILABLE',
      query: query || '',
      items: [],
      explanation: 'Tavily Search API key is not configured. Set TAVILY_API_KEY in server/.env to enable web search.',
    };
  }

  // Input validation
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return {
      status: 'ERROR',
      query: query || '',
      items: [],
      explanation: 'Search query must be at least 2 characters long.',
    };
  }

  const trimmedQuery = query.trim();
  const maxResults = Math.min(Math.max(parseInt(options.maxResults, 10) || DEFAULT_MAX_RESULTS, 1), 20);
  const searchDepth = options.searchDepth === 'advanced' ? 'advanced' : 'basic';
  const includeAnswer = Boolean(options.includeAnswer);

  const payload = {
    api_key: apiKey,
    query: trimmedQuery,
    max_results: maxResults,
    search_depth: searchDepth,
    include_answer: includeAnswer,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      logger.warn('[Tavily] Authentication failed (HTTP 401/403). Check TAVILY_API_KEY in server/.env.');
      return {
        status: 'SOURCE_UNAVAILABLE',
        query: trimmedQuery,
        items: [],
        explanation: 'Tavily Search API authentication failed. Please verify your TAVILY_API_KEY in server/.env.',
      };
    }

    if (response.status === 429) {
      logger.warn('[Tavily] Rate limit exceeded (HTTP 429).');
      return {
        status: 'SOURCE_UNAVAILABLE',
        query: trimmedQuery,
        items: [],
        explanation: 'Tavily Search API rate limit reached. Web search temporarily unavailable.',
      };
    }

    if (!response.ok) {
      logger.warn(`[Tavily] API responded with HTTP status ${response.status}.`);
      return {
        status: 'SOURCE_UNAVAILABLE',
        query: trimmedQuery,
        items: [],
        explanation: `Tavily Search API encountered an issue (HTTP ${response.status}).`,
      };
    }

    const data = await response.json();
    const rawResults = Array.isArray(data.results) ? data.results : [];

    const items = rawResults.map((item) => {
      const link = item.url || '';
      return {
        title: item.title || '',
        link,
        snippet: item.content || '',
        displayLink: extractDomain(link) || '',
        score: typeof item.score === 'number' ? item.score : null,
      };
    });

    if (items.length === 0) {
      return {
        status: 'NOT_FOUND',
        query: trimmedQuery,
        items: [],
        answer: data.answer || null,
        explanation: `No search results found for query: "${trimmedQuery}".`,
        responseTime: data.response_time,
      };
    }

    return {
      status: 'OK',
      query: trimmedQuery,
      items,
      answer: data.answer || null,
      explanation: `Found ${items.length} search result(s).`,
      responseTime: data.response_time,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.warn(`[Tavily] Search request timed out after ${DEFAULT_TIMEOUT_MS}ms for query: "${trimmedQuery}".`);
      return {
        status: 'SOURCE_UNAVAILABLE',
        query: trimmedQuery,
        items: [],
        explanation: 'Tavily Search API request timed out.',
      };
    }

    logger.error('[Tavily] Unexpected error during search:', error.message);
    return {
      status: 'SOURCE_UNAVAILABLE',
      query: trimmedQuery,
      items: [],
      explanation: 'An unexpected error occurred while communicating with Tavily Search API.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

export default { searchTavily, extractDomain };

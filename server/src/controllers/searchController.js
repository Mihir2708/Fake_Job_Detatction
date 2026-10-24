/**
 * searchController.js
 *
 * Controller for Tavily Search API operations.
 */

import { searchTavily } from '../services/tavilySearchService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Handles POST /api/search
 * Executes a web search via Tavily Search API.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const executeSearch = async (req, res) => {
  try {
    // 1. Verify API Key configuration
    if (!config.tavilyApiKey) {
      return sendError(res, {
        statusCode: 503,
        message: 'Tavily Search API key is not configured on the server. Please set TAVILY_API_KEY in server/.env.',
      });
    }

    const { query, maxResults, searchDepth, includeAnswer } = req.body || {};

    // 2. Validate query
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return sendError(res, {
        statusCode: 400,
        message: 'Search query is required and must be at least 2 characters long.',
      });
    }

    if (query.trim().length > 500) {
      return sendError(res, {
        statusCode: 400,
        message: 'Search query must not exceed 500 characters.',
      });
    }

    // 3. Validate maxResults (clamp between 1 and 20)
    let parsedMaxResults = 5;
    if (maxResults !== undefined) {
      const parsed = parseInt(maxResults, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 20) {
        return sendError(res, {
          statusCode: 400,
          message: 'maxResults must be an integer between 1 and 20.',
        });
      }
      parsedMaxResults = parsed;
    }

    logger.info(`[SearchController] Executing Tavily search for query: "${query.trim().slice(0, 80)}"`);

    // 4. Perform search via service
    const result = await searchTavily(query.trim(), {
      maxResults: parsedMaxResults,
      searchDepth: searchDepth === 'advanced' ? 'advanced' : 'basic',
      includeAnswer: Boolean(includeAnswer),
    });

    if (result.status === 'SOURCE_UNAVAILABLE') {
      return sendError(res, {
        statusCode: 503,
        message: result.explanation || 'Web search service is currently unavailable.',
      });
    }

    if (result.status === 'ERROR') {
      return sendError(res, {
        statusCode: 400,
        message: result.explanation || 'Invalid search parameters.',
      });
    }

    // 5. Return results
    return sendSuccess(res, {
      statusCode: 200,
      message: result.explanation,
      data: {
        query: result.query,
        count: result.items.length,
        results: result.items.map((item) => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
          score: item.score,
          domain: item.displayLink,
        })),
        answer: result.answer || null,
        responseTime: result.responseTime || null,
      },
    });
  } catch (err) {
    logger.error('[SearchController] Search error:', err.message);
    return sendError(res, {
      statusCode: 500,
      message: 'An unexpected internal error occurred while executing web search.',
    });
  }
};

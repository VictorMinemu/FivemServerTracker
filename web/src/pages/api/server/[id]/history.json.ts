/**
 * Server Player History API Endpoint
 *
 * Returns player count history data for a given server ID and time range.
 * Used by the PlayerChart component to fetch chart data on the client.
 *
 * GET /api/server/{id}/history.json?range=24h|7d|30d
 *
 * @module
 */

import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db.js';
import { getPlayerHistory, type TimeRange } from '../../../../lib/history-queries.js';

export const prerender = false;

/** Valid time ranges for input validation */
const VALID_RANGES: ReadonlySet<string> = new Set(['24h', '7d', '30d']);

/**
 * GET handler for server player history.
 *
 * @param context - Astro API route context with params and request
 * @returns JSON response with player history data or error
 *
 * @example
 * ```
 * GET /api/server/bkr4qr/history.json?range=7d
 * // Returns: { data: [[ts1, ts2, ...], [count1, count2, ...]], peak: 85, avg: 41.5, range: '7d' }
 * ```
 */
export const GET: APIRoute = async ({ params, request }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Server ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Extract and validate range from query params
    const url = new URL(request.url);
    const rangeParam = url.searchParams.get('range') ?? '24h';
    const range: TimeRange = VALID_RANGES.has(rangeParam)
      ? (rangeParam as TimeRange)
      : '24h';

    const result = getPlayerHistory(db, id, range);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('History API error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

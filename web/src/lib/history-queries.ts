/**
 * History Query Layer
 *
 * Provides player count history data for chart rendering. Selects the
 * appropriate data source based on the requested time range:
 * - 24h: raw snapshots (highest resolution, ~96 data points)
 * - 7d: hourly rollups (medium resolution, ~168 data points)
 * - 30d: daily rollups (low resolution, ~30 data points)
 *
 * Returns data in uPlot's columnar format [timestamps[], playerCounts[]]
 * with timestamps as Unix seconds.
 *
 * @module
 */

import { and, eq, gte, asc } from 'drizzle-orm';
import { snapshots, hourlyRollups, dailyRollups } from '../../../src/db/schema.js';
import type { DrizzleDB } from '../../../src/db/index.js';

/** Valid time range options for history queries */
export type TimeRange = '24h' | '7d' | '30d';

/** Seconds per time unit */
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

/** Valid time range values for validation */
const VALID_RANGES: readonly TimeRange[] = ['24h', '7d', '30d'];

/**
 * Player history response containing chart data and summary statistics.
 *
 * The `data` field uses uPlot's columnar format: an array of two arrays
 * where the first is timestamps (Unix seconds) and the second is player counts.
 */
export interface HistoryResponse {
  /** uPlot columnar format: [timestamps[], playerCounts[]] */
  data: [number[], number[]];
  /** Peak player count in range */
  peak: number;
  /** Average player count in range */
  avg: number;
  /** Queried time range */
  range: TimeRange;
}

/**
 * Retrieves player count history for a server within the specified time range.
 *
 * Automatically selects the correct data source based on the range:
 * - `'24h'`: Queries the `snapshots` table for raw per-poll data
 * - `'7d'`: Queries the `hourlyRollups` table for hourly aggregates
 * - `'30d'`: Queries the `dailyRollups` table for daily aggregates
 *
 * Timestamps in the output are Unix seconds (not milliseconds) for
 * direct compatibility with uPlot's time axis.
 *
 * @param db - Drizzle database instance
 * @param serverId - FiveM endpoint ID (e.g., "bkr4qr")
 * @param range - Time range to query: '24h', '7d', or '30d'
 * @param nowEpoch - Current time as Unix seconds (defaults to Date.now()/1000). Exposed for testing.
 * @returns Player history with columnar data, peak, average, and range
 *
 * @example
 * ```ts
 * const history = getPlayerHistory(db, 'bkr4qr', '7d');
 * // history.data[0] = [1772500000, 1772503600, ...]  // timestamps (Unix seconds)
 * // history.data[1] = [42, 38, ...]                   // player counts
 * // history.peak = 85
 * // history.avg = 41.5
 * ```
 */
export function getPlayerHistory(
  db: DrizzleDB,
  serverId: string,
  range: TimeRange,
  nowEpoch: number = Math.floor(Date.now() / 1000),
): HistoryResponse {
  // Validate range, default to '24h' if invalid
  const validRange: TimeRange = VALID_RANGES.includes(range) ? range : '24h';

  switch (validRange) {
    case '24h':
      return querySnapshots(db, serverId, nowEpoch);
    case '7d':
      return queryHourlyRollups(db, serverId, nowEpoch);
    case '30d':
      return queryDailyRollups(db, serverId, nowEpoch);
  }
}

/**
 * Queries raw snapshots for the last 24 hours.
 *
 * @param db - Drizzle database instance
 * @param serverId - Server ID to query
 * @param nowEpoch - Current time as Unix seconds
 * @returns HistoryResponse with snapshot data
 */
function querySnapshots(
  db: DrizzleDB,
  serverId: string,
  nowEpoch: number,
): HistoryResponse {
  const cutoff = new Date((nowEpoch - 24 * SECONDS_PER_HOUR) * 1000);

  const rows = db
    .select({
      timestamp: snapshots.timestamp,
      playerCount: snapshots.playerCount,
    })
    .from(snapshots)
    .where(
      and(
        eq(snapshots.serverId, serverId),
        gte(snapshots.timestamp, cutoff),
      ),
    )
    .orderBy(asc(snapshots.timestamp))
    .all();

  if (rows.length === 0) {
    return { data: [[], []], peak: 0, avg: 0, range: '24h' };
  }

  const timestamps: number[] = [];
  const playerCounts: number[] = [];
  let peak = 0;
  let sum = 0;

  for (const row of rows) {
    const ts = Math.floor(row.timestamp.getTime() / 1000);
    timestamps.push(ts);
    playerCounts.push(row.playerCount);
    if (row.playerCount > peak) {
      peak = row.playerCount;
    }
    sum += row.playerCount;
  }

  const avg = sum / rows.length;

  return { data: [timestamps, playerCounts], peak, avg, range: '24h' };
}

/**
 * Queries hourly rollups for the last 7 days.
 *
 * Uses avgPlayers for the chart line and computes peak from maxPlayers
 * across all hourly rollups. Average is weighted by sampleCount.
 *
 * @param db - Drizzle database instance
 * @param serverId - Server ID to query
 * @param nowEpoch - Current time as Unix seconds
 * @returns HistoryResponse with hourly rollup data
 */
function queryHourlyRollups(
  db: DrizzleDB,
  serverId: string,
  nowEpoch: number,
): HistoryResponse {
  const cutoff = new Date((nowEpoch - 7 * SECONDS_PER_DAY) * 1000);

  const rows = db
    .select({
      hourTimestamp: hourlyRollups.hourTimestamp,
      avgPlayers: hourlyRollups.avgPlayers,
      maxPlayers: hourlyRollups.maxPlayers,
      sampleCount: hourlyRollups.sampleCount,
    })
    .from(hourlyRollups)
    .where(
      and(
        eq(hourlyRollups.serverId, serverId),
        gte(hourlyRollups.hourTimestamp, cutoff),
      ),
    )
    .orderBy(asc(hourlyRollups.hourTimestamp))
    .all();

  if (rows.length === 0) {
    return { data: [[], []], peak: 0, avg: 0, range: '7d' };
  }

  const timestamps: number[] = [];
  const playerCounts: number[] = [];
  let peak = 0;
  let weightedSum = 0;
  let totalSamples = 0;

  for (const row of rows) {
    const ts = Math.floor(row.hourTimestamp.getTime() / 1000);
    timestamps.push(ts);
    playerCounts.push(row.avgPlayers);
    if (row.maxPlayers > peak) {
      peak = row.maxPlayers;
    }
    weightedSum += row.avgPlayers * row.sampleCount;
    totalSamples += row.sampleCount;
  }

  const avg = totalSamples > 0 ? weightedSum / totalSamples : 0;

  return { data: [timestamps, playerCounts], peak, avg, range: '7d' };
}

/**
 * Queries daily rollups for the last 30 days.
 *
 * Uses avgPlayers for the chart line and computes peak from maxPlayers
 * across all daily rollups. Average is weighted by sampleCount.
 *
 * @param db - Drizzle database instance
 * @param serverId - Server ID to query
 * @param nowEpoch - Current time as Unix seconds
 * @returns HistoryResponse with daily rollup data
 */
function queryDailyRollups(
  db: DrizzleDB,
  serverId: string,
  nowEpoch: number,
): HistoryResponse {
  const cutoff = new Date((nowEpoch - 30 * SECONDS_PER_DAY) * 1000);

  const rows = db
    .select({
      dayTimestamp: dailyRollups.dayTimestamp,
      avgPlayers: dailyRollups.avgPlayers,
      maxPlayers: dailyRollups.maxPlayers,
      sampleCount: dailyRollups.sampleCount,
    })
    .from(dailyRollups)
    .where(
      and(
        eq(dailyRollups.serverId, serverId),
        gte(dailyRollups.dayTimestamp, cutoff),
      ),
    )
    .orderBy(asc(dailyRollups.dayTimestamp))
    .all();

  if (rows.length === 0) {
    return { data: [[], []], peak: 0, avg: 0, range: '30d' };
  }

  const timestamps: number[] = [];
  const playerCounts: number[] = [];
  let peak = 0;
  let weightedSum = 0;
  let totalSamples = 0;

  for (const row of rows) {
    const ts = Math.floor(row.dayTimestamp.getTime() / 1000);
    timestamps.push(ts);
    playerCounts.push(row.avgPlayers);
    if (row.maxPlayers > peak) {
      peak = row.maxPlayers;
    }
    weightedSum += row.avgPlayers * row.sampleCount;
    totalSamples += row.sampleCount;
  }

  const avg = totalSamples > 0 ? weightedSum / totalSamples : 0;

  return { data: [timestamps, playerCounts], peak, avg, range: '30d' };
}

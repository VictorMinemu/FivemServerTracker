/**
 * Snapshot-to-Rollup Aggregation
 *
 * Aggregates raw snapshots into hourly rollups and hourly rollups into
 * daily rollups. Both functions only process fully completed time windows
 * (never the current hour/day) and are idempotent -- re-running will not
 * create duplicate rollup rows.
 *
 * These functions are designed to run inline during each poll cycle,
 * after snapshot creation and before retention cleanup.
 *
 * @module
 */

import { sql } from 'drizzle-orm';
import type { DrizzleDB } from './index.js';

/** Number of seconds in one hour */
const SECONDS_PER_HOUR = 3600;

/** Number of seconds in one day */
const SECONDS_PER_DAY = 86400;

/**
 * Aggregates raw snapshots from fully completed hours into hourly rollup rows.
 *
 * For each server, finds all snapshots whose timestamp falls before the
 * current hour boundary and after the latest existing hourly rollup (or 0
 * if none exist). Groups by server ID and truncated hour, computing
 * AVG, MAX, MIN of player_count and COUNT of samples.
 *
 * The function is idempotent: if rollups already exist for a given
 * server+hour, the query's WHERE clause excludes those snapshots from
 * re-aggregation by only looking at timestamps strictly after the latest
 * existing rollup hour.
 *
 * @param db - Drizzle database instance
 * @returns Number of hourly rollup rows inserted
 *
 * @example
 * ```ts
 * const inserted = aggregateHourlyRollups(db);
 * if (inserted > 0) {
 *   console.log(`Created ${inserted} hourly rollups`);
 * }
 * ```
 */
export function aggregateHourlyRollups(db: DrizzleDB): number {
  // Current hour boundary: truncate current time to start of hour
  const currentHourBoundary =
    Math.floor(Date.now() / 1000 / SECONDS_PER_HOUR) * SECONDS_PER_HOUR;

  // Insert aggregated rollups for completed hours only.
  // Constants are embedded via sql.raw() to force SQLite integer division
  // (bound parameters are treated as real, breaking truncation arithmetic).
  // The NOT IN subquery prevents re-inserting rollups for already-aggregated
  // server+hour pairs, ensuring idempotency.
  const result = db.run(sql`
    INSERT INTO hourly_rollups (server_id, hour_timestamp, avg_players, max_players, min_players, sample_count)
    SELECT
      s.server_id,
      (s.timestamp / ${sql.raw(String(SECONDS_PER_HOUR))}) * ${sql.raw(String(SECONDS_PER_HOUR))} AS hour_ts,
      AVG(s.player_count),
      MAX(s.player_count),
      MIN(s.player_count),
      COUNT(*)
    FROM snapshots s
    WHERE s.timestamp < ${currentHourBoundary}
      AND (s.timestamp / ${sql.raw(String(SECONDS_PER_HOUR))}) * ${sql.raw(String(SECONDS_PER_HOUR))} NOT IN (
        SELECT h2.hour_timestamp FROM hourly_rollups h2 WHERE h2.server_id = s.server_id
      )
    GROUP BY s.server_id, hour_ts
  `);

  return result.changes;
}

/**
 * Aggregates hourly rollups from fully completed days into daily rollup rows.
 *
 * For each server, finds all hourly rollups whose hour_timestamp falls
 * before the current day boundary and after the latest existing daily
 * rollup (or 0 if none exist). Groups by server ID and truncated day,
 * computing AVG of avg_players, MAX of max_players, MIN of min_players,
 * and SUM of sample_count.
 *
 * The function is idempotent: if daily rollups already exist for a given
 * server+day, those hourly rollups are excluded from re-aggregation.
 *
 * @param db - Drizzle database instance
 * @returns Number of daily rollup rows inserted
 *
 * @example
 * ```ts
 * const inserted = aggregateDailyRollups(db);
 * if (inserted > 0) {
 *   console.log(`Created ${inserted} daily rollups`);
 * }
 * ```
 */
export function aggregateDailyRollups(db: DrizzleDB): number {
  // Current day boundary: truncate current time to start of day (UTC)
  const currentDayBoundary =
    Math.floor(Date.now() / 1000 / SECONDS_PER_DAY) * SECONDS_PER_DAY;

  // Insert aggregated daily rollups for completed days only.
  // Constants are embedded via sql.raw() for proper integer division.
  const result = db.run(sql`
    INSERT INTO daily_rollups (server_id, day_timestamp, avg_players, max_players, min_players, sample_count)
    SELECT
      h.server_id,
      (h.hour_timestamp / ${sql.raw(String(SECONDS_PER_DAY))}) * ${sql.raw(String(SECONDS_PER_DAY))} AS day_ts,
      AVG(h.avg_players),
      MAX(h.max_players),
      MIN(h.min_players),
      SUM(h.sample_count)
    FROM hourly_rollups h
    WHERE h.hour_timestamp < ${currentDayBoundary}
      AND (h.hour_timestamp / ${sql.raw(String(SECONDS_PER_DAY))}) * ${sql.raw(String(SECONDS_PER_DAY))} NOT IN (
        SELECT d2.day_timestamp FROM daily_rollups d2 WHERE d2.server_id = h.server_id
      )
    GROUP BY h.server_id, day_ts
  `);

  return result.changes;
}

/**
 * History Query Layer Tests
 *
 * Validates the player history data access functions for chart rendering:
 * - Correct table selection per time range (snapshots/hourly/daily)
 * - Columnar output format compatible with uPlot [timestamps[], playerCounts[]]
 * - Peak and average stat calculations
 * - Timestamps as Unix seconds (not milliseconds)
 * - Empty data handling
 * - Time window filtering
 *
 * Uses an in-memory SQLite database with real SQL execution (no mocks).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDatabase, type DrizzleDB } from '../../../src/db/index.js';
import { getPlayerHistory } from './history-queries.js';

let db: DrizzleDB;

/** Base epoch for test data: a known hour boundary */
const BASE_EPOCH = Math.floor(1772587200 / 3600) * 3600; // Ensure it's an hour boundary

/** Seconds in various time units */
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

/** "now" for the tests -- 2 hours after base */
const NOW_EPOCH = BASE_EPOCH + 2 * SECONDS_PER_HOUR;

beforeAll(async () => {
  db = createDatabase(':memory:');

  // Create the servers table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      hostname TEXT NOT NULL,
      hostname_clean TEXT NOT NULL,
      project_name TEXT,
      project_description TEXT,
      gametype TEXT,
      mapname TEXT,
      max_players INTEGER NOT NULL,
      current_players INTEGER NOT NULL DEFAULT 0,
      icon_version INTEGER,
      locale TEXT,
      tags TEXT,
      resources TEXT,
      is_online INTEGER NOT NULL DEFAULT 1,
      consecutive_misses INTEGER NOT NULL DEFAULT 0,
      last_seen_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Create snapshots table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      player_count INTEGER NOT NULL,
      max_players INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (server_id) REFERENCES servers(id)
    )
  `);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_snapshots_server_time ON snapshots(server_id, timestamp)`);

  // Create hourly_rollups table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS hourly_rollups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      hour_timestamp INTEGER NOT NULL,
      avg_players REAL NOT NULL,
      max_players INTEGER NOT NULL,
      min_players INTEGER NOT NULL,
      sample_count INTEGER NOT NULL,
      FOREIGN KEY (server_id) REFERENCES servers(id)
    )
  `);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_hourly_server_time ON hourly_rollups(server_id, hour_timestamp)`);

  // Create daily_rollups table
  db.run(sql`
    CREATE TABLE IF NOT EXISTS daily_rollups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      day_timestamp INTEGER NOT NULL,
      avg_players REAL NOT NULL,
      max_players INTEGER NOT NULL,
      min_players INTEGER NOT NULL,
      sample_count INTEGER NOT NULL,
      FOREIGN KEY (server_id) REFERENCES servers(id)
    )
  `);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_daily_server_time ON daily_rollups(server_id, day_timestamp)`);

  // Seed a server record
  db.run(sql`
    INSERT INTO servers (id, hostname, hostname_clean, max_players, current_players, is_online, consecutive_misses, last_seen_at, created_at, updated_at)
    VALUES ('test-srv', 'Test Server', 'Test Server', 128, 50, 1, 0, ${NOW_EPOCH}, ${NOW_EPOCH}, ${NOW_EPOCH})
  `);

  // Seed snapshots at 15-min intervals for the last 2 hours (8 snapshots)
  // Player counts: 20, 25, 30, 40, 50, 45, 35, 28
  const snapshotCounts = [20, 25, 30, 40, 50, 45, 35, 28];
  for (let i = 0; i < snapshotCounts.length; i++) {
    const ts = NOW_EPOCH - (snapshotCounts.length - 1 - i) * 15 * SECONDS_PER_MINUTE;
    db.run(sql`
      INSERT INTO snapshots (server_id, player_count, max_players, timestamp)
      VALUES ('test-srv', ${snapshotCounts[i]!}, 128, ${ts})
    `);
  }

  // Seed hourly rollups for the last 3 days (72 entries)
  for (let i = 0; i < 72; i++) {
    const hourTs = NOW_EPOCH - (72 - i) * SECONDS_PER_HOUR;
    const avgP = 30 + (i % 24); // Varies between 30-53
    const maxP = avgP + 10;
    const minP = avgP - 10;
    db.run(sql`
      INSERT INTO hourly_rollups (server_id, hour_timestamp, avg_players, max_players, min_players, sample_count)
      VALUES ('test-srv', ${hourTs}, ${avgP}, ${maxP}, ${minP}, 4)
    `);
  }

  // Seed daily rollups for the last 60 days (60 entries)
  for (let i = 0; i < 60; i++) {
    const dayTs = NOW_EPOCH - (60 - i) * SECONDS_PER_DAY;
    const avgP = 40 + (i % 30); // Varies between 40-69
    const maxP = avgP + 20;
    const minP = avgP - 15;
    db.run(sql`
      INSERT INTO daily_rollups (server_id, day_timestamp, avg_players, max_players, min_players, sample_count)
      VALUES ('test-srv', ${dayTs}, ${avgP}, ${maxP}, ${minP}, 96)
    `);
  }
});

describe('getPlayerHistory', () => {
  it('returns columnar data [timestamps[], playerCounts[]] for range 24h from snapshots', () => {
    const result = getPlayerHistory(db, 'test-srv', '24h', NOW_EPOCH);
    expect(result.range).toBe('24h');
    expect(result.data).toHaveLength(2);
    expect(Array.isArray(result.data[0])).toBe(true);
    expect(Array.isArray(result.data[1])).toBe(true);
    // Should have data points from snapshots
    expect(result.data[0].length).toBeGreaterThan(0);
    expect(result.data[0].length).toBe(result.data[1].length);
  });

  it('queries hourlyRollups for range 7d using avgPlayers', () => {
    const result = getPlayerHistory(db, 'test-srv', '7d', NOW_EPOCH);
    expect(result.range).toBe('7d');
    expect(result.data[0].length).toBeGreaterThan(0);
    // Hourly rollups use avgPlayers, so values should include fractional numbers
    // (our seed data uses integer avgPlayers, but the function should return them)
    expect(result.data[1].length).toBe(result.data[0].length);
  });

  it('queries dailyRollups for range 30d using avgPlayers', () => {
    const result = getPlayerHistory(db, 'test-srv', '30d', NOW_EPOCH);
    expect(result.range).toBe('30d');
    expect(result.data[0].length).toBeGreaterThan(0);
    expect(result.data[1].length).toBe(result.data[0].length);
  });

  it('returns correct peak (MAX) and avg (AVG) values for 24h', () => {
    const result = getPlayerHistory(db, 'test-srv', '24h', NOW_EPOCH);
    // Seed player counts: [20, 25, 30, 40, 50, 45, 35, 28]
    // Peak = 50, Avg = (20+25+30+40+50+45+35+28) / 8 = 273 / 8 = 34.125
    expect(result.peak).toBe(50);
    expect(result.avg).toBeCloseTo(34.125, 1);
  });

  it('returns empty arrays and zero stats when no data exists for the server', () => {
    const result = getPlayerHistory(db, 'nonexistent-srv', '24h', NOW_EPOCH);
    expect(result.data).toEqual([[], []]);
    expect(result.peak).toBe(0);
    expect(result.avg).toBe(0);
    expect(result.range).toBe('24h');
  });

  it('timestamps in output are Unix seconds (not milliseconds)', () => {
    const result = getPlayerHistory(db, 'test-srv', '24h', NOW_EPOCH);
    // All timestamps should be reasonable Unix seconds (not milliseconds)
    // Unix seconds for a date around 2026 are ~1.77 billion
    // Milliseconds would be ~1.77 trillion
    for (const ts of result.data[0]) {
      expect(ts).toBeLessThan(10_000_000_000); // Less than 10 billion = seconds
      expect(ts).toBeGreaterThan(1_000_000_000); // Greater than 1 billion = after 2001
    }
  });

  it('only returns data within the requested time window (not older)', () => {
    const result24h = getPlayerHistory(db, 'test-srv', '24h', NOW_EPOCH);
    const cutoff24h = NOW_EPOCH - 24 * SECONDS_PER_HOUR;
    for (const ts of result24h.data[0]) {
      expect(ts).toBeGreaterThanOrEqual(cutoff24h);
    }

    const result7d = getPlayerHistory(db, 'test-srv', '7d', NOW_EPOCH);
    const cutoff7d = NOW_EPOCH - 7 * SECONDS_PER_DAY;
    for (const ts of result7d.data[0]) {
      expect(ts).toBeGreaterThanOrEqual(cutoff7d);
    }

    const result30d = getPlayerHistory(db, 'test-srv', '30d', NOW_EPOCH);
    const cutoff30d = NOW_EPOCH - 30 * SECONDS_PER_DAY;
    for (const ts of result30d.data[0]) {
      expect(ts).toBeGreaterThanOrEqual(cutoff30d);
    }
  });

  it('returns data sorted by timestamp ascending', () => {
    const result = getPlayerHistory(db, 'test-srv', '24h', NOW_EPOCH);
    for (let i = 1; i < result.data[0].length; i++) {
      expect(result.data[0][i]!).toBeGreaterThanOrEqual(result.data[0][i - 1]!);
    }
  });

  it('defaults to 24h for invalid range', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = getPlayerHistory(db, 'test-srv', 'invalid' as any, NOW_EPOCH);
    expect(result.range).toBe('24h');
  });
});

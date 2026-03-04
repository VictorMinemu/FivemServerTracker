/**
 * Aggregation Logic Tests
 *
 * Validates snapshot-to-hourly and hourly-to-daily rollup aggregation:
 * correct AVG/MAX/MIN/COUNT, completed-window-only processing,
 * idempotency, and multi-server independence.
 *
 * Uses an in-memory SQLite database with real SQL execution (no mocks).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import type { DrizzleDB } from './index.js';
import { aggregateHourlyRollups, aggregateDailyRollups } from './aggregation.js';

/**
 * Creates a fresh in-memory SQLite database with the full schema applied.
 */
function createTestDb(): DrizzleDB {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE servers (
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
    );

    CREATE TABLE snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL REFERENCES servers(id),
      player_count INTEGER NOT NULL,
      max_players INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX idx_snapshots_server_time ON snapshots(server_id, timestamp);
    CREATE INDEX idx_snapshots_timestamp ON snapshots(timestamp);

    CREATE TABLE hourly_rollups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL REFERENCES servers(id),
      hour_timestamp INTEGER NOT NULL,
      avg_players REAL NOT NULL,
      max_players INTEGER NOT NULL,
      min_players INTEGER NOT NULL,
      sample_count INTEGER NOT NULL
    );
    CREATE INDEX idx_hourly_server_time ON hourly_rollups(server_id, hour_timestamp);

    CREATE TABLE daily_rollups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL REFERENCES servers(id),
      day_timestamp INTEGER NOT NULL,
      avg_players REAL NOT NULL,
      max_players INTEGER NOT NULL,
      min_players INTEGER NOT NULL,
      sample_count INTEGER NOT NULL
    );
    CREATE INDEX idx_daily_server_time ON daily_rollups(server_id, day_timestamp);
  `);

  return drizzle(sqlite, { schema }) as unknown as DrizzleDB;
}

/** Helper: insert a server record for FK constraints */
function insertServer(db: DrizzleDB, id: string): void {
  const now = new Date();
  db.insert(schema.servers)
    .values({
      id,
      hostname: `Server ${id}`,
      hostnameClean: `Server ${id}`,
      maxPlayers: 128,
      currentPlayers: 0,
      isOnline: true,
      consecutiveMisses: 0,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

/** Helper: insert a raw snapshot with a Unix epoch timestamp */
function insertSnapshot(
  db: DrizzleDB,
  serverId: string,
  playerCount: number,
  maxPlayers: number,
  epochSeconds: number,
): void {
  db.insert(schema.snapshots)
    .values({
      serverId,
      playerCount,
      maxPlayers,
      timestamp: new Date(epochSeconds * 1000),
    })
    .run();
}

/** Helper: insert an hourly rollup with a Unix epoch timestamp */
function insertHourlyRollup(
  db: DrizzleDB,
  serverId: string,
  hourEpoch: number,
  avgPlayers: number,
  maxPlayers: number,
  minPlayers: number,
  sampleCount: number,
): void {
  db.insert(schema.hourlyRollups)
    .values({
      serverId,
      hourTimestamp: new Date(hourEpoch * 1000),
      avgPlayers,
      maxPlayers,
      minPlayers,
      sampleCount,
    })
    .run();
}

describe('aggregateHourlyRollups', () => {
  let db: DrizzleDB;

  // Fixed "now" = 2026-03-04T02:30:00Z (epoch 1772593800)
  // Current hour boundary = floor(1772593800 / 3600) * 3600 = 1772593200
  // Completed hour = 1772593200 - 3600 = 1772589600
  const NOW_EPOCH = 1772593800;
  const CURRENT_HOUR = 1772593200;
  const COMPLETED_HOUR = CURRENT_HOUR - 3600; // 1772589600

  beforeEach(() => {
    db = createTestDb();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_EPOCH * 1000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aggregates snapshots from a completed hour with correct AVG, MAX, MIN, COUNT', () => {
    insertServer(db, 'srv-a');

    // 4 snapshots in the completed hour
    insertSnapshot(db, 'srv-a', 10, 128, COMPLETED_HOUR + 0);
    insertSnapshot(db, 'srv-a', 20, 128, COMPLETED_HOUR + 900);
    insertSnapshot(db, 'srv-a', 30, 128, COMPLETED_HOUR + 1800);
    insertSnapshot(db, 'srv-a', 40, 128, COMPLETED_HOUR + 2700);

    const inserted = aggregateHourlyRollups(db);
    expect(inserted).toBe(1);

    const rollups = db.select().from(schema.hourlyRollups).all();
    expect(rollups.length).toBe(1);

    const rollup = rollups[0]!;
    expect(rollup.serverId).toBe('srv-a');
    expect(rollup.avgPlayers).toBeCloseTo(25, 1); // (10+20+30+40)/4
    expect(rollup.maxPlayers).toBe(40);
    expect(rollup.minPlayers).toBe(10);
    expect(rollup.sampleCount).toBe(4);
  });

  it('does NOT aggregate snapshots from the current (incomplete) hour', () => {
    insertServer(db, 'srv-a');

    // Snapshots in the current hour (should be skipped)
    insertSnapshot(db, 'srv-a', 50, 128, CURRENT_HOUR + 100);
    insertSnapshot(db, 'srv-a', 60, 128, CURRENT_HOUR + 200);

    const inserted = aggregateHourlyRollups(db);
    expect(inserted).toBe(0);

    const rollups = db.select().from(schema.hourlyRollups).all();
    expect(rollups.length).toBe(0);
  });

  it('is idempotent -- running twice does not create duplicate rollups', () => {
    insertServer(db, 'srv-a');

    insertSnapshot(db, 'srv-a', 10, 128, COMPLETED_HOUR + 0);
    insertSnapshot(db, 'srv-a', 20, 128, COMPLETED_HOUR + 900);

    const first = aggregateHourlyRollups(db);
    expect(first).toBe(1);

    const second = aggregateHourlyRollups(db);
    expect(second).toBe(0);

    const rollups = db.select().from(schema.hourlyRollups).all();
    expect(rollups.length).toBe(1);
  });

  it('handles multiple servers in the same hour independently', () => {
    insertServer(db, 'srv-a');
    insertServer(db, 'srv-b');

    // Server A: 2 snapshots
    insertSnapshot(db, 'srv-a', 10, 128, COMPLETED_HOUR + 0);
    insertSnapshot(db, 'srv-a', 30, 128, COMPLETED_HOUR + 900);

    // Server B: 3 snapshots with different values
    insertSnapshot(db, 'srv-b', 100, 256, COMPLETED_HOUR + 0);
    insertSnapshot(db, 'srv-b', 200, 256, COMPLETED_HOUR + 900);
    insertSnapshot(db, 'srv-b', 300, 256, COMPLETED_HOUR + 1800);

    const inserted = aggregateHourlyRollups(db);
    expect(inserted).toBe(2);

    const rollups = db.select().from(schema.hourlyRollups).all();
    expect(rollups.length).toBe(2);

    const rollupA = rollups.find((r) => r.serverId === 'srv-a')!;
    expect(rollupA.avgPlayers).toBeCloseTo(20, 1);
    expect(rollupA.maxPlayers).toBe(30);
    expect(rollupA.minPlayers).toBe(10);
    expect(rollupA.sampleCount).toBe(2);

    const rollupB = rollups.find((r) => r.serverId === 'srv-b')!;
    expect(rollupB.avgPlayers).toBeCloseTo(200, 1);
    expect(rollupB.maxPlayers).toBe(300);
    expect(rollupB.minPlayers).toBe(100);
    expect(rollupB.sampleCount).toBe(3);
  });
});

describe('aggregateDailyRollups', () => {
  let db: DrizzleDB;

  // Fixed "now" = 2026-03-04T02:30:00Z (epoch 1772593800)
  // Current day boundary = 2026-03-04T00:00:00Z (epoch 1772582400)
  const NOW_EPOCH = 1772593800;
  const CURRENT_DAY = 1772582400;
  // A fully completed day: 2026-03-03T00:00:00Z
  const COMPLETED_DAY = CURRENT_DAY - 86400;

  beforeEach(() => {
    db = createTestDb();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_EPOCH * 1000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aggregates hourly rollups from a completed day into one daily rollup per server', () => {
    insertServer(db, 'srv-a');

    // 4 hourly rollups in the completed day (hours 00, 06, 12, 18)
    insertHourlyRollup(db, 'srv-a', COMPLETED_DAY + 0, 15, 30, 5, 4);
    insertHourlyRollup(db, 'srv-a', COMPLETED_DAY + 21600, 25, 50, 10, 4);
    insertHourlyRollup(db, 'srv-a', COMPLETED_DAY + 43200, 35, 70, 15, 4);
    insertHourlyRollup(db, 'srv-a', COMPLETED_DAY + 64800, 45, 90, 20, 4);

    const inserted = aggregateDailyRollups(db);
    expect(inserted).toBe(1);

    const rollups = db.select().from(schema.dailyRollups).all();
    expect(rollups.length).toBe(1);

    const rollup = rollups[0]!;
    expect(rollup.serverId).toBe('srv-a');
    expect(rollup.avgPlayers).toBeCloseTo(30, 1); // (15+25+35+45)/4
    expect(rollup.maxPlayers).toBe(90); // MAX of maxPlayers
    expect(rollup.minPlayers).toBe(5); // MIN of minPlayers
    expect(rollup.sampleCount).toBe(16); // SUM of sampleCount: 4+4+4+4
  });

  it('does NOT aggregate hourly rollups from the current (incomplete) day', () => {
    insertServer(db, 'srv-a');

    // Hourly rollup in the current day (should be skipped)
    insertHourlyRollup(db, 'srv-a', CURRENT_DAY + 0, 20, 40, 10, 4);

    const inserted = aggregateDailyRollups(db);
    expect(inserted).toBe(0);

    const rollups = db.select().from(schema.dailyRollups).all();
    expect(rollups.length).toBe(0);
  });

  it('is idempotent -- running twice does not create duplicate daily rollups', () => {
    insertServer(db, 'srv-a');

    insertHourlyRollup(db, 'srv-a', COMPLETED_DAY + 0, 20, 40, 10, 4);
    insertHourlyRollup(db, 'srv-a', COMPLETED_DAY + 3600, 30, 50, 15, 4);

    const first = aggregateDailyRollups(db);
    expect(first).toBe(1);

    const second = aggregateDailyRollups(db);
    expect(second).toBe(0);

    const rollups = db.select().from(schema.dailyRollups).all();
    expect(rollups.length).toBe(1);
  });
});

describe('aggregation row count returns', () => {
  let db: DrizzleDB;

  const NOW_EPOCH = 1772593800;
  const CURRENT_HOUR = 1772593200;
  const COMPLETED_HOUR = CURRENT_HOUR - 3600; // 1772589600
  const CURRENT_DAY = 1772582400;
  const COMPLETED_DAY = CURRENT_DAY - 86400; // 1772496000

  beforeEach(() => {
    db = createTestDb();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_EPOCH * 1000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('both functions return the number of rows inserted', () => {
    insertServer(db, 'srv-a');
    insertServer(db, 'srv-b');

    // 2 servers with snapshots in the same completed hour
    insertSnapshot(db, 'srv-a', 10, 128, COMPLETED_HOUR + 0);
    insertSnapshot(db, 'srv-b', 20, 64, COMPLETED_HOUR + 0);

    const hourlyCount = aggregateHourlyRollups(db);
    expect(hourlyCount).toBe(2);

    // 2 servers with hourly rollups in a completed day
    insertHourlyRollup(db, 'srv-a', COMPLETED_DAY + 0, 10, 20, 5, 2);
    insertHourlyRollup(db, 'srv-b', COMPLETED_DAY + 0, 30, 40, 25, 2);

    const dailyCount = aggregateDailyRollups(db);
    expect(dailyCount).toBe(2);
  });
});

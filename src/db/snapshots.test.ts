/**
 * Database Operations Tests
 *
 * Integration tests for all database CRUD operations using an in-memory
 * SQLite database. Each test gets a fresh database instance so tests are
 * fully isolated and can run in any order.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import {
  batchUpsertServers,
  createSnapshots,
  getExistingServerStatuses,
  markMissingServersOffline,
  deleteExpiredData,
} from './operations.js';
import type { ServerUpsert } from '../types/server.js';
import type { DrizzleDB } from './index.js';

/**
 * Creates a fresh in-memory SQLite database with the full schema applied.
 * Uses raw SQL to create tables matching the Drizzle schema definition,
 * since drizzle-kit push requires a file-based database.
 */
function createTestDb(): DrizzleDB {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  // Create tables matching the Drizzle schema
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

/** Helper: creates a ServerUpsert for testing with sensible defaults */
function makeServerUpsert(overrides: Partial<ServerUpsert> = {}): ServerUpsert {
  const now = new Date();
  return {
    id: 'test-server-1',
    hostname: '^1Test ^0Server',
    hostnameClean: 'Test Server',
    projectName: 'Test Project',
    projectDescription: 'A test server',
    gametype: 'roleplay',
    mapname: 'fivem-map-hipster',
    maxPlayers: 128,
    currentPlayers: 42,
    iconVersion: 12345,
    locale: 'en-US',
    tags: '["rp","voice"]',
    resources: '["mysql-async","es_extended"]',
    isOnline: true,
    consecutiveMisses: 0,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('batchUpsertServers', () => {
  let db: DrizzleDB;

  beforeEach(() => {
    db = createTestDb();
  });

  it('inserts new servers and returns correct count', () => {
    const serverList = [
      makeServerUpsert({ id: 'srv-1', hostnameClean: 'Server One' }),
      makeServerUpsert({ id: 'srv-2', hostnameClean: 'Server Two' }),
      makeServerUpsert({ id: 'srv-3', hostnameClean: 'Server Three' }),
    ];

    const count = batchUpsertServers(db, serverList);
    expect(count).toBe(3);

    // Verify data was actually inserted
    const rows = db.select().from(schema.servers).all();
    expect(rows.length).toBe(3);
    expect(rows.map((r) => r.id).sort()).toEqual(['srv-1', 'srv-2', 'srv-3']);
  });

  it('updates existing server on conflict (upsert behavior)', () => {
    const server = makeServerUpsert({
      id: 'upsert-test',
      hostnameClean: 'Original Name',
      maxPlayers: 64,
    });

    batchUpsertServers(db, [server]);

    // Upsert with different data
    const updated = makeServerUpsert({
      id: 'upsert-test',
      hostnameClean: 'Updated Name',
      maxPlayers: 128,
    });
    const count = batchUpsertServers(db, [updated]);
    expect(count).toBe(1);

    const rows = db.select().from(schema.servers).all();
    expect(rows.length).toBe(1);
    expect(rows[0]!.hostnameClean).toBe('Updated Name');
    expect(rows[0]!.maxPlayers).toBe(128);
  });

  it('returns 0 for empty input', () => {
    const count = batchUpsertServers(db, []);
    expect(count).toBe(0);
  });
});

describe('createSnapshots', () => {
  let db: DrizzleDB;

  beforeEach(() => {
    db = createTestDb();
    // Insert prerequisite servers (foreign key constraint)
    batchUpsertServers(db, [
      makeServerUpsert({ id: 'snap-srv-1' }),
      makeServerUpsert({ id: 'snap-srv-2' }),
    ]);
  });

  it('creates one snapshot per server with correct timestamp', () => {
    const snapshotData = [
      { serverId: 'snap-srv-1', playerCount: 42, maxPlayers: 128 },
      { serverId: 'snap-srv-2', playerCount: 15, maxPlayers: 64 },
    ];

    const count = createSnapshots(db, snapshotData);
    expect(count).toBe(2);

    const rows = db.select().from(schema.snapshots).all();
    expect(rows.length).toBe(2);

    const snap1 = rows.find((r) => r.serverId === 'snap-srv-1');
    expect(snap1).toBeDefined();
    expect(snap1!.playerCount).toBe(42);
    expect(snap1!.maxPlayers).toBe(128);
    expect(snap1!.timestamp).toBeInstanceOf(Date);

    const snap2 = rows.find((r) => r.serverId === 'snap-srv-2');
    expect(snap2).toBeDefined();
    expect(snap2!.playerCount).toBe(15);
  });

  it('returns 0 for empty input', () => {
    const count = createSnapshots(db, []);
    expect(count).toBe(0);
  });
});

describe('getExistingServerStatuses', () => {
  let db: DrizzleDB;

  beforeEach(() => {
    db = createTestDb();
    batchUpsertServers(db, [
      makeServerUpsert({
        id: 'status-srv-1',
        isOnline: true,
        consecutiveMisses: 0,
      }),
      makeServerUpsert({
        id: 'status-srv-2',
        isOnline: false,
        consecutiveMisses: 3,
      }),
    ]);
  });

  it('returns status map for known servers', () => {
    const statuses = getExistingServerStatuses(db, [
      'status-srv-1',
      'status-srv-2',
    ]);
    expect(statuses.size).toBe(2);

    const status1 = statuses.get('status-srv-1');
    expect(status1).toBeDefined();
    expect(status1!.isOnline).toBe(true);
    expect(status1!.consecutiveMisses).toBe(0);

    const status2 = statuses.get('status-srv-2');
    expect(status2).toBeDefined();
    expect(status2!.isOnline).toBe(false);
    expect(status2!.consecutiveMisses).toBe(3);
  });

  it('returns empty map for unknown server IDs', () => {
    const statuses = getExistingServerStatuses(db, [
      'unknown-1',
      'unknown-2',
    ]);
    expect(statuses.size).toBe(0);
  });

  it('returns empty map for empty input', () => {
    const statuses = getExistingServerStatuses(db, []);
    expect(statuses.size).toBe(0);
  });
});

describe('markMissingServersOffline', () => {
  let db: DrizzleDB;

  beforeEach(() => {
    db = createTestDb();
  });

  it('increments miss counter but keeps online until threshold', () => {
    batchUpsertServers(db, [
      makeServerUpsert({
        id: 'miss-srv-1',
        isOnline: true,
        consecutiveMisses: 0,
      }),
    ]);

    // Server not present in poll
    const newlyOffline = markMissingServersOffline(db, new Set());
    expect(newlyOffline).toBe(0); // Miss count = 1, still below threshold of 3

    const rows = db.select().from(schema.servers).all();
    const server = rows.find((r) => r.id === 'miss-srv-1');
    expect(server!.consecutiveMisses).toBe(1);
    expect(server!.isOnline).toBe(true); // Still online (1 < 3)
  });

  it('marks server offline at threshold', () => {
    batchUpsertServers(db, [
      makeServerUpsert({
        id: 'threshold-srv',
        isOnline: true,
        consecutiveMisses: 2, // One more miss will reach threshold of 3
      }),
    ]);

    const newlyOffline = markMissingServersOffline(db, new Set());
    expect(newlyOffline).toBe(1);

    const rows = db.select().from(schema.servers).all();
    const server = rows.find((r) => r.id === 'threshold-srv');
    expect(server!.consecutiveMisses).toBe(3);
    expect(server!.isOnline).toBe(false);
  });

  it('does not touch servers that are in presentIds', () => {
    batchUpsertServers(db, [
      makeServerUpsert({
        id: 'present-srv',
        isOnline: true,
        consecutiveMisses: 0,
      }),
    ]);

    const newlyOffline = markMissingServersOffline(
      db,
      new Set(['present-srv']),
    );
    expect(newlyOffline).toBe(0);

    const rows = db.select().from(schema.servers).all();
    const server = rows.find((r) => r.id === 'present-srv');
    expect(server!.consecutiveMisses).toBe(0); // Unchanged
    expect(server!.isOnline).toBe(true);
  });

  it('returns 0 when no online servers are missing', () => {
    const newlyOffline = markMissingServersOffline(db, new Set());
    expect(newlyOffline).toBe(0);
  });
});

describe('deleteExpiredData', () => {
  let db: DrizzleDB;

  beforeEach(() => {
    db = createTestDb();
    // Create prerequisite server
    batchUpsertServers(db, [
      makeServerUpsert({ id: 'retention-srv' }),
    ]);
  });

  it('removes snapshots older than 7 days but keeps recent ones', () => {
    const now = new Date();
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    // Insert old and recent snapshots
    db.insert(schema.snapshots)
      .values({
        serverId: 'retention-srv',
        playerCount: 10,
        maxPlayers: 64,
        timestamp: eightDaysAgo,
      })
      .run();
    db.insert(schema.snapshots)
      .values({
        serverId: 'retention-srv',
        playerCount: 20,
        maxPlayers: 64,
        timestamp: twoDaysAgo,
      })
      .run();

    const result = deleteExpiredData(db);
    expect(result.snapshotsDeleted).toBe(1);

    const remaining = db.select().from(schema.snapshots).all();
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.playerCount).toBe(20); // Recent one kept
  });

  it('removes hourly rollups older than 90 days but keeps recent ones', () => {
    const now = new Date();
    const ninetyOneDaysAgo = new Date(
      now.getTime() - 91 * 24 * 60 * 60 * 1000,
    );
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    db.insert(schema.hourlyRollups)
      .values({
        serverId: 'retention-srv',
        hourTimestamp: ninetyOneDaysAgo,
        avgPlayers: 10.5,
        maxPlayers: 20,
        minPlayers: 5,
        sampleCount: 4,
      })
      .run();
    db.insert(schema.hourlyRollups)
      .values({
        serverId: 'retention-srv',
        hourTimestamp: thirtyDaysAgo,
        avgPlayers: 15.5,
        maxPlayers: 25,
        minPlayers: 8,
        sampleCount: 4,
      })
      .run();

    const result = deleteExpiredData(db);
    expect(result.rollupsDeleted).toBe(1);

    const remaining = db.select().from(schema.hourlyRollups).all();
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.avgPlayers).toBe(15.5); // Recent one kept
  });

  it('does not touch daily rollups regardless of age', () => {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    db.insert(schema.dailyRollups)
      .values({
        serverId: 'retention-srv',
        dayTimestamp: oneYearAgo,
        avgPlayers: 12.0,
        maxPlayers: 30,
        minPlayers: 3,
        sampleCount: 24,
      })
      .run();

    deleteExpiredData(db);

    const remaining = db.select().from(schema.dailyRollups).all();
    expect(remaining.length).toBe(1); // Still there -- daily rollups are kept indefinitely
  });

  it('returns zero counts when nothing is expired', () => {
    const result = deleteExpiredData(db);
    expect(result.snapshotsDeleted).toBe(0);
    expect(result.rollupsDeleted).toBe(0);
  });
});

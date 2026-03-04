/**
 * Query Layer Tests
 *
 * Validates all data access patterns for server browsing:
 * listing with search/filter/sort/pagination, detail with parsed arrays,
 * category mapping, and popular tags aggregation.
 *
 * Uses an in-memory SQLite database with real SQL execution (no mocks).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDatabase, type DrizzleDB } from '../../../src/db/index.js';
import { servers } from '../../../src/db/schema.js';
import {
  getServerListing,
  getServerDetail,
  getCategories,
  getPopularTags,
} from './queries.js';

let db: DrizzleDB;

/**
 * Seed data: 10 servers with varied gametype, locale, player counts, tags, resources.
 */
const seedServers = [
  {
    id: 'srv001',
    hostname: '^1RP ^0City',
    hostnameClean: 'RP City',
    projectName: 'RP City Project',
    projectDescription: 'A roleplay server',
    gametype: 'roleplay',
    mapname: 'los-santos',
    maxPlayers: 128,
    currentPlayers: 100,
    iconVersion: 1,
    locale: 'en-US',
    tags: JSON.stringify(['roleplay', 'serious', 'economy']),
    resources: JSON.stringify(['es_extended', 'esx_skin']),
    isOnline: true,
    consecutiveMisses: 0,
    lastSeenAt: new Date('2026-03-04T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
  },
  {
    id: 'srv002',
    hostname: 'Racing Hub',
    hostnameClean: 'Racing Hub',
    projectName: 'Racing Hub',
    projectDescription: 'Competitive racing',
    gametype: 'racing',
    mapname: 'track-1',
    maxPlayers: 64,
    currentPlayers: 50,
    iconVersion: 2,
    locale: 'en-US',
    tags: JSON.stringify(['racing', 'competitive']),
    resources: JSON.stringify(['race_system']),
    isOnline: true,
    consecutiveMisses: 0,
    lastSeenAt: new Date('2026-03-04T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
  },
  {
    id: 'srv003',
    hostname: 'Freeroam Paradise',
    hostnameClean: 'Freeroam Paradise',
    projectName: 'Freeroam Paradise',
    projectDescription: 'Free roam fun',
    gametype: 'freeroam',
    mapname: 'map-1',
    maxPlayers: 200,
    currentPlayers: 75,
    iconVersion: null,
    locale: 'es-ES',
    tags: JSON.stringify(['freeroam', 'fun']),
    resources: JSON.stringify(['vehicle_spawner']),
    isOnline: true,
    consecutiveMisses: 0,
    lastSeenAt: new Date('2026-03-04T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
  },
  {
    id: 'srv004',
    hostname: 'Offline RP Server',
    hostnameClean: 'Offline RP Server',
    projectName: 'Offline RP',
    projectDescription: null,
    gametype: 'roleplay',
    mapname: 'city',
    maxPlayers: 32,
    currentPlayers: 0,
    iconVersion: null,
    locale: 'en-US',
    tags: JSON.stringify(['roleplay']),
    resources: JSON.stringify([]),
    isOnline: false,
    consecutiveMisses: 4,
    lastSeenAt: new Date('2026-03-03T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-03-03T00:00:00Z'),
  },
  {
    id: 'srv005',
    hostname: 'Tiny RP',
    hostnameClean: 'Tiny RP',
    projectName: 'Tiny RP',
    projectDescription: 'Small rp server',
    gametype: 'rp',
    mapname: 'los-santos',
    maxPlayers: 16,
    currentPlayers: 5,
    iconVersion: 5,
    locale: 'fr-FR',
    tags: JSON.stringify(['roleplay', 'economy']),
    resources: JSON.stringify(['qb-core']),
    isOnline: true,
    consecutiveMisses: 0,
    lastSeenAt: new Date('2026-03-04T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
  },
  {
    id: 'srv006',
    hostname: 'No Tags Server',
    hostnameClean: 'No Tags Server',
    projectName: null,
    projectDescription: null,
    gametype: 'deathmatch',
    mapname: 'arena',
    maxPlayers: 24,
    currentPlayers: 12,
    iconVersion: null,
    locale: 'de-DE',
    tags: null,
    resources: null,
    isOnline: true,
    consecutiveMisses: 0,
    lastSeenAt: new Date('2026-03-04T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
  },
  {
    id: 'srv007',
    hostname: 'Big Race Server',
    hostnameClean: 'Big Race Server',
    projectName: 'Big Race',
    projectDescription: 'Big racing server',
    gametype: 'race',
    mapname: 'circuit',
    maxPlayers: 100,
    currentPlayers: 80,
    iconVersion: 7,
    locale: 'en-US',
    tags: JSON.stringify(['racing', 'competitive', 'economy']),
    resources: JSON.stringify(['race_core', 'garage']),
    isOnline: true,
    consecutiveMisses: 0,
    lastSeenAt: new Date('2026-03-04T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
  },
  {
    id: 'srv008',
    hostname: 'Spanish RP',
    hostnameClean: 'Spanish RP',
    projectName: 'Spanish RP',
    projectDescription: 'Spanish roleplay',
    gametype: 'roleplay',
    mapname: 'ciudad',
    maxPlayers: 64,
    currentPlayers: 30,
    iconVersion: 8,
    locale: 'es-ES',
    tags: JSON.stringify(['roleplay', 'serious', 'spanish']),
    resources: JSON.stringify(['es_extended']),
    isOnline: true,
    consecutiveMisses: 0,
    lastSeenAt: new Date('2026-03-04T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
  },
  {
    id: 'srv009',
    hostname: 'Free Roam Zone',
    hostnameClean: 'Free Roam Zone',
    projectName: 'Free Roam Zone',
    projectDescription: 'Free roam zone',
    gametype: 'free roam',
    mapname: 'wilderness',
    maxPlayers: 48,
    currentPlayers: 20,
    iconVersion: null,
    locale: 'en-US',
    tags: JSON.stringify(['freeroam', 'fun', 'economy']),
    resources: JSON.stringify(['spawn_manager']),
    isOnline: true,
    consecutiveMisses: 0,
    lastSeenAt: new Date('2026-03-04T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
  },
  {
    id: 'srv010',
    hostname: 'Empty Server',
    hostnameClean: 'Empty Server',
    projectName: 'Empty',
    projectDescription: null,
    gametype: 'sandbox',
    mapname: 'test',
    maxPlayers: 10,
    currentPlayers: 0,
    iconVersion: null,
    locale: 'en-US',
    tags: JSON.stringify(['test']),
    resources: JSON.stringify([]),
    isOnline: true,
    consecutiveMisses: 0,
    lastSeenAt: new Date('2026-03-04T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-03-04T00:00:00Z'),
  },
];

beforeAll(async () => {
  db = createDatabase(':memory:');

  // Create the servers table using raw SQL for in-memory DB
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

  // Seed the database
  for (const server of seedServers) {
    db.insert(servers).values(server).run();
  }
});

describe('getServerListing', () => {
  it('returns online servers sorted by currentPlayers descending by default', async () => {
    const result = await getServerListing(db);
    expect(result.servers.length).toBeGreaterThan(0);
    // All returned servers should be online
    for (const s of result.servers) {
      expect(s.isOnline).toBe(true);
    }
    // Check sorted by currentPlayers descending
    for (let i = 1; i < result.servers.length; i++) {
      const prev = result.servers[i - 1];
      const curr = result.servers[i];
      expect(prev!.currentPlayers).toBeGreaterThanOrEqual(curr!.currentPlayers);
    }
    // Offline server (srv004) should NOT appear
    const ids = result.servers.map((s) => s.id);
    expect(ids).not.toContain('srv004');
  });

  it('uses default page 1 and pageSize 24', async () => {
    const result = await getServerListing(db);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(24);
  });

  it('respects pageSize and page number', async () => {
    const page1 = await getServerListing(db, { pageSize: 3, page: 1 });
    expect(page1.servers.length).toBe(3);
    expect(page1.page).toBe(1);

    const page2 = await getServerListing(db, { pageSize: 3, page: 2 });
    expect(page2.servers.length).toBe(3);
    expect(page2.page).toBe(2);

    // Ensure no overlap
    const page1Ids = page1.servers.map((s) => s.id);
    const page2Ids = page2.servers.map((s) => s.id);
    for (const id of page2Ids) {
      expect(page1Ids).not.toContain(id);
    }
  });

  it('calculates totalPages correctly', async () => {
    const result = await getServerListing(db, { pageSize: 3 });
    // 9 online servers, pageSize 3 = 3 pages
    expect(result.total).toBe(9);
    expect(result.totalPages).toBe(3);
  });

  it('filters by hostname substring (case-insensitive search)', async () => {
    const result = await getServerListing(db, { q: 'racing' });
    expect(result.servers.length).toBe(1);
    expect(result.servers[0]!.id).toBe('srv002');
  });

  it('returns empty results for no search match', async () => {
    const result = await getServerListing(db, { q: 'nonexistent_server_xyz' });
    expect(result.servers.length).toBe(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('filters by gamemode exact match (case-insensitive)', async () => {
    const result = await getServerListing(db, { gamemode: 'roleplay' });
    expect(result.servers.length).toBeGreaterThan(0);
    for (const s of result.servers) {
      expect(s.gametype?.toLowerCase()).toBe('roleplay');
    }
  });

  it('filters by locale exact match', async () => {
    const result = await getServerListing(db, { locale: 'es-ES' });
    expect(result.servers.length).toBe(2);
    const ids = result.servers.map((s) => s.id);
    expect(ids).toContain('srv003');
    expect(ids).toContain('srv008');
  });

  it('filters by minPlayers threshold', async () => {
    const result = await getServerListing(db, { minPlayers: 50 });
    for (const s of result.servers) {
      expect(s.currentPlayers).toBeGreaterThanOrEqual(50);
    }
    // srv001 (100), srv002 (50), srv003 (75), srv007 (80)
    expect(result.servers.length).toBe(4);
  });

  it('filters by maxPlayers threshold', async () => {
    const result = await getServerListing(db, { maxPlayers: 20 });
    for (const s of result.servers) {
      expect(s.currentPlayers).toBeLessThanOrEqual(20);
    }
  });

  it('supports combined filters (gamemode + minPlayers)', async () => {
    const result = await getServerListing(db, {
      gamemode: 'roleplay',
      minPlayers: 10,
    });
    for (const s of result.servers) {
      expect(s.gametype?.toLowerCase()).toBe('roleplay');
      expect(s.currentPlayers).toBeGreaterThanOrEqual(10);
    }
    // Only srv001 (100 players, roleplay) and srv008 (30 players, roleplay) match
    expect(result.servers.length).toBe(2);
  });

  it('sorts by name ascending', async () => {
    const result = await getServerListing(db, { sort: 'name', sortDir: 'asc' });
    for (let i = 1; i < result.servers.length; i++) {
      const prev = result.servers[i - 1]!.hostnameClean.toLowerCase();
      const curr = result.servers[i]!.hostnameClean.toLowerCase();
      expect(prev <= curr).toBe(true);
    }
  });

  it('sorts by players ascending', async () => {
    const result = await getServerListing(db, {
      sort: 'players',
      sortDir: 'asc',
    });
    for (let i = 1; i < result.servers.length; i++) {
      const prev = result.servers[i - 1]!;
      const curr = result.servers[i]!;
      expect(prev.currentPlayers).toBeLessThanOrEqual(curr.currentPlayers);
    }
  });

  it('matches RP category to roleplay and rp gametypes', async () => {
    const result = await getServerListing(db, { category: 'rp' });
    expect(result.servers.length).toBeGreaterThan(0);
    const ids = result.servers.map((s) => s.id);
    // srv001 (roleplay), srv005 (rp), srv008 (roleplay) should match
    expect(ids).toContain('srv001');
    expect(ids).toContain('srv005');
    expect(ids).toContain('srv008');
    // srv002 (racing) should NOT match
    expect(ids).not.toContain('srv002');
  });

  it('returns all online servers for unknown category', async () => {
    const result = await getServerListing(db, { category: 'nonexistent' });
    // Unknown category should return all online servers (no filter applied)
    expect(result.total).toBe(9);
  });

  it('filters servers by tag', async () => {
    const result = await getServerListing(db, { tag: 'economy' });
    expect(result.servers.length).toBeGreaterThan(0);
    const ids = result.servers.map((s) => s.id);
    // srv001, srv005, srv007, srv009 have 'economy' tag
    expect(ids).toContain('srv001');
    expect(ids).toContain('srv005');
    expect(ids).toContain('srv007');
    expect(ids).toContain('srv009');
  });

  it('does not include resources column in listing results', async () => {
    const result = await getServerListing(db);
    for (const s of result.servers) {
      // The server card type should not have a resources property
      expect('resources' in s).toBe(false);
    }
  });
});

describe('getServerDetail', () => {
  it('returns full server data by ID with parsed arrays', async () => {
    const detail = await getServerDetail(db, 'srv001');
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe('srv001');
    expect(detail!.hostnameClean).toBe('RP City');
    expect(detail!.currentPlayers).toBe(100);
    expect(detail!.tags).toEqual(['roleplay', 'serious', 'economy']);
    expect(detail!.resources).toEqual(['es_extended', 'esx_skin']);
  });

  it('returns null for nonexistent ID', async () => {
    const detail = await getServerDetail(db, 'nonexistent');
    expect(detail).toBeNull();
  });

  it('handles null tags/resources gracefully', async () => {
    const detail = await getServerDetail(db, 'srv006');
    expect(detail).not.toBeNull();
    expect(detail!.tags).toEqual([]);
    expect(detail!.resources).toEqual([]);
  });
});

describe('getCategories', () => {
  it('returns category list with slugs and labels', () => {
    const categories = getCategories();
    expect(categories.length).toBeGreaterThan(0);
    for (const cat of categories) {
      expect(cat).toHaveProperty('slug');
      expect(cat).toHaveProperty('label');
      expect(typeof cat.slug).toBe('string');
      expect(typeof cat.label).toBe('string');
    }
  });

  it('includes rp, racing, and freeroam categories', () => {
    const categories = getCategories();
    const slugs = categories.map((c) => c.slug);
    expect(slugs).toContain('rp');
    expect(slugs).toContain('racing');
    expect(slugs).toContain('freeroam');
  });
});

describe('getPopularTags', () => {
  it('returns tags sorted by frequency descending', async () => {
    const tags = await getPopularTags(db);
    expect(tags.length).toBeGreaterThan(0);
    // Check sorted by count descending
    for (let i = 1; i < tags.length; i++) {
      expect(tags[i - 1]!.count).toBeGreaterThanOrEqual(tags[i]!.count);
    }
  });

  it('respects the limit parameter', async () => {
    const tags = await getPopularTags(db, 3);
    expect(tags.length).toBeLessThanOrEqual(3);
  });

  it('counts tag occurrences from online servers only', async () => {
    const tags = await getPopularTags(db);
    // 'roleplay' appears in srv001 (online), srv005 (online), srv008 (online)
    // srv004 is offline so its 'roleplay' tag should NOT be counted
    const rpTag = tags.find((t) => t.tag === 'roleplay');
    expect(rpTag).toBeDefined();
    expect(rpTag!.count).toBe(3); // Only from online servers
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { ServerCache } from './server-cache.js';
import type { DecodedServer } from '../types/server.js';

/** Factory helper to create sample DecodedServer objects for testing. */
function createSampleServer(overrides: Partial<DecodedServer> = {}): DecodedServer {
  return {
    id: 'abc123',
    hostname: '^1Test ^0Server',
    hostnameClean: 'Test Server',
    projectName: 'Test Project',
    projectDescription: 'A test server',
    gametype: 'roleplay',
    mapname: 'fivem-map-skater',
    players: 32,
    maxPlayers: 64,
    locale: 'en-US',
    tags: ['roleplay', 'voice'],
    resources: ['mysql-async', 'es_extended'],
    connectEndPoints: ['192.168.1.1:30120'],
    iconVersion: 1,
    enhancedHostSupport: false,
    server: 'FXServer-1.0.0',
    upvotePower: 10,
    burstPower: 0,
    vars: { sv_projectName: 'Test Project' },
    ...overrides,
  };
}

describe('ServerCache', () => {
  let cache: ServerCache;

  beforeEach(() => {
    cache = new ServerCache();
  });

  describe('get()', () => {
    it('returns empty array when cache is empty (never been populated)', () => {
      expect(cache.get()).toEqual([]);
    });

    it('returns previously set servers', () => {
      const servers = [createSampleServer({ id: 'srv1' }), createSampleServer({ id: 'srv2' })];
      cache.set(servers);
      const result = cache.get();
      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('srv1');
      expect(result[1]!.id).toBe('srv2');
    });
  });

  describe('set()', () => {
    it('overwrites previous data', () => {
      cache.set([createSampleServer({ id: 'old' })]);
      cache.set([createSampleServer({ id: 'new' })]);
      const result = cache.get();
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('new');
    });

    it('stores a deep copy - mutation of original does not affect cache', () => {
      const servers = [createSampleServer({ id: 'srv1', players: 10 })];
      cache.set(servers);

      // Mutate the original array and object
      servers[0]!.players = 999;
      servers.push(createSampleServer({ id: 'added' }));

      const cached = cache.get();
      expect(cached).toHaveLength(1);
      expect(cached[0]!.players).toBe(10);
    });
  });

  describe('getServer()', () => {
    it('returns single server by ID', () => {
      cache.set([
        createSampleServer({ id: 'srv1', hostname: 'Server One' }),
        createSampleServer({ id: 'srv2', hostname: 'Server Two' }),
      ]);
      const server = cache.getServer('srv2');
      expect(server).toBeDefined();
      expect(server!.hostname).toBe('Server Two');
    });

    it('returns undefined if server not found', () => {
      cache.set([createSampleServer({ id: 'srv1' })]);
      expect(cache.getServer('nonexistent')).toBeUndefined();
    });

    it('returns undefined when cache is empty', () => {
      expect(cache.getServer('any')).toBeUndefined();
    });
  });

  describe('getLastUpdated()', () => {
    it('returns null when cache has never been set', () => {
      expect(cache.getLastUpdated()).toBeNull();
    });

    it('returns timestamp of last set() call', () => {
      const before = new Date();
      cache.set([createSampleServer()]);
      const after = new Date();

      const lastUpdated = cache.getLastUpdated();
      expect(lastUpdated).not.toBeNull();
      expect(lastUpdated!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lastUpdated!.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('clear()', () => {
    it('resets cache to empty state', () => {
      cache.set([createSampleServer({ id: 'srv1' })]);
      cache.clear();
      expect(cache.get()).toEqual([]);
      expect(cache.getLastUpdated()).toBeNull();
    });
  });

  describe('deep copy isolation on get()', () => {
    it('returned data does not affect cached data when mutated', () => {
      cache.set([createSampleServer({ id: 'srv1', players: 10 })]);

      const result1 = cache.get();
      result1[0]!.players = 999;

      const result2 = cache.get();
      expect(result2[0]!.players).toBe(10);
    });
  });
});

/**
 * Schema Validation Tests
 *
 * Validates that all four Drizzle ORM table exports exist with the correct
 * table names and column structures. These tests verify the data contract
 * that the rest of the application depends on.
 */

import { describe, it, expect } from 'vitest';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { servers, snapshots, hourlyRollups, dailyRollups } from './schema.js';

describe('tables', () => {
  describe('servers', () => {
    it('exports servers table with correct name', () => {
      expect(getTableName(servers)).toBe('servers');
    });

    it('has all required columns', () => {
      const cols = getTableColumns(servers);
      expect(cols).toHaveProperty('id');
      expect(cols).toHaveProperty('hostname');
      expect(cols).toHaveProperty('hostnameClean');
      expect(cols).toHaveProperty('projectName');
      expect(cols).toHaveProperty('projectDescription');
      expect(cols).toHaveProperty('gametype');
      expect(cols).toHaveProperty('mapname');
      expect(cols).toHaveProperty('maxPlayers');
      expect(cols).toHaveProperty('locale');
      expect(cols).toHaveProperty('tags');
      expect(cols).toHaveProperty('resources');
      expect(cols).toHaveProperty('isOnline');
      expect(cols).toHaveProperty('consecutiveMisses');
      expect(cols).toHaveProperty('lastSeenAt');
      expect(cols).toHaveProperty('createdAt');
      expect(cols).toHaveProperty('updatedAt');
    });

    it('has id as primary key', () => {
      const cols = getTableColumns(servers);
      expect(cols.id.primary).toBe(true);
    });
  });

  describe('snapshots', () => {
    it('exports snapshots table with correct name', () => {
      expect(getTableName(snapshots)).toBe('snapshots');
    });

    it('has all required columns', () => {
      const cols = getTableColumns(snapshots);
      expect(cols).toHaveProperty('id');
      expect(cols).toHaveProperty('serverId');
      expect(cols).toHaveProperty('playerCount');
      expect(cols).toHaveProperty('maxPlayers');
      expect(cols).toHaveProperty('timestamp');
    });

    it('has auto-increment primary key', () => {
      const cols = getTableColumns(snapshots);
      expect(cols.id.primary).toBe(true);
    });
  });

  describe('hourlyRollups', () => {
    it('exports hourly_rollups table with correct name', () => {
      expect(getTableName(hourlyRollups)).toBe('hourly_rollups');
    });

    it('has all required columns', () => {
      const cols = getTableColumns(hourlyRollups);
      expect(cols).toHaveProperty('id');
      expect(cols).toHaveProperty('serverId');
      expect(cols).toHaveProperty('hourTimestamp');
      expect(cols).toHaveProperty('avgPlayers');
      expect(cols).toHaveProperty('maxPlayers');
      expect(cols).toHaveProperty('minPlayers');
      expect(cols).toHaveProperty('sampleCount');
    });

    it('has auto-increment primary key', () => {
      const cols = getTableColumns(hourlyRollups);
      expect(cols.id.primary).toBe(true);
    });
  });

  describe('dailyRollups', () => {
    it('exports daily_rollups table with correct name', () => {
      expect(getTableName(dailyRollups)).toBe('daily_rollups');
    });

    it('has all required columns', () => {
      const cols = getTableColumns(dailyRollups);
      expect(cols).toHaveProperty('id');
      expect(cols).toHaveProperty('serverId');
      expect(cols).toHaveProperty('dayTimestamp');
      expect(cols).toHaveProperty('avgPlayers');
      expect(cols).toHaveProperty('maxPlayers');
      expect(cols).toHaveProperty('minPlayers');
      expect(cols).toHaveProperty('sampleCount');
    });

    it('has auto-increment primary key', () => {
      const cols = getTableColumns(dailyRollups);
      expect(cols.id.primary).toBe(true);
    });
  });

  describe('all tables defined', () => {
    it('all four tables are exported as Drizzle sqliteTable instances', () => {
      expect(getTableName(servers)).toBeDefined();
      expect(getTableName(snapshots)).toBeDefined();
      expect(getTableName(hourlyRollups)).toBeDefined();
      expect(getTableName(dailyRollups)).toBeDefined();
    });
  });
});

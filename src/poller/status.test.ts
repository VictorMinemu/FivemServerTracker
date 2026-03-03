import { describe, it, expect, beforeEach } from 'vitest';
import { updateServerStatus, createInitialStatus, OFFLINE_THRESHOLD } from './status.js';
import type { ServerStatus } from '../types/server.js';

describe('OFFLINE_THRESHOLD', () => {
  it('is set to 3', () => {
    expect(OFFLINE_THRESHOLD).toBe(3);
  });
});

describe('createInitialStatus', () => {
  it('creates a new server status as online with 0 misses', () => {
    const before = new Date();
    const status = createInitialStatus();
    const after = new Date();

    expect(status.isOnline).toBe(true);
    expect(status.consecutiveMisses).toBe(0);
    expect(status.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(status.lastSeenAt.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(status.lastCheckedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(status.lastCheckedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('updateServerStatus', () => {
  let baseStatus: ServerStatus;

  beforeEach(() => {
    baseStatus = {
      isOnline: true,
      consecutiveMisses: 0,
      lastSeenAt: new Date('2025-01-01T00:00:00Z'),
      lastCheckedAt: new Date('2025-01-01T00:00:00Z'),
    };
  });

  describe('server present in poll', () => {
    it('resets consecutiveMisses to 0', () => {
      baseStatus.consecutiveMisses = 2;
      const result = updateServerStatus(baseStatus, true);
      expect(result.consecutiveMisses).toBe(0);
    });

    it('sets isOnline to true', () => {
      baseStatus.isOnline = false;
      const result = updateServerStatus(baseStatus, true);
      expect(result.isOnline).toBe(true);
    });

    it('updates lastSeenAt to current time', () => {
      const before = new Date();
      const result = updateServerStatus(baseStatus, true);
      const after = new Date();

      expect(result.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.lastSeenAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('updates lastCheckedAt to current time', () => {
      const before = new Date();
      const result = updateServerStatus(baseStatus, true);
      const after = new Date();

      expect(result.lastCheckedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.lastCheckedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('server missing from poll - hysteresis', () => {
    it('increments consecutiveMisses on 1st miss', () => {
      const result = updateServerStatus(baseStatus, false);
      expect(result.consecutiveMisses).toBe(1);
    });

    it('keeps isOnline true after 1 miss', () => {
      const result = updateServerStatus(baseStatus, false);
      expect(result.isOnline).toBe(true);
    });

    it('keeps isOnline true after 2 misses', () => {
      baseStatus.consecutiveMisses = 1;
      const result = updateServerStatus(baseStatus, false);
      expect(result.consecutiveMisses).toBe(2);
      expect(result.isOnline).toBe(true);
    });

    it('flips isOnline to false after 3 consecutive misses', () => {
      baseStatus.consecutiveMisses = 2;
      const result = updateServerStatus(baseStatus, false);
      expect(result.consecutiveMisses).toBe(3);
      expect(result.isOnline).toBe(false);
    });

    it('stays offline after more than 3 misses', () => {
      baseStatus.consecutiveMisses = 5;
      baseStatus.isOnline = false;
      const result = updateServerStatus(baseStatus, false);
      expect(result.consecutiveMisses).toBe(6);
      expect(result.isOnline).toBe(false);
    });

    it('does not update lastSeenAt when missing', () => {
      const originalLastSeen = baseStatus.lastSeenAt;
      const result = updateServerStatus(baseStatus, false);
      expect(result.lastSeenAt).toEqual(originalLastSeen);
    });

    it('updates lastCheckedAt even when missing', () => {
      const before = new Date();
      const result = updateServerStatus(baseStatus, false);
      const after = new Date();

      expect(result.lastCheckedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.lastCheckedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('recovery from missed polls', () => {
    it('resets counter when server reappears after 2 misses', () => {
      baseStatus.consecutiveMisses = 2;
      const result = updateServerStatus(baseStatus, true);
      expect(result.consecutiveMisses).toBe(0);
      expect(result.isOnline).toBe(true);
    });

    it('recovers to online from offline when server reappears', () => {
      baseStatus.consecutiveMisses = 5;
      baseStatus.isOnline = false;
      const result = updateServerStatus(baseStatus, true);
      expect(result.consecutiveMisses).toBe(0);
      expect(result.isOnline).toBe(true);
    });
  });

  describe('immutability', () => {
    it('returns a new object, does not mutate input', () => {
      const original = { ...baseStatus };
      const result = updateServerStatus(baseStatus, false);

      expect(result).not.toBe(baseStatus);
      expect(baseStatus.consecutiveMisses).toBe(original.consecutiveMisses);
      expect(baseStatus.isOnline).toBe(original.isOnline);
    });
  });
});

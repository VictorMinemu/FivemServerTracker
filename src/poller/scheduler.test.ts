/**
 * Scheduler Tests
 *
 * Validates that the polling scheduler calls the poll function immediately
 * on startup and registers a cron job with the correct schedule expression.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startScheduler } from './scheduler.js';

// Mock node-cron
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
  },
}));

import cron from 'node-cron';

describe('startScheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env var
    delete process.env['POLL_INTERVAL_CRON'];
  });

  afterEach(() => {
    delete process.env['POLL_INTERVAL_CRON'];
  });

  it('calls pollFn immediately on startup', async () => {
    const pollFn = vi.fn().mockResolvedValue(undefined);

    startScheduler(pollFn);

    // pollFn should be called once immediately
    expect(pollFn).toHaveBeenCalledTimes(1);
  });

  it('registers cron.schedule with default 15-minute expression', () => {
    const pollFn = vi.fn().mockResolvedValue(undefined);

    startScheduler(pollFn);

    expect(cron.schedule).toHaveBeenCalledTimes(1);
    expect(cron.schedule).toHaveBeenCalledWith(
      '*/15 * * * *',
      expect.any(Function),
    );
  });

  it('uses POLL_INTERVAL_CRON env var when set', () => {
    process.env['POLL_INTERVAL_CRON'] = '*/5 * * * *';
    const pollFn = vi.fn().mockResolvedValue(undefined);

    startScheduler(pollFn);

    expect(cron.schedule).toHaveBeenCalledWith(
      '*/5 * * * *',
      expect.any(Function),
    );
  });

  it('catches pollFn errors without throwing', async () => {
    const pollFn = vi.fn().mockRejectedValue(new Error('Network failure'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    startScheduler(pollFn);

    // Wait for the rejected promise to be caught
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

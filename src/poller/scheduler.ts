/**
 * Cron Scheduling for the Polling Pipeline
 *
 * Manages the recurring execution of the FiveM server poll cycle using
 * node-cron. The scheduler runs the poll function:
 *
 * 1. **Immediately on startup** - Ensures data is available from the moment
 *    the application boots, without waiting for the first cron tick.
 * 2. **Every 15 minutes** (default) - Configurable via the `POLL_INTERVAL_CRON`
 *    environment variable using standard crontab syntax.
 *
 * The poll function's errors are always caught to prevent a failed poll from
 * stopping the cron schedule. Each invocation is fire-and-forget: the scheduler
 * does not wait for one poll to complete before scheduling the next.
 *
 * @module
 */

import cron from 'node-cron';

/**
 * Starts the recurring poll scheduler.
 *
 * Calls `pollFn` immediately (fire-and-forget) to populate data on startup,
 * then schedules it to run at the interval defined by `POLL_INTERVAL_CRON`
 * (defaults to every 15 minutes: `*\/15 * * * *`).
 *
 * Errors from `pollFn` are caught and logged via `console.error` to prevent
 * the cron schedule from stopping. This is intentional: a single failed poll
 * (network timeout, endpoint error) should not disable future polls.
 *
 * @param pollFn - Async function that executes one complete poll cycle.
 *                 Should handle its own error logging internally.
 *
 * @example
 * ```ts
 * startScheduler(async () => {
 *   const result = await executePollCycle(db, cache);
 *   console.log(`Poll: ${result.serversFound} servers`);
 * });
 * ```
 */
export function startScheduler(pollFn: () => Promise<void>): void {
  // Run immediately on startup (fire-and-forget)
  pollFn().catch(console.error);

  // Schedule recurring polls
  const cronExpression =
    process.env['POLL_INTERVAL_CRON'] ?? '*/15 * * * *';
  cron.schedule(cronExpression, () => {
    pollFn().catch(console.error);
  });
}

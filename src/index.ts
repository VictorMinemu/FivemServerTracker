/**
 * FiveM Server Tracker - Application Entry Point
 *
 * Bootstraps the complete FiveM server tracking pipeline:
 *
 * 1. Loads environment variables from `.env` via dotenv
 * 2. Initializes the SQLite database connection (creates file + tables if needed)
 * 3. Creates an in-memory server cache for failure resilience
 * 4. Starts the cron scheduler, which immediately executes the first poll
 *    and then repeats every 15 minutes (configurable via `POLL_INTERVAL_CRON`)
 *
 * **Running the application:**
 * - Development: `npm run dev` (uses tsx for direct TS execution)
 * - Production: `npm run build && node dist/index.js`
 *
 * **Environment variables:**
 * - `DB_FILE_NAME` - SQLite database path (default: `data/fivem-tracker.db`)
 * - `POLL_INTERVAL_CRON` - Cron expression for poll frequency (default: `*\/15 * * * *`)
 * - `FIVEM_STREAM_URL` - Override the FiveM stream endpoint URL
 *
 * @module
 */

import 'dotenv/config';
import { db } from './db/index.js';
import { ServerCache } from './cache/server-cache.js';
import { executePollCycle } from './poller/poller.js';
import { startScheduler } from './poller/scheduler.js';

const cache = new ServerCache();

console.log('[FiveM Tracker] Starting...');
console.log(
  `[FiveM Tracker] Database: ${process.env['DB_FILE_NAME'] ?? 'data/fivem-tracker.db'}`,
);
console.log(
  `[FiveM Tracker] Poll interval: ${process.env['POLL_INTERVAL_CRON'] ?? '*/15 * * * *'}`,
);

startScheduler(async () => {
  const result = await executePollCycle(db, cache);
  console.log(
    `[FiveM Tracker] Poll complete: ${result.serversFound} found, ${result.serversUpserted} upserted, ${result.snapshotsCreated} snapshots in ${result.durationMs}ms`,
  );
  if (result.errors.length > 0) {
    console.warn(
      `[FiveM Tracker] Poll errors: ${result.errors.join(', ')}`,
    );
  }
});

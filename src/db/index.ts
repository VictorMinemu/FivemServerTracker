/**
 * Database Connection Factory
 *
 * Provides a configured Drizzle ORM instance connected to a SQLite database
 * via better-sqlite3. The connection is optimized for the polling workload
 * with WAL mode, busy timeout, and foreign key enforcement.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';

/**
 * Creates and configures a SQLite database connection with Drizzle ORM.
 *
 * Applies three critical PRAGMAs for the polling workload:
 *
 * - **WAL mode** (`journal_mode = WAL`): Enables concurrent read/write access.
 *   Readers do not block writers and vice versa, which is essential when the
 *   polling scheduler is writing thousands of snapshots while the web frontend
 *   reads server data simultaneously.
 *
 * - **Busy timeout** (`busy_timeout = 5000`): Waits up to 5 seconds for a lock
 *   instead of immediately returning SQLITE_BUSY. This handles brief write
 *   contention during large batch upserts without failing the transaction.
 *
 * - **Foreign keys** (`foreign_keys = ON`): Enforces referential integrity
 *   between snapshots/rollups and the servers table. SQLite disables foreign
 *   keys by default for backwards compatibility; we enable them explicitly.
 *
 * @param dbPath - File path to the SQLite database file. Parent directories
 *                 are created automatically if they do not exist.
 * @returns Configured Drizzle ORM instance with full schema type inference
 */
export function createDatabase(dbPath: string) {
  // Ensure the directory for the database file exists
  mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('foreign_keys = ON');

  return drizzle(sqlite, { schema });
}

/** Type alias for the Drizzle database instance returned by createDatabase */
export type DrizzleDB = ReturnType<typeof createDatabase>;

/** Default database path, configurable via DB_FILE_NAME environment variable */
const defaultDbPath = process.env['DB_FILE_NAME'] ?? 'data/fivem-tracker.db';

/**
 * Default database instance for use throughout the application.
 *
 * Uses the DB_FILE_NAME environment variable if set, otherwise falls back
 * to `data/fivem-tracker.db` in the project root. The `data/` directory
 * is created automatically on first use.
 */
export const db = createDatabase(defaultDbPath);

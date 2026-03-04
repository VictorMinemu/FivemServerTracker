/**
 * Database Re-export for Web Layer
 *
 * Provides access to the shared Drizzle database instance and schema
 * tables from the web frontend. This thin re-export ensures the web
 * layer uses the same database connection as the polling pipeline.
 *
 * @module
 */

export { db } from '../../../src/db/index.js';
export { servers, snapshots } from '../../../src/db/schema.js';

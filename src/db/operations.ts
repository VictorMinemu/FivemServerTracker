/**
 * Database CRUD Operations for the Polling Pipeline
 *
 * Provides all database write and query operations needed by the polling
 * orchestrator. Every function wraps its work in a SQLite transaction for
 * atomicity and performance -- a single poll can touch thousands of servers,
 * so batching all writes into one transaction reduces disk syncs from O(N)
 * to O(1), yielding 10-100x speedup (see research Pitfall 3).
 *
 * **Note:** better-sqlite3 is synchronous, so Drizzle's `db.transaction()`
 * callback must be synchronous (no `async`/`await`). All operations within
 * a transaction use the synchronous Drizzle API accordingly.
 *
 * Exports:
 * - {@link batchUpsertServers} - Insert or update all servers from a poll
 * - {@link createSnapshots} - Record player counts at poll time
 * - {@link getExistingServerStatuses} - Fetch current online/offline state
 * - {@link markMissingServersOffline} - Apply hysteresis to absent servers
 * - {@link deleteExpiredData} - Enforce tiered retention policy
 *
 * @module
 */

import { eq, lt, inArray } from 'drizzle-orm';
import { servers, snapshots, hourlyRollups } from './schema.js';
import type { DrizzleDB } from './index.js';
import type { ServerUpsert } from '../types/server.js';
import { OFFLINE_THRESHOLD } from '../poller/status.js';

/**
 * Upserts all servers from a single poll cycle within one transaction.
 *
 * Uses SQLite's INSERT ... ON CONFLICT DO UPDATE to atomically create new
 * server records or update existing ones. Wrapping all upserts in a single
 * transaction is critical for performance: thousands of individual INSERTs
 * each trigger a disk sync, while a single transaction batches them into
 * one sync -- 10-100x faster for the typical 5,000-15,000 server poll.
 *
 * @param db - Drizzle database instance
 * @param serverData - Array of server records to upsert (from current poll)
 * @returns Number of servers upserted (inserted or updated)
 */
export function batchUpsertServers(
  db: DrizzleDB,
  serverData: ServerUpsert[],
): number {
  if (serverData.length === 0) return 0;

  db.transaction((tx) => {
    for (const server of serverData) {
      tx.insert(servers)
        .values(server)
        .onConflictDoUpdate({
          target: servers.id,
          set: {
            hostname: server.hostname,
            hostnameClean: server.hostnameClean,
            projectName: server.projectName,
            projectDescription: server.projectDescription,
            gametype: server.gametype,
            mapname: server.mapname,
            maxPlayers: server.maxPlayers,
            locale: server.locale,
            tags: server.tags,
            resources: server.resources,
            isOnline: server.isOnline,
            consecutiveMisses: server.consecutiveMisses,
            lastSeenAt: server.lastSeenAt,
            updatedAt: new Date(),
          },
        })
        .run();
    }
  });

  return serverData.length;
}

/**
 * Creates one snapshot row per server, recording player counts at poll time.
 *
 * Each snapshot captures a point-in-time measurement of a server's population.
 * These are the highest-resolution data points (one per server per 15-minute
 * poll) and form the basis for hourly and daily rollup aggregation. Raw
 * snapshots are retained for 7 days before being purged by
 * {@link deleteExpiredData}.
 *
 * All inserts run in a single transaction for the same performance reasons
 * as {@link batchUpsertServers}.
 *
 * @param db - Drizzle database instance
 * @param snapshotData - Array of server ID + player count pairs from the poll
 * @returns Number of snapshot rows created
 */
export function createSnapshots(
  db: DrizzleDB,
  snapshotData: { serverId: string; playerCount: number; maxPlayers: number }[],
): number {
  if (snapshotData.length === 0) return 0;

  const now = new Date();

  db.transaction((tx) => {
    for (const snap of snapshotData) {
      tx.insert(snapshots)
        .values({
          serverId: snap.serverId,
          playerCount: snap.playerCount,
          maxPlayers: snap.maxPlayers,
          timestamp: now,
        })
        .run();
    }
  });

  return snapshotData.length;
}

/**
 * Fetches the current online/offline status for a set of server IDs.
 *
 * The poller uses this before upserting to apply hysteresis: when a server
 * reappears in a poll, its `consecutiveMisses` resets to 0 and `isOnline`
 * becomes true. When a server is absent, `consecutiveMisses` increments.
 * The poller needs the existing status to compute the new state via
 * `updateServerStatus()`.
 *
 * Queries are batched in chunks of 500 to stay within SQLite's variable limit,
 * while minimizing round trips.
 *
 * @param db - Drizzle database instance
 * @param serverIds - Array of FiveM endpoint IDs to look up
 * @returns Map of server ID to current status fields (empty for unknown servers)
 */
export function getExistingServerStatuses(
  db: DrizzleDB,
  serverIds: string[],
): Map<
  string,
  { isOnline: boolean; consecutiveMisses: number; lastSeenAt: Date }
> {
  const result = new Map<
    string,
    { isOnline: boolean; consecutiveMisses: number; lastSeenAt: Date }
  >();

  if (serverIds.length === 0) return result;

  // Batch in chunks of 500 to avoid SQLite variable limit
  const CHUNK_SIZE = 500;
  for (let i = 0; i < serverIds.length; i += CHUNK_SIZE) {
    const chunk = serverIds.slice(i, i + CHUNK_SIZE);
    const rows = db
      .select({
        id: servers.id,
        isOnline: servers.isOnline,
        consecutiveMisses: servers.consecutiveMisses,
        lastSeenAt: servers.lastSeenAt,
      })
      .from(servers)
      .where(inArray(servers.id, chunk))
      .all();

    for (const row of rows) {
      result.set(row.id, {
        isOnline: row.isOnline,
        consecutiveMisses: row.consecutiveMisses,
        lastSeenAt: row.lastSeenAt,
      });
    }
  }

  return result;
}

/**
 * Marks servers as offline when they have been absent for too many polls.
 *
 * After upserting the servers that appeared in the current poll, this function
 * handles the ones that did NOT appear. It queries all servers currently marked
 * online that are not in the `presentIds` set, increments their
 * `consecutiveMisses`, and flips `isOnline` to false once the miss count
 * reaches the {@link OFFLINE_THRESHOLD} (default 3 = 45 minutes).
 *
 * This runs AFTER upserts so that servers found in the current poll have
 * already had their `consecutiveMisses` reset to 0 and `isOnline` set to true.
 *
 * @param db - Drizzle database instance
 * @param presentIds - Set of server IDs that appeared in the current poll
 * @returns Number of servers newly marked as offline (not just missed)
 */
export function markMissingServersOffline(
  db: DrizzleDB,
  presentIds: Set<string>,
): number {
  // Get all servers currently considered online
  const onlineServers = db
    .select({
      id: servers.id,
      consecutiveMisses: servers.consecutiveMisses,
    })
    .from(servers)
    .where(eq(servers.isOnline, true))
    .all();

  // Filter to those NOT present in the current poll
  const missingServers = onlineServers.filter((s) => !presentIds.has(s.id));

  if (missingServers.length === 0) return 0;

  let newlyOfflineCount = 0;

  db.transaction((tx) => {
    for (const server of missingServers) {
      const newMisses = server.consecutiveMisses + 1;
      const shouldGoOffline = newMisses >= OFFLINE_THRESHOLD;

      if (shouldGoOffline) {
        newlyOfflineCount++;
      }

      tx.update(servers)
        .set({
          consecutiveMisses: newMisses,
          isOnline: shouldGoOffline ? false : true,
          updatedAt: new Date(),
        })
        .where(eq(servers.id, server.id))
        .run();
    }
  });

  return newlyOfflineCount;
}

/**
 * Enforces the tiered data retention policy by deleting expired records.
 *
 * The retention tiers are:
 * - **Raw snapshots**: Retained 7 days, then deleted. These are the highest-
 *   resolution data points (one per server per poll) and grow fastest.
 * - **Hourly rollups**: Retained 90 days, then deleted. Aggregated from
 *   raw snapshots, these provide sufficient resolution for week/month graphs.
 * - **Daily rollups**: Retained indefinitely. These are never deleted by
 *   this function, providing long-term historical trend data.
 *
 * Both deletes run in a single transaction so the cleanup is atomic.
 * This function should be called at the end of each poll cycle to keep
 * database size bounded.
 *
 * @param db - Drizzle database instance
 * @returns Counts of deleted rows for logging/monitoring
 */
export function deleteExpiredData(
  db: DrizzleDB,
): { snapshotsDeleted: number; rollupsDeleted: number } {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  let snapshotsDeleted = 0;
  let rollupsDeleted = 0;

  db.transaction((tx) => {
    const snapResult = tx
      .delete(snapshots)
      .where(lt(snapshots.timestamp, sevenDaysAgo))
      .run();
    snapshotsDeleted = snapResult.changes;

    const rollupResult = tx
      .delete(hourlyRollups)
      .where(lt(hourlyRollups.hourTimestamp, ninetyDaysAgo))
      .run();
    rollupsDeleted = rollupResult.changes;
  });

  return { snapshotsDeleted, rollupsDeleted };
}

/**
 * Poll Cycle Orchestrator
 *
 * Coordinates the complete FiveM server data pipeline from network fetch
 * through database storage. Each poll cycle:
 *
 * 1. **Fetch** - Opens the binary stream from the FiveM master list endpoint
 * 2. **Decode** - Reads length-prefixed protobuf frames, decodes each into
 *    a typed Server object, and filters to GTA5 (FiveM) servers only
 * 3. **Sanitize** - Strips GTA color codes, tilde formatting, and zero-width
 *    Unicode from server hostnames for search and display
 * 4. **Status** - Applies hysteresis-based online/offline detection using
 *    existing server state from the database
 * 5. **Store** - Upserts server records and creates snapshot rows in a
 *    single SQLite transaction for each operation
 * 6. **Aggregate** - Rolls up completed-hour snapshots into hourly rollups
 *    and completed-day hourly rollups into daily rollups
 * 7. **Retain** - Deletes expired snapshots (>7 days) and hourly rollups
 *    (>90 days) to keep database size bounded
 * 8. **Cache** - Updates the in-memory cache with the latest server data
 *    so it's available as fallback if the next poll fails
 *
 * **Error recovery (DATA-06):** The entire cycle is wrapped in try/catch.
 * On failure, the cache provides last-good data from the previous successful
 * poll. The function never throws -- errors are logged and returned in the
 * PollResult so the scheduler continues running.
 *
 * @module
 */

import { fetchServerStream, readFrames } from './fetcher.js';
import { decodeServerFrame, transformServer, isGta5Server } from './decoder.js';
import { sanitizeServerName } from './sanitizer.js';
import { updateServerStatus, createInitialStatus } from './status.js';
import {
  batchUpsertServers,
  createSnapshots,
  getExistingServerStatuses,
  markMissingServersOffline,
  deleteExpiredData,
} from '../db/operations.js';
import { aggregateHourlyRollups, aggregateDailyRollups } from '../db/aggregation.js';
import type { DrizzleDB } from '../db/index.js';
import type { ServerCache } from '../cache/server-cache.js';
import type { DecodedServer, PollResult, ServerUpsert } from '../types/server.js';

/** Default FiveM server list stream endpoint URL */
const STREAM_URL =
  process.env['FIVEM_STREAM_URL'] ??
  'https://frontend.cfx-services.net/api/servers/streamRedir/';

/**
 * Executes a complete poll cycle: fetch, decode, sanitize, store, and cache.
 *
 * This is the main entry point for each scheduled poll. It orchestrates
 * the entire data pipeline from HTTP fetch through database writes and
 * cache update. On success, the cache is refreshed with the latest data.
 * On failure, the cache retains its previous data (last-good fallback)
 * and the error is logged but NOT re-thrown, so the cron scheduler
 * continues operating.
 *
 * @param db - Drizzle database instance for server and snapshot writes
 * @param cache - In-memory server cache for fallback on failure
 * @returns Poll results with server counts, snapshot count, errors, and timing
 *
 * @example
 * ```ts
 * const result = await executePollCycle(db, cache);
 * console.log(`Found ${result.serversFound} servers in ${result.durationMs}ms`);
 * if (result.errors.length > 0) {
 *   console.warn('Poll had errors:', result.errors);
 * }
 * ```
 */
export async function executePollCycle(
  db: DrizzleDB,
  cache: ServerCache,
): Promise<PollResult> {
  const startTime = Date.now();

  try {
    // 1. Fetch the binary stream
    const stream = await fetchServerStream(STREAM_URL);

    // 2. Decode frames and collect GTA5 servers
    const decodedServers: DecodedServer[] = [];

    await readFrames(stream, (frame) => {
      const raw = decodeServerFrame(frame);
      if (!raw || !raw.EndPoint || !raw.Data) return;
      if (!isGta5Server(raw)) return;

      const server = transformServer(raw);
      // 3. Sanitize the server name
      server.hostnameClean = sanitizeServerName(server.hostname);
      decodedServers.push(server);
    });

    // 4. Get existing statuses for hysteresis
    const serverIds = decodedServers.map((s) => s.id);
    const existingStatuses = getExistingServerStatuses(db, serverIds);

    // 5. Build upsert data with status
    const now = new Date();
    const upserts: ServerUpsert[] = decodedServers.map((server) => {
      const existing = existingStatuses.get(server.id);
      const status = existing
        ? updateServerStatus(
            {
              isOnline: existing.isOnline,
              consecutiveMisses: existing.consecutiveMisses,
              lastSeenAt: existing.lastSeenAt,
              lastCheckedAt: now,
            },
            true, // Server is present in this poll
          )
        : createInitialStatus();

      return {
        id: server.id,
        hostname: server.hostname,
        hostnameClean: server.hostnameClean,
        projectName: server.projectName,
        projectDescription: server.projectDescription,
        gametype: server.gametype,
        mapname: server.mapname,
        maxPlayers: server.maxPlayers,
        currentPlayers: server.players,
        iconVersion: server.iconVersion,
        locale: server.locale,
        tags: JSON.stringify(server.tags),
        resources: JSON.stringify(server.resources),
        isOnline: status.isOnline,
        consecutiveMisses: status.consecutiveMisses,
        lastSeenAt: status.lastSeenAt,
        createdAt: now,
        updatedAt: now,
      };
    });

    // 6. Database writes
    const serversUpserted = batchUpsertServers(db, upserts);

    const snapshotData = decodedServers.map((s) => ({
      serverId: s.id,
      playerCount: s.players,
      maxPlayers: s.maxPlayers,
    }));
    const snapshotsCreated = createSnapshots(db, snapshotData);

    // 6b. Aggregate completed time windows into rollups
    const hourlyInserted = aggregateHourlyRollups(db);
    const dailyInserted = aggregateDailyRollups(db);
    if (hourlyInserted > 0 || dailyInserted > 0) {
      console.log(
        `[FiveM Tracker] Aggregation: ${hourlyInserted} hourly, ${dailyInserted} daily rollups`,
      );
    }

    // 7. Mark missing servers (hysteresis)
    const presentIds = new Set(serverIds);
    const newlyOffline = markMissingServersOffline(db, presentIds);
    if (newlyOffline > 0) {
      console.log(
        `[FiveM Tracker] ${newlyOffline} servers marked offline (exceeded miss threshold)`,
      );
    }

    // 8. Retention enforcement
    const retention = deleteExpiredData(db);
    if (retention.snapshotsDeleted > 0 || retention.rollupsDeleted > 0) {
      console.log(
        `[FiveM Tracker] Retention: deleted ${retention.snapshotsDeleted} snapshots, ${retention.rollupsDeleted} rollups`,
      );
    }

    // 9. Update cache with latest data
    cache.set(decodedServers);

    const durationMs = Date.now() - startTime;
    return {
      serversFound: decodedServers.length,
      serversUpserted,
      snapshotsCreated,
      errors: [],
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error(`[FiveM Tracker] Poll failed: ${errorMessage}`);

    // Fallback to cached data (DATA-06)
    const cachedServers = cache.get();
    console.warn(
      `[FiveM Tracker] Using cached data: ${cachedServers.length} servers from last successful poll`,
    );

    return {
      serversFound: cachedServers.length,
      serversUpserted: 0,
      snapshotsCreated: 0,
      errors: [errorMessage],
      durationMs,
    };
  }
}

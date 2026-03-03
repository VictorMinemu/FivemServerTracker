/**
 * In-Memory Server Cache
 *
 * Provides a last-good-data cache for the FiveM server list. When a poll
 * fetch fails (network error, timeout, upstream outage), the cache serves
 * the most recent successfully fetched data, ensuring the application
 * always has server data available for API responses.
 *
 * **Deep-copy isolation:** All data stored and retrieved is deep-copied
 * via `structuredClone()` to prevent external mutations from corrupting
 * the cached state. This makes the cache safe to use across async
 * boundaries without defensive copying at call sites.
 *
 * @module
 */

import type { DecodedServer } from '../types/server.js';

/**
 * In-memory cache for decoded server data.
 *
 * Stores the last successfully fetched server list and serves it
 * when live fetches fail. Uses `structuredClone()` for deep-copy
 * isolation between cached and returned data.
 *
 * @example
 * ```ts
 * const cache = new ServerCache();
 *
 * // Store data after successful poll
 * cache.set(decodedServers);
 *
 * // Retrieve cached data when poll fails
 * const servers = cache.get(); // deep copy of last-good data
 *
 * // Look up a specific server
 * const server = cache.getServer("bkr4qr");
 * ```
 */
export class ServerCache {
  /** Internal storage for cached server data */
  private servers: DecodedServer[] = [];

  /** Timestamp of the last successful set() call */
  private lastUpdated: Date | null = null;

  /**
   * Stores a server list in the cache, replacing any previous data.
   *
   * The input array is deep-copied via `structuredClone()`, so subsequent
   * mutations to the original array will not affect the cached data.
   *
   * @param servers - The decoded server array to cache
   */
  set(servers: DecodedServer[]): void {
    this.servers = structuredClone(servers);
    this.lastUpdated = new Date();
  }

  /**
   * Retrieves the cached server list.
   *
   * Returns a deep copy of the cached data. Returns an empty array
   * if the cache has never been populated.
   *
   * @returns Deep copy of cached servers, or empty array if unpopulated
   */
  get(): DecodedServer[] {
    return structuredClone(this.servers);
  }

  /**
   * Looks up a single server by its FiveM endpoint ID.
   *
   * @param id - The server ID to look up (e.g., "bkr4qr")
   * @returns The matching server, or `undefined` if not found
   */
  getServer(id: string): DecodedServer | undefined {
    const server = this.servers.find((s) => s.id === id);
    return server ? structuredClone(server) : undefined;
  }

  /**
   * Returns the timestamp of the last successful `set()` call.
   *
   * @returns Date of last cache update, or `null` if never set
   */
  getLastUpdated(): Date | null {
    return this.lastUpdated;
  }

  /**
   * Clears all cached data and resets the last-updated timestamp.
   */
  clear(): void {
    this.servers = [];
    this.lastUpdated = null;
  }
}

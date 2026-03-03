/**
 * Server Status Hysteresis
 *
 * Manages online/offline status transitions using a hysteresis pattern
 * to prevent status flapping caused by transient network issues or
 * temporary server unresponsiveness.
 *
 * **How it works:** A server is only marked offline after
 * {@link OFFLINE_THRESHOLD} consecutive missed polls (default: 3 polls
 * = 45 minutes at 15-minute intervals). A single successful detection
 * immediately resets the miss counter and marks the server online.
 *
 * This asymmetry is intentional: going offline requires sustained
 * absence (protecting against false negatives), while going online
 * requires only a single detection (servers should appear responsive
 * immediately).
 *
 * @module
 */

import type { ServerStatus } from '../types/server.js';

/**
 * Number of consecutive missed polls required before a server
 * is marked as offline. With a 15-minute poll interval, this
 * means 45 minutes of continuous absence.
 */
export const OFFLINE_THRESHOLD = 3;

/**
 * Updates a server's online/offline status based on poll results.
 *
 * Returns a new {@link ServerStatus} object -- the input is never mutated.
 *
 * **State transitions:**
 * - Present in poll: `consecutiveMisses` resets to 0, `isOnline` becomes `true`,
 *   both `lastSeenAt` and `lastCheckedAt` update to now.
 * - Missing from poll: `consecutiveMisses` increments by 1, `isOnline` flips
 *   to `false` only when `consecutiveMisses >= OFFLINE_THRESHOLD`,
 *   `lastCheckedAt` updates but `lastSeenAt` is preserved.
 *
 * @param current - The server's current status state
 * @param presentInPoll - Whether the server was found in the latest poll
 * @returns A new ServerStatus reflecting the updated state
 *
 * @example
 * ```ts
 * // Server found in poll - immediately online
 * const status = updateServerStatus(current, true);
 * // status.isOnline === true, status.consecutiveMisses === 0
 *
 * // Server missing - increment counter
 * const status = updateServerStatus(current, false);
 * // status.consecutiveMisses === current.consecutiveMisses + 1
 * ```
 */
export function updateServerStatus(
  current: ServerStatus,
  presentInPoll: boolean,
): ServerStatus {
  const now = new Date();

  if (presentInPoll) {
    return {
      isOnline: true,
      consecutiveMisses: 0,
      lastSeenAt: now,
      lastCheckedAt: now,
    };
  }

  const newMisses = current.consecutiveMisses + 1;

  return {
    isOnline: newMisses < OFFLINE_THRESHOLD,
    consecutiveMisses: newMisses,
    lastSeenAt: current.lastSeenAt,
    lastCheckedAt: now,
  };
}

/**
 * Creates an initial status for a newly discovered server.
 *
 * New servers start as online with zero misses and timestamps
 * set to the current time (the moment of first detection).
 *
 * @returns A fresh ServerStatus for a newly discovered server
 *
 * @example
 * ```ts
 * const status = createInitialStatus();
 * // { isOnline: true, consecutiveMisses: 0, lastSeenAt: now, lastCheckedAt: now }
 * ```
 */
export function createInitialStatus(): ServerStatus {
  const now = new Date();

  return {
    isOnline: true,
    consecutiveMisses: 0,
    lastSeenAt: now,
    lastCheckedAt: now,
  };
}

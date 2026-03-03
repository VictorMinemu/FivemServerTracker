/**
 * Application-Level Server Type Definitions
 *
 * These types define the data contract for the post-decode data flow.
 * They bridge the gap between the raw protobuf-decoded data and the
 * database schema, providing typed interfaces for each stage of processing.
 */

/**
 * Decoded server from the FiveM protobuf stream, before database storage.
 *
 * Represents a single server as extracted from the binary stream after
 * protobuf decoding and field mapping. This is the "raw application"
 * representation -- all fields are typed but not yet sanitized or
 * transformed for database insertion.
 */
export interface DecodedServer {
  /** FiveM endpoint ID (e.g., "bkr4qr") - unique identifier from the master list */
  id: string;

  /** Raw hostname with FiveM color codes (e.g., "^1My ^4Server") */
  hostname: string;

  /** Sanitized hostname with all formatting codes stripped */
  hostnameClean: string;

  /** Project name from sv_projectName server variable */
  projectName: string | null;

  /** Project description from sv_projectDesc server variable */
  projectDescription: string | null;

  /** Game type / gamemode (e.g., "roleplay", "racing") */
  gametype: string | null;

  /** Current map name */
  mapname: string | null;

  /** Number of players currently connected */
  players: number;

  /** Maximum player slots configured */
  maxPlayers: number;

  /** Server locale code (e.g., "en-US") */
  locale: string | null;

  /** Server tags for categorization */
  tags: string[];

  /** List of running resources/scripts on the server */
  resources: string[];

  /** Server connection endpoints (IP:port pairs) */
  connectEndPoints: string[];

  /** Icon version number for server icon caching, null if no icon */
  iconVersion: number | null;

  /** Whether the server supports enhanced host features */
  enhancedHostSupport: boolean;

  /** Server software version string, null if not reported */
  server: string | null;

  /** Upvote power score from the FiveM community rating system */
  upvotePower: number;

  /** Burst power score for temporary visibility boosts */
  burstPower: number;

  /** Server variables map (sv_projectName, sv_projectDesc, gamename, etc.) */
  vars: Record<string, string>;
}

/**
 * Shape for upserting into the servers table.
 *
 * Transforms DecodedServer fields into the database-compatible format:
 * - Arrays (tags, resources) are JSON-serialized to strings
 * - Timestamps are Date objects (Drizzle handles epoch conversion)
 * - Player count is not stored here (goes to snapshots table)
 */
export interface ServerUpsert {
  /** FiveM endpoint ID */
  id: string;

  /** Raw hostname with color codes */
  hostname: string;

  /** Sanitized hostname */
  hostnameClean: string;

  /** Project name from server variables */
  projectName: string | null;

  /** Project description from server variables */
  projectDescription: string | null;

  /** Game type / gamemode */
  gametype: string | null;

  /** Current map name */
  mapname: string | null;

  /** Maximum player slots */
  maxPlayers: number;

  /** Server locale code */
  locale: string | null;

  /** JSON-serialized string[] of server tags */
  tags: string;

  /** JSON-serialized string[] of running resources */
  resources: string;

  /** Whether the server is currently considered online */
  isOnline: boolean;

  /** Number of consecutive polls where this server was missing */
  consecutiveMisses: number;

  /** Timestamp of last successful detection in poll */
  lastSeenAt: Date;

  /** Timestamp when this server was first discovered */
  createdAt: Date;

  /** Timestamp of the most recent update */
  updatedAt: Date;
}

/**
 * Tracks server online/offline status with hysteresis.
 *
 * The hysteresis pattern prevents status flapping: a server is only
 * marked offline after OFFLINE_THRESHOLD (default 3) consecutive
 * missed polls (= 45 minutes). A single successful detection
 * immediately resets the counter and marks the server online.
 */
export interface ServerStatus {
  /** Whether the server is currently considered online */
  isOnline: boolean;

  /** Number of consecutive polls where this server was not found */
  consecutiveMisses: number;

  /** Timestamp of the last poll where this server was detected */
  lastSeenAt: Date;

  /** Timestamp of the most recent poll check (whether found or not) */
  lastCheckedAt: Date;
}

/**
 * Result of a single poll cycle.
 *
 * Captures metrics from one complete fetch-decode-store cycle for
 * monitoring and logging. The errors array contains non-fatal issues
 * that occurred during the poll (e.g., individual decode failures)
 * without preventing the overall poll from completing.
 */
export interface PollResult {
  /** Total number of servers found in the stream response */
  serversFound: number;

  /** Number of server records created or updated in the database */
  serversUpserted: number;

  /** Number of snapshot rows created for this poll cycle */
  snapshotsCreated: number;

  /** Non-fatal errors encountered during the poll */
  errors: string[];

  /** Total duration of the poll cycle in milliseconds */
  durationMs: number;
}

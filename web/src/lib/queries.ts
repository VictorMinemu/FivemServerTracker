/**
 * Server Query Layer
 *
 * Provides all data access functions for the server browsing UI:
 * - `getServerListing`: Paginated server list with search, filter, sort
 * - `getServerDetail`: Single server with parsed JSON arrays
 * - `getCategories`: Static category list for navigation
 * - `getPopularTags`: Most common tags from online servers
 *
 * All functions accept a Drizzle DB instance for testability with in-memory SQLite.
 *
 * @module
 */

import {
  eq,
  and,
  like,
  gte,
  lte,
  asc,
  desc,
  count,
  sql,
  or,
  type SQL,
} from 'drizzle-orm';
import { servers } from '../../../src/db/schema.js';
import type { DrizzleDB } from '../../../src/db/index.js';

/** Filters accepted by getServerListing */
export interface ListingFilters {
  /** Text search on hostnameClean (case-insensitive LIKE) */
  q?: string;
  /** Exact match on gametype column (case-insensitive) */
  gamemode?: string;
  /** Category slug mapped to gametype patterns */
  category?: string;
  /** Tag name to filter by (LIKE on JSON tags column) */
  tag?: string;
  /** Exact match on locale column */
  locale?: string;
  /** Minimum current player count */
  minPlayers?: number;
  /** Maximum current player count */
  maxPlayers?: number;
  /** Sort field: 'players' or 'name' */
  sort?: 'players' | 'name';
  /** Sort direction: 'asc' or 'desc' */
  sortDir?: 'asc' | 'desc';
  /** Page number (1-based) */
  page?: number;
  /** Results per page */
  pageSize?: number;
}

/** Server data for listing cards (excludes resources to avoid bloat) */
export interface ServerCard {
  id: string;
  hostnameClean: string;
  currentPlayers: number;
  maxPlayers: number;
  isOnline: boolean;
  gametype: string | null;
  mapname: string | null;
  iconVersion: number | null;
  lastSeenAt: Date;
  tags: string | null;
}

/** Full server data with parsed JSON arrays */
export interface ServerDetail {
  id: string;
  hostname: string;
  hostnameClean: string;
  projectName: string | null;
  projectDescription: string | null;
  gametype: string | null;
  mapname: string | null;
  maxPlayers: number;
  currentPlayers: number;
  iconVersion: number | null;
  locale: string | null;
  tags: string[];
  resources: string[];
  isOnline: boolean;
  consecutiveMisses: number;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Paginated listing result */
export interface ListingResult {
  servers: ServerCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Category definition with slug and human-readable label */
export interface Category {
  slug: string;
  label: string;
}

/** Tag with occurrence count */
export interface TagCount {
  tag: string;
  count: number;
}

/**
 * Static mapping from category slugs to gametype LIKE patterns.
 *
 * Each category maps to one or more SQL LIKE patterns that are combined
 * with OR to match against the gametype column.
 */
export const CATEGORY_MAP: Record<string, { label: string; patterns: string[] }> = {
  rp: { label: 'Roleplay', patterns: ['%roleplay%', '%rp%'] },
  racing: { label: 'Racing', patterns: ['%racing%', '%race%'] },
  freeroam: { label: 'Freeroam', patterns: ['%freeroam%', '%free roam%'] },
};

/**
 * Retrieves a paginated list of online servers with search, filter, and sort.
 *
 * Builds dynamic WHERE conditions from the provided filters and executes
 * two queries: one for the page of results and one for the total count.
 * Only returns columns needed for server cards (excludes resources).
 *
 * @param db - Drizzle database instance
 * @param filters - Optional listing filters (search, gamemode, category, tag, locale, player range, sort, pagination)
 * @returns Paginated listing result with servers, total count, and page metadata
 *
 * @example
 * ```ts
 * const result = await getServerListing(db, { q: 'roleplay', page: 1, pageSize: 24 });
 * console.log(result.servers); // ServerCard[]
 * console.log(result.totalPages); // number
 * ```
 */
export async function getServerListing(
  db: DrizzleDB,
  filters: ListingFilters = {},
): Promise<ListingResult> {
  const {
    q,
    gamemode,
    category,
    tag,
    locale,
    minPlayers,
    maxPlayers,
    sort = 'players',
    sortDir,
    page = 1,
    pageSize = 24,
  } = filters;

  // Build WHERE conditions
  const conditions: SQL[] = [eq(servers.isOnline, true)];

  // Text search on hostnameClean
  if (q) {
    conditions.push(like(servers.hostnameClean, `%${q}%`));
  }

  // Exact gamemode match (case-insensitive via SQL lower())
  if (gamemode) {
    conditions.push(sql`lower(${servers.gametype}) = lower(${gamemode})`);
  }

  // Category filter: expand to OR conditions on gametype
  if (category) {
    const catDef = CATEGORY_MAP[category];
    if (catDef) {
      const catConditions = catDef.patterns.map((pattern) =>
        like(sql`lower(${servers.gametype})`, pattern),
      );
      if (catConditions.length > 0) {
        conditions.push(or(...catConditions)!);
      }
    }
    // Unknown category: no additional filter (returns all)
  }

  // Tag filter: LIKE on JSON tags column
  if (tag) {
    conditions.push(like(servers.tags, `%${tag}%`));
  }

  // Locale exact match
  if (locale) {
    conditions.push(eq(servers.locale, locale));
  }

  // Player count range
  if (minPlayers !== undefined) {
    conditions.push(gte(servers.currentPlayers, minPlayers));
  }
  if (maxPlayers !== undefined) {
    conditions.push(lte(servers.currentPlayers, maxPlayers));
  }

  // Build WHERE clause
  const whereClause = and(...conditions);

  // Build ORDER BY (name sort uses COLLATE NOCASE for case-insensitive ordering)
  let orderByClause;
  if (sort === 'name') {
    const nameExpr = sql`${servers.hostnameClean} COLLATE NOCASE`;
    orderByClause = sortDir === 'desc'
      ? desc(nameExpr)
      : asc(nameExpr);
  } else {
    // Default: sort by players
    orderByClause = sortDir === 'asc'
      ? asc(servers.currentPlayers)
      : desc(servers.currentPlayers);
  }

  // Calculate offset
  const offset = (page - 1) * pageSize;

  // Execute data query (select only card columns, exclude resources)
  const rows = db
    .select({
      id: servers.id,
      hostnameClean: servers.hostnameClean,
      currentPlayers: servers.currentPlayers,
      maxPlayers: servers.maxPlayers,
      isOnline: servers.isOnline,
      gametype: servers.gametype,
      mapname: servers.mapname,
      iconVersion: servers.iconVersion,
      lastSeenAt: servers.lastSeenAt,
      tags: servers.tags,
    })
    .from(servers)
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(pageSize)
    .offset(offset)
    .all();

  // Execute count query with same conditions
  const countResult = db
    .select({ value: count() })
    .from(servers)
    .where(whereClause)
    .all();

  const total = countResult[0]?.value ?? 0;
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

  return {
    servers: rows,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Retrieves a single server by ID with all columns and parsed JSON arrays.
 *
 * Returns null if the server is not found. Tags and resources are parsed
 * from their JSON string representation to string arrays, with null values
 * safely defaulting to empty arrays.
 *
 * @param db - Drizzle database instance
 * @param id - FiveM endpoint ID (e.g., "bkr4qr")
 * @returns Full server detail with parsed arrays, or null if not found
 *
 * @example
 * ```ts
 * const server = await getServerDetail(db, 'bkr4qr');
 * if (server) {
 *   console.log(server.tags); // string[]
 *   console.log(server.resources); // string[]
 * }
 * ```
 */
export async function getServerDetail(
  db: DrizzleDB,
  id: string,
): Promise<ServerDetail | null> {
  const rows = db
    .select()
    .from(servers)
    .where(eq(servers.id, id))
    .all();

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    hostname: row.hostname,
    hostnameClean: row.hostnameClean,
    projectName: row.projectName,
    projectDescription: row.projectDescription,
    gametype: row.gametype,
    mapname: row.mapname,
    maxPlayers: row.maxPlayers,
    currentPlayers: row.currentPlayers,
    iconVersion: row.iconVersion,
    locale: row.locale,
    tags: safeParseJsonArray(row.tags),
    resources: safeParseJsonArray(row.resources),
    isOnline: row.isOnline,
    consecutiveMisses: row.consecutiveMisses,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Returns the static list of server categories with slugs and labels.
 *
 * Categories map to gametype LIKE patterns used by getServerListing
 * when the `category` filter is provided.
 *
 * @returns Array of category objects with slug and label
 *
 * @example
 * ```ts
 * const categories = getCategories();
 * // [{ slug: 'rp', label: 'Roleplay' }, { slug: 'racing', label: 'Racing' }, ...]
 * ```
 */
export function getCategories(): Category[] {
  return Object.entries(CATEGORY_MAP).map(([slug, { label }]) => ({
    slug,
    label,
  }));
}

/**
 * Aggregates the most common tags from online servers.
 *
 * Queries all online servers' tags column, parses each JSON string to an
 * array, counts occurrences of each tag, and returns the top N tags
 * sorted by frequency descending.
 *
 * @param db - Drizzle database instance
 * @param limit - Maximum number of tags to return (default: 20)
 * @returns Array of tags with occurrence counts, sorted by frequency
 *
 * @example
 * ```ts
 * const tags = await getPopularTags(db, 10);
 * // [{ tag: 'roleplay', count: 45 }, { tag: 'economy', count: 32 }, ...]
 * ```
 */
export async function getPopularTags(
  db: DrizzleDB,
  limit = 20,
): Promise<TagCount[]> {
  // Query all online servers' tags
  const rows = db
    .select({ tags: servers.tags })
    .from(servers)
    .where(eq(servers.isOnline, true))
    .all();

  // Count tag occurrences in memory
  const tagCounts = new Map<string, number>();
  for (const row of rows) {
    const parsed = safeParseJsonArray(row.tags);
    for (const tag of parsed) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  // Sort by frequency descending and take top N
  const sorted = [...tagCounts.entries()]
    .map(([tag, tagCount]) => ({ tag, count: tagCount }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return sorted;
}

/**
 * Safely parses a JSON string to a string array.
 *
 * Returns an empty array for null, undefined, or invalid JSON values.
 * This prevents crashes when tags or resources columns contain
 * unexpected data.
 *
 * @param value - JSON string to parse, or null/undefined
 * @returns Parsed string array, or empty array on failure
 */
function safeParseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

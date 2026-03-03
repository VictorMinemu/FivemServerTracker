/**
 * Protobuf Decoder and Server Transformer
 *
 * Wraps the generated protobufjs decoder to safely decode binary frames
 * into typed application objects. Handles decode errors gracefully by
 * returning null instead of throwing, and transforms the raw protobuf
 * Server message into the application-level DecodedServer interface.
 *
 * The transformation maps protobuf field names to application field names,
 * extracts commonly-used server variables (locale, tags, projectName),
 * and provides sensible defaults for missing optional fields.
 *
 * @see src/proto/master.proto - The protobuf schema definition
 * @see src/types/server.ts - The DecodedServer target interface
 */

import { master } from '../proto/generated/master.js';
import type { DecodedServer } from '../types/server.js';

/**
 * Decoded raw server structure from protobuf, before application transformation.
 *
 * This interface represents the shape of a successfully decoded protobuf
 * Server message, with the EndPoint string and optional ServerData payload.
 */
interface RawDecodedServer {
  EndPoint: string;
  Data: master.IServerData | null;
}

/**
 * Decodes a raw protobuf frame into a Server object.
 *
 * Wraps `master.Server.decode()` in a try/catch to handle malformed
 * or corrupted frame bytes gracefully. On decode failure, logs a
 * warning and returns null rather than crashing the polling pipeline.
 *
 * @param frame - Raw protobuf bytes (without the 4-byte length prefix)
 * @returns Decoded server object with EndPoint and Data, or null if decode fails
 */
export function decodeServerFrame(
  frame: Uint8Array
): RawDecodedServer | null {
  try {
    const server = master.Server.decode(frame);
    return {
      EndPoint: server.EndPoint,
      Data: server.Data ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[decoder] Failed to decode server frame: ${message}`);
    return null;
  }
}

/**
 * Transforms a raw decoded protobuf Server into the application DecodedServer type.
 *
 * Maps protobuf field names to application field names, extracts commonly-used
 * server variables from the vars map (locale, tags, sv_projectName, sv_projectDesc),
 * and applies sensible defaults for missing optional fields.
 *
 * The hostnameClean field is intentionally set to an empty string here -- it will
 * be populated by the sanitizer module in a later processing stage.
 *
 * @param raw - Decoded protobuf Server object with EndPoint and Data fields
 * @returns Fully-mapped DecodedServer object ready for further processing
 */
export function transformServer(
  raw: { EndPoint: string; Data: master.IServerData | null }
): DecodedServer {
  const data = raw.Data;

  const vars = data?.vars ?? {};
  const tagsString = vars['tags'] ?? '';
  const locale = vars['locale'] ?? null;
  const projectName = vars['sv_projectName'] ?? null;
  const projectDescription = vars['sv_projectDesc'] ?? null;

  return {
    id: raw.EndPoint,
    hostname: data?.hostname ?? '',
    hostnameClean: '',
    projectName: projectName || null,
    projectDescription: projectDescription || null,
    gametype: data?.gametype || null,
    mapname: data?.mapname || null,
    players: data?.clients ?? 0,
    maxPlayers: data?.svMaxclients ?? 0,
    locale: locale || null,
    tags: tagsString ? tagsString.split(',').filter(Boolean) : [],
    resources: data?.resources ?? [],
    connectEndPoints: data?.connectEndPoints ?? [],
    iconVersion: data?.iconVersion || null,
    enhancedHostSupport: data?.enhancedHostSupport ?? false,
    server: data?.server || null,
    upvotePower: data?.upvotePower ?? 0,
    burstPower: data?.burstPower ?? 0,
    vars: Object.fromEntries(Object.entries(vars)),
  };
}

/**
 * Checks whether a decoded server is a GTA5 (FiveM) server.
 *
 * The FiveM master server list includes servers for multiple games:
 * GTA5 (FiveM), RDR3 (RedM), and LibertyM. This function filters
 * to only FiveM servers by checking the `gamename` server variable.
 *
 * Servers with no gamename variable or an empty gamename are treated
 * as GTA5 servers by default, matching the FiveM client behavior.
 *
 * @param raw - Decoded server with at least the Data.vars fields
 * @returns true if the server is a GTA5/FiveM server, false otherwise
 */
export function isGta5Server(
  raw: { Data: master.IServerData | null }
): boolean {
  const gamename = raw.Data?.vars?.['gamename'];
  // Default to gta5 when gamename is not set or empty
  if (!gamename) return true;
  return gamename === 'gta5';
}

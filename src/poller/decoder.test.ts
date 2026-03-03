/**
 * Protobuf Decoder and Server Transformer Unit Tests
 *
 * Tests the protobuf decode wrapper and the transformation from raw
 * protobuf Server messages to typed DecodedServer application objects.
 * Covers field mapping, variable extraction (locale, tags, projectName),
 * malformed frame handling, empty endpoint detection, and GTA5 filtering.
 */

import { describe, it, expect, vi } from 'vitest';
import { master } from '../proto/generated/master.js';
import { decodeServerFrame, transformServer, isGta5Server } from './decoder.js';

/**
 * Encodes a Server protobuf message into raw bytes for testing the decoder.
 *
 * @param props - Properties for the Server protobuf message
 * @returns Uint8Array of encoded protobuf bytes (without length prefix)
 */
function encodeServerBytes(props: {
  EndPoint?: string;
  Data?: {
    hostname?: string;
    clients?: number;
    svMaxclients?: number;
    protocol?: number;
    gametype?: string;
    mapname?: string;
    resources?: string[];
    server?: string;
    iconVersion?: number;
    vars?: Record<string, string>;
    enhancedHostSupport?: boolean;
    upvotePower?: number;
    connectEndPoints?: string[];
    burstPower?: number;
  };
}): Uint8Array {
  const msg = master.Server.create(props);
  return master.Server.encode(msg).finish();
}

describe('decodeServerFrame', () => {
  it('decodes a valid protobuf Server frame into an object with correct EndPoint and Data fields', () => {
    const bytes = encodeServerBytes({
      EndPoint: 'abc123',
      Data: {
        hostname: 'My Test Server',
        clients: 10,
        svMaxclients: 32,
        protocol: 4,
        gametype: 'roleplay',
        mapname: 'los_santos',
      },
    });

    const result = decodeServerFrame(bytes);

    expect(result).not.toBeNull();
    expect(result!.EndPoint).toBe('abc123');
    expect(result!.Data).toBeDefined();
    expect(result!.Data!.hostname).toBe('My Test Server');
    expect(result!.Data!.clients).toBe(10);
    expect(result!.Data!.svMaxclients).toBe(32);
  });

  it('returns null on malformed/garbage bytes without throwing', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const garbage = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc, 0xfb, 0xfa, 0x99, 0x88]);

    const result = decodeServerFrame(garbage);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('transformServer', () => {
  it('maps all ServerData fields to DecodedServer correctly', () => {
    const raw = {
      EndPoint: 'xyz789',
      Data: master.ServerData.create({
        hostname: '^1My ^4Server',
        clients: 25,
        svMaxclients: 64,
        protocol: 4,
        gametype: 'racing',
        mapname: 'highway_track',
        resources: ['es_extended', 'esx_skin', 'mysql-async'],
        server: 'FXServer-master v1.0.0',
        iconVersion: 3,
        vars: {
          gamename: 'gta5',
          locale: 'en-US',
          tags: 'racing,drift,cars',
          sv_projectName: 'Speed Demons',
          sv_projectDesc: 'Best racing server',
        },
        enhancedHostSupport: true,
        upvotePower: 42,
        connectEndPoints: ['192.168.1.1:30120'],
        burstPower: 5,
      }),
    };

    const result = transformServer(raw);

    expect(result.id).toBe('xyz789');
    expect(result.hostname).toBe('^1My ^4Server');
    expect(result.hostnameClean).toBe('');
    expect(result.players).toBe(25);
    expect(result.maxPlayers).toBe(64);
    expect(result.gametype).toBe('racing');
    expect(result.mapname).toBe('highway_track');
    expect(result.resources).toEqual(['es_extended', 'esx_skin', 'mysql-async']);
    expect(result.server).toBe('FXServer-master v1.0.0');
    expect(result.iconVersion).toBe(3);
    expect(result.enhancedHostSupport).toBe(true);
    expect(result.upvotePower).toBe(42);
    expect(result.connectEndPoints).toEqual(['192.168.1.1:30120']);
    expect(result.burstPower).toBe(5);
    expect(result.vars).toHaveProperty('gamename', 'gta5');
  });

  it('extracts locale from vars.locale, tags from vars.tags (comma-split), projectName from vars.sv_projectName, projectDescription from vars.sv_projectDesc', () => {
    const raw = {
      EndPoint: 'locale-test',
      Data: master.ServerData.create({
        hostname: 'Locale Server',
        vars: {
          locale: 'es-ES',
          tags: 'roleplay,economy,police',
          sv_projectName: 'RP Spain',
          sv_projectDesc: 'Spanish roleplay server',
        },
      }),
    };

    const result = transformServer(raw);

    expect(result.locale).toBe('es-ES');
    expect(result.tags).toEqual(['roleplay', 'economy', 'police']);
    expect(result.projectName).toBe('RP Spain');
    expect(result.projectDescription).toBe('Spanish roleplay server');
  });

  it('sets hostnameClean to empty string (placeholder for sanitizer)', () => {
    const raw = {
      EndPoint: 'clean-test',
      Data: master.ServerData.create({
        hostname: '^1Colored ^4Name',
      }),
    };

    const result = transformServer(raw);

    expect(result.hostnameClean).toBe('');
  });

  it('handles missing optional fields with defaults', () => {
    const raw = {
      EndPoint: 'minimal',
      Data: master.ServerData.create({
        hostname: 'Minimal Server',
        clients: 1,
        svMaxclients: 16,
      }),
    };

    const result = transformServer(raw);

    expect(result.gametype).toBeNull();
    expect(result.mapname).toBeNull();
    expect(result.locale).toBeNull();
    expect(result.tags).toEqual([]);
    expect(result.resources).toEqual([]);
    expect(result.connectEndPoints).toEqual([]);
    expect(result.projectName).toBeNull();
    expect(result.projectDescription).toBeNull();
    expect(result.iconVersion).toBeNull();
    expect(result.server).toBeNull();
    expect(result.enhancedHostSupport).toBe(false);
    expect(result.upvotePower).toBe(0);
    expect(result.burstPower).toBe(0);
  });

  it('handles empty tags string by producing empty array', () => {
    const raw = {
      EndPoint: 'empty-tags',
      Data: master.ServerData.create({
        hostname: 'Empty Tags Server',
        vars: { tags: '' },
      }),
    };

    const result = transformServer(raw);

    expect(result.tags).toEqual([]);
  });
});

describe('isGta5Server', () => {
  it('returns true for servers with vars.gamename = "gta5"', () => {
    const raw = {
      Data: master.ServerData.create({
        vars: { gamename: 'gta5' },
      }),
    };

    expect(isGta5Server(raw)).toBe(true);
  });

  it('returns true when gamename is undefined/empty (defaults to gta5)', () => {
    const raw = {
      Data: master.ServerData.create({}),
    };

    expect(isGta5Server(raw)).toBe(true);
  });

  it('returns false for servers with vars.gamename = "rdr3" (RedM)', () => {
    const raw = {
      Data: master.ServerData.create({
        vars: { gamename: 'rdr3' },
      }),
    };

    expect(isGta5Server(raw)).toBe(false);
  });

  it('returns false for servers with vars.gamename = "libertym"', () => {
    const raw = {
      Data: master.ServerData.create({
        vars: { gamename: 'libertym' },
      }),
    };

    expect(isGta5Server(raw)).toBe(false);
  });
});

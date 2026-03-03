/**
 * Frame Reader Unit Tests
 *
 * Tests the binary frame reader that parses 4-byte LE length-prefixed
 * protobuf frames from the FiveM server list stream. Covers single frame,
 * multi-frame, split chunks, oversized frame rejection, empty stream,
 * and partial length prefix scenarios.
 */

import { describe, it, expect, vi } from 'vitest';
import { master } from '../proto/generated/master.js';
import { readFrames, fetchServerStream } from './fetcher.js';

/**
 * Creates a length-prefixed binary frame from a Server protobuf message.
 *
 * Encodes the given server properties into a protobuf Server message,
 * then prepends a 4-byte little-endian length prefix matching the
 * FiveM binary stream frame format.
 *
 * @param serverProps - Properties for the Server protobuf message
 * @returns Complete frame with 4-byte LE length prefix + protobuf payload
 */
function createFrame(serverProps: {
  EndPoint?: string;
  Data?: {
    hostname?: string;
    clients?: number;
    svMaxclients?: number;
    gametype?: string;
    mapname?: string;
    vars?: Record<string, string>;
  };
}): Uint8Array {
  const msg = master.Server.create(serverProps);
  const encoded = master.Server.encode(msg).finish();
  const frame = new Uint8Array(4 + encoded.length);
  const view = new DataView(frame.buffer);
  view.setUint32(0, encoded.length, true); // Little-endian
  frame.set(encoded, 4);
  return frame;
}

/**
 * Creates a ReadableStream that yields the provided chunks sequentially.
 *
 * Used to simulate the HTTP response body stream for testing the frame
 * reader with controlled chunk boundaries.
 *
 * @param chunks - Array of Uint8Array chunks to yield
 * @returns ReadableStream that yields each chunk in order
 */
function createReadableStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]!);
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe('readFrames', () => {
  it('extracts a single complete frame from a buffer with valid 4-byte LE length prefix', async () => {
    const frame = createFrame({
      EndPoint: 'abc123',
      Data: { hostname: 'Test Server', clients: 10, svMaxclients: 32 },
    });
    const stream = createReadableStream([frame]);
    const frames: Uint8Array[] = [];

    await readFrames(stream, (f) => frames.push(f));

    expect(frames).toHaveLength(1);
    const decoded = master.Server.decode(frames[0]!);
    expect(decoded.EndPoint).toBe('abc123');
    expect(decoded.Data?.hostname).toBe('Test Server');
  });

  it('extracts multiple consecutive frames from a single buffer', async () => {
    const frame1 = createFrame({
      EndPoint: 'srv1',
      Data: { hostname: 'Server One', clients: 5 },
    });
    const frame2 = createFrame({
      EndPoint: 'srv2',
      Data: { hostname: 'Server Two', clients: 15 },
    });

    // Combine both frames into one chunk
    const combined = new Uint8Array(frame1.length + frame2.length);
    combined.set(frame1);
    combined.set(frame2, frame1.length);

    const stream = createReadableStream([combined]);
    const frames: Uint8Array[] = [];

    await readFrames(stream, (f) => frames.push(f));

    expect(frames).toHaveLength(2);
    const decoded1 = master.Server.decode(frames[0]!);
    const decoded2 = master.Server.decode(frames[1]!);
    expect(decoded1.EndPoint).toBe('srv1');
    expect(decoded2.EndPoint).toBe('srv2');
  });

  it('handles a frame split across two stream chunks (partial frame buffering)', async () => {
    const frame = createFrame({
      EndPoint: 'split-test',
      Data: { hostname: 'Split Server', clients: 42 },
    });

    // Split the frame at an arbitrary point in the middle
    const splitPoint = Math.floor(frame.length / 2);
    const chunk1 = frame.slice(0, splitPoint);
    const chunk2 = frame.slice(splitPoint);

    const stream = createReadableStream([chunk1, chunk2]);
    const frames: Uint8Array[] = [];

    await readFrames(stream, (f) => frames.push(f));

    expect(frames).toHaveLength(1);
    const decoded = master.Server.decode(frames[0]!);
    expect(decoded.EndPoint).toBe('split-test');
  });

  it('rejects frames with length > 65535 (throws Error with "Frame too large")', async () => {
    // Create a fake frame header claiming 70000 bytes
    const fakeHeader = new Uint8Array(4);
    const view = new DataView(fakeHeader.buffer);
    view.setUint32(0, 70000, true);

    const stream = createReadableStream([fakeHeader]);

    await expect(readFrames(stream, () => {})).rejects.toThrow('Frame too large');
  });

  it('processes an empty stream without error (zero frames)', async () => {
    const stream = createReadableStream([]);
    const frames: Uint8Array[] = [];

    await readFrames(stream, (f) => frames.push(f));

    expect(frames).toHaveLength(0);
  });

  it('handles a stream chunk that contains only a partial length prefix (< 4 bytes)', async () => {
    const frame = createFrame({
      EndPoint: 'partial-prefix',
      Data: { hostname: 'Partial Prefix Server', clients: 7 },
    });

    // Split so first chunk has only 3 bytes (partial length prefix)
    const chunk1 = frame.slice(0, 3);
    const chunk2 = frame.slice(3);

    const stream = createReadableStream([chunk1, chunk2]);
    const frames: Uint8Array[] = [];

    await readFrames(stream, (f) => frames.push(f));

    expect(frames).toHaveLength(1);
    const decoded = master.Server.decode(frames[0]!);
    expect(decoded.EndPoint).toBe('partial-prefix');
  });
});

describe('fetchServerStream', () => {
  it('fetches from the configured URL and returns a readable stream', async () => {
    const mockBody = createReadableStream([]);
    const mockResponse = {
      ok: true,
      body: mockBody,
      status: 200,
    } as unknown as Response;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      const stream = await fetchServerStream('https://example.com/api/servers/streamRedir/');
      expect(stream).toBe(mockBody);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://example.com/api/servers/streamRedir/',
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws on non-OK response status', async () => {
    const mockResponse = {
      ok: false,
      body: null,
      status: 403,
    } as unknown as Response;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      await expect(fetchServerStream('https://example.com/api')).rejects.toThrow('403');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws on null response body', async () => {
    const mockResponse = {
      ok: true,
      body: null,
      status: 200,
    } as unknown as Response;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    try {
      await expect(fetchServerStream('https://example.com/api')).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

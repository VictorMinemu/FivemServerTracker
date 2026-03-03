/**
 * HTTP Fetch and Binary Frame Reader for FiveM Server List
 *
 * The FiveM master server list endpoint returns a continuous binary stream
 * where each server entry is encoded as a protobuf message prefixed with
 * a 4-byte little-endian unsigned integer indicating the payload size.
 *
 * This module provides two functions:
 * - `readFrames`: Parses the binary stream into individual protobuf frame payloads
 * - `fetchServerStream`: Fetches the stream from the FiveM endpoint
 *
 * The frame format is derived from the official FiveM source code:
 * citizenfx/fivem ext/cfx-ui/src/cfx/common/services/servers/source/utils/frameReader.ts
 */

/** Maximum allowed frame size in bytes (64 KB). Frames exceeding this are rejected. */
const MAX_FRAME_SIZE = 65535;

/**
 * Reads length-prefixed protobuf frames from a binary stream.
 *
 * The FiveM server list endpoint returns a continuous binary stream
 * where each server is encoded as a protobuf message prefixed with
 * a 4-byte little-endian unsigned integer indicating payload size.
 * Maximum frame size is 65535 bytes.
 *
 * The reader handles chunk boundaries correctly: stream chunks from
 * fetch() do not align with frame boundaries, so partial frames are
 * buffered until enough data arrives to extract a complete frame.
 *
 * @param stream - ReadableStream of Uint8Array chunks from fetch response body
 * @param onFrame - Callback invoked with each complete frame's protobuf payload bytes
 * @throws Error if a frame's declared length exceeds MAX_FRAME_SIZE (65535 bytes)
 */
export async function readFrames(
  stream: ReadableStream<Uint8Array>,
  onFrame: (frame: Uint8Array) => void
): Promise<void> {
  const reader = stream.getReader();
  let buffer = new Uint8Array(0);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Concatenate new chunk with leftover buffer
      const newBuffer = new Uint8Array(buffer.length + value.length);
      newBuffer.set(buffer);
      newBuffer.set(value, buffer.length);
      buffer = newBuffer;

      // Extract complete frames from the accumulated buffer
      while (buffer.length >= 4) {
        const frameLength =
          buffer[0]! | (buffer[1]! << 8) | (buffer[2]! << 16) | (buffer[3]! << 24);

        if (frameLength > MAX_FRAME_SIZE) {
          throw new Error(`Frame too large: ${frameLength} bytes exceeds maximum of ${MAX_FRAME_SIZE}`);
        }

        if (buffer.length < 4 + frameLength) {
          break; // Incomplete frame, wait for more data
        }

        const frame = buffer.slice(4, 4 + frameLength);
        onFrame(frame);
        buffer = buffer.slice(4 + frameLength);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Fetches the FiveM server list binary stream from the given URL.
 *
 * Makes an HTTP GET request with appropriate headers for receiving
 * binary protobuf data. The response body is returned as a ReadableStream
 * suitable for passing to `readFrames`.
 *
 * The FiveM endpoint is currently at:
 * `https://frontend.cfx-services.net/api/servers/streamRedir/`
 *
 * @param url - The full URL of the FiveM server list streaming endpoint
 * @returns ReadableStream of binary chunks from the response body
 * @throws Error if the response status is not OK or the body is null
 */
export async function fetchServerStream(
  url: string
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/octet-stream',
      'User-Agent': 'FiveM-Server-Tracker/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Stream fetch failed: HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Stream fetch failed: response body is null');
  }

  return response.body;
}

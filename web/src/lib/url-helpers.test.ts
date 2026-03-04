/**
 * URL Helper Tests
 *
 * Validates that server icon and connect URL construction follows
 * the expected cfx.re/FiveM CDN patterns.
 */

import { describe, it, expect } from 'vitest';
import {
  getServerIconUrl,
  getConnectUrl,
  DEFAULT_ICON_PATH,
} from './url-helpers.js';

describe('getServerIconUrl', () => {
  it('returns CDN URL with valid iconVersion', () => {
    const url = getServerIconUrl('bkr4qr', 12345);
    expect(url).toBe(
      'https://frontend.cfx-services.net/api/servers/icon/bkr4qr/12345.png',
    );
  });

  it('returns default icon path when iconVersion is null', () => {
    const url = getServerIconUrl('bkr4qr', null);
    expect(url).toBe(DEFAULT_ICON_PATH);
    expect(url).toBe('/images/default-server-icon.png');
  });

  it('handles iconVersion of 0 as a valid version', () => {
    const url = getServerIconUrl('abc123', 0);
    expect(url).toBe(
      'https://frontend.cfx-services.net/api/servers/icon/abc123/0.png',
    );
  });
});

describe('getConnectUrl', () => {
  it('returns correct cfx.re connect URL', () => {
    const url = getConnectUrl('bkr4qr');
    expect(url).toBe('https://cfx.re/join/bkr4qr');
  });

  it('handles various server ID formats', () => {
    const url = getConnectUrl('x7y8z9');
    expect(url).toBe('https://cfx.re/join/x7y8z9');
  });
});

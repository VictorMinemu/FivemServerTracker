/**
 * URL Helper Utilities for FiveM Server Links
 *
 * Provides functions to construct CDN icon URLs and connect URLs for
 * FiveM servers. These URLs follow the official cfx.re/FiveM CDN patterns.
 *
 * @module
 */

/** Default icon path used when a server has no icon version */
export const DEFAULT_ICON_PATH = '/images/default-server-icon.png';

/**
 * Constructs the CDN URL for a server's icon image.
 *
 * FiveM servers can have versioned icons hosted on the cfx-services CDN.
 * When iconVersion is null (server has no icon), returns a local default
 * icon path instead.
 *
 * @param serverId - The FiveM endpoint ID (e.g., "bkr4qr")
 * @param iconVersion - The icon version number, or null if no icon
 * @returns Full CDN URL for the server icon, or the default icon path
 *
 * @example
 * ```ts
 * getServerIconUrl('bkr4qr', 12345);
 * // => 'https://frontend.cfx-services.net/api/servers/icon/bkr4qr/12345.png'
 *
 * getServerIconUrl('bkr4qr', null);
 * // => '/images/default-server-icon.png'
 * ```
 */
export function getServerIconUrl(
  serverId: string,
  iconVersion: number | null,
): string {
  if (iconVersion === null) {
    return DEFAULT_ICON_PATH;
  }
  return `https://frontend.cfx-services.net/api/servers/icon/${serverId}/${iconVersion}.png`;
}

/**
 * Constructs the cfx.re connect URL for a server.
 *
 * This URL can be used as a direct connect link that opens the FiveM
 * client and connects to the specified server.
 *
 * @param serverId - The FiveM endpoint ID (e.g., "bkr4qr")
 * @returns The cfx.re connect URL
 *
 * @example
 * ```ts
 * getConnectUrl('bkr4qr');
 * // => 'https://cfx.re/join/bkr4qr'
 * ```
 */
export function getConnectUrl(serverId: string): string {
  return `https://cfx.re/join/${serverId}`;
}

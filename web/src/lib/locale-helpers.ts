/**
 * Locale display helpers.
 *
 * Converts locale codes (e.g., "en-US", "es-ES") to flag emojis
 * and human-readable region names for the server browsing UI.
 *
 * @module
 */

/**
 * Extracts the country code from a locale string and returns its flag emoji.
 *
 * Uses the Regional Indicator Symbol technique: each letter of the 2-letter
 * country code is offset into the Unicode Regional Indicator range (U+1F1E6).
 *
 * @param locale - BCP 47 locale string (e.g., "en-US", "es-ES", "fr")
 * @returns Flag emoji string, or empty string if no country code can be extracted
 *
 * @example
 * ```ts
 * localeToFlag('en-US'); // '🇺🇸'
 * localeToFlag('es-ES'); // '🇪🇸'
 * localeToFlag('fr');    // '🇫🇷'
 * localeToFlag('');      // ''
 * ```
 */
export function localeToFlag(locale: string | null | undefined): string {
  if (!locale) return '';

  // Try to get country from "xx-YY" format, fall back to locale itself for 2-letter codes
  const parts = locale.split('-');
  const country = parts.length >= 2 ? parts[parts.length - 1]! : locale;

  if (country.length !== 2) return '';

  const upper = country.toUpperCase();
  const codePoint1 = upper.charCodeAt(0) - 65 + 0x1f1e6;
  const codePoint2 = upper.charCodeAt(1) - 65 + 0x1f1e6;

  return String.fromCodePoint(codePoint1, codePoint2);
}

/**
 * Returns a human-readable region name for a locale code.
 *
 * Uses Intl.DisplayNames when available, falls back to the raw locale string.
 *
 * @param locale - BCP 47 locale string (e.g., "en-US", "es-ES")
 * @returns Human-readable region name (e.g., "United States", "Spain")
 *
 * @example
 * ```ts
 * localeToRegionName('en-US'); // 'United States'
 * localeToRegionName('es-ES'); // 'Spain'
 * ```
 */
export function localeToRegionName(locale: string | null | undefined): string {
  if (!locale) return '';

  const parts = locale.split('-');
  const country = parts.length >= 2 ? parts[parts.length - 1]! : locale;

  if (country.length !== 2) return locale;

  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return displayNames.of(country.toUpperCase()) ?? locale;
  } catch {
    return locale;
  }
}

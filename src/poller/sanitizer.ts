/**
 * Server Name Sanitizer
 *
 * FiveM/GTA server names use three formatting systems that must be stripped
 * to produce clean, readable hostnames:
 *
 * 1. **Caret codes** (`^0`-`^9`, `^*`, `^d`, `^p`, `^q`, `^r`):
 *    GTA-native color codes inherited from the RAGE engine. `^0` through `^9`
 *    map to predefined colors, `^*` toggles bold, and `^d`/`^p`/`^q`/`^r` are
 *    additional formatting modifiers.
 *
 * 2. **Tilde tags** (`~r~`, `~bold~`, `~HUD_COLOUR_BLUE~`, `~HC_123~`):
 *    GTA HUD formatting tags used for in-game text styling. These include
 *    simple single-letter tags (`~r~`, `~s~`, `~g~`), word tags (`~bold~`,
 *    `~normal~`), and complex tags referencing HUD color constants.
 *
 * 3. **Zero-width Unicode** (ZWJ, ZWNJ, BOM, variation selectors):
 *    Invisible Unicode characters sometimes inserted intentionally to break
 *    text matching or unintentionally from copy-paste. These are stripped to
 *    normalize the name for search and display.
 *
 * Both the raw (`hostname`) and clean (`hostnameClean`) versions are stored:
 * the raw name preserves the server owner's intended styling for rich display,
 * while the clean name enables reliable search, sorting, and deduplication.
 *
 * @module
 */

/**
 * Strips all FiveM/GTA formatting codes from a server name.
 *
 * Applies a multi-pass regex pipeline:
 * 1. Strip caret codes (`^0`-`^9`, `^*`, `^d`, `^p`, `^q`, `^r`)
 * 2. Strip tilde tags (`~tagname~`)
 * 3. Remove zero-width Unicode characters and variation selectors
 * 4. Collapse multiple whitespace to a single space
 * 5. Trim leading/trailing whitespace
 *
 * @param raw - The raw server hostname with formatting codes
 * @returns The clean hostname with all formatting stripped
 *
 * @example
 * ```ts
 * sanitizeServerName("^1[^3RP^1] ^0Los Santos ^1Life")
 * // => "[RP] Los Santos Life"
 *
 * sanitizeServerName("~r~~bold~CITY RP~s~ | ~g~NOW HIRING")
 * // => "CITY RP | NOW HIRING"
 * ```
 */
export function sanitizeServerName(raw: string): string {
  let result = raw;

  // Step 1: Strip caret codes (^0-^9, ^*, ^d, ^p, ^q, ^r)
  result = result.replace(/\^[0-9*dpqr]/gi, '');

  // Step 2: Strip tilde format tags (~tagname~)
  result = result.replace(/~[a-zA-Z0-9_]+~/g, '');

  // Step 3: Remove zero-width Unicode characters, BOM, and variation selectors
  // U+200B-U+200F: Zero-width space, ZWNJ, ZWJ, LRM, RLM
  // U+2028-U+202F: Line/paragraph separators, embedding marks
  // U+FEFF: BOM / Zero-width no-break space
  // U+FE0E-U+FE0F: Variation selectors (text/emoji presentation)
  result = result.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\uFE0E\uFE0F]/g, '');

  // Step 4: Collapse multiple whitespace to single space
  result = result.replace(/\s+/g, ' ');

  // Step 5: Trim leading/trailing whitespace
  result = result.trim();

  return result;
}

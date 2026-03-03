import { describe, it, expect } from 'vitest';
import { sanitizeServerName } from './sanitizer.js';

describe('sanitizeServerName', () => {
  describe('caret codes', () => {
    it('strips caret digit codes', () => {
      expect(sanitizeServerName('^1Red ^0White')).toBe('Red White');
    });

    it('strips caret letter codes', () => {
      expect(sanitizeServerName('^dSpecial^r')).toBe('Special');
    });

    it('strips caret star code', () => {
      expect(sanitizeServerName('^*Bold')).toBe('Bold');
    });

    it('strips all caret code variants (^p, ^q)', () => {
      expect(sanitizeServerName('^pPastel^qQuiet')).toBe('PastelQuiet');
    });
  });

  describe('tilde format tags', () => {
    it('strips simple tilde format tags', () => {
      expect(sanitizeServerName('~r~Red~s~ Normal')).toBe('Red Normal');
    });

    it('strips complex tilde tags with underscores', () => {
      expect(sanitizeServerName('~HUD_COLOUR_BLUE~Blue')).toBe('Blue');
    });

    it('strips HC tilde tags', () => {
      expect(sanitizeServerName('~HC_123~Colored')).toBe('Colored');
    });

    it('strips bold/italic tilde tags', () => {
      expect(sanitizeServerName('~bold~Text~normal~')).toBe('Text');
    });
  });

  describe('zero-width and special Unicode characters', () => {
    it('removes zero-width joiners', () => {
      expect(sanitizeServerName('Hello\u200BWorld')).toBe('HelloWorld');
    });

    it('removes right-to-left marks', () => {
      expect(sanitizeServerName('Hello\u200FWorld')).toBe('HelloWorld');
    });

    it('removes variation selectors', () => {
      expect(sanitizeServerName('Star\uFE0EStar\uFE0F')).toBe('StarStar');
    });

    it('removes BOM character', () => {
      expect(sanitizeServerName('\uFEFFHello')).toBe('Hello');
    });
  });

  describe('whitespace normalization', () => {
    it('collapses multiple spaces', () => {
      expect(sanitizeServerName('Hello    World')).toBe('Hello World');
    });

    it('trims leading and trailing whitespace', () => {
      expect(sanitizeServerName('  Hello World  ')).toBe('Hello World');
    });
  });

  describe('combination and edge cases', () => {
    it('handles combination of caret, tilde, and formatting', () => {
      expect(sanitizeServerName('^1~bold~My ^3Server~s~ Name^0')).toBe('My Server Name');
    });

    it('returns empty string for name that is only formatting codes', () => {
      expect(sanitizeServerName('^1^2^3~r~~s~')).toBe('');
    });

    it('preserves emoji in server names', () => {
      expect(sanitizeServerName('My Server \u{1F680}')).toBe('My Server \u{1F680}');
    });

    it('handles already-clean names unchanged', () => {
      expect(sanitizeServerName('Clean Server Name')).toBe('Clean Server Name');
    });

    it('handles empty string input', () => {
      expect(sanitizeServerName('')).toBe('');
    });
  });

  describe('real-world server names', () => {
    it('sanitizes complex roleplay server name', () => {
      expect(
        sanitizeServerName('^1[^3RP^1] ^0Los Santos ^1Life ^0| ^3Custom Cars ^0| ^1Jobs')
      ).toBe('[RP] Los Santos Life | Custom Cars | Jobs');
    });

    it('sanitizes tilde-formatted server name', () => {
      expect(
        sanitizeServerName('~r~~bold~CITY RP~s~ | ~g~NOW HIRING')
      ).toBe('CITY RP | NOW HIRING');
    });
  });
});

import { describe, expect, it } from 'vitest';
import { buildDay, versionLine, versionParts } from '../version';

describe('buildDay', () => {
  it('spells the month, so 09/10 is never read as October', () => {
    expect(buildDay('2026-09-20T21:46:00.000Z')).toBe('20 Sep 2026');
  });

  it('says nothing rather than "Invalid Date" when the stamp is missing', () => {
    expect(buildDay('')).toBe('');
    expect(buildDay('not a date')).toBe('');
  });
});

describe('versionLine', () => {
  it('reads as one line the player can say out loud', () => {
    expect(versionLine('1.0.0', '1f5bd8e', '2026-09-20T21:46:00.000Z')).toBe(
      'Version 1.0.0 · 1f5bd8e · 20 Sep 2026',
    );
  });

  /* A checkout without git still builds — see vite.config.ts. The line has to
     hold up with any of the three missing, rather than showing bare separators. */
  it('drops what the build could not stamp', () => {
    expect(versionLine('1.0.0', '', '')).toBe('Version 1.0.0');
    expect(versionLine('1.0.0', '1f5bd8e', '')).toBe('Version 1.0.0 · 1f5bd8e');
    expect(versionLine('', '1f5bd8e', '2026-09-20T21:46:00.000Z')).toBe('1f5bd8e · 20 Sep 2026');
  });
});

describe('versionParts', () => {
  it('keeps the number and the build apart, so the sidebar can stack them', () => {
    expect(versionParts('1.0.0', '1f5bd8e', '2026-09-20T21:46:00.000Z')).toEqual({
      number: 'Version 1.0.0',
      build: '1f5bd8e · 20 Sep 2026',
    });
  });

  it('leaves out what the build could not stamp', () => {
    expect(versionParts('1.0.0', '', '')).toEqual({ number: 'Version 1.0.0', build: '' });
    expect(versionParts('', '1f5bd8e', '')).toEqual({ number: '', build: '1f5bd8e' });
  });
});

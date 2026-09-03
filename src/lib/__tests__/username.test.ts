import { describe, expect, it } from 'vitest';
import {
  HANDLE_RE,
  checkHandle,
  normaliseHandle,
  suggestHandle,
} from '../username';

/**
 * The claim itself needs Firestore; these are the rules that decide whether a
 * name is allowed, which is where the bugs that matter live. A handle is baked
 * into every song its owner shares, so a name that normalises two ways, or two
 * people who differ only in capitals, is not a cosmetic problem.
 */

describe('normaliseHandle', () => {
  it('lowercases, so Rory and rory are one person', () => {
    expect(normaliseHandle('Rory')).toBe('rory');
    expect(normaliseHandle('RORY')).toBe(normaliseHandle('rory'));
  });

  it('drops a leading @, which people type out of habit', () => {
    expect(normaliseHandle('@rory')).toBe('rory');
    expect(normaliseHandle('@@rory')).toBe('rory');
  });

  it('turns spaces into underscores rather than closing them up', () => {
    expect(normaliseHandle('Rory Neary')).toBe('rory_neary');
  });

  it('strips what a handle cannot contain', () => {
    expect(normaliseHandle('rory!<>#')).toBe('rory');
    expect(normaliseHandle('ro/ry')).toBe('rory');
  });

  it('is idempotent — normalising a normalised handle changes nothing', () => {
    for (const raw of ['@Rory Neary', 'RORY.n', 'a b c']) {
      expect(normaliseHandle(normaliseHandle(raw))).toBe(normaliseHandle(raw));
    }
  });

  it('agrees with the pattern the security rules enforce', () => {
    // A normalised handle that checkHandle accepts must also pass the rule,
    // or a claim the UI allows is rejected by the server.
    for (const raw of ['Rory', '@dave_b', 'jo.smith', 'Rory Neary']) {
      const handle = normaliseHandle(raw);
      if (checkHandle(raw).ok) expect(HANDLE_RE.test(handle)).toBe(true);
    }
  });
});

describe('checkHandle', () => {
  it('accepts ordinary names', () => {
    for (const ok of ['rory', 'dave_b', 'jo.smith', 'gtr99']) {
      expect(checkHandle(ok).ok).toBe(true);
    }
  });

  it('refuses an empty or too-short name', () => {
    expect(checkHandle('').ok).toBe(false);
    expect(checkHandle('r').ok).toBe(false);
  });

  it('refuses one longer than the rules allow', () => {
    expect(checkHandle('r'.repeat(25)).ok).toBe(false);
  });

  it('refuses a leading dot or underscore', () => {
    expect(checkHandle('.rory').ok).toBe(false);
    expect(checkHandle('_rory').ok).toBe(false);
  });

  it('refuses reserved names, so nobody shares a song "from support"', () => {
    expect(checkHandle('support').ok).toBe(false);
    expect(checkHandle('Admin').ok).toBe(false);
  });

  it('gives a reason a person can act on', () => {
    const problem = checkHandle('r');
    expect(problem.ok).toBe(false);
    if (!problem.ok) expect(problem.reason).toMatch(/least/i);
  });
});

describe('suggestHandle', () => {
  it('takes the local part of an email, never the domain', () => {
    expect(suggestHandle('rory@dataspinners.co.uk')).toBe('rory');
  });

  it('suggests nothing rather than something invalid', () => {
    expect(suggestHandle('a@b.com')).toBe('');
    expect(suggestHandle('support@x.com')).toBe('');
  });
});

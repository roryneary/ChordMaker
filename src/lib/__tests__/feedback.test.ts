import { describe, expect, it } from 'vitest';
import {
  MAX_BODY,
  MAX_MENTIONS,
  MAX_TITLE,
  excerpt,
  mentionId,
  mentionedHandles,
  parseMention,
  parsePost,
  parseThread,
  postProblem,
  postedWhen,
  replyCount,
  replyingTo,
  splitMentions,
  threadProblem,
} from '../feedback';
import { HANDLE_RE } from '../username';

/**
 * Who a post @-s decides who is told about it, so a name read wrongly is
 * somebody pinged who was not meant to be, or somebody missed who was.
 */

describe('mentionedHandles', () => {
  it('finds an @ at the start, the middle and the end', () => {
    expect(mentionedHandles('@rory the capo chip')).toEqual(['rory']);
    expect(mentionedHandles('what do you think @sam_b about it')).toEqual(['sam_b']);
    expect(mentionedHandles('over to you @jo')).toEqual(['jo']);
  });

  it('lowercases, so @Rory is the same person as @rory, and lists each once', () => {
    expect(mentionedHandles('@Rory and @rory and @RORY')).toEqual(['rory']);
  });

  it('keeps the order they were written in', () => {
    expect(mentionedHandles('@sam then @jo then @sam')).toEqual(['sam', 'jo']);
  });

  it('treats a dot at the end as the end of the sentence', () => {
    expect(mentionedHandles('thanks @rory.')).toEqual(['rory']);
    expect(mentionedHandles('thanks @rory...')).toEqual(['rory']);
    // A dot inside a handle is part of it.
    expect(mentionedHandles('@rory.n agreed')).toEqual(['rory.n']);
  });

  it('is not fooled by an email address', () => {
    expect(mentionedHandles('mail me at rory@example.com')).toEqual([]);
  });

  it('takes punctuation before the @', () => {
    expect(mentionedHandles('(@rory) and "@sam", @jo!')).toEqual(['rory', 'sam', 'jo']);
  });

  it('ignores what cannot be a handle', () => {
    expect(mentionedHandles('@ nothing, @a, @_x, @')).toEqual([]);
    expect(mentionedHandles(`@${'a'.repeat(25)}`)).toEqual([]);
  });

  it('only ever returns handles the claim rules would allow', () => {
    for (const h of mentionedHandles('@Rory.N @sam_b @jo.. @ab @x1_y.z')) {
      expect(h).toMatch(HANDLE_RE);
    }
  });
});

describe('splitMentions', () => {
  const texts = [
    'thanks @Rory.',
    '@sam first, then (@jo)',
    'nothing to see',
    '',
    'rory@example.com @a @ok',
  ];

  it('gives back the post exactly when joined', () => {
    for (const t of texts) {
      expect(splitMentions(t).map((p) => p.text).join('')).toBe(t);
    }
  });

  it('marks the mentions, keeping their case and leaving the full stop out', () => {
    expect(splitMentions('thanks @Rory.')).toEqual([
      { text: 'thanks ' },
      { text: '@Rory', handle: 'rory' },
      { text: '.' },
    ]);
  });

  it('agrees with mentionedHandles about who is mentioned', () => {
    for (const t of texts) {
      const found = splitMentions(t).flatMap((p) => ('handle' in p ? [p.handle] : []));
      expect([...new Set(found)]).toEqual(mentionedHandles(t));
    }
  });
});

describe('replyingTo', () => {
  it('puts the @ in front of an empty box', () => {
    expect(replyingTo('', 'rory')).toBe('@rory ');
  });

  it('puts it in front of what is already written', () => {
    expect(replyingTo('  good idea', 'rory')).toBe('@rory good idea');
  });

  it('does nothing when they are @-ed already', () => {
    expect(replyingTo('yes @Rory, agreed', 'rory')).toBe('yes @Rory, agreed');
  });
});

describe('what may be posted', () => {
  it('needs a title and words', () => {
    expect(threadProblem('', 'body')).toMatch(/line/);
    expect(threadProblem('   ', 'body')).toMatch(/line/);
    expect(threadProblem('Title', '  ')).toMatch(/nothing/);
    expect(threadProblem('Title', 'body')).toBeNull();
  });

  it('holds to the limits the rules hold to', () => {
    expect(threadProblem('x'.repeat(MAX_TITLE + 1), 'body')).not.toBeNull();
    expect(threadProblem('x'.repeat(MAX_TITLE), 'body')).toBeNull();
    expect(postProblem('x'.repeat(MAX_BODY + 1))).not.toBeNull();
    expect(postProblem('x'.repeat(MAX_BODY))).toBeNull();
  });

  it('refuses more people than one post may @', () => {
    const names = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff'];
    expect(postProblem(names.slice(0, MAX_MENTIONS).map((n) => `@${n}`).join(' '))).toBeNull();
    expect(postProblem(names.slice(0, MAX_MENTIONS + 1).map((n) => `@${n}`).join(' '))).toMatch(
      /At most/,
    );
  });
});

describe('excerpt', () => {
  it('leaves a short post alone, on one line', () => {
    expect(excerpt('one\n\ntwo   three')).toBe('one two three');
  });

  it('cuts a long one at a word', () => {
    const cut = excerpt('the quick brown fox jumps over the lazy dog', 20);
    expect(cut).toBe('the quick brown fox…');
    expect(cut.length).toBeLessThanOrEqual(21);
  });

  it('cuts inside a word only when there is no space worth cutting at', () => {
    expect(excerpt('a'.repeat(50), 10)).toBe(`${'a'.repeat(10)}…`);
  });
});

describe('postedWhen', () => {
  const now = new Date(2026, 8, 25, 12, 0).getTime();

  it('says how long ago, then the day', () => {
    expect(postedWhen(now - 20_000, now)).toBe('just now');
    expect(postedWhen(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(postedWhen(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(postedWhen(new Date(2026, 8, 20, 9).getTime(), now)).toBe('20 Sep');
    expect(postedWhen(new Date(2025, 11, 2).getTime(), now)).toBe('2 Dec 2025');
  });

  it('says "just now" for a clock that is slightly ahead', () => {
    expect(postedWhen(now + 30_000, now)).toBe('just now');
  });
});

describe('replyCount', () => {
  it('does not count the opening post as a reply', () => {
    expect(replyCount({ postCount: 1 })).toBe('No replies yet');
    expect(replyCount({ postCount: 2 })).toBe('1 reply');
    expect(replyCount({ postCount: 4 })).toBe('3 replies');
  });
});

describe('mentionId', () => {
  it('is one per person per post', () => {
    expect(mentionId('p1', 'u1')).toBe('p1_u1');
    expect(mentionId('p1', 'u1')).toBe(mentionId('p1', 'u1'));
    expect(mentionId('p1', 'u1')).not.toBe(mentionId('p1', 'u2'));
  });
});

describe('reading what the database holds', () => {
  it('reads a thread, and refuses one with no author or title', () => {
    const t = parseThread('t1', {
      authorUid: 'u1',
      handle: 'rory',
      display: 'Rory',
      title: 'Capo',
      postCount: 3,
      lastPostId: 'p3',
      lastBy: 'Sam',
      createdAt: 1,
      updatedAt: 5,
    });
    expect(t).toMatchObject({ id: 't1', title: 'Capo', postCount: 3, lastBy: 'Sam', updatedAt: 5 });
    expect(parseThread('t', { handle: 'rory', title: 'x' })).toBeNull();
    expect(parseThread('t', { authorUid: 'u', handle: 'rory' })).toBeNull();
    expect(parseThread('t', null)).toBeNull();
  });

  it('fills what a thread leaves out from what it has', () => {
    const t = parseThread('t', { authorUid: 'u', handle: 'rory', title: 'x', createdAt: 7 });
    expect(t).toMatchObject({ display: 'rory', lastBy: 'rory', postCount: 1, updatedAt: 7 });
  });

  it('reads a post, keeping only the uids that are strings', () => {
    const p = parsePost('t1', 'p1', {
      authorUid: 'u1',
      handle: 'rory',
      body: 'hi @sam',
      mentions: ['u2', 3, null],
      createdAt: 9,
    });
    expect(p).toMatchObject({ threadId: 't1', id: 'p1', display: 'rory', mentions: ['u2'] });
    expect(parsePost('t', 'p', { authorUid: 'u', handle: 'h' })).toBeNull();
  });

  it('reads a notice, and refuses one that points nowhere', () => {
    const m = parseMention('p1_u2', {
      toUid: 'u2',
      fromUid: 'u1',
      fromHandle: 'rory',
      threadId: 't1',
      postId: 'p1',
      title: 'Capo',
      excerpt: 'hi',
      createdAt: 3,
    });
    expect(m).toMatchObject({ fromDisplay: 'rory', threadId: 't1', postId: 'p1' });
    expect(parseMention('x', { toUid: 'u2', fromUid: 'u1', threadId: 't1' })).toBeNull();
  });
});

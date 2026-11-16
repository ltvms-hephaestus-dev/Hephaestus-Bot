import { describe, expect, it } from 'vitest';
import { check, checkBlank, getPath, normalize } from '../src/lib/check';
import { LevelSchema, type Level } from '../src/lib/schema';
import { highlight } from '../src/lib/highlight';

const base = {
  id: 'x',
  title: 'X',
  concepts: ['c'],
  lesson: 'l',
  goal: 'g',
  hints: ['h'],
  success: 's',
  links: [
    { title: 'a', url: 'https://a.example', kind: 'docs' },
    { title: 'b', url: 'https://b.example', kind: 'docs' },
  ],
};
const deps = { countTokens: async (t: string) => t.split(/\s+/).filter(Boolean).length };
const make = (extra: object): Level => LevelSchema.parse({ ...base, ...extra });

describe('normalize', () => {
  it('trims, strips quotes and lowercases', () => {
    expect(normalize('  "Hammer" ')).toBe('hammer');
    expect(normalize("'A b'", true)).toBe('A b');
  });
});

describe('blanks', () => {
  const b = (accept: any, extra = {}) => ({ accept, ...extra });
  it('equals and oneOf', async () => {
    expect(await checkBlank('Hammer', b({ equals: 'hammer' }))).toBe(true);
    expect(await checkBlank('Hammer', b({ equals: 'hammer' }, { caseSensitive: true }))).toBe(false);
    expect(await checkBlank('>=', b({ oneOf: ['>', '>='] }))).toBe(true);
    expect(await checkBlank('', b({ equals: '' }))).toBe(false);
  });
  it('numbers', async () => {
    expect(await checkBlank('0', b({ number: { eq: 0 } }))).toBe(true);
    expect(await checkBlank('0.0', b({ number: { eq: 0 } }))).toBe(true);
    expect(await checkBlank('0.7', b({ number: { min: 0.5, max: 1 } }))).toBe(true);
    expect(await checkBlank('1.2', b({ number: { min: 0.5, max: 1 } }))).toBe(false);
    expect(await checkBlank('zero', b({ number: { eq: 0 } }))).toBe(false);
  });
  it('regex is anchored and survives a broken pattern', async () => {
    expect(await checkBlank('tools/call', b({ regex: 'tools/(call|list)' }))).toBe(true);
    expect(await checkBlank('xtools/call', b({ regex: 'tools/(call|list)' }))).toBe(false);
    expect(await checkBlank('a', b({ regex: '(' }))).toBe(false);
  });
  it('token counts use the tokenizer it is given', async () => {
    expect(await checkBlank('"one two three"', b({ tokenCount: { eq: 3 } }), deps)).toBe(true);
    expect(await checkBlank('one two', b({ tokenCount: { eq: 3 } }), deps)).toBe(false);
  });
});

describe('challenge types', () => {
  it('fill reports each blank', async () => {
    const l = make({
      challenge: { type: 'fill', code: { python: '{{a}} {{b}}', typescript: '{{a}} {{b}}' }, blanks: { a: { accept: { equals: '1' } }, b: { accept: { equals: '2' }, feedback: 'b is wrong' } } },
      solution: { a: '1', b: '2' },
    });
    const res = await check(l, { a: '1', b: '9' });
    expect(res.ok).toBe(false);
    expect(res.blanks).toEqual({ a: true, b: false });
    expect(res.feedback).toEqual(['b is wrong']);
  });

  it('choice needs exactly the right set', async () => {
    const l = make({
      challenge: { type: 'choice', multiple: true, options: [{ id: 'a', text: 'A', correct: true }, { id: 'b', text: 'B', correct: true }, { id: 'c', text: 'C', why: 'no' }] },
    });
    expect((await check(l, ['a', 'b'])).ok).toBe(true);
    expect((await check(l, ['a'])).ok).toBe(false);
    expect((await check(l, ['a', 'b', 'c'])).feedback).toEqual(['no']);
  });

  it('order points at the first wrong step', async () => {
    const l = make({ challenge: { type: 'order', items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }] } });
    expect((await check(l, ['a', 'b', 'c'])).ok).toBe(true);
    expect((await check(l, ['a', 'c', 'b'])).feedback[0]).toMatch(/step 2/);
  });

  it('json applies rules and explains bad JSON', async () => {
    const l = make({
      challenge: {
        type: 'json',
        starter: '{}',
        rules: [
          { path: 'method', op: 'equals', value: 'tools/call', message: 'method' },
          { path: 'params.arguments.city', op: 'type', value: 'string', message: 'city' },
          { path: 'tags', op: 'includes', value: 'x', message: 'tags' },
        ],
      },
      solution: '{"method":"tools/call","params":{"arguments":{"city":"Paris"}},"tags":["x"]}',
    });
    expect((await check(l, l.solution)).ok).toBe(true);
    expect((await check(l, '{"method":"tools/call"}')).feedback).toEqual(['city', 'tags']);
    expect((await check(l, '{oops')).feedback[0]).toMatch(/not valid JSON/);
    expect(getPath({ a: [{ b: 1 }] }, 'a.0.b')).toBe(1);
  });
});

describe('schema catches authoring mistakes', () => {
  it('blank used in code but not defined', () => {
    const r = LevelSchema.safeParse({ ...base, challenge: { type: 'fill', code: { python: '{{a}}', typescript: '{{b}}' }, blanks: { a: { accept: { equals: '1' } } } }, solution: { a: '1' } });
    expect(r.success).toBe(false);
  });
  it('choice with no correct option', () => {
    const r = LevelSchema.safeParse({ ...base, challenge: { type: 'choice', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] } });
    expect(r.success).toBe(false);
  });
  it('a stray or misspelt key is refused instead of silently dropped', () => {
    const order = { type: 'order', items: [{ id: 'a', text: 'A', oops: null }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }] };
    expect(LevelSchema.safeParse({ ...base, challenge: order }).success).toBe(false);
    const ok = { type: 'order', items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }] };
    expect(LevelSchema.safeParse({ ...base, challenge: ok }).success).toBe(true);
    expect(LevelSchema.safeParse({ ...base, challenge: ok, hint: 'typo' }).success).toBe(false);
  });

  it('http links are refused', () => {
    const r = LevelSchema.safeParse({ ...base, links: [{ title: 'a', url: 'http://a.example', kind: 'docs' }, base.links[1]], challenge: { type: 'order', items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }] } });
    expect(r.success).toBe(false);
  });
});

describe('highlight', () => {
  it('keeps every character and tags the obvious tokens', () => {
    const line = 'x = embed("king")  # comment';
    const toks = highlight(line, 'python');
    expect(toks.map((t) => t.text).join('')).toBe(line);
    expect(toks.find((t) => t.cls === 's')?.text).toBe('"king"');
    expect(toks.find((t) => t.cls === 'c')?.text).toBe('# comment');
    expect(highlight('const a = 1; // hi', 'typescript').find((t) => t.cls === 'k')?.text).toBe('const');
  });

  it('never splits a blank marker, in or out of a string', () => {
    const blank = '\uE000temp\uE001';
    for (const line of [`temperature=${blank},`, `x = "${blank}"`, `  temperature: ${blank},`]) {
      const toks = highlight(line, 'python').concat(highlight(line, 'typescript'));
      expect(toks.some((t) => t.text.includes(blank))).toBe(true);
    }
  });
});

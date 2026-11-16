/**
 * The gates that keep the game honest. If a lesson is added that cannot be solved
 * with its own reference answer, or accepts a wrong one, the build fails here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { check, referenceAnswer } from '../src/lib/check';
import { loadBeyond, loadWorlds, topicTree } from '../src/lib/content';
import { LevelSchema } from '../src/lib/schema';
import { TEMPLATES } from '../src/lib/templates';
import { analogy, fitWindow, reshape, SCENE_NAMES } from '../src/scenes';

const worlds = loadWorlds();
const levels = worlds.flatMap((w) => w.levels.map((l) => ({ w, l, name: `${w.id}/${l.id}` })));

describe('worlds', () => {
  it('load, in order, with unique ids', () => {
    expect(worlds.length).toBeGreaterThan(0);
    expect(worlds.map((w) => w.order)).toEqual([...worlds.map((w) => w.order)].sort((a, b) => a - b));
    expect(new Set(worlds.map((w) => w.order)).size).toBe(worlds.length);
  });

  it('every world has lessons or a plan', () => {
    for (const w of worlds) expect(w.levels.length + (w.planned?.length ?? 0), w.id).toBeGreaterThan(0);
  });

  it('the first world is fully written', () => {
    expect(worlds[0]!.levels.length).toBeGreaterThanOrEqual(7);
    expect(worlds[0]!.planned ?? []).toHaveLength(0);
  });
});

describe.each(levels)('level $name', ({ l }) => {
  it('uses a scene the game has', () => {
    expect(SCENE_NAMES).toContain(l.scene.type);
  });

  it('accepts its reference solution', async () => {
    const res = await check(l, referenceAnswer(l));
    expect(res.feedback).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it('rejects an empty answer', async () => {
    const empty = l.challenge.type === 'fill' ? {} : l.challenge.type === 'json' ? '' : [];
    expect((await check(l, empty)).ok).toBe(false);
  });

  it('rejects its authored wrong answer', async () => {
    expect(l.wrong, 'add a "wrong:" answer to the lesson file').toBeDefined();
    const res = await check(l, l.wrong);
    expect(res.ok).toBe(false);
    expect(res.feedback.length).toBeGreaterThan(0);
  });

  it('has the same blanks in Python and TypeScript', () => {
    if (l.challenge.type !== 'fill') return;
    const names = (code: string) => [...new Set([...code.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))].sort();
    expect(names(l.challenge.code.python)).toEqual(names(l.challenge.code.typescript));
  });

  it('keeps code lines short enough to read without scrolling', () => {
    const c = l.challenge;
    if (c.type !== 'fill' && !(c.type === 'choice' && c.code)) return;
    for (const code of Object.values(c.code!)) {
      for (const line of code.split('\n')) {
        expect(line.replace(/\{\{\w+\}\}/g, '________').length, line).toBeLessThanOrEqual(58);
      }
    }
  });

  it('keeps the lesson short and the links secure', () => {
    expect(l.lesson.split(/\s+/).length, 'lesson is over 250 words').toBeLessThanOrEqual(250);
    for (const link of l.links) expect(link.url.startsWith('https://')).toBe(true);
    expect(new Set(l.links.map((x) => x.url)).size).toBe(l.links.length);
  });
});

describe('scenes agree with the lessons that use them', () => {
  const find = (id: string) => levels.find((x) => x.l.id === id)!.l;

  it('next-token: the answer is the most likely token on the board', () => {
    const l = find('next-token');
    const tokens = l.scene.tokens as [string, number][];
    const top = [...tokens].sort((a, b) => b[1] - a[1])[0]![0];
    expect((l.solution as Record<string, string>).word).toBe(top);
  });

  it('embeddings: the reference word really lands on the target', () => {
    const l = find('embeddings');
    const s = l.scene as any;
    const word = (l.solution as Record<string, string>).word!;
    expect(analogy(s.points, s.expr.start, s.expr.minus, word)?.nearest).toBe('queen');
    expect(analogy(s.points, s.expr.start, s.expr.minus, 'girl')?.nearest).not.toBe('queen');
  });

  it('attention: the answer has the highest weight, and the variant flips it', () => {
    const l = find('attention');
    const s = l.scene as any;
    const top = (tokens: string[], weights: number[]) => tokens[weights.indexOf(Math.max(...weights))];
    expect(top(s.tokens, s.weights)).toBe((l.solution as Record<string, string>).word);
    expect(top(s.alt.tokens, s.alt.weights)).toBe('suitcase');
    expect(s.tokens.length).toBe(s.weights.length);
  });

  it('sampling: temperature 0 leaves a single possible answer', () => {
    const l = find('sampling');
    const base = (l.scene.tokens as [string, number][]).map((t) => t[1]);
    expect(reshape(base, 0, 1).p.filter((p) => p > 0)).toHaveLength(1);
    expect(reshape(base, 1, 1).p.filter((p) => p > 0).length).toBe(base.length);
    expect(reshape(base, 1, 0.9).cut.filter(Boolean).length).toBeGreaterThan(0);
  });

  it('context window: 128 is the smallest size that keeps the first message', () => {
    const l = find('context-window');
    const msgs = (l.scene as any).messages;
    const keeps = (n: number) => fitWindow(msgs, n)[0];
    expect(keeps(64)).toBe(false);
    expect(keeps(128)).toBe(true);
    expect((l.solution as Record<string, string>).size).toBe('128');
  });
});

describe('extensibility', () => {
  it('every Forge template is a valid lesson that its own solution solves', async () => {
    for (const [name, t] of Object.entries(TEMPLATES)) {
      const parsed = LevelSchema.safeParse(YAML.parse(t.yaml));
      expect(parsed.success, `template ${name}: ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`).toBe(true);
      if (parsed.success) expect((await check(parsed.data, referenceAnswer(parsed.data))).ok, name).toBe(true);
    }
  });

  it('the topic map contains every level and concept', () => {
    const tree = JSON.stringify(topicTree(worlds, (p) => `/${p}`, 'root'));
    for (const { l } of levels) {
      expect(tree).toContain(l.title.replace(/"/g, '&quot;'));
    }
  });

  it('the beyond page has links for every topic', () => {
    const b = loadBeyond();
    expect(b.sections.length).toBeGreaterThanOrEqual(4);
    for (const s of b.sections) for (const t of s.topics) expect(t.links.length, t.title).toBeGreaterThan(0);
  });

  it('no MCP lesson teaches the removed handshake as current', () => {
    const dir = path.resolve('content/worlds');
    for (const w of fs.readdirSync(dir)) {
      for (const f of fs.readdirSync(path.join(dir, w))) {
        const text = fs.readFileSync(path.join(dir, w, f), 'utf8');
        expect(/Mcp-Session-Id/i.test(text) && !/removed|no longer|older|before 2026/i.test(text), `${w}/${f}`).toBe(false);
      }
    }
  });
});

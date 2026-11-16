/**
 * The gates that keep the game honest. If a lesson is added that cannot be solved
 * with its own reference answer, or accepts a wrong one, the build fails here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { check, checkBlank, referenceAnswer } from '../src/lib/check';
import { loadBeyond, loadWorlds, topicTree } from '../src/lib/content';
import { LevelSchema } from '../src/lib/schema';
import { TEMPLATES } from '../src/lib/templates';
import { analogy, bill, fitWindow, reshape, resolveMessages, runLoop, SCENE_NAMES, streamTiming, topK } from '../src/scenes';

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

describe('request/reply boards agree with their lessons (World 2)', () => {
  const find = (id: string) => levels.find((x) => x.l.id === id)!.l;
  const asValues = (l: ReturnType<typeof find>, answer: unknown): Record<string, string> =>
    l.challenge.type === 'fill'
      ? (answer as Record<string, string>)
      : l.challenge.type === 'choice'
        ? { choice: (answer as string[]).join(',') }
        : l.challenge.type === 'order'
          ? { order: (answer as string[]).join(',') }
          : { json: answer as string };
  const view = (id: string, answer: unknown) => resolveMessages(find(id).scene, asValues(find(id), answer));

  it('every request/reply board shows a clean reply for the reference answer', () => {
    for (const { l } of levels.filter((x) => x.l.scene.type === 'messages')) {
      const v = resolveMessages(l.scene, asValues(l, referenceAnswer(l)));
      expect(v.error, l.id).toBeUndefined();
      expect(v.pending, l.id).toBe(false);
      expect(v.reply, l.id).toBeDefined();
    }
  });

  it('one HTTP request: the limit cuts the reply exactly where the lesson says', () => {
    const l = find('one-http-request');
    const tokens = (l.scene as any).reply.tokens as string[];
    expect(tokens).toHaveLength(12);
    expect(view('one-http-request', { role: 'user', max: '12' }).reply).toMatchObject({ cut: false, stopReason: 'end_turn' });
    expect(view('one-http-request', { role: 'user', max: '11' }).reply).toMatchObject({ cut: true, stopReason: 'max_tokens' });
    expect(view('one-http-request', l.wrong).reply?.cut).toBe(true);
    expect(view('one-http-request', { role: 'robot', max: '100' }).error).toMatch(/not a role/);
    expect(view('one-http-request', { role: 'user', max: '0' }).error).toMatch(/at least 1/);
    expect(view('one-http-request', { role: 'user', max: '' }).pending).toBe(true);
  });

  it('who is speaking: the system prompt only applies with the right parameter and roles', () => {
    expect(view('who-is-speaking', { param: 'system', who: 'assistant' }).system).toMatch(/blacksmith/);
    expect(view('who-is-speaking', { param: 'system', who: 'user' }).note).toBeDefined();
    expect(view('who-is-speaking', { param: 'instructions', who: 'assistant' }).error).toMatch(/Unknown parameter/);
    expect(view('who-is-speaking', { param: 'system', who: 'robot' }).error).toMatch(/not a role/);
  });

  it('nothing is remembered: the robot knows the name only when the history is sent', async () => {
    const l = find('nothing-is-remembered');
    const blank = (l.challenge as any).blanks.sent;
    for (const good of ['history + [question]', 'history+[question]', '[...history, question]', '[ ...history, question, ]']) {
      expect(await checkBlank(good, blank), good).toBe(true);
      const v = view('nothing-is-remembered', { sent: good });
      expect(v.messages, good).toHaveLength(3);
      expect(v.reply?.content).toMatch(/Ada/);
    }
    for (const bad of ['[question]', 'question', 'history', 'messages', '[question] + history']) {
      expect(await checkBlank(bad, blank), bad).toBe(false);
    }
    expect(view('nothing-is-remembered', { sent: '[question]' }).messages).toHaveLength(1);
    expect(view('nothing-is-remembered', { sent: '[question]' }).reply?.content).not.toMatch(/Ada/);
    expect(view('nothing-is-remembered', { sent: 'history' }).messages).toHaveLength(2);
    expect(view('nothing-is-remembered', { sent: 'everything' }).error).toBeDefined();
  });

  it('word by word: streaming changes the first words, not the finish', () => {
    const tokens = (find('word-by-word').scene as any).reply.tokens as string[];
    const on = streamTiming(tokens.length, true);
    const off = streamTiming(tokens.length, false);
    expect(on.total).toBe(off.total);
    expect(on.first).toBeLessThan(off.first);
    expect([on.first, off.first]).toEqual([0.2, 3.2]); // the numbers quoted in the success text
    expect(view('word-by-word', { on: 'maybe' }).error).toBeDefined();
    expect(view('word-by-word', { on: 'False' }).reply).toBeDefined();
  });

  it('counting the cost: the answer is the price list, and the totals in the text are right', () => {
    const l = find('counting-the-cost');
    const s = l.scene as any;
    const sol = l.solution as Record<string, string>;
    expect([Number(sol.in_price), Number(sol.out_price)]).toEqual([s.prices.input, s.prices.output]);
    const cost = bill(s.usage, s.prices.input, s.prices.output);
    expect(cost.total).toBeCloseTo(0.0135, 6);
    expect(cost.total * 10000).toBeCloseTo(135, 6);
    expect(cost.output).toBeGreaterThan(cost.input);
  });

  it('saying what you mean: every option shows its own reply, and only the right one is two lines', () => {
    const l = find('saying-what-you-mean');
    if (l.challenge.type !== 'choice') throw new Error('expected a choice challenge');
    expect(view('saying-what-you-mean', []).pending).toBe(true);
    for (const o of l.challenge.options) {
      const v = view('saying-what-you-mean', [o.id]);
      expect(v.reply, o.id).toBeDefined();
      expect(/\nPriority: (low|medium|high)$/.test(v.reply!.content), o.id).toBe(!!o.correct);
    }
  });

  it('answers your code can read: the reply only becomes valid once the schema has the enum', () => {
    const l = find('answers-your-code-can-read');
    const before = JSON.parse(view('answers-your-code-can-read', l.wrong).reply!.content);
    const after = JSON.parse(view('answers-your-code-can-read', l.solution).reply!.content);
    expect(['low', 'medium', 'high']).not.toContain(before.priority);
    expect(['low', 'medium', 'high']).toContain(after.priority);
    expect(JSON.parse((l.challenge as any).starter)).toBeTypeOf('object');
  });
});

describe('the full path is written', () => {
  it('has 45 levels in 7 worlds and nothing left planned', () => {
    expect(worlds.map((w) => w.levels.length)).toEqual([7, 7, 7, 7, 7, 6, 4]);
    expect(levels).toHaveLength(45);
    for (const w of worlds) expect(w.planned ?? [], w.id).toHaveLength(0);
  });

  it('every level id is unique across the whole game', () => {
    expect(new Set(levels.map((x) => x.l.id)).size).toBe(levels.length);
  });
});

describe('boards agree with their lessons (Worlds 3 to 7)', () => {
  const find = (id: string) => levels.find((x) => x.l.id === id)!.l;
  const view = (id: string, values: Record<string, string>) => resolveMessages(find(id).scene, values);

  it('search by meaning: the answer keeps both refund passages and nothing else', () => {
    const l = find('search-by-meaning');
    const chunks = (l.scene as any).chunks as { text: string; score: number }[];
    const k = Number((l.solution as Record<string, string>).k);
    const picked = topK(chunks, k);
    expect(picked.every((c) => c.score > 0.7)).toBe(true);
    expect(chunks.filter((c) => c.score > 0.7)).toHaveLength(k);
    expect(topK(chunks, 0)).toEqual([]);
    expect(topK(chunks, 1)[0]!.text).toMatch(/Refunds/);
    expect(picked[0]!.text.toLowerCase()).not.toMatch(/money|back/); // no shared keywords, as the note says
  });

  it('a loop with tools: only the right stop reason lets the agent finish', () => {
    const s = find('a-loop-with-tools').scene as any;
    expect(new RegExp(s.gate, 'i').test('tool_use')).toBe(true);
    expect(new RegExp(s.gate, 'i').test('end_turn')).toBe(false);
    expect(runLoop(s.steps, 99, true)).toEqual({ ran: s.steps.length, outcome: 'finished' });
    expect(runLoop(s.steps, 99, false)).toEqual({ ran: 1, outcome: 'no-loop' });
  });

  it('knowing when to stop: the accepted range is exactly the budgets that finish within policy', () => {
    const l = find('knowing-when-to-stop');
    const steps = (l.scene as any).steps;
    const needed = steps.filter((s: any) => s.who === 'model').length;
    const accept = (l.challenge as any).blanks.n.accept.number;
    expect(accept).toEqual({ min: needed, max: 10 });
    expect(runLoop(steps, needed - 1).outcome).toBe('budget');
    expect(runLoop(steps, needed).outcome).toBe('finished');
    expect(runLoop(steps, 2).ran).toBe(4); // found the cause, never opened the ticket
    expect(runLoop(steps, 0).outcome).toBe('idle');
  });

  it('describing a tool: the model only calls the tool correctly with a description and a required city', () => {
    const l = find('describing-a-tool');
    expect(view('describing-a-tool', { json: l.solution as string }).reply?.content).toMatch(/"city": "Lisbon"/);
    expect(view('describing-a-tool', { json: (l.challenge as any).starter }).reply?.stopReason).toBe('end_turn');
    const noRequired = (l.solution as string).replace('"required": ["city"]', '"required": []');
    expect(view('describing-a-tool', { json: noRequired }).reply?.content).toMatch(/input: \{\}/);
  });

  it('when tools fail: only the error result lets the model correct itself', () => {
    expect(view('when-tools-fail', { choice: 'error' }).reply?.content).toMatch(/"Lisbon"/);
    expect(view('when-tools-fail', { choice: 'crash' }).error).toBeDefined();
    expect(view('when-tools-fail', { choice: 'fake' }).reply?.content).toMatch(/sunny/);
  });

  it('MCP levels use the current revision and the stateless headers', () => {
    const l = find('how-messages-travel');
    expect((l.solution as Record<string, string>).version).toBe('2026-07-28');
    expect(view('how-messages-travel', { version: '2026-07-28' }).error).toBeUndefined();
    expect(view('how-messages-travel', { version: '2024-11-05' }).error).toMatch(/Unsupported protocol version/);
    expect(view('how-messages-travel', {}).pending).toBe(true);
    const text = JSON.stringify(l);
    for (const header of ['MCP-Protocol-Version', 'Mcp-Method', 'Mcp-Name']) expect(text).toContain(header);
    expect(view('reading-the-wire', { json: find('reading-the-wire').solution as string }).reply?.content).toMatch(/"isError": false/);
    expect(view('write-a-server', { kind: 'tool' }).reply?.content).toMatch(/search_tickets/);
    expect(view('write-a-server', { kind: 'resource' }).reply?.content).toMatch(/tools: \[ \]/);
    expect(view('write-a-server', { kind: 'thing' }).error).toBeDefined();
  });

  it('reading a trace: the numbers add up and the answer is the step where input jumped', () => {
    const l = find('reading-a-trace');
    const metas = ((l.scene as any).messages as { meta?: string }[]).map((m) => m.meta ?? '');
    const inputs = metas.map((m) => /input ([\d,]+)/.exec(m)?.[1]).filter(Boolean).map((n) => Number(n!.replace(/,/g, '')));
    expect(inputs.reduce((a, b) => a + b, 0)).toBe(102500);
    expect(String((l.scene as any).reply)).toContain('102,500');
    const seconds = metas.map((m) => /([\d.]+) s$/.exec(m)?.[1]).filter(Boolean).map(Number);
    expect(Math.round(seconds.reduce((a, b) => a + b, 0))).toBe(29);
    expect(metas[Number((l.solution as Record<string, string>).step)]).toMatch(/returns 48,000 tokens/);
  });

  it('fix a broken run: the right name ends the run, any other repeats the failure', () => {
    expect(view('fix-a-broken-run', { param: 'status' }).reply?.content).toMatch(/closed/);
    expect(view('fix-a-broken-run', { param: 'state' }).reply?.content).toMatch(/budget used up/);
    expect(view('fix-a-broken-run', {}).reply?.content).toMatch(/budget used up/);
  });

  it('every clickable option on a request/reply board shows its own outcome', () => {
    for (const { l } of levels) {
      if (l.scene.type !== 'messages' || l.challenge.type !== 'choice' || l.challenge.multiple) continue;
      if (!((l.scene as any).needs ?? []).includes('choice')) continue;
      const seen = new Set<string>();
      for (const o of l.challenge.options) {
        const v = resolveMessages(l.scene, { choice: o.id });
        expect(v.reply ?? v.error, `${l.id}/${o.id}`).toBeDefined();
        seen.add(JSON.stringify([v.reply?.content, v.error, v.note, v.messages]));
      }
      expect(seen.size, l.id).toBe(l.challenge.options.length);
    }
  });
});

describe('lesson files', () => {
  it('have no text silently cut off by a YAML comment', () => {
    // In YAML, " #" starts a comment outside quotes. "Ticket #482 is open" would lose its ending.
    const dir = path.resolve('content/worlds');
    for (const w of fs.readdirSync(dir)) {
      for (const f of fs.readdirSync(path.join(dir, w))) {
        let inBlock = -1;
        for (const [i, line] of fs.readFileSync(path.join(dir, w, f), 'utf8').split('\n').entries()) {
          const indent = line.search(/\S/);
          if (inBlock >= 0 && (indent > inBlock || indent === -1)) continue;
          inBlock = /:\s*[|>][-+]?\s*$/.test(line) ? indent : -1;
          const bare = line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'/g, '""');
          expect(/\S\s+#/.test(bare), `${w}/${f}:${i + 1} ${line.trim()}`).toBe(false);
        }
      }
    }
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

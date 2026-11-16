/**
 * Decides whether an answer is right. Pure and deterministic: no DOM, no network,
 * no model. This is the only place correctness is decided, so CI can prove every
 * reference solution.
 */
import type { Accept, Answer, Blank, Level } from './schema';

export interface CheckResult {
  ok: boolean;
  /** Human-readable lines explaining what is wrong. Empty when ok. */
  feedback: string[];
  /** For fill challenges: which blanks are right. */
  blanks?: Record<string, boolean>;
}

export interface CheckDeps {
  countTokens: (text: string) => Promise<number>;
}

const defaultDeps: CheckDeps = {
  countTokens: async (text) => (await import('./tokenizer')).countTokens(text),
};

/** Players often type quotes around a string. Treat `"mat"` and `mat` the same. */
export function normalize(raw: string, caseSensitive = false): string {
  let s = raw.trim();
  const m = s.match(/^(["'`])(.*)\1$/s);
  if (m) s = m[2]!.trim();
  return caseSensitive ? s : s.toLowerCase();
}

function inRange(n: number, rule: { eq?: number; min?: number; max?: number }): boolean {
  if (rule.eq !== undefined && n !== rule.eq) return false;
  if (rule.min !== undefined && n < rule.min) return false;
  if (rule.max !== undefined && n > rule.max) return false;
  return true;
}

export async function checkBlank(raw: string, blank: Blank, deps: CheckDeps = defaultDeps): Promise<boolean> {
  const accept: Accept = blank.accept;
  const cs = blank.caseSensitive ?? false;
  const value = normalize(raw ?? '', cs);
  if (value === '') return false;
  if ('equals' in accept) return value === normalize(accept.equals, cs);
  if ('oneOf' in accept) return accept.oneOf.some((a) => value === normalize(a, cs));
  if ('regex' in accept) {
    try {
      return new RegExp(`^(?:${accept.regex})$`, cs ? '' : 'i').test(raw.trim());
    } catch {
      return false;
    }
  }
  if ('number' in accept) {
    if (!/^-?\d+(\.\d+)?$/.test(value)) return false;
    return inRange(Number(value), accept.number);
  }
  if ('tokenCount' in accept) {
    const text = raw.trim().replace(/^(["'`])(.*)\1$/s, '$2');
    return inRange(await deps.countTokens(text), accept.tokenCount);
  }
  return false;
}

/** Read "a.b.0.c" out of a JSON value. */
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split('.').filter(Boolean)) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function jsonRuleHolds(root: unknown, rule: { path: string; op: string; value?: unknown }): boolean {
  const v = getPath(root, rule.path);
  switch (rule.op) {
    case 'exists':
      return v !== undefined;
    case 'equals':
      return JSON.stringify(v) === JSON.stringify(rule.value);
    case 'type':
      return typeOf(v) === rule.value;
    case 'includes':
      if (Array.isArray(v)) return v.some((x) => JSON.stringify(x) === JSON.stringify(rule.value));
      if (typeof v === 'string') return v.toLowerCase().includes(String(rule.value).toLowerCase());
      return false;
    case 'matches':
      try {
        return typeof v === 'string' && new RegExp(String(rule.value), 'i').test(v);
      } catch {
        return false;
      }
    case 'minLength':
      return (typeof v === 'string' || Array.isArray(v)) && v.length >= Number(rule.value);
    default:
      return false;
  }
}

export async function check(level: Level, answer: Answer | undefined, deps: CheckDeps = defaultDeps): Promise<CheckResult> {
  const c = level.challenge;

  if (c.type === 'fill') {
    const given = (answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {}) as Record<string, string>;
    const blanks: Record<string, boolean> = {};
    const feedback: string[] = [];
    for (const [name, blank] of Object.entries(c.blanks)) {
      const raw = given[name] ?? '';
      const ok = await checkBlank(raw, blank, deps);
      blanks[name] = ok;
      if (!ok) feedback.push(raw.trim() === '' ? `Fill in the blank "${name}".` : blank.feedback ?? `"${raw.trim()}" is not right for "${name}".`);
    }
    return { ok: feedback.length === 0, feedback, blanks };
  }

  if (c.type === 'choice') {
    const picked = new Set(Array.isArray(answer) ? answer : []);
    if (picked.size === 0) return { ok: false, feedback: ['Pick an answer first.'] };
    const feedback: string[] = [];
    let ok = true;
    for (const o of c.options) {
      const want = !!o.correct;
      const has = picked.has(o.id);
      if (want !== has) {
        ok = false;
        if (has && o.why) feedback.push(o.why);
      }
    }
    if (!ok && feedback.length === 0) feedback.push(c.multiple ? 'Not quite: check which options you ticked.' : 'Not that one.');
    return { ok, feedback: ok ? [] : feedback };
  }

  if (c.type === 'order') {
    const given = Array.isArray(answer) ? answer : [];
    const want = c.items.map((i) => i.id);
    if (given.length !== want.length) return { ok: false, feedback: ['Put every step in the list.'] };
    const firstWrong = want.findIndex((id, i) => given[i] !== id);
    if (firstWrong === -1) return { ok: true, feedback: [] };
    if (firstWrong === 0) return { ok: false, feedback: ['The first step is not right yet. What has to exist before anything else can happen?'] };
    return { ok: false, feedback: [`The first ${firstWrong} step${firstWrong === 1 ? ' is' : 's are'} in place. Look at step ${firstWrong + 1}.`] };
  }

  // json
  const text = typeof answer === 'string' ? answer : '';
  if (text.trim() === '') return { ok: false, feedback: ['Write some JSON first.'] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, feedback: [`That is not valid JSON yet: ${(e as Error).message}`] };
  }
  const feedback = c.rules.filter((r) => !jsonRuleHolds(parsed, r)).map((r) => r.message);
  return { ok: feedback.length === 0, feedback };
}

/** The reference answer for a level, in the shape `check` expects. */
export function referenceAnswer(level: Level): Answer {
  if (level.challenge.type === 'order') return level.challenge.items.map((i) => i.id);
  if (level.challenge.type === 'choice' && level.solution === undefined) {
    return level.challenge.options.filter((o) => o.correct).map((o) => o.id);
  }
  return level.solution as Answer;
}

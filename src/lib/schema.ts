/**
 * The lesson format. This file is the single source of truth: the site build, the
 * tests, the in-browser Forge and the published JSON Schema all use it.
 */
import { z } from 'zod';

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase letters, digits and dashes, e.g. "next-token"');

export const LINK_KINDS = ['docs', 'article', 'video', 'paper', 'course', 'tool', 'code'] as const;

export const LinkSchema = z.strictObject({
  title: z.string().min(1),
  url: z.string().regex(/^https:\/\/\S+$/, 'must be an https:// link'),
  kind: z.enum(LINK_KINDS),
  note: z.string().optional(),
});

const NumberRule = z
  .object({ eq: z.number().optional(), min: z.number().optional(), max: z.number().optional() })
  .refine((r) => r.eq !== undefined || r.min !== undefined || r.max !== undefined, {
    message: 'give at least one of eq, min, max',
  });

/** How one blank is judged. Exactly one rule per blank. */
export const AcceptSchema = z.union([
  z.object({ equals: z.string() }),
  z.object({ oneOf: z.array(z.string()).min(1) }),
  z.object({ regex: z.string().max(200) }),
  z.object({ number: NumberRule }),
  z.object({ tokenCount: NumberRule }),
]);

export const BlankSchema = z.strictObject({
  accept: AcceptSchema,
  placeholder: z.string().optional(),
  width: z.number().int().min(1).max(60).optional(),
  caseSensitive: z.boolean().optional(),
  /** Shown when this blank is wrong. */
  feedback: z.string().optional(),
});

const blankName = z.string().regex(/^[a-z][a-z0-9_]*$/, 'blank names look like "temp" or "top_p"');

const FillChallenge = z.object({
  type: z.literal('fill'),
  code: z.object({ python: z.string().min(1), typescript: z.string().min(1) }),
  blanks: z.record(blankName, BlankSchema),
});

const ChoiceChallenge = z.object({
  type: z.literal('choice'),
  multiple: z.boolean().optional(),
  code: z.object({ python: z.string(), typescript: z.string() }).optional(),
  options: z
    .array(z.strictObject({ id: slug, text: z.string().min(1), correct: z.boolean().optional(), why: z.string().optional() }))
    .min(2),
});

const OrderChallenge = z.object({
  type: z.literal('order'),
  /** Written in the correct order. The player sees them shuffled. */
  items: z.array(z.strictObject({ id: slug, text: z.string().min(1) })).min(3),
});

export const JSON_OPS = ['exists', 'equals', 'type', 'includes', 'matches', 'minLength'] as const;

const JsonChallenge = z.object({
  type: z.literal('json'),
  starter: z.string(),
  rules: z
    .array(
      z.object({
        /** Dot path into the player's JSON, e.g. "params.arguments.city" or "tools.0.name". */
        path: z.string(),
        op: z.enum(JSON_OPS),
        value: z.unknown().optional(),
        message: z.string().min(1),
      }),
    )
    .min(1),
});

export const ChallengeSchema = z.discriminatedUnion('type', [
  FillChallenge,
  ChoiceChallenge,
  OrderChallenge,
  JsonChallenge,
]);

export const SceneSchema = z.looseObject({ type: z.string().min(1) });

const AnswerSchema = z.union([z.record(z.string(), z.string()), z.array(z.string()), z.string()]);

// Strict: a misspelt key (or a stray comma in YAML) is an error, not silently dropped.
const LevelBase = z.strictObject({
  id: slug,
  title: z.string().min(1).max(60),
  /** Short phrases; they become the leaves of the topic map. */
  concepts: z.array(z.string().min(1)).min(1).max(6),
  /** Markdown. Keep it under about 250 words. */
  lesson: z.string().min(1),
  /** Markdown. One or two sentences telling the player what to do. */
  goal: z.string().min(1),
  scene: SceneSchema.default({ type: 'robot' }),
  challenge: ChallengeSchema,
  hints: z.array(z.string().min(1)).min(1).max(4),
  /** Markdown shown after solving: why the answer is right. */
  success: z.string().min(1),
  links: z.array(LinkSchema).min(2).max(4),
  /** Reference answer. CI proves the checker accepts it. Not needed for `order`. */
  solution: AnswerSchema.optional(),
  /** A plausible wrong answer. CI proves the checker rejects it. */
  wrong: AnswerSchema.optional(),
});

export function blanksIn(code: string): string[] {
  return [...code.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g)].map((m) => m[1]!);
}

export const LevelSchema = LevelBase.superRefine((level, ctx) => {
  const c = level.challenge;
  const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: 'custom', message, path });

  if (c.type === 'fill') {
    const names = Object.keys(c.blanks).sort();
    for (const lang of ['python', 'typescript'] as const) {
      const used = [...new Set(blanksIn(c.code[lang]))].sort();
      if (used.join() !== names.join()) {
        issue(
          `the ${lang} code uses blanks [${used.join(', ')}] but "blanks" defines [${names.join(', ')}]`,
          ['challenge', 'code', lang],
        );
      }
    }
    if (names.length === 0) issue('a fill challenge needs at least one {{blank}}', ['challenge', 'blanks']);
    if (level.solution === undefined || typeof level.solution !== 'object' || Array.isArray(level.solution)) {
      issue('fill challenges need "solution" as a map of blank name to answer', ['solution']);
    } else {
      for (const n of names) if (!(n in level.solution)) issue(`solution is missing the blank "${n}"`, ['solution']);
    }
  }
  if (c.type === 'choice') {
    const right = c.options.filter((o) => o.correct).length;
    if (right === 0) issue('mark at least one option with correct: true', ['challenge', 'options']);
    if (right > 1 && !c.multiple) issue('several options are correct: set multiple: true', ['challenge', 'multiple']);
    const ids = c.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) issue('option ids must be unique', ['challenge', 'options']);
  }
  if (c.type === 'order') {
    const ids = c.items.map((o) => o.id);
    if (new Set(ids).size !== ids.length) issue('item ids must be unique', ['challenge', 'items']);
  }
  if (c.type === 'json' && typeof level.solution !== 'string') {
    issue('json challenges need "solution" as a JSON string', ['solution']);
  }
});

export const PlannedLevelSchema = z.object({ title: z.string().min(1), concepts: z.array(z.string()).optional() });

export const WorldSchema = z.object({
  id: slug,
  order: z.number().int().min(1),
  title: z.string().min(1),
  /** The robot part this world forges. */
  part: z.string().min(1),
  /** The question this world answers, in the learner's words. */
  question: z.string().min(1),
  summary: z.string().min(1),
  /** Levels that are planned but not written yet. Shown as "being forged". */
  planned: z.array(PlannedLevelSchema).optional(),
});

/** A bundle of lessons that can be imported in the Forge from a file or a URL. */
export const PackSchema = z.object({
  hephaestus: z.literal(1),
  title: z.string().optional(),
  levels: z.array(LevelSchema).min(1),
});

export const BeyondSchema = z.object({
  verified: z.string(),
  intro: z.string(),
  sections: z.array(
    z.object({
      id: slug,
      title: z.string(),
      why: z.string(),
      topics: z.array(
        z.object({
          title: z.string(),
          about: z.string(),
          links: z.array(LinkSchema).min(1),
        }),
      ),
    }),
  ),
  notCovered: z.array(z.object({ title: z.string(), about: z.string() })),
});

export type Link = z.infer<typeof LinkSchema>;
export type Accept = z.infer<typeof AcceptSchema>;
export type Blank = z.infer<typeof BlankSchema>;
export type Challenge = z.infer<typeof ChallengeSchema>;
export type Level = z.infer<typeof LevelSchema>;
export type World = z.infer<typeof WorldSchema>;
export type Pack = z.infer<typeof PackSchema>;
export type Beyond = z.infer<typeof BeyondSchema>;
export type Answer = z.infer<typeof AnswerSchema>;

/** Turn Zod issues into short, readable lines. */
export function explain(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.length ? i.path.join('.') : 'top level of the file'}: ${i.message}`);
}

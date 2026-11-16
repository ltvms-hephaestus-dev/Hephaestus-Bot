/**
 * Board scenes. A scene draws what the player's answer means. It never decides
 * whether the answer is right: that is check.ts's job.
 *
 * To add a scene: write a component taking SceneProps, add it to SCENES below,
 * and document its config in CONTRIBUTING.md. This is the only extension point
 * in the game that needs code; everything else is lesson data.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { tokenize, type Token } from '../lib/tokenizer';

export type Status = 'idle' | 'wrong' | 'solved';

export interface SceneProps {
  /** The `scene:` block of the lesson file. */
  config: Record<string, any>;
  /** Current text of every blank, by name. */
  values: Record<string, string>;
  status: Status;
  /** Put words in the robot's speech bubble. */
  say: (text: string) => void;
}

const clean = (s: string | undefined) => (s ?? '').trim().replace(/^(["'`])(.*)\1$/s, '$2').trim();
const bound = (p: SceneProps, key: string): string | undefined => {
  const name = p.config.bind?.[key];
  return name ? clean(p.values[name]) : undefined;
};

/* ------------------------------------------------------------------ robot */

function RobotScene({ config, say }: SceneProps) {
  useEffect(() => say(config.say ?? ''), [config.say]);
  return config.note ? <p class="scene-note">{config.note}</p> : null;
}

/* ------------------------------------------------------------------- bars */

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pure: reshape a distribution with temperature, then cut its tail with top-p. */
export function reshape(base: number[], temperature: number, topP: number): { p: number[]; cut: boolean[] } {
  const norm = (a: number[]) => {
    const s = a.reduce((x, y) => x + y, 0) || 1;
    return a.map((v) => v / s);
  };
  let p = norm(base);
  if (temperature === 0) {
    const top = p.indexOf(Math.max(...p));
    p = p.map((_, i) => (i === top ? 1 : 0));
  } else if (Number.isFinite(temperature) && temperature > 0) {
    p = norm(p.map((v) => Math.pow(v, 1 / temperature)));
  }
  const order = p.map((_, i) => i).sort((a, b) => p[b]! - p[a]!);
  const keep = new Set<number>();
  let cum = 0;
  const limit = Number.isFinite(topP) && topP > 0 ? Math.min(topP, 1) : 1;
  for (const i of order) {
    if (cum >= limit - 1e-9) break;
    keep.add(i);
    cum += p[i]!;
  }
  return { p: norm(p.map((v, i) => (keep.has(i) ? v : 0))), cut: p.map((_, i) => !keep.has(i)) };
}

function BarsScene(props: SceneProps) {
  const { config, say } = props;
  const tokens: [string, number][] = config.tokens ?? [];
  const tRaw = bound(props, 'temperature');
  const guess = bound(props, 'guess');
  const explore: string[] = config.explore ?? [];
  const [topP, setTopP] = useState(1);

  const temperature = tRaw === undefined || tRaw === '' || Number.isNaN(Number(tRaw)) ? 1 : Number(tRaw);
  const { p, cut } = useMemo(() => reshape(tokens.map((t) => t[1]), temperature, topP), [tokens, temperature, topP]);

  const samples = useMemo(() => {
    const rand = mulberry32(7);
    return Array.from({ length: 10 }, () => {
      let r = rand();
      for (let i = 0; i < p.length; i++) {
        r -= p[i]!;
        if (r <= 0) return tokens[i]![0];
      }
      return tokens[tokens.length - 1]![0];
    });
  }, [p]);

  const top = tokens[p.indexOf(Math.max(...p))]?.[0] ?? '';
  useEffect(() => {
    if (config.say) say(config.say);
    else say(`${config.prompt ?? ''} ${config.sample ? samples[0] : top}`.trim());
  }, [top, samples[0], config.prompt]);

  return (
    <div class="scene scene-bars">
      {config.prompt && (
        <p class="scene-prompt">
          {config.prompt} <span class="scene-cursor" aria-hidden="true" />
        </p>
      )}
      <ul class="bars" aria-label="Probability of each next token">
        {tokens.map(([word], i) => {
          const pct = Math.round(p[i]! * 100);
          const isGuess = guess !== undefined && guess !== '' && guess.toLowerCase() === word.trim().toLowerCase();
          return (
            <li class={`bar${cut[i] ? ' bar--cut' : ''}${isGuess ? ' bar--guess' : ''}`} key={word}>
              <span class="bar__word">{word}</span>
              <span class="bar__track">
                <span class="bar__fill" style={{ width: `${Math.max(p[i]! * 100, 0.5)}%` }} />
              </span>
              <span class="bar__pct">{cut[i] ? 'cut' : `${pct}%`}</span>
            </li>
          );
        })}
      </ul>
      {config.sample && (
        <div class="samples">
          <p class="scene-caption">Ten answers with these settings</p>
          <p class="samples__row">
            {samples.map((s, i) => (
              <span class={`chip${s === top ? '' : ' chip--alt'}`} key={i}>
                {s}
              </span>
            ))}
          </p>
        </div>
      )}
      {explore.includes('topP') && (
        <label class="scene-slider">
          <span>
            Try it: top_p = <output>{topP.toFixed(2)}</output>
          </span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={topP}
            onInput={(e) => setTopP(Number((e.target as HTMLInputElement).value))}
          />
          <small>Not graded. Lower it and watch the unlikely words get cut.</small>
        </label>
      )}
      {config.note && <p class="scene-note">{config.note}</p>}
    </div>
  );
}

/* ----------------------------------------------------------------- tokens */

function TokensScene(props: SceneProps) {
  const { config, say } = props;
  const text = bound(props, 'text') ?? config.text ?? '';
  const [toks, setToks] = useState<Token[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    if (!text) {
      setToks([]);
      return;
    }
    tokenize(text)
      .then((t) => live && setToks(t))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [text]);

  const n = toks?.length ?? 0;
  const target: number | undefined = config.target;
  useEffect(() => {
    if (failed) say('My tokenizer did not load. Check your connection and reload.');
    else if (toks === null) say('Heating up the tokenizer…');
    else if (n === 0) say('Type something and I will chop it into tokens.');
    else if (target !== undefined && n !== target) say(`That is ${n} token${n === 1 ? '' : 's'}. I need exactly ${target}.`);
    else say(`${n} token${n === 1 ? '' : 's'}. ${target !== undefined ? 'A perfect fit.' : ''}`.trim());
  }, [n, toks === null, failed, target]);

  return (
    <div class="scene scene-tokens">
      <p class="scene-caption">How the model sees your text</p>
      <p class="tokens" aria-live="polite">
        {(toks ?? []).map((t, i) => (
          <span class={`tok tok--${i % 4}`} key={i} title={`token id ${t.id}`}>
            <span class="tok__text">{t.text.replace(/ /g, '·').replace(/\n/g, '↵') || '∅'}</span>
            <span class="tok__id">{t.id}</span>
          </span>
        ))}
        {toks !== null && n === 0 && <span class="scene-empty">No tokens yet</span>}
      </p>
      <p class="scene-count">
        <strong>{n}</strong> token{n === 1 ? '' : 's'}
        {target !== undefined && <span> of {target} needed</span>}
        <span class="scene-count__sub"> from {text.length} character{text.length === 1 ? '' : 's'}</span>
      </p>
      <small class="scene-legend">A dot (·) is a space. The number under each piece is its id in the vocabulary.</small>
    </div>
  );
}

/* ------------------------------------------------------------- embeddings */

type Pt = [number, number];

/** Pure: start - minus + plus, and the nearest other word to where that lands. */
export function analogy(points: Record<string, Pt>, start: string, minus: string, plus: string) {
  const a = points[start];
  const b = points[minus];
  const c = points[plus];
  if (!a || !b || !c) return null;
  const at: Pt = [a[0] - b[0] + c[0], a[1] - b[1] + c[1]];
  let best = '';
  let bestD = Infinity;
  for (const [w, q] of Object.entries(points)) {
    if (w === start || w === minus || w === plus) continue;
    const d = Math.hypot(q[0] - at[0], q[1] - at[1]);
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return { at, nearest: best };
}

function EmbeddingsScene(props: SceneProps) {
  const { config, say } = props;
  const points: Record<string, Pt> = config.points ?? {};
  const start: string = config.expr?.start;
  const minus: string = config.expr?.minus;
  const plus = (bound(props, 'plus') ?? '').toLowerCase();
  const result = plus ? analogy(points, start, minus, plus) : null;

  useEffect(() => {
    if (!plus) say(`Every word is a point. Give me a word to add to ${start} − ${minus}.`);
    else if (!result) say(`I do not have "${plus}" on my map. Pick a word you can see.`);
    else say(`${start} − ${minus} + ${plus} lands nearest to "${result.nearest}".`);
  }, [plus, result?.nearest]);

  const xs = Object.values(points).map((p) => p[0]);
  const ys = Object.values(points).map((p) => p[1]);
  const maxX = Math.max(...xs, result?.at[0] ?? 0) + 1.2;
  const maxY = Math.max(...ys, result?.at[1] ?? 0) + 1.2;
  const W = 400;
  const H = 300;
  const sx = (x: number) => 24 + (x / maxX) * (W - 48);
  const sy = (y: number) => H - 24 - (y / maxY) * (H - 48);
  const arrow = (from: Pt, to: Pt, cls: string) => (
    <line x1={sx(from[0])} y1={sy(from[1])} x2={sx(to[0])} y2={sy(to[1])} class={cls} marker-end="url(#arrowhead)" />
  );

  return (
    <div class="scene scene-embed">
      <p class="scene-caption">
        The robot's map of meaning. Words used in similar ways sit close together.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} class="embed" role="img" aria-label="Words plotted as points; similar words are near each other">
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0l10 5-10 5z" fill="context-stroke" />
          </marker>
        </defs>
        {result && points[minus] && points[plus] && arrow(points[minus]!, points[plus]!, 'embed__dir')}
        {result && points[start] && arrow(points[start]!, result.at, 'embed__dir embed__dir--applied')}
        {Object.entries(points).map(([w, [x, y]]) => {
          const hot = w === start || w === minus || w === plus;
          const hit = result?.nearest === w;
          return (
            <g key={w} class={`embed__pt${hot ? ' embed__pt--hot' : ''}${hit ? ' embed__pt--hit' : ''}`}>
              <circle cx={sx(x)} cy={sy(y)} r={hit ? 7 : 4.5} />
              <text x={sx(x) + 9} y={sy(y) + 4}>
                {w}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------- attention */

function AttentionScene(props: SceneProps) {
  const { config, say, status } = props;
  const [alt, setAlt] = useState(false);
  const src = alt && config.alt ? config.alt : config;
  const tokens: string[] = src.tokens ?? [];
  const weights: number[] = src.weights ?? [];
  const focus: number = config.focus ?? 0;
  const guess = (bound(props, 'guess') ?? '').toLowerCase();
  const solved = status === 'solved';
  const guessIdx = tokens.findIndex((t, i) => i !== focus && t.toLowerCase() === guess);

  useEffect(() => {
    if (solved) {
      const top = weights.indexOf(Math.max(...weights));
      say(`"${tokens[focus]}" looks hardest at "${tokens[top]}".`);
    } else if (guess && guessIdx === -1) say(`"${guess}" is not a word in this sentence.`);
    else if (guess) say(`You think "${tokens[focus]}" points at "${tokens[guessIdx]}". Check it.`);
    else say(`Which word tells you what "${tokens[focus]}" means?`);
  }, [guess, guessIdx, solved, alt]);

  // Lay the words out like text: left to right, wrapping onto new rows.
  const MAX = 430;
  const TOP = 64;
  const ROW = 76;
  const widths = tokens.map((t) => t.length * 9.2 + 14);
  const at: { x: number; y: number }[] = [];
  let x = 10;
  let row = 0;
  for (const w of widths) {
    if (x + w > MAX && x > 10) {
      row += 1;
      x = 10;
    }
    at.push({ x: x + w / 2, y: TOP + row * ROW });
    x += w + 4;
  }
  const H = TOP + row * ROW + 40;
  // Arcs leave the top of the focus word. A word on a row above is reached at its
  // bottom edge, so the line never runs through its letters.
  const arc = (to: number, cls: string, width: number, opacity: number) => {
    const a = at[focus]!;
    const b = at[to]!;
    const above = b.y < a.y;
    const below = b.y > a.y;
    const y1 = below ? a.y + 12 : a.y - 14;
    const y2 = above ? b.y + 12 : b.y - 14;
    const lift = above || below ? 0 : Math.min(52, 20 + Math.abs(b.x - a.x) * 0.2);
    const cx = above || below ? b.x : (a.x + b.x) / 2;
    const cy = above || below ? (y1 + y2) / 2 + (above ? 8 : -8) : y1 - lift;
    return <path key={`${cls}${to}`} d={`M${a.x} ${y1} Q${cx} ${cy} ${b.x} ${y2}`} class={cls} style={{ strokeWidth: width, opacity }} />;
  };

  return (
    <div class="scene scene-attn">
      <p class="scene-caption">
        {solved ? 'Thicker line, more attention.' : `Attention from "${tokens[focus]}" is hidden until you check your answer.`}
      </p>
      <svg viewBox={`0 0 ${MAX + 10} ${H}`} class="attn" role="img" aria-label={`The sentence: ${tokens.join(' ')}`}>
        {solved && weights.map((w, i) => (i === focus || w < 0.02 ? null : arc(i, 'attn__arc', 1 + w * 11, 0.3 + w)))}
        {!solved && guessIdx >= 0 && arc(guessIdx, 'attn__arc attn__arc--guess', 2.5, 1)}
        {tokens.map((t, i) => (
          <g key={i} class={`attn__tok${i === focus ? ' attn__tok--focus' : ''}${i === guessIdx ? ' attn__tok--guess' : ''}`}>
            <rect x={at[i]!.x - widths[i]! / 2} y={at[i]!.y - 14} width={widths[i]} height="26" rx="5" />
            <text x={at[i]!.x} y={at[i]!.y + 4} text-anchor="middle">
              {t}
            </text>
            {solved && i !== focus && weights[i]! >= 0.05 && (
              <text x={at[i]!.x} y={at[i]!.y < at[focus]!.y ? at[i]!.y - 20 : at[i]!.y + 25} text-anchor="middle" class="attn__w">
                {Math.round(weights[i]! * 100)}%
              </text>
            )}
          </g>
        ))}
      </svg>
      {solved && config.alt && (
        <button type="button" class="btn" onClick={() => setAlt(!alt)}>
          {alt ? config.alt.back ?? 'Back to the original sentence' : config.alt.label}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- context */

interface Msg {
  role: string;
  text: string;
  tokens: number;
  key?: boolean;
}

/** Pure: which messages still fit, counting back from the newest. */
export function fitWindow(messages: Msg[], size: number): boolean[] {
  const inside = messages.map(() => false);
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (used + messages[i]!.tokens > size) break;
    used += messages[i]!.tokens;
    inside[i] = true;
  }
  return inside;
}

function ContextScene(props: SceneProps) {
  const { config, say } = props;
  const messages: Msg[] = config.messages ?? [];
  const raw = bound(props, 'window') ?? '';
  const size = /^\d+$/.test(raw) ? Number(raw) : NaN;
  const inside = Number.isNaN(size) ? messages.map(() => true) : fitWindow(messages, size);
  const used = messages.reduce((s, m, i) => s + (inside[i] ? m.tokens : 0), 0);
  const total = messages.reduce((s, m) => s + m.tokens, 0);
  const keyIn = messages.every((m, i) => !m.key || inside[i]);

  useEffect(() => {
    if (Number.isNaN(size)) say('Pick a context window size for me.');
    else say(keyIn ? config.remembered ?? 'I remember.' : config.forgotten ?? 'I have lost the start of our chat.');
  }, [size, keyIn]);

  return (
    <div class="scene scene-ctx">
      <p class="scene-caption">
        The conversation is {total} tokens long.{' '}
        {Number.isNaN(size) ? 'No window chosen yet.' : `Window: ${size} tokens, ${used} in use.`}
      </p>
      <ol class="ctx">
        {messages.map((m, i) => (
          <li class={`ctx__msg ctx__msg--${m.role}${inside[i] ? '' : ' ctx__msg--out'}`} key={i}>
            <span class="ctx__role">{m.role}</span>
            <span class="ctx__text">{m.text}</span>
            <span class="ctx__tokens">
              {m.tokens} tokens{inside[i] ? '' : ', outside the window'}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* --------------------------------------------------------------- registry */

export const SCENES: Record<string, (p: SceneProps) => JSX.Element | null> = {
  robot: RobotScene,
  bars: BarsScene,
  tokens: TokensScene,
  embeddings: EmbeddingsScene,
  attention: AttentionScene,
  context: ContextScene,
};

export const SCENE_NAMES = Object.keys(SCENES);

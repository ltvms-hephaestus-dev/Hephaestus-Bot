/**
 * Plays one prepared level: lesson on the left, code challenge under it, the
 * board on the right. It does not know where the level came from.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { LANGS, LANG_LABEL, type Lang } from '../config';
import { check, type CheckResult } from '../lib/check';
import { highlight } from '../lib/highlight';
import type { Prepared } from '../lib/prepare';
import { markSolved, readStore, writeStore } from '../lib/progress';
import type { Answer, Blank } from '../lib/schema';
import { temperStyle } from '../lib/temper';
import { SCENES, type Status } from '../scenes';
import { Robot } from './Robot';

const OPEN = '';
const CLOSE = '';
const MARK = new RegExp(`${OPEN}([a-z][a-z0-9_]*)${CLOSE}`);

interface CodeProps {
  code: string;
  lang: Lang;
  blanks?: Record<string, Blank>;
  values?: Record<string, string>;
  verdict?: Record<string, boolean>;
  onChange?: (name: string, value: string) => void;
  onEnter?: () => void;
}

/** Code with inline inputs where the lesson left {{blanks}}. */
export function CodeBlock({ code, lang, blanks = {}, values = {}, verdict, onChange, onEnter }: CodeProps) {
  const lines = code.replace(/\s+$/, '').split('\n');
  let first = true;
  return (
    <pre class="code" data-lang={lang}>
      <code>
        {lines.map((line, n) => {
          const marked = line.replace(/\{\{([a-z][a-z0-9_]*)\}\}/g, `${OPEN}$1${CLOSE}`);
          return (
            <span class="code__line" key={n}>
              <span class="code__no" aria-hidden="true">
                {n + 1}
              </span>
              {highlight(marked, lang).map((tok, i) => (
                <span class={tok.cls ? `t-${tok.cls}` : undefined} key={i}>
                  {tok.text.split(MARK).map((part, j) => {
                    if (j % 2 === 0) return part;
                    const blank = blanks[part];
                    const state = verdict ? (verdict[part] ? ' blank--ok' : ' blank--bad') : '';
                    const focus = first;
                    first = false;
                    return (
                      <input
                        key={part}
                        class={`blank${state}`}
                        type="text"
                        value={values[part] ?? ''}
                        placeholder={blank?.placeholder ?? '…'}
                        style={{ width: `${blank?.width ?? Math.max(4, (blank?.placeholder ?? '').length + 1)}ch` }}
                        aria-label={`Blank: ${part.replace(/_/g, ' ')}`}
                        aria-invalid={verdict ? !verdict[part] : undefined}
                        autocomplete="off"
                        autocapitalize="off"
                        spellcheck={false}
                        data-autofocus={focus ? '' : undefined}
                        onInput={(e) => onChange?.(part, (e.target as HTMLInputElement).value)}
                        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
                      />
                    );
                  })}
                </span>
              ))}
              {'\n'}
            </span>
          );
        })}
      </code>
    </pre>
  );
}

/** Turn `backticks` in plain option text into <code>, without touching HTML. */
function Inline({ text }: { text: string }) {
  return <>{text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>;
}

function shuffled<T extends { id: string }>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  if (out.every((x, i) => x.id === items[i]!.id)) out.push(out.shift()!);
  return out;
}

const KIND_LABEL: Record<string, string> = {
  docs: 'Docs',
  article: 'Article',
  video: 'Video',
  paper: 'Paper',
  course: 'Course',
  tool: 'Tool',
  code: 'Code',
};

export interface PlayerProps {
  data: Prepared;
  /** Set false in the Forge preview so drafts do not count as progress. */
  persist?: boolean;
}

export default function LevelPlayer({ data, persist = true }: PlayerProps) {
  const { level, html, world, position, nav } = data;
  const c = level.challenge;

  const [lang, setLang] = useState<Lang>('python');
  const [values, setValues] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>(() => (c.type === 'order' ? shuffled(c.items, level.id).map((i) => i.id) : []));
  const [jsonText, setJsonText] = useState(c.type === 'json' ? c.starter : '');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [hints, setHints] = useState(0);
  const [bubble, setBubble] = useState('');
  const [busy, setBusy] = useState(false);
  const [solvedBefore, setSolvedBefore] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = readStore();
    setLang(s.lang);
    setSolvedBefore(!!s.solved[data.fullId]);
    root.current?.querySelector<HTMLInputElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, [data.fullId]);

  const touch = () => {
    if (status !== 'idle') setStatus('idle');
    if (result) setResult(null);
  };

  const answer: Answer = c.type === 'fill' ? values : c.type === 'choice' ? picked : c.type === 'order' ? order : jsonText;

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await check(level, answer);
      setResult(res);
      setStatus(res.ok ? 'solved' : 'wrong');
      if (res.ok) {
        if (persist) markSolved(data.fullId);
        setSolvedBefore(true);
        requestAnimationFrame(() => doneRef.current?.focus({ preventScroll: false }));
      }
    } catch {
      setResult({ ok: false, feedback: ['The checker could not run. Check your connection and try again.'] });
      setStatus('wrong');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setValues({});
    setPicked([]);
    if (c.type === 'order') setOrder(shuffled(c.items, level.id).map((i) => i.id));
    if (c.type === 'json') setJsonText(c.starter);
    setStatus('idle');
    setResult(null);
  }

  function chooseLang(l: Lang) {
    setLang(l);
    if (persist) writeStore({ lang: l });
  }

  function move(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
    touch();
  }

  const Scene = SCENES[level.scene.type] ?? SCENES.robot!;
  const sceneValues = useMemo(() => values, [values]);
  const mood = status === 'solved' ? 'happy' : status === 'wrong' ? 'sad' : 'idle';
  const fallback = status === 'solved' ? 'That is it!' : status === 'wrong' ? 'Not yet. Read the feedback and try again.' : 'Ready when you are.';
  const hasCode = c.type === 'fill' || (c.type === 'choice' && c.code);
  const itemById = c.type === 'order' ? Object.fromEntries(c.items.map((i) => [i.id, i])) : {};

  return (
    <div class="play" ref={root} style={temperStyle(world.order)}>
      <div class="play__left">
        <nav class="crumbs" aria-label="Where you are">
          <a href={nav.world}>
            World {world.order}: {world.title}
          </a>
          <span class="crumbs__pos">
            Level {position.index} of {position.total}
            {solvedBefore && <span class="solved-tag"> ✓ solved</span>}
          </span>
        </nav>

        <h1 class="play__title">{level.title}</h1>
        <div class="prose" dangerouslySetInnerHTML={{ __html: html.lesson }} />

        <section class="task" aria-label="Your task">
          <div class="task__head">
            <h2>Your task</h2>
            {hasCode && (
              <div class="langs" role="group" aria-label="Code language">
                {LANGS.map((l) => (
                  <button type="button" key={l} class="langs__btn" aria-pressed={lang === l} onClick={() => chooseLang(l)}>
                    {LANG_LABEL[l]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div class="prose task__goal" dangerouslySetInnerHTML={{ __html: html.goal }} />

          {c.type === 'fill' && (
            <CodeBlock
              code={c.code[lang]}
              lang={lang}
              blanks={c.blanks}
              values={values}
              verdict={result && !result.ok ? result.blanks : undefined}
              onChange={(name, v) => {
                setValues((old) => ({ ...old, [name]: v }));
                touch();
              }}
              onEnter={run}
            />
          )}

          {c.type === 'choice' && (
            <>
              {c.code && <CodeBlock code={c.code[lang]} lang={lang} />}
              <fieldset class="choices">
                <legend class="visually-hidden">{c.multiple ? 'Pick every answer that applies' : 'Pick one answer'}</legend>
                {c.options.map((o) => (
                  <label class="choice" key={o.id}>
                    <input
                      type={c.multiple ? 'checkbox' : 'radio'}
                      name={`choice-${level.id}`}
                      checked={picked.includes(o.id)}
                      onChange={() => {
                        setPicked(c.multiple ? (picked.includes(o.id) ? picked.filter((p) => p !== o.id) : [...picked, o.id]) : [o.id]);
                        touch();
                      }}
                    />
                    <span>
                      <Inline text={o.text} />
                    </span>
                  </label>
                ))}
              </fieldset>
            </>
          )}

          {c.type === 'order' && (
            <ol class="order">
              {order.map((id, i) => (
                <li class="order__item" key={id}>
                  <span class="order__text">
                    <Inline text={itemById[id]?.text ?? id} />
                  </span>
                  <span class="order__btns">
                    <button type="button" class="btn btn--icon" disabled={i === 0} aria-label={`Move step ${i + 1} up`} onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button type="button" class="btn btn--icon" disabled={i === order.length - 1} aria-label={`Move step ${i + 1} down`} onClick={() => move(i, 1)}>
                      ↓
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {c.type === 'json' && (
            <textarea
              class="json"
              rows={Math.min(18, Math.max(6, jsonText.split('\n').length + 1))}
              spellcheck={false}
              aria-label="Your JSON"
              value={jsonText}
              onInput={(e) => {
                setJsonText((e.target as HTMLTextAreaElement).value);
                touch();
              }}
              onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && run()}
            />
          )}

          <div class="actions">
            <button type="button" class="btn btn--primary" onClick={run} disabled={busy}>
              {busy ? 'Checking…' : 'Check answer'}
            </button>
            {hints < html.hints.length && (
              <button type="button" class="btn" onClick={() => setHints(hints + 1)}>
                {hints === 0 ? 'Show a hint' : `Show another hint (${hints} of ${html.hints.length} shown)`}
              </button>
            )}
            <button type="button" class="btn btn--quiet" onClick={reset}>
              Start over
            </button>
          </div>

          <div class="feedback" role="status" aria-live="polite">
            {result && !result.ok && (
              <div class="notice notice--bad">
                <strong>✗ Not yet.</strong>
                <ul>
                  {result.feedback.map((f, i) => (
                    <li key={i}>
                      <Inline text={f} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {hints > 0 && (
            <ol class="hints" aria-label="Hints">
              {html.hints.slice(0, hints).map((h, i) => (
                <li key={i} class="prose" dangerouslySetInnerHTML={{ __html: h }} />
              ))}
            </ol>
          )}

          {status === 'solved' && (
            <div class="notice notice--ok" tabIndex={-1} ref={doneRef}>
              <strong>✓ Solved.</strong>
              <div class="prose" dangerouslySetInnerHTML={{ __html: html.success }} />
              {nav.next && (
                <a class="btn btn--primary" href={nav.next}>
                  {nav.nextLabel ?? 'Next level'}
                </a>
              )}
            </div>
          )}
        </section>

        <section class="deeper" aria-label="Go deeper">
          <h2>Go deeper</h2>
          <ul class="links">
            {level.links.map((l) => (
              <li key={l.url}>
                <span class="links__kind">{KIND_LABEL[l.kind] ?? l.kind}</span>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  {l.title}
                </a>
                {l.note && <span class="links__note">{l.note}</span>}
              </li>
            ))}
          </ul>
          <p class="concepts">
            <span>On the topic map:</span>
            {level.concepts.map((k) => (
              <span class="concept" key={k}>
                {k}
              </span>
            ))}
          </p>
        </section>

        <nav class="pager" aria-label="Levels">
          {nav.prev ? <a href={nav.prev}>Previous level</a> : <span />}
          {nav.next && <a href={nav.next}>{status === 'solved' || solvedBefore ? nav.nextLabel ?? 'Next level' : 'Skip this level'}</a>}
        </nav>
      </div>

      <aside class="play__right" aria-label="The board">
        <div class={`board board--${status}`}>
          <div class="board__scene">
            <Scene config={level.scene} values={sceneValues} status={status} say={setBubble} />
          </div>
          <div class="board__robot">
            <Robot parts={world.order} mood={mood} />
            <p class="bubble" aria-live="polite">
              {bubble || fallback}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

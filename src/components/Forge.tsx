/**
 * The lesson forge: write a lesson as text, see it validated and playable at once,
 * keep it in this browser, export it, import others, or hand it to GitHub.
 * There is no server: "publish" means proposing the file to the repository.
 */
import DOMPurify from 'dompurify';
import { useEffect, useMemo, useState } from 'preact/hooks';
import YAML from 'yaml';
import { renderMd } from '../lib/markdown';
import { prepare, type Prepared } from '../lib/prepare';
import { readMyLessons, writeMyLessons } from '../lib/progress';
import { LevelSchema, PackSchema, explain, type Level } from '../lib/schema';
import { TEMPLATES } from '../lib/templates';
import { SCENE_NAMES } from '../scenes';
import LevelPlayer from './LevelPlayer';

export interface ForgeWorld {
  id: string;
  dir: string;
  order: number;
  title: string;
  /** Number the next lesson file in this world should start with. */
  next: number;
}

interface Props {
  worlds: ForgeWorld[];
  repo: string;
  branch: string;
  playUrl: string;
}

export const safeMd = (md: string) => DOMPurify.sanitize(renderMd(md), { ADD_ATTR: ['target', 'rel'] });

export function prepareCustom(level: Level, order: number, backUrl: string): Prepared {
  return prepare(level, { id: 'custom', title: 'My lessons', order, part: 'Custom' }, safeMd, {
    fullId: `custom/${level.id}`,
    position: { index: 1, total: 1 },
    nav: { world: backUrl },
  });
}

type Parsed = { level?: Level; issues: string[] };

function parseLesson(text: string): Parsed {
  let raw: unknown;
  try {
    raw = YAML.parse(text);
  } catch (e) {
    return { issues: [`The text is not valid YAML: ${(e as Error).message.split('\n')[0]}`] };
  }
  if (raw === null || typeof raw !== 'object') return { issues: ['Start from a template, or paste a lesson.'] };
  const res = LevelSchema.safeParse(raw);
  if (!res.success) return { issues: explain(res.error) };
  const issues: string[] = [];
  if (!SCENE_NAMES.includes(res.data.scene.type)) {
    issues.push(`scene.type: "${res.data.scene.type}" is not a scene this game has. Use one of: ${SCENE_NAMES.join(', ')}.`);
  }
  return { level: res.data, issues };
}

/** Accepts one lesson or a pack of lessons, as YAML or JSON. */
function readLessons(text: string): { levels: Level[]; error?: string } {
  let raw: any;
  try {
    raw = YAML.parse(text);
  } catch (e) {
    return { levels: [], error: `Could not read the file: ${(e as Error).message.split('\n')[0]}` };
  }
  if (raw && typeof raw === 'object' && 'levels' in raw) {
    const pack = PackSchema.safeParse(raw);
    return pack.success ? { levels: pack.data.levels } : { levels: [], error: `The pack is not valid. ${explain(pack.error).slice(0, 3).join(' ')}` };
  }
  const one = LevelSchema.safeParse(raw);
  return one.success ? { levels: [one.data] } : { levels: [], error: `The lesson is not valid. ${explain(one.error).slice(0, 3).join(' ')}` };
}

function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/yaml' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function Forge({ worlds, repo, branch, playUrl }: Props) {
  const [text, setText] = useState(TEMPLATES.fill!.yaml);
  const [parsed, setParsed] = useState<Parsed>(() => parseLesson(TEMPLATES.fill!.yaml));
  const [mine, setMine] = useState<Level[]>([]);
  const [target, setTarget] = useState(worlds[0]?.id ?? '');
  const [packUrl, setPackUrl] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const saved = readMyLessons();
    setMine(saved);
    const q = new URLSearchParams(location.search);
    const edit = q.get('edit');
    const found = edit ? saved.find((l) => l.id === edit) : undefined;
    if (found) setText(YAML.stringify(found, { lineWidth: 88 }));
    const pack = q.get('pack');
    if (pack) {
      setPackUrl(pack);
      void importUrl(pack, saved);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setParsed(parseLesson(text)), 250);
    return () => clearTimeout(t);
  }, [text]);

  const world = worlds.find((w) => w.id === target) ?? worlds[0];
  const level = parsed.level;
  const preview = useMemo(() => (level ? prepareCustom(level, world?.order ?? 1, '#') : null), [level, world?.order]);
  const previewKey = level ? JSON.stringify([level.id, level.challenge, level.scene]) : '';

  function store(levels: Level[], note: string) {
    const merged = [...mine.filter((m) => !levels.some((l) => l.id === m.id)), ...levels];
    const ok = writeMyLessons(merged);
    setMine(merged);
    setMsg(ok ? note : `${note} This browser would not store it, so it will be gone when you close the page: download it to keep it.`);
  }

  function take(result: { levels: Level[]; error?: string }, from: string, current = mine) {
    if (result.error || result.levels.length === 0) {
      setMsg(result.error ?? 'No lessons found.');
      return;
    }
    const merged = [...current.filter((m) => !result.levels.some((l) => l.id === m.id)), ...result.levels];
    const ok = writeMyLessons(merged);
    setMine(merged);
    setText(YAML.stringify(result.levels[0], { lineWidth: 88 }));
    setMsg(`Imported ${result.levels.length} lesson${result.levels.length === 1 ? '' : 's'} from ${from}.${ok ? '' : ' This browser would not store them.'}`);
  }

  async function importUrl(u: string, current = mine) {
    if (!/^https:\/\//.test(u)) {
      setMsg('Give an https:// address of a lesson or pack file.');
      return;
    }
    try {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`the server answered ${res.status}`);
      take(readLessons(await res.text()), u, current);
    } catch (e) {
      setMsg(`Could not load ${u}: ${(e as Error).message}. The site hosting the file must allow other sites to read it (CORS).`);
    }
  }

  async function importFile(file: File | undefined) {
    if (file) take(readLessons(await file.text()), file.name);
  }

  function remove(id: string) {
    const rest = mine.filter((m) => m.id !== id);
    writeMyLessons(rest);
    setMine(rest);
    setMsg(`Deleted "${id}" from this browser.`);
  }

  const fileName = level && world ? `${String(world.next).padStart(2, '0')}-${level.id}.yaml` : 'lesson.yaml';
  const proposeUrl =
    level && world
      ? `https://github.com/${repo}/new/${branch}/content/worlds/${world.dir}?filename=${encodeURIComponent(fileName)}&value=${encodeURIComponent(text)}`
      : '';
  const tooLong = proposeUrl.length > 7500;

  return (
    <div>
      <div class="forge">
        <section aria-label="Lesson editor">
          <div class="forge__bar">
            <label>
              <span class="visually-hidden">Start from a template</span>
              <select
                onChange={(e) => {
                  const k = (e.target as HTMLSelectElement).value;
                  if (k && TEMPLATES[k]) setText(TEMPLATES[k]!.yaml);
                  (e.target as HTMLSelectElement).value = '';
                }}
              >
                <option value="">Start from a template…</option>
                {Object.entries(TEMPLATES).map(([k, t]) => (
                  <option value={k} key={k}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label class="btn">
              Import a file
              <input type="file" accept=".yaml,.yml,.json" class="visually-hidden" onChange={(e) => importFile((e.target as HTMLInputElement).files?.[0])} />
            </label>
          </div>

          <textarea class="forge__editor" spellcheck={false} aria-label="Lesson as YAML" value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />

          <div class="forge__issues" role="status" aria-live="polite">
            {parsed.issues.length > 0 ? (
              <div class="notice notice--bad">
                <strong>✗ {parsed.level ? 'One thing to fix' : 'Not a valid lesson yet'}</strong>
                <ul>
                  {parsed.issues.slice(0, 8).map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div class="notice notice--ok" style={{ marginTop: 0 }}>
                <strong>✓ Valid lesson.</strong> Try it in the preview, then keep it.
              </div>
            )}
          </div>

          <h2 style={{ marginTop: '1.5rem' }}>Keep it</h2>
          <div class="forge__bar">
            <button type="button" class="btn btn--primary" disabled={!level} onClick={() => level && store([level], `Saved "${level.title}" to this browser.`)}>
              Save to my lessons
            </button>
            <button type="button" class="btn" disabled={!level} onClick={() => download(fileName, text)}>
              Download {fileName}
            </button>
          </div>

          <h2 style={{ marginTop: '1.5rem' }}>Propose it for the game</h2>
          <p class="muted">
            Opens GitHub with the file filled in, in the world you pick. GitHub then walks you through a pull request; a
            maintainer reviews it before it goes live.
          </p>
          <div class="forge__bar">
            <label>
              <span class="visually-hidden">World</span>
              <select value={target} onChange={(e) => setTarget((e.target as HTMLSelectElement).value)}>
                {worlds.map((w) => (
                  <option value={w.id} key={w.id}>
                    World {w.order}: {w.title}
                  </option>
                ))}
              </select>
            </label>
            {level && !tooLong ? (
              <a class="btn" href={proposeUrl} target="_blank" rel="noopener noreferrer">
                Propose on GitHub
              </a>
            ) : (
              <button type="button" class="btn" disabled>
                Propose on GitHub
              </button>
            )}
          </div>
          {tooLong && <p class="muted">This lesson is too long for a prefilled link. Download the file and add it to content/worlds/{world?.dir}/ in a pull request.</p>}

          <h2 style={{ marginTop: '1.5rem' }}>Import from a link</h2>
          <div class="forge__bar">
            <label style={{ flex: '1 1 14rem', display: 'flex' }}>
              <span class="visually-hidden">Address of a lesson or pack file</span>
              <input type="url" style={{ flex: 1 }} placeholder="https://…/pack.json" value={packUrl} onInput={(e) => setPackUrl((e.target as HTMLInputElement).value)} />
            </label>
            <button type="button" class="btn" onClick={() => importUrl(packUrl.trim())}>
              Import
            </button>
          </div>

          <p role="status" aria-live="polite" class="muted">
            {msg}
          </p>
        </section>

        <section aria-label="Preview">
          <h2>Preview</h2>
          <div class="forge__preview">
            {preview ? <LevelPlayer key={previewKey} data={preview} persist={false} /> : <p style={{ padding: '2rem 0' }}>Fix the problems on the left and the lesson will appear here, ready to play.</p>}
          </div>
        </section>
      </div>

      <section style={{ marginTop: '3rem' }}>
        <h2>My lessons</h2>
        {mine.length === 0 ? (
          <p class="muted">Nothing saved yet. Lessons you save or import are kept in this browser only.</p>
        ) : (
          <ul class="mylessons">
            {mine.map((l) => (
              <li key={l.id}>
                <span>
                  <strong>{l.title}</strong> <span class="muted">{l.id}</span>
                </span>
                <span class="forge__bar" style={{ margin: 0 }}>
                  <a class="btn" href={`${playUrl}?id=${encodeURIComponent(l.id)}`}>
                    Play
                  </a>
                  <button type="button" class="btn" onClick={() => setText(YAML.stringify(l, { lineWidth: 88 }))}>
                    Edit
                  </button>
                  <button type="button" class="btn btn--quiet" onClick={() => remove(l.id)}>
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

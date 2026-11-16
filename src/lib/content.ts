/**
 * Reads the lessons from /content at build time. Nothing else touches the disk.
 * Folder and file names start with a number that sets the play order:
 *   content/worlds/01-brain/world.yaml
 *   content/worlds/01-brain/02-tokens.yaml
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { BeyondSchema, LevelSchema, WorldSchema, explain, type Beyond, type Level, type World } from './schema';

const ROOT = path.resolve(process.cwd(), 'content');

export interface LoadedWorld extends World {
  dir: string;
  levels: Level[];
}

function readYaml(file: string): unknown {
  return YAML.parse(fs.readFileSync(file, 'utf8'));
}

function fail(file: string, lines: string[]): never {
  throw new Error(`Invalid lesson file ${path.relative(process.cwd(), file)}\n  - ${lines.join('\n  - ')}`);
}

let cache: LoadedWorld[] | null = null;

export function loadWorlds(): LoadedWorld[] {
  if (cache) return cache;
  const worldsDir = path.join(ROOT, 'worlds');
  const worlds: LoadedWorld[] = [];
  for (const dir of fs.readdirSync(worldsDir).sort()) {
    const full = path.join(worldsDir, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    const worldFile = path.join(full, 'world.yaml');
    const w = WorldSchema.safeParse(readYaml(worldFile));
    if (!w.success) fail(worldFile, explain(w.error));
    const levels: Level[] = [];
    for (const f of fs.readdirSync(full).sort()) {
      if (f === 'world.yaml' || !/\.ya?ml$/.test(f)) continue;
      const file = path.join(full, f);
      const l = LevelSchema.safeParse(readYaml(file));
      if (!l.success) fail(file, explain(l.error));
      const expected = f.replace(/^\d+-/, '').replace(/\.ya?ml$/, '');
      if (l.data.id !== expected) fail(file, [`id is "${l.data.id}" but the file name says "${expected}"`]);
      levels.push(l.data);
    }
    const ids = levels.map((l) => l.id);
    if (new Set(ids).size !== ids.length) fail(worldFile, ['two levels in this world share an id']);
    worlds.push({ ...w.data, dir, levels });
  }
  worlds.sort((a, b) => a.order - b.order);
  const wids = worlds.map((w) => w.id);
  if (new Set(wids).size !== wids.length) throw new Error('Two worlds share an id');
  cache = worlds;
  return worlds;
}

export function loadBeyond(): Beyond {
  const file = path.join(ROOT, 'beyond.yaml');
  const b = BeyondSchema.safeParse(readYaml(file));
  if (!b.success) fail(file, explain(b.error));
  return b.data;
}

export function loadFacts(): Record<string, string> {
  const file = path.join(ROOT, 'facts.yaml');
  if (!fs.existsSync(file)) return {};
  const raw = readYaml(file) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]));
}

export interface TreeNode {
  content: string;
  children: TreeNode[];
  payload?: Record<string, unknown>;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The topic map is generated from the lessons, so a new lesson appears on it by itself. */
export function topicTree(worlds: LoadedWorld[], href: (p: string) => string, rootTitle: string): TreeNode {
  return {
    content: `<strong>${esc(rootTitle)}</strong>`,
    // Worlds with no written lessons start folded so the written ones stay readable.
    children: worlds.map((w) => {
      const node = worldTree(w, href);
      if (w.levels.length === 0) node.payload = { ...node.payload, fold: 1 };
      return node;
    }),
  };
}

export function worldTree(w: LoadedWorld, href: (p: string) => string): TreeNode {
  return {
    content: `<a href="${href(`worlds/${w.id}/`)}">${w.order}. ${esc(w.title)}</a>`,
    payload: { world: w.order },
    children: [
      ...w.levels.map((l) => ({
        content: `<a href="${href(`play/${w.id}/${l.id}/`)}">${esc(l.title)}</a>`,
        payload: { world: w.order },
        children: l.concepts.map((c) => ({ content: esc(c), children: [], payload: { world: w.order } })),
      })),
      ...(w.planned ?? []).map((p) => ({
        content: `<em>${esc(p.title)}</em>`,
        payload: { world: w.order, fold: 1 },
        children: (p.concepts ?? []).map((c) => ({ content: esc(c), children: [], payload: { world: w.order } })),
      })),
    ],
  };
}

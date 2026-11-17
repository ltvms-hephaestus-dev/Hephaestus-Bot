/**
 * Keeps REPO_MAP.md in step with the repository. It checks what can be checked
 * mechanically: every file is named, every named path exists, and the numbers in
 * the map match the content. Whether the descriptions are still true is for
 * reviewers. See "Keeping this map current" in REPO_MAP.md.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadWorlds } from '../src/lib/content';
import { SCENE_NAMES } from '../src/scenes';

const ROOT = path.resolve('.');
const map = fs.readFileSync(path.join(ROOT, 'REPO_MAP.md'), 'utf8');
const worlds = loadWorlds();

/** Folders whose files the map must name; also the only prefixes checked for existence. */
const TOP = ['.github', 'content', 'docs', 'public', 'scripts', 'src', 'tests'];

function trackedFiles(): string[] | null {
  try {
    return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return null; // not a git checkout (for example a downloaded zip)
  }
}

/** The text of one "## Heading" section of the map. */
function section(start: string): string {
  const parts = map.split(/^## /m);
  const found = parts.find((p) => p.startsWith(start));
  if (!found) throw new Error(`REPO_MAP.md has no section starting "## ${start}"`);
  return found;
}

/** Table rows of a section, as trimmed cells. */
function rows(text: string): string[][] {
  return text
    .split('\n')
    .filter((l) => l.startsWith('| ') && !/^\|\s*-/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

const files = trackedFiles();

describe.skipIf(!files)('REPO_MAP.md names every file', () => {
  it('every tracked file, or its world folder, is named in backticks', () => {
    const required = new Set<string>();
    for (const f of files!) {
      const lesson = /^(content\/worlds\/[^/]+\/)(\d+-[^/]+\.ya?ml|world\.yaml)$/.exec(f);
      if (lesson) required.add(lesson[1]!);
      else if (f.startsWith('docs/prompts/')) required.add('docs/prompts/');
      else required.add(f);
    }
    const missing = [...required].filter((p) => !map.includes(`\`${p}\``)).sort();
    expect(missing, `Add these to REPO_MAP.md:\n  ${missing.join('\n  ')}`).toEqual([]);
  });
});

describe('REPO_MAP.md names nothing that is gone', () => {
  it('every path in backticks under a top-level folder exists', () => {
    const named = [...map.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]!);
    const paths = named.filter((p) => TOP.includes(p.split('/')[0]!) && p.includes('/') && !/[<>*?{}[\]]/.test(p.replace(/\[(world|level)\]/g, '')));
    const gone = [...new Set(paths)].filter((p) => !fs.existsSync(path.join(ROOT, p))).sort();
    expect(gone, `REPO_MAP.md names paths that no longer exist:\n  ${gone.join('\n  ')}`).toEqual([]);
  });
});

describe('REPO_MAP.md numbers match the content', () => {
  it('the level, world and board counts at a glance', () => {
    const glance = section('At a glance');
    const levels = /\*\*Levels:\*\* (\d+) in (\d+) worlds/.exec(glance);
    const boards = /\*\*Boards:\*\* (\d+)/.exec(glance);
    expect(levels, 'expected a line "**Levels:** N in M worlds"').not.toBeNull();
    expect(boards, 'expected a line "**Boards:** N"').not.toBeNull();
    expect(Number(levels![1])).toBe(worlds.reduce((n, w) => n + w.levels.length, 0));
    expect(Number(levels![2])).toBe(worlds.length);
    expect(Number(boards![1])).toBe(SCENE_NAMES.length);
  });

  it('the worlds table has one row per world, with the right level count and boards', () => {
    const table = rows(section('Lesson data')).filter((r) => r[0]?.startsWith('`content/worlds/'));
    expect(table.map((r) => r[0])).toEqual(worlds.map((w) => `\`content/worlds/${w.dir}/\``));
    for (const w of worlds) {
      const row = table.find((r) => r[0] === `\`content/worlds/${w.dir}/\``)!;
      expect(row[1], `${w.dir}: URL id`).toBe(`\`${w.id}\``);
      expect(Number(row[4]), `${w.dir}: level count`).toBe(w.levels.length);
      const used = [...new Set(w.levels.map((l) => l.scene.type))].sort();
      expect(row[5]!.split(',').map((s) => s.trim()).sort(), `${w.dir}: boards used`).toEqual(used);
    }
  });

  it('the boards table lists exactly the registered boards, with the worlds that use them', () => {
    const table = rows(section('Boards')).filter((r) => /^`[a-z]+`$/.test(r[0] ?? ''));
    expect(table.map((r) => r[0]!.slice(1, -1)).sort()).toEqual([...SCENE_NAMES].sort());
    for (const r of table) {
      const name = r[0]!.slice(1, -1);
      const actual = worlds.filter((w) => w.levels.some((l) => l.scene.type === name)).map((w) => w.order);
      const listed = r[r.length - 1]!.split(',').flatMap((part) => {
        const range = /^(\d+) to (\d+)$/.exec(part.trim());
        if (range) return Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, i) => Number(range[1]) + i);
        return /^\d+$/.test(part.trim()) ? [Number(part.trim())] : [];
      });
      expect(listed, `board ${name}: "Used in worlds"`).toEqual(actual);
    }
  });
});

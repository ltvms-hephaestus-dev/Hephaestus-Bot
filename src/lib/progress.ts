/**
 * Progress lives in this browser only. Storage can be blocked or full, so every
 * read and write is guarded: the game still plays, it just forgets.
 */
import type { Lang } from '../config';
import type { Level } from './schema';

export const PROGRESS_KEY = 'hephaestus-bot:v1';
export const LESSONS_KEY = 'hephaestus-bot:my-lessons:v1';

export interface Store {
  lang: Lang;
  /** fullId -> ISO date the level was solved. */
  solved: Record<string, string>;
}

const empty = (): Store => ({ lang: 'python', solved: {} });

export function readStore(): Store {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { lang: parsed.lang === 'typescript' ? 'typescript' : 'python', solved: parsed.solved ?? {} };
  } catch {
    return empty();
  }
}

export function writeStore(patch: Partial<Store>): Store {
  const next = { ...readStore(), ...patch };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('hb:progress'));
  } catch {
    /* storage unavailable: keep playing without saving */
  }
  return next;
}

export function markSolved(fullId: string): void {
  const s = readStore();
  if (s.solved[fullId]) return;
  writeStore({ solved: { ...s.solved, [fullId]: new Date().toISOString() } });
}

export function readMyLessons(): Level[] {
  try {
    const raw = localStorage.getItem(LESSONS_KEY);
    return raw ? (JSON.parse(raw) as Level[]) : [];
  } catch {
    return [];
  }
}

/** Returns false when the browser refused to store the lessons. */
export function writeMyLessons(levels: Level[]): boolean {
  try {
    localStorage.setItem(LESSONS_KEY, JSON.stringify(levels));
    return true;
  } catch {
    return false;
  }
}

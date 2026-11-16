/** Build-time helpers that turn loaded worlds into what pages need. */
import { loadFacts, loadWorlds, type LoadedWorld } from './content';
import { renderMd } from './markdown';
import { prepare, type Prepared } from './prepare';
import type { Level } from './schema';
import { url } from './url';

export const levelHref = (w: { id: string }, l: { id: string }) => url(`play/${w.id}/${l.id}/`);
export const worldHref = (w: { id: string }) => url(`worlds/${w.id}/`);
export const fullId = (w: { id: string }, l: { id: string }) => `${w.id}/${l.id}`;

export function allLevels(worlds: LoadedWorld[] = loadWorlds()) {
  return worlds.flatMap((w) => w.levels.map((l) => ({ id: fullId(w, l), href: levelHref(w, l), title: l.title })));
}

export function prepareOfficial(world: LoadedWorld, level: Level, worlds: LoadedWorld[] = loadWorlds()): Prepared {
  const facts = loadFacts();
  const i = world.levels.findIndex((l) => l.id === level.id);
  const prev = world.levels[i - 1];
  const next = world.levels[i + 1];
  const laterWorld = worlds.find((w) => w.order > world.order);

  let nextHref: string | undefined;
  let nextLabel: string | undefined;
  if (next) {
    nextHref = levelHref(world, next);
  } else if (laterWorld?.levels[0]) {
    nextHref = levelHref(laterWorld, laterWorld.levels[0]);
    nextLabel = `Start World ${laterWorld.order}: ${laterWorld.title}`;
  } else if (laterWorld) {
    nextHref = worldHref(laterWorld);
    nextLabel = `See what World ${laterWorld.order} will teach`;
  } else {
    nextHref = url('beyond/');
    nextLabel = 'You finished the game. See where to go next';
  }

  return prepare(
    level,
    { id: world.id, title: world.title, order: world.order, part: world.part },
    (md) => renderMd(md, facts),
    {
      fullId: fullId(world, level),
      position: { index: i + 1, total: world.levels.length },
      nav: { prev: prev ? levelHref(world, prev) : undefined, next: nextHref, nextLabel, world: worldHref(world) },
    },
  );
}

/**
 * A "prepared" level is a level plus everything the player needs to show it:
 * rendered HTML, where it sits in its world, and where to go next. The player
 * receives this and does not care whether it came from the build or the Forge.
 */
import type { Level } from './schema';

export interface WorldRef {
  id: string;
  title: string;
  order: number;
  part: string;
}

export interface Prepared {
  /** Used as the progress key, e.g. "brain/tokens" or "custom/my-lesson". */
  fullId: string;
  level: Level;
  html: { lesson: string; goal: string; success: string; hints: string[] };
  world: WorldRef;
  position: { index: number; total: number };
  nav: { prev?: string; next?: string; nextLabel?: string; world: string };
}

export function prepare(
  level: Level,
  world: WorldRef,
  render: (md: string) => string,
  extra: Pick<Prepared, 'fullId' | 'position' | 'nav'>,
): Prepared {
  return {
    ...extra,
    level,
    world,
    html: {
      lesson: render(level.lesson),
      goal: render(level.goal),
      success: render(level.success),
      hints: level.hints.map(render),
    },
  };
}

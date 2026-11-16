/** GET /api/levels/<world>/<level>.json: one lesson, exactly as the Forge reads it. */
import type { APIRoute } from 'astro';
import { loadWorlds } from '../../../../lib/content';

export function getStaticPaths() {
  return loadWorlds().flatMap((w) => w.levels.map((l) => ({ params: { world: w.id, level: l.id } })));
}

export const GET: APIRoute = ({ params }) => {
  const w = loadWorlds().find((x) => x.id === params.world)!;
  const l = w.levels.find((x) => x.id === params.level)!;
  return new Response(JSON.stringify(l, null, 2), { headers: { 'content-type': 'application/json' } });
};

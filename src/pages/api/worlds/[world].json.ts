/** GET /api/worlds/<id>.json: a world's lessons as a pack the Forge can import. */
import type { APIRoute } from 'astro';
import { loadWorlds } from '../../../lib/content';

export function getStaticPaths() {
  return loadWorlds().map((w) => ({ params: { world: w.id } }));
}

export const GET: APIRoute = ({ params }) => {
  const w = loadWorlds().find((x) => x.id === params.world)!;
  const body = {
    hephaestus: 1,
    title: w.title,
    world: { id: w.id, order: w.order, part: w.part, question: w.question, summary: w.summary, planned: w.planned ?? [] },
    levels: w.levels,
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'content-type': 'application/json' } });
};

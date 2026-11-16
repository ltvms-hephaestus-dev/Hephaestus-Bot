/**
 * Read-only API. The site is static, so these are plain JSON files generated at
 * build time. GET /api/index.json lists everything and links to the rest.
 */
import type { APIRoute } from 'astro';
import { SITE } from '../../config';
import { loadFacts, loadWorlds } from '../../lib/content';
import { url } from '../../lib/url';

export const GET: APIRoute = ({ site }) => {
  const abs = (p: string) => new URL(url(p), site).href;
  const body = {
    name: SITE.name,
    format: 1,
    license: { code: 'MIT', lessons: 'CC BY 4.0' },
    facts: loadFacts(),
    schema: abs('api/schema.json'),
    worlds: loadWorlds().map((w) => ({
      id: w.id,
      order: w.order,
      title: w.title,
      part: w.part,
      question: w.question,
      summary: w.summary,
      page: abs(`worlds/${w.id}/`),
      /** Every written lesson of this world as one importable pack. */
      pack: abs(`api/worlds/${w.id}.json`),
      levels: w.levels.map((l) => ({
        id: l.id,
        title: l.title,
        concepts: l.concepts,
        type: l.challenge.type,
        play: abs(`play/${w.id}/${l.id}/`),
        data: abs(`api/levels/${w.id}/${l.id}.json`),
      })),
      planned: w.planned ?? [],
    })),
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'content-type': 'application/json' } });
};

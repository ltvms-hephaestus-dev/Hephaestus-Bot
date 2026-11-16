/** GET /api/schema.json: the lesson format as JSON Schema, generated from schema.ts. */
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { LevelSchema, PackSchema } from '../../lib/schema';

export const GET: APIRoute = () => {
  const body = {
    $comment:
      'Generated from src/lib/schema.ts. A few cross-field rules (for example, blanks in the code must match the "blanks" map) are checked by the game but cannot be expressed here.',
    level: z.toJSONSchema(LevelSchema, { unrepresentable: 'any', io: 'input' }),
    pack: z.toJSONSchema(PackSchema, { unrepresentable: 'any', io: 'input' }),
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'content-type': 'application/json' } });
};

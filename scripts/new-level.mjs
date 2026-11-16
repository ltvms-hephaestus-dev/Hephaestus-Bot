#!/usr/bin/env node
// Creates the next numbered lesson file in a world.
// Usage: npm run new:level -- <world-folder> <lesson-id>
//   e.g. npm run new:level -- 02-voice one-http-request
import fs from 'node:fs';
import path from 'node:path';

const [world, id] = process.argv.slice(2);
const worldsDir = path.resolve('content/worlds');
const available = fs.readdirSync(worldsDir).filter((d) => fs.statSync(path.join(worldsDir, d)).isDirectory());

if (!world || !id) {
  console.error(`Usage: npm run new:level -- <world-folder> <lesson-id>\nWorlds: ${available.join(', ')}`);
  process.exit(1);
}
if (!available.includes(world)) {
  console.error(`No world folder "${world}". Choose one of: ${available.join(', ')}`);
  process.exit(1);
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('The lesson id must be lowercase letters, digits and dashes, e.g. "one-http-request".');
  process.exit(1);
}

const dir = path.join(worldsDir, world);
const lessons = fs.readdirSync(dir).filter((f) => /^\d+-.*\.ya?ml$/.test(f));
if (lessons.some((f) => f.replace(/^\d+-/, '').replace(/\.ya?ml$/, '') === id)) {
  console.error(`A lesson with id "${id}" already exists in ${world}.`);
  process.exit(1);
}
const next = String(Math.max(0, ...lessons.map((f) => parseInt(f, 10))) + 1).padStart(2, '0');
const file = path.join(dir, `${next}-${id}.yaml`);

const title = id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
fs.writeFileSync(
  file,
  `id: ${id}
title: ${title}
concepts:
  - first concept

lesson: |
  Explain one idea in plain words, under 250 words.

goal: |
  Tell the player exactly what to do.

scene:
  type: robot
  say: What the robot says before the player answers.

challenge:
  type: fill
  code:
    python: |
      answer = "{{word}}"
    typescript: |
      const answer = "{{word}}";
  blanks:
    word:
      placeholder: word
      accept: { equals: change-me }
      feedback: Shown when this blank is wrong.

hints:
  - A gentle nudge.
  - Nearly the answer.

success: |
  Why the answer is right, and what it means in practice.

links:
  - title: A primary source
    url: https://example.com/replace-me
    kind: docs
  - title: Another one
    url: https://example.com/replace-me-too
    kind: article

solution: { word: change-me }
wrong: { word: something-else }
`,
);

console.log(`Created ${path.relative(process.cwd(), file)}`);
console.log('Edit it, then run "npm test". If the lesson was listed under "planned:" in world.yaml, remove it from there.');

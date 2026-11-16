# Candidate build prompts

Four complete prompts written from the same confirmed spec, each with a different
strategy. They were scored and merged into [`BUILD_PROMPT.md`](./BUILD_PROMPT.md).
Kept here so future contributors can see why the final prompt looks the way it does.

Shared facts every candidate assumes (the confirmed spec):

- **Product:** Hephaestus Bot, a free browser game (Flexbox Froggy format) that takes a
  developer from zero AI knowledge to building with LLMs, MCP and agents.
- **Learner:** can code (functions, JSON, HTTP), knows no AI.
- **Path:** 7 worlds, 45 levels: Brain (how LLMs work) → Voice (LLMs from code) →
  Memory and hands (knowledge and tools) → Universal plug (MCP) → Autonomy (agents) →
  Street smarts (production) → Graduation (capstone).
- **Each level:** short lesson, a code challenge in Python and TypeScript with instant
  visual feedback, a topic map, 2-4 primary-source links, graded hints.
- **Constraints:** fully simulated (no API keys, no backend), static hosting on GitHub
  Pages, English but translation-ready, MIT code + CC BY 4.0 content.
- **Extensible:** new lessons and new worlds can be added later without touching engine
  code, including from the browser.
- **Out of scope for v1:** real model calls, accounts, leaderboards, analytics,
  translations, model training and fine-tuning maths, framework tutorials. These get a
  "Beyond" page of curated links instead.

---

## Candidate A: Spec-first

*Strategy: a full requirements document. The builder plans, then implements.*

```text
You are building Hephaestus Bot, an open-source learning game for developers.

CONTEXT
Developers are told to "use AI" without understanding it. Hephaestus Bot teaches the
whole stack in order (LLMs, APIs, tools, MCP, agents, production) the way Flexbox
Froggy teaches CSS: one tiny idea per level, a few characters of real code to type,
and a picture that reacts immediately. The player forges a robot; each world adds a
part. The learner can already program but has never used an LLM.

REQUIREMENTS
R1  Seven worlds, 45 levels, in the order given in the spec. Each world must answer
    the question the previous one raises.
R2  Level page: lesson (under 250 words), challenge, reactive board, hints, links.
R3  Challenge types: fill-in-the-blank code, multiple choice, put-in-order, write
    JSON. Checking is deterministic and runs in the browser.
R4  Every code snippet exists in Python and TypeScript; a toggle switches both.
R5  Topic map per world and for the whole game, generated from lesson data.
R6  Progress is stored in the browser only. No accounts, no tracking.
R7  A "Beyond" page links to resources for everything out of scope.
R8  Lessons are data files validated by a published schema. Adding a lesson or a
    world requires no engine change.
R9  An in-browser lesson builder can create, preview, import and export lessons, and
    hand a finished lesson to GitHub as a proposed file.
R10 Read-only JSON endpoints expose every world, level and the schema.
R11 Accessible: keyboard operable, visible focus, status never by colour alone,
    reduced motion respected.
R12 MCP content follows spec revision 2026-07-28 (stateless; no initialize handshake).
R13 Version-sensitive facts live in one file with a "last verified" date.

NON-GOALS
Real model calls, backend, accounts, analytics, translations, training maths,
framework tutorials.

STACK
Astro (static output), TypeScript, Preact islands, Zod, YAML content, Vitest,
GitHub Actions deploying to GitHub Pages.

PROCESS
First write a short plan covering data model, checker design and page list. Then
implement. If a requirement is ambiguous, choose the simplest reading, note it in
DECISIONS.md and continue. Ask only if a choice cannot be undone.

DONE WHEN
All 45 levels are playable in both languages, tests pass, the site builds and deploys.
```

## Candidate B: Phased

*Strategy: ordered milestones, each ending in something that runs.*

```text
Build Hephaestus Bot (spec above) in six milestones. Do not start a milestone until
the previous one's check passes. Commit at the end of each.

M1 Walking skeleton
   Astro project, one hard-coded level, a fill-in-the-blank challenge that turns
   green when correct, deployed build artifact.
   Check: `npm run build` succeeds; the level can be solved in a browser.

M2 Lessons as data
   Level and world schema, YAML loader, checker for all four challenge types,
   language toggle, progress in localStorage.
   Check: unit tests for the checker; a second level added by creating one file.

M3 The board
   Robot mascot plus reactive scenes (probability bars, tokens, embeddings,
   attention, context window). Scene parameters bind to blanks in the code.
   Check: typing in a blank changes the board without pressing Check.

M4 World 1 complete
   Seven levels on how LLMs work, with hints, links and reference solutions.
   Check: CI proves every reference solution passes and a wrong answer fails.
   STOP and show the owner. Adjust tone and difficulty before writing more.

M5 Reach
   Topic maps, Beyond page, lesson builder with import/export and GitHub handoff,
   JSON endpoints, README and CONTRIBUTING, deploy workflow.
   Check: a lesson made in the builder plays without rebuilding the site.

M6 Worlds 2-7
   One world per commit, each adding only content plus any new scene it needs.
   Check: same CI gate as M4, link checker green.

Rules: no backend, no API keys, no tracking. Python and TypeScript on every snippet.
When unsure, pick the option that keeps lessons as plain data, and write it down.
```

## Candidate C: Acceptance-driven

*Strategy: the work is defined by checks. Build until they pass.*

```text
Build Hephaestus Bot (spec above). You are finished when every item below is true,
and each is verified by a command or a test, not by inspection.

CONTENT GATES (automated, run in CI)
- Every level file validates against the schema.
- Level ids are unique; every world lists its levels in play order.
- Every code template has a Python and a TypeScript variant with identical blanks.
- Every level ships a reference solution; the checker accepts it.
- For every level, an empty answer and one authored wrong answer are rejected.
- Every level has 2-4 links, all https, each with a title and a kind.
- Levels that count tokens are checked against the real tokenizer, not a stored number.
- No MCP lesson mentions an initialize handshake or session id as current behaviour.

BEHAVIOUR GATES
- Solving a level stores progress; reloading keeps it; clearing storage resets it.
- Changing a bound blank updates the board within one frame, before Check is pressed.
- The language toggle changes every snippet on the page and survives reload.
- The whole game is playable with the keyboard alone.
- With JavaScript storage blocked, the game still plays (progress is simply not kept).

EXTENSIBILITY GATES
- Adding `content/worlds/<new>/world.yaml` plus one level file makes a new world
  appear on the home page, in the topic map and in the JSON endpoints. No code edits.
- A lesson authored in the browser builder validates with the same schema, previews
  live, exports as a file, and can be re-imported from a file or a URL.
- Imported lesson text is sanitised before it is rendered.

DELIVERY GATES
- `npm test` and `npm run build` pass on a clean clone.
- A GitHub Actions workflow tests, builds and deploys to GitHub Pages on push to main.
- A scheduled workflow checks external links and reports failures.

If a gate cannot be met, say which one and why. Do not weaken a gate silently.
```

## Candidate D: Architecture-led

*Strategy: fix the structure and interfaces first; leave detail to the builder.*

```text
Build Hephaestus Bot (spec above) on this architecture. The interfaces are fixed;
implementation inside each box is yours.

content/                 Plain data. The only place lessons live.
  worlds/<nn-id>/world.yaml      id, title, part, colour, summary, planned[]
  worlds/<nn-id>/<nn-id>.yaml    one level
  beyond.yaml, facts.yaml

src/lib/schema.ts        Zod. Single source of truth for Level, World, Pack.
                         Used by the build, the tests, the browser builder and
                         exported as JSON Schema.
src/lib/check.ts         check(level, answer) -> { ok, feedback[] }. Pure, async,
                         no DOM. One function per challenge type in a registry.
src/lib/content.ts       Reads content/ at build time. Nothing else touches the disk.
src/scenes/              Registry: name -> component(props: { config, values, status }).
                         Scenes read answers; they never decide correctness.
src/components/LevelPlayer   Takes one prepared level as props. Does not know
                         whether it came from the build or from the browser.
src/pages/api/*.json     Static, read-only mirror of content plus the schema.
/forge                   Builder: edit as YAML, validate, preview with LevelPlayer,
                         save locally, export, import from file or URL, open a
                         prefilled "new file" page on GitHub.

Invariants
1. A level is data. New levels never need engine changes; new scene types do, and
   that is the only extension point that needs code.
2. The same Level object flows through build, API, builder and player.
3. Correctness is decided only in check.ts, so CI can prove every solution.
4. Untrusted lesson text is sanitised at the edge where it enters.
5. Every internal link goes through one helper that applies the site base path.
6. UI strings live in one dictionary so a locale can be added without code edits.

Stack: Astro static output, Preact islands, TypeScript, Vitest, GitHub Pages.
Record any deviation from this structure in DECISIONS.md with the reason.
```

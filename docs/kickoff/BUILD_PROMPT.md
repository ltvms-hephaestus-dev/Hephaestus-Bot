# Hephaestus Bot: build prompt

The single prompt this project is built from. Hand it to a coding agent to rebuild or
extend the game. See [`candidate-prompts.md`](./candidate-prompts.md) for the four
drafts it was merged from.

```text
ROLE AND CONTEXT
You are building Hephaestus Bot, a free, open-source browser game that teaches
developers how AI systems work, in the format of Flexbox Froggy: one small idea per
level, a few characters of real code to type, and a picture that reacts at once.
The player forges a robot; each world adds a part. The learner can already program
(functions, JSON, HTTP) and has never used an LLM. Many developers are asked to
"use AI" without a mental model of it; this game gives them one, in the order the
ideas depend on each other.

GOAL AND DEFINITION OF DONE
A learner who finishes can call a model API, write an MCP server, and build and
debug an agent. Done means: all levels are playable in Python and TypeScript, every
reference solution is proven by CI, the site deploys from main, and a new lesson can
be added without touching engine code.

SCOPE
In: seven worlds, 45 levels.
  1 Brain: next-token prediction, tokens, embeddings, attention, sampling,
    context window, training/cutoff/hallucination
  2 Voice: API request, roles, statelessness, streaming, tokens as cost, prompting,
    structured output
  3 Memory and hands: why outside knowledge, similarity search, RAG pipeline,
    tool calling, tool schemas, call/result round trip, tool errors
  4 Universal plug (MCP): the integration problem, host/client/server,
    tools/resources/prompts, JSON-RPC messages, transports, write a server,
    auth and security
  5 Autonomy: model + tools + loop, workflows vs agents, workflow patterns,
    orchestrator and evaluator loops, stop conditions, memory, context engineering
  6 Street smarts: subagents, evals, guardrails and prompt injection,
    human-in-the-loop, reading traces, cost and caching
  7 Graduation: anatomy of a coding agent, trace a request end to end, debug a
    broken run, pick the simplest architecture
Each level: lesson under 250 words, one challenge, a reactive board, graded hints,
2-4 primary-source links, concepts that feed the topic map.
Also in: a Beyond page of curated links for everything out of scope; an in-browser
lesson builder; read-only JSON endpoints.
Out: real model calls, any backend, accounts, leaderboards, analytics, translations
beyond English, training and fine-tuning maths, framework-specific tutorials.

STACK AND ARCHITECTURE
Astro (static output) + TypeScript + Preact islands + Zod + YAML + Vitest, deployed
to GitHub Pages by GitHub Actions. Fixed structure:
  content/worlds/<nn-id>/world.yaml and <nn-id>.yaml   lessons are plain data
  content/beyond.yaml, content/facts.yaml              links; version-sensitive facts
  src/lib/schema.ts    one Zod schema for Level, World and Pack, reused by the
                       build, tests, builder and exported as JSON Schema
  src/lib/check.ts     check(level, answer) -> {ok, feedback}; pure, no DOM
  src/scenes/          registry of board scenes; they show answers, never judge them
  src/components/LevelPlayer   plays one prepared level, wherever it came from
  src/pages/api/       static JSON mirror of the content
  /forge               builder: edit, validate, preview, save, export, import from
                       file or URL, open a prefilled new-file page on GitHub
Invariants: a level is data (only new scene types need code); the same Level object
flows through build, API, builder and player; correctness is decided only in
check.ts; untrusted lesson text is sanitised where it enters; every internal link
uses one base-path helper; UI strings live in one dictionary.

BUILD PLAN
M1 Skeleton: one hard-coded level that turns green. Check: build succeeds.
M2 Lessons as data: schema, loader, four challenge types (fill, choice, order,
   json), language toggle, progress. Check: checker unit tests; second level = one file.
M3 Board: robot plus scenes whose parameters bind to code blanks.
   Check: typing changes the board before Check is pressed.
M4 World 1 complete. Check: CI gates below. STOP and show the owner before M6.
M5 Reach: topic maps, Beyond page, Forge, JSON endpoints, docs, deploy workflow.
   Check: a lesson made in the Forge plays without rebuilding.
M6 Worlds 2-7, one world per commit. Check: CI gates, link check.

CI GATES (must stay green)
- every level validates; ids unique
- Python and TypeScript templates have identical blanks
- every reference solution passes; empty and authored wrong answers fail
- token-count levels are verified with the real tokenizer
- 2-4 https links per level
- adding a world folder with one level makes it appear everywhere, no code edits

CONSTRAINTS AND PITFALLS
- MCP lessons follow spec revision 2026-07-28: stateless requests, no initialize
  handshake, no session id. Most older tutorials are wrong on this.
- Model names, prices and SDK versions go in content/facts.yaml with a
  "last verified" date, never inline in lessons.
- Do not grade with an LLM; grading must be deterministic.
- No API keys, no tracking, no third-party requests at page load. Fonts self-hosted.
- Keyboard operable, visible focus, status never by colour alone, reduced motion.
- Teach durable concepts; prefer "start simple, add agency only when needed".

WORKING RULES
If something is ambiguous, pick the option that keeps lessons as plain data, record
it in docs/DECISIONS.md and continue. Ask first only when a choice cannot be undone.
Never weaken a CI gate silently. Commit per milestone with a message that says what
a player can now do.

DELIVERABLES
Source repository, passing tests, deploy workflow, README (play, run, add a lesson),
CONTRIBUTING (lessons, scenes, translations), LICENSE (MIT) and LICENSE-CONTENT
(CC BY 4.0), docs/DECISIONS.md.
```

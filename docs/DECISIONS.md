# Decisions and known gaps

Short notes on choices that were not obvious, and on places where the project does not
yet match its own [build prompt](./kickoff/BUILD_PROMPT.md).

## Decisions

- **Astro 7, not 6.** The research brief named Astro 6; version 7 was current when the
  project was created. Nothing in the design depends on the difference.
- **Lessons are YAML read from disk**, not an Astro content collection. One small loader
  (`src/lib/content.ts`) is shared by the build, the tests and the scripts, and there is
  no framework-specific step between a contributor's file and the game.
- **Navigation is open.** Any level can be opened at any time, as in Flexbox Froggy.
  Order is recommended, not enforced.
- **The topic map is generated** from each lesson's `concepts`. Nobody maintains it by
  hand, so it cannot drift from the lessons.
- **Board data is illustrative.** Probabilities, attention weights and embedding
  coordinates in World 1 are hand-written to teach the idea clearly. They are not
  measurements from a real model, and the lessons say so where it matters. The
  tokenizer is real (`o200k_base`).
- **Checking is deterministic.** No model grades an answer. Open-ended levels (for
  example "write any text that is exactly 4 tokens") are checked with a rule, here the
  real tokenizer.
- **The API is read-only.** The site is static. Lessons can be created, previewed,
  imported and exported in the browser, and proposed to the repository through a
  prefilled GitHub link. Publishing to the official game is always a pull request.
- **Imported lessons are untrusted.** Their Markdown is sanitised before rendering, and
  the schema only allows `https` links. A lesson can still contain a slow regular
  expression; that can only slow down the browser of the person who imported it.
- **Temper colours** (straw, gold, bronze, purple, violet, blue, pale blue) are the
  colours steel shows as it is heated, used as the world colours. An eighth world
  starts the cycle again.
- **Copyright holder** is "Hephaestus Bot contributors". Change `LICENSE` if the
  repository owner wants a named holder.

- **World 2 uses a made-up API, `forge-1` and `client.messages.create`.** It has the
  shape most providers share (a model, a list of messages, a token limit, a separate
  system prompt, usage counts, streaming events), so the lessons do not age with any
  one provider's model names. Where providers differ, the lesson says so.
- **Prices in World 2 are examples** ($3 and $15 per million tokens) and are labelled as
  such on the board. Real prices belong in the linked pricing pages, not in lessons.
- **One board serves all of World 2.** The `messages` scene shows a request and its
  reply, and lessons describe the alternative outcomes as data (`cases`). No lesson
  in World 2 needed code of its own, and Worlds 3 and 4 can reuse the scene for tool
  calls and JSON-RPC.

## Known gaps

- **Worlds 3 to 7 are outlines.** Their lessons are listed under `planned:` in each
  `world.yaml`. They still need new scenes: a retrieval view, an agent loop and a
  run trace.
- **Interface strings are still inside the components.** The build prompt asks for one
  dictionary. This is the first step for translations; see CONTRIBUTING.
- **Some links were written from memory and not machine-checked** at creation time,
  because the build environment could not reach them. The weekly link-check workflow
  will flag any that are wrong. They are the 3Blue1Brown, Transformer Explainer,
  OpenAI tokenizer, minbpe, Illustrated Word2vec, Embedding Projector, LLM
  Visualization, arXiv, Hugging Face blog and docs, YouTube, nanoGPT, Ollama, fast.ai,
  LLMs-from-scratch, PEFT, Pydantic AI, LlamaIndex, MCP SDK repositories, Microsoft
  AI Agents for Beginners, Simon Willison and Hamel Husain links; and, in World 2, the
  Gemini text-generation page, MDN server-sent events, the Anthropic prompt tutorial
  repository, promptingguide.ai, json-schema.org, Zod and Pydantic.
- **No end-to-end browser test is committed.** Every level was played wrong and then
  right in headless Chrome during development, but that script is not part of CI.
- **Challenges are designed for a keyboard and a wide screen.** They work on a phone;
  the board moves between the lesson and the task.

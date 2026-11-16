# Hephaestus Bot

**Forge a robot. Understand AI.**

A free browser game that teaches developers how AI systems work, in the spirit of
[Flexbox Froggy](https://flexboxfroggy.com/): one small idea per level, a few characters
of real code to type, and a picture that reacts as you type. You start with an empty
robot shell and add a part in every world.

Play it: <https://ltvms-hephaestus-dev.github.io/Hephaestus-Bot/> (once GitHub Pages is
enabled for this repository; see [Deploying](#deploying)).

## What you learn

The order matters. Each world answers the question the one before it raises.

| # | World | The robot gets | Status |
|---|---|---|---|
| 1 | How LLMs work | Brain | **Playable, 7 levels** |
| 2 | LLMs from code | Voice | **Playable, 7 levels** |
| 3 | Knowledge and tools | Memory and hands | **Playable, 7 levels** |
| 4 | Model Context Protocol | Universal plug | **Playable, 7 levels** |
| 5 | Agents | Autonomy | **Playable, 7 levels** |
| 6 | Agentic systems in production | Street smarts | **Playable, 6 levels** |
| 7 | Capstone: real code | Graduation | **Playable, 4 levels** |

Every level has a short lesson, a code challenge in **Python and TypeScript**, a board
that reacts to your answer, graded hints, and links to primary sources. All concepts
appear on a topic map that is generated from the lessons.

Nothing is sent anywhere. There are no accounts, no API keys and no tracking. Progress
is stored in your browser. Topics the game leaves out on purpose (real API calls,
training, fine-tuning, frameworks) have a curated links page, "Beyond the game".

## Run it locally

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev      # http://localhost:4321/Hephaestus-Bot/
npm test         # proves every lesson's reference answer passes its checker
npm run build    # static site in dist/
```

## Add a lesson

A lesson is one YAML file. There are three ways to add one, and none of them needs you
to touch the engine.

1. **In the browser.** Open the *Lesson forge* page on the site. Write the lesson on the
   left, play it on the right as you type, then press *Propose on GitHub*. That opens
   GitHub with the file filled in and walks you through a pull request.
2. **From the command line.**
   ```bash
   npm run new:level -- 02-voice one-http-request
   ```
   This creates the next numbered file in that world from a template.
3. **By hand.** Copy any file in `content/worlds/01-brain/` and edit it.

Then run `npm test`. The tests refuse a lesson whose own reference answer does not
pass, whose wrong answer is accepted, or whose Python and TypeScript blanks differ.

To add a **new world**, create a folder such as `content/worlds/08-voice-agents/` with a
`world.yaml` and at least one lesson. It appears on the home page, the topic map and the
JSON endpoints by itself.

The full format is in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Lesson data as JSON

The site is static, so the API is read-only: plain JSON files generated at build time.

| Endpoint | Contents |
|---|---|
| `/api/index.json` | Every world and level, with links to the rest |
| `/api/worlds/<world>.json` | A world's lessons as one pack |
| `/api/levels/<world>/<level>.json` | One lesson, in the format the forge reads |
| `/api/schema.json` | The lesson format as JSON Schema |

A pack can be loaded into the forge from any https address that allows cross-origin
reads: `/forge/?pack=https://example.com/my-pack.json`. This is how you share lessons
without going through this repository.

Adding a lesson to the official game always ends in a pull request. A write API would
need a server, and this project does not have one by design.

## How it is built

```
content/                 Lessons, as data. The only place lessons live.
  worlds/<nn-id>/world.yaml
  worlds/<nn-id>/<nn-id>.yaml
  beyond.yaml            Links for out-of-scope topics
  facts.yaml             Version-sensitive facts with a "last verified" date
src/lib/schema.ts        The lesson format (Zod). One source of truth.
src/lib/check.ts         Decides whether an answer is right. Pure, no DOM.
src/scenes/              Board scenes. They show answers; they never judge them.
src/components/          LevelPlayer, Robot, TopicMap, Forge
src/pages/               Pages and the static JSON endpoints
tests/                   The gates that keep lessons honest
docs/kickoff/            The build prompt this project was generated from
docs/DECISIONS.md        Choices made along the way, and known gaps
```

Stack: [Astro](https://astro.build/) (static output), Preact, TypeScript, Zod, Vitest.
Fonts are self-hosted; the page makes no third-party requests.

## Deploying

`.github/workflows/deploy.yml` tests, builds and publishes to GitHub Pages on every
push to `main`. One-time setup: in the repository, open **Settings → Pages** and set
**Source** to **GitHub Actions**.

To host somewhere else, set `SITE_URL` and `BASE_PATH` when building, for example
`SITE_URL=https://learn.example.com BASE_PATH=/ npm run build`, and serve `dist/`.

## Licence

- Code: [MIT](./LICENSE)
- Lessons and other content in `content/`: [CC BY 4.0](./LICENSE-CONTENT)

Inspired by Flexbox Froggy by Thomas Park. No code or artwork from it is used.

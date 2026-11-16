# Contributing

Thank you for helping. Most contributions are lessons, and a lesson is a single text
file, so you do not need to know the codebase.

## Writing a good lesson

1. **One idea.** If you need the word "also", it is probably two lessons.
2. **Under 250 words.** The tests enforce it. Cut history and caveats; link to them.
3. **Answer the question the previous lesson raised.** Read the lesson before yours and
   end yours by pointing at what comes next.
4. **The player types real code.** Prefer a blank in a line of code over a quiz
   question. Use multiple choice for judgement calls and ordering for processes.
5. **The board must react.** Bind a blank to the scene so something changes while the
   player types, before they press *Check answer*.
6. **Teach what lasts.** Model names, prices and SDK versions go in
   `content/facts.yaml` and are referenced as `{{fact.key}}`, never written inline.
7. **Link to primary sources.** Two to four links: specifications, official docs,
   papers, the original author's explanation. All `https`.
8. **MCP lessons follow revision 2026-07-28**, which is stateless: no `initialize`
   handshake and no session id. Much older material online is out of date on this.

## The lesson file

`content/worlds/<nn-world>/<nn>-<id>.yaml`. The number sets the order; the `id` must
match the file name.

```yaml
id: next-token                 # lowercase, dashes; unique within the world
title: The prediction machine  # up to 60 characters
concepts:                      # 1-6 short phrases; they become topic-map leaves
  - next-token prediction
lesson: |                      # Markdown, under 250 words
  ...
goal: |                        # Markdown; exactly what the player must do
  ...
scene:                         # the board; see "Scenes" below
  type: bars
challenge:                     # see "Challenge types" below
  type: fill
hints:                         # 1-4, from a nudge to nearly the answer
  - ...
success: |                     # Markdown; why the answer is right
  ...
links:                         # 2-4
  - title: ...
    url: https://...
    kind: docs                 # docs | article | video | paper | course | tool | code
    note: Why it is worth the click.   # optional
solution: { word: hammer }     # reference answer; the tests prove it passes
wrong: { word: banana }        # a plausible wrong answer; the tests prove it fails
```

Unknown keys are errors, so a typo is caught instead of ignored.

### Challenge types

**`fill`**: code with blanks. Write `{{name}}` where the player types. Both languages
must use the same blanks.

```yaml
challenge:
  type: fill
  code:
    python: |
      temperature = {{temp}}
    typescript: |
      const temperature = {{temp}};
  blanks:
    temp:
      placeholder: "0 to 2"    # optional
      width: 6                 # optional, in characters
      feedback: Shown when this blank is wrong.   # optional
      accept: { number: { eq: 0 } }
solution: { temp: "0" }
```

`accept` takes exactly one rule:

| Rule | Passes when |
|---|---|
| `{ equals: hammer }` | the answer matches (quotes and case ignored unless `caseSensitive: true`) |
| `{ oneOf: [">", ">="] }` | it matches any of the list |
| `{ regex: "tools/(call\|list)" }` | the whole answer matches the pattern |
| `{ number: { eq, min, max } }` | it is a number in range |
| `{ tokenCount: { eq, min, max } }` | the real tokenizer counts that many tokens |

Keep code lines to 58 characters so nobody has to scroll sideways.

**`choice`**: multiple choice. Mark right answers with `correct: true`; give wrong ones
a `why`, shown if picked. Add `multiple: true` when several are correct. An optional
`code:` block (both languages) is shown above the options.

**`order`**: put steps in order. Write `items` in the correct order; players see them
shuffled. No `solution` needed.

**`json`**: the player writes JSON, checked by rules.

```yaml
challenge:
  type: json
  starter: |
    { "method": "" }
  rules:
    - { path: method, op: equals, value: tools/call, message: Set "method" to "tools/call". }
```

Paths are dot-separated (`params.arguments.city`, `tools.0.name`). Operators:
`exists`, `equals`, `type` (string, number, boolean, object, array, null), `includes`,
`matches`, `minLength`.

### Scenes

A scene draws what the answer means. It never decides correctness. `bind` connects a
scene input to a blank by name.

| Scene | Shows | Config |
|---|---|---|
| `robot` | Just the robot and a speech bubble | `say`, `note` |
| `bars` | Next-token probabilities | `prompt`, `tokens: [[word, p], …]`, `bind: { guess, temperature }`, `sample: true`, `explore: [topP]`, `say`, `note` |
| `tokens` | Live tokenization of text | `bind: { text }` or `text`, `target` |
| `embeddings` | Words as points, with vector arithmetic | `points: { word: [x, y] }`, `expr: { start, minus }`, `bind: { plus }` |
| `attention` | A sentence with attention arcs | `tokens`, `weights`, `focus` (index), `bind: { guess }`, `alt` |
| `context` | A conversation and a context window | `messages: [{ role, text, tokens, key }]`, `bind: { window }`, `remembered`, `forgotten` |
| `messages` | A request to a model and the reply or error that comes back | `request`, `system`, `messages: [{ role, content }]`, `reply` (text, or `{ tokens }`, or `{ content, mono }`), `error`, `note`, `say`, `needs`, `cases`, `bind: { maxTokens, stream, inPrice, outPrice }`, `stream: true`, `usage`, `prices` |

The `messages` scene is driven by data. Any string in it may contain `{{blank}}` to
show what the player typed. `needs` lists blanks that must be filled before anything
is "sent". `cases` describes alternative outcomes: each has a `when` map of blank name
to a regular expression, and the first case whose patterns all match replaces the
default `messages`, `reply`, `error`, `note` and so on. See
`content/worlds/02-voice/` for seven worked examples.

Scenes read answers by name. Blanks keep their own names. For the other challenge
types the answer is exposed as `choice` (the selected option ids, comma-separated),
`order` (the item ids in their current order) and `json` (the text as typed), so a
`messages` case can react to a click with `when: { choice: "^specific$" }`.

If a scene shows data that determines the answer, add a test in
`tests/content.test.ts` proving the board and the solution agree (see the existing
ones for World 1).

## Adding a scene

This is the one extension that needs code.

1. Write a Preact component in `src/scenes/index.tsx` that takes `SceneProps`
   (`config`, `values`, `status`, `say`).
2. Put any logic that decides what is drawn in a pure, exported function, and test it.
3. Register it in `SCENES` and add a row to the table above.
4. Style it in `src/styles/global.css` using the existing variables. Use `--temper` for
   the world's colour. Never signal state by colour alone.

## Adding a world

Create `content/worlds/<nn>-<id>/world.yaml`:

```yaml
id: voice-agents
order: 8
title: Voice agents
part: Ears                     # what the robot gains
question: The learner's question this world answers, in their words.
summary: Two or three sentences.
planned:                       # optional: lessons not written yet
  - title: Speech in, speech out
    concepts: [speech-to-text, latency]
```

Add one or more lesson files next to it. Nothing else needs editing.

## Translations

The game is English only for now. The intended approach is a parallel content tree,
`content/i18n/<locale>/worlds/...`, holding only the text fields of each lesson, with
code, scenes and checks shared. Two things are needed first and are good first
contributions: extracting the interface strings from the components into one
dictionary, and a loader that overlays a locale on the English lessons. Open an issue
before starting so the work is not duplicated.

## Before you open a pull request

```bash
npm test
npm run build
```

Both must pass. Describe in one sentence what a player can do after your change that
they could not do before.

Lessons you contribute are licensed CC BY 4.0, and code MIT, like the rest of the
project.

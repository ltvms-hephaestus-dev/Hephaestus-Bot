/**
 * Starter lessons for the Forge, one per challenge type. Each is a complete, valid
 * lesson: the tests check that, so they also serve as living documentation of the
 * format.
 */
const head = (id: string, title: string) => `id: ${id}
title: ${title}
concepts:
  - first concept
  - second concept

lesson: |
  Explain **one idea** here in plain words. Markdown works: lists, \`code\`,
  [links](https://example.com). Aim for under 250 words.

goal: |
  Tell the player exactly what to do.
`;

const tail = `
hints:
  - A gentle nudge.
  - A stronger push.
  - Nearly the answer.

success: |
  Say why the answer is right and what it means in practice.

links:
  - title: A primary source
    url: https://modelcontextprotocol.io/specification/2026-07-28
    kind: docs
    note: Why this link is worth the click.
  - title: Something to watch or try
    url: https://www.anthropic.com/engineering/building-effective-agents
    kind: article
`;

export const TEMPLATES: Record<string, { label: string; yaml: string }> = {
  fill: {
    label: 'Fill in the code',
    yaml: `${head('my-fill-lesson', 'Fill in the blank')}
# The board. "bars" draws a probability chart; "bind" connects it to a blank.
scene:
  type: bars
  prompt: The sky is
  bind: { guess: word }
  tokens:
    - [blue, 0.8]
    - [grey, 0.15]
    - [falling, 0.05]

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
      accept: { equals: blue }
      feedback: Shown when this blank is wrong.

solution: { word: blue }
wrong: { word: grey }
${tail}`,
  },
  choice: {
    label: 'Multiple choice',
    yaml: `${head('my-choice-lesson', 'Pick the right one')}
scene:
  type: robot
  say: Which one is it?

challenge:
  type: choice
  options:
    - id: right
      text: The correct option. Use \`backticks\` for code.
      correct: true
    - id: tempting
      text: A tempting wrong option
      why: Shown if the player picks this. Explain the misunderstanding.
    - id: wrong
      text: Another wrong option
      why: Explain this one too.

solution: [right]
wrong: [tempting]
${tail}`,
  },
  order: {
    label: 'Put steps in order',
    yaml: `${head('my-order-lesson', 'Put it in order')}
scene:
  type: robot
  say: I always mix these up.

# Write the steps in the correct order. The player sees them shuffled.
challenge:
  type: order
  items:
    - { id: first, text: This happens first }
    - { id: second, text: Then this }
    - { id: third, text: And this last }
${tail}`,
  },
  json: {
    label: 'Write JSON',
    yaml: `${head('my-json-lesson', 'Write the message')}
scene:
  type: robot
  say: Send me a tool call I can run.

# Rules are checked against the player's JSON. Paths look like "params.name".
# Ops: exists, equals, type, includes, matches, minLength.
challenge:
  type: json
  starter: |
    {
      "method": "",
      "params": {}
    }
  rules:
    - path: method
      op: equals
      value: tools/call
      message: Set "method" to "tools/call".
    - path: params.name
      op: type
      value: string
      message: Give the tool a "name" inside "params".

solution: |
  { "method": "tools/call", "params": { "name": "get_weather" } }
wrong: |
  { "method": "tools/list", "params": {} }
${tail}`,
  },
};

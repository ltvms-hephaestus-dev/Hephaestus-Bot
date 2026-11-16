# Prompt: three more levels for World 7

Written with the `senior-dev-guide` skill for a mid-tier builder (Claude Sonnet). The
design decisions and the failing tests were written first; the builder writes the
lesson files that make them pass.

```text
ROLE AND CONTEXT
You are adding three lessons to Hephaestus Bot, a browser game that teaches
developers how AI systems work (in the style of Flexbox Froggy). World 7 is the
capstone: it shows a coding agent working on real code. The three new lessons
teach the human side of that: how to brief an agent, what to let it do without
asking, and how to check its work. A lesson is one YAML data file. You will not
write engine code.

GOAL AND DEFINITION OF DONE
Create three lesson files so that `npm test` passes (it currently fails with
exactly 5 failing tests, all about these lessons) and `npm run build` succeeds.

WHAT EXISTS
Repository root: /home/claude/hephaestus-bot (branch world-7-more, already checked out)
- CONTRIBUTING.md               the lesson format. Read it first, fully.
- src/lib/schema.ts             the schema. Unknown keys are errors.
- src/scenes/index.tsx          the boards. You only need `resolveMessages`
                                (how `needs`, `cases`, `when`, `{{blank}}` work).
- tests/content.test.ts         the gates. The block "World 7, working with a
                                coding agent (levels 4 to 6)" is your specification.
- content/worlds/07-graduation/ the world you are adding to.
Patterns to copy (read all three before writing):
- content/worlds/06-street-smarts/03-hostile-text.yaml   single choice + clickable board
- content/worlds/04-universal-plug/06-write-a-server.yaml fill + board with cases and a default error
- content/worlds/07-graduation/03-fix-a-broken-run.yaml   tone and length of World 7
Commands: `npm test` (all gates), `npm run build`.

SCOPE
In: create exactly these three files in content/worlds/07-graduation/
  04-brief-the-agent.yaml
  05-set-the-permissions.yaml
  06-trust-but-verify.yaml
and make one small edit to the `success:` text of 03-fix-a-broken-run.yaml only if
needed so it leads into level 4 (do not change anything else in that file).
Out: everything else. Do not edit tests/, src/, any other content file,
package.json, or docs. Do not rename or renumber files. Do not add dependencies.

THE THREE LESSONS (design is fixed; you write the words)

1) id: brief-the-agent    title: "Brief the agent"
   Teaches: an agent is as good as its brief. A good brief states the goal, how
   to check it is done (a command), what is in and out of scope, and points at an
   existing example to follow.
   challenge: type choice (single). Option ids exactly: vague, everything,
   stepwise, specific. `specific` is the only correct one.
     vague      = "Fix the date bug."
     everything = one giant brief asking for the fix plus a refactor plus new
                  features in one go
     stepwise   = dictating every keystroke, line by line, leaving the agent no
                  way to react to what it finds
     specific   = goal + done-check + scope + pattern to copy
   scene: type messages, `needs: [choice]`, an `idle:` line, and one case per
   option showing what the agent does with that brief. Only the `specific`
   case's `reply` may contain the words "tests pass" (the test checks this).
   Give each wrong option a `why:`. solution: [specific]   wrong: [vague]

2) id: set-the-permissions    title: "Set the permissions"
   Teaches: let reversible, contained actions run; ask before actions that leave
   the machine. The agent works in a local checkout where every edit can be
   undone with git, so edits need no approval, but pushing to the shared
   repository does.
   challenge: type fill, one blank named `tool`, accept { equals: git_push }.
   The code (Python and TypeScript) is a small permission config: an `allow` list
   containing read_file, search_code, edit_file, run_tests and an `ask` list
   whose single entry is the blank. Lines must be 58 characters or shorter.
   scene: type messages, `needs: [tool]`, with:
     - a case for ^git_push$: a short trace where the agent edits and tests
       freely and the push waits for a person. The word "approval" (or
       "approve") must appear somewhere in its messages, reply or note.
     - a case for ^edit_file$: no error, a `note` explaining the wrong trade
       (a prompt on every edit, while the push goes out unreviewed).
     - cases for the other three real tools, each with a `note`.
     - a default `error` for anything else that names what was typed, e.g.
       'No tool called "{{tool}}".' (Cases that should not show it need
       `error: ""`, exactly as write-a-server.yaml does.)
   solution: { tool: git_push }   wrong: { tool: edit_file }

3) id: trust-but-verify    title: "Trust, but verify"
   Teaches: an agent's report is a claim, not evidence. The agent says "all
   tests pass". They do, because it deleted the failing test. Only reading the
   whole diff, test files included, shows that.
   challenge: type choice (single). Option ids exactly: report, rerun, ask, diff.
   `diff` is the only correct one.
     report = accept the summary
     rerun  = run the tests yourself (they pass: the failing test is gone)
     ask    = ask the agent whether it is sure (it says yes)
     diff   = read the full diff including tests, then run them
   scene: type messages, `needs: [choice]`, `idle:`, one case per option.
   The letters "delet" (deleted/deletes/deletion) must appear ONLY in the `diff`
   case, nowhere in the other three cases' messages, reply or note, and the
   `rerun` case's reply must contain "pass". (The test checks both.)
   solution: [diff]   wrong: [rerun]

INVARIANTS
- Lessons are data. No code changes.
- Every lesson has: id matching its file name, title, 1-6 concepts, lesson
  (under 250 words), goal, scene, challenge, 2-3 hints (a nudge, a push, nearly
  the answer), success, 2-4 links, solution, wrong.
- British spelling, plain words, no hype, second person, as in the files you read.
- Links: use ONLY URLs that already appear in other files under content/.
  Do not write any URL from memory. `grep -rhoE "https://[^ \"']+" content | sort -u`
  lists them. No URL twice within one lesson.

PITFALLS (each of these has already broken this repository once)
- In YAML, " #" starts a comment outside quotes. "Ticket #482 is open" loses its
  ending. Put any text containing " #" in quotes. A test checks this.
- A plain YAML value containing ": " must be quoted.
- Inside `{ ... }` flow maps, quote any text containing a comma.
- Code lines over 58 characters fail a test (a blank counts as 8).
- The lesson body must stay under 250 words; a test counts them.
- The level before yours ends by fixing a broken run; the level after yours is
  the finale ("the simplest thing that works"). Your three should read as one
  arc between them, and level 6's `success` should hand over to the finale.

PLAN
M1  Write 04-brief-the-agent.yaml. Run `npm test`. The "brief the agent" test
    and all generic "level graduation/brief-the-agent" tests must pass.
M2  Write 05-set-the-permissions.yaml. Run `npm test`.
M3  Write 06-trust-but-verify.yaml. Run `npm test`: 0 failures.
M4  Run `npm run build`. It must complete with no error.

GATES
  npm test          must end with 0 failed
  npm run build     must end with "Complete!"
Never edit a test to make it pass. If you believe a test is wrong, stop and say
which one and why, and leave it failing.

WORKING RULES
Read a file before you rely on it. When something is ambiguous, choose the
simplest option that keeps the invariants and mention it in your report.
Do not commit; leave the changes in the working tree.

REPORT BACK
1. The files you created or changed.
2. The last 6 lines of `npm test` and the last 3 lines of `npm run build`, pasted.
3. Any decision you made that the prompt did not settle.
4. Anything you did not do or could not verify.
```

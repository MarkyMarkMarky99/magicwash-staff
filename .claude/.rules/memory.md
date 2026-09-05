# Rule — `.user/memory/MEMORY.md`

## What it is

- **Live note, not a document.** What is being worked on, what is next, what is stuck.
- Written for the next session opened with "read `MEMORY.md`" after a `/clear`.
- **Not** project rules → those live in `CLAUDE.md` and `.claude/.rules/`.
- **Not** a design doc → those live in `docs/plans/`.
- **Not** a changelog or diary → that is `git log`.

## Hard limits

- **150 lines max.** Over the limit → delete before adding.
- Bullets and keywords. No paragraphs, no prose explanation.
- One line per item wherever possible.

## What goes in

- Current branch and what is in flight on it.
- Next actions, in the order they should happen.
- Blockers, and who or what they are waiting on.
- Decisions still open, and decisions reversed.
- Resume files: which path to reopen to continue.

## What stays out

- Anything recoverable from `git log`, a diff, `docs/`, `CLAUDE.md`, or `.claude/.rules/`.
  **Reference it, do not copy it.**
- Finished work with nothing left to do.
- Explanations of how the codebase works.
- Rules of any kind.

## Tied to branches — the part that gets forgotten

- Every entry belongs to a branch that **currently exists**.
- **Branch deleted or merged → delete every line about it.** Same commit, not later.
- Before writing, check the branch list. An entry with no live branch is stale by definition.
- Never leave "was going to do X on branch Y" once Y is gone.

## When to update

- **At every commit.**
- On any significant decision or reversal — a session can be cut short.
- Immediately after deleting or merging a branch.
- Before the user `/clear`s.

## Accuracy

- Stale content here is worse than no content: the next session acts on it.
- Finished an item → delete the line. Do not mark it done and leave it.
- Contradicts reality → fix it now, do not append a correction.

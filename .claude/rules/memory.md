# Rule — `.user/memory/MEMORY.md`

## What it is

- **Live note, not a document.** What is being worked on, what is next, what is stuck.
- Written for the next session opened with "read `MEMORY.md`" after a `/clear`.
- **Not** project rules → those live in `CLAUDE.md` and `.claude/rules/`.
- **Not** a design doc → those live in `docs/plans/`.
- **Not** a changelog or diary → that is `git log`.

## Hard limits

- **150 lines max.** Over the limit → delete before adding.
- Use short sections and bullets only. No paragraphs, prose explanations, tables, or numbered plans.
- One line per item wherever possible.
- Keep each bullet to one short sentence. Do not embed measurements, commit histories, file:line inventories,
  implementation designs, or audit evidence in `MEMORY.md`.
- Put detail that needs more than one short bullet in a separate file under `.user/memory/`, then link to it.

## Branches in flight

- `MEMORY.md` must always contain a `## Branches in flight` section directly after the opening branch
  status and before pending work.
- List every local **non-main** branch that has not been deleted. Do not omit a branch because it is
  stale, behind `main`, or has no caller yet.
- Use one bullet per branch: branch name, a one-sentence status, and a reference to
  `.user/memory/<safe-branch-name>.md` for details. Convert `/` in a branch name to `-` in the file name.
- Keep `main` in the opening `Branch: ...` status line, not in `## Branches in flight`.
- When a non-main branch is deleted or merged, delete its bullet and its matching branch-memory file
  in the same commit.

## What goes in

- Current branch and what is in flight on it.
- A concise status entry for every branch in `## Branches in flight`.
- Pending work grouped by domain. Do not imply an order or priority unless the user explicitly sets one.
- Blockers, and who or what they are waiting on.
- Decisions still open, and decisions reversed.
- Resume files: which path to reopen to continue.

## What stays out

- Anything recoverable from `git log`, a diff, `docs/`, `CLAUDE.md`, or `.claude/rules/`.
  **Reference it, do not copy it.**
- Finished work with nothing left to do.
- Explanations of how the codebase works.
- Rules of any kind.
- Long branch histories or multi-paragraph branch summaries; keep those in the branch-memory file.

## Tied to branches — the part that gets forgotten

- Every entry belongs to a branch that **currently exists**.
- **Branch deleted or merged → delete every line about it.** Same commit, not later.
- Before writing, check the local branch list. A `## Branches in flight` section that omits an extant
  non-main branch is incomplete; an entry with no live branch is stale by definition.
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

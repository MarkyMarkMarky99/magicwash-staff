---
name: backend-team-flat
description: Orchestrate this repository's already-decided backend brief through the configured coder, tester, and reviewer agents from a root-level Codex session, using one-level dispatch and up to three fix/review cycles with command-backed final reporting. Use when the brief has an explicit finite gate list and the work must follow the project's .codex/agents/coder.toml, tester.toml, and reviewer.toml roles without delegating to backend-team.toml.
---

# Backend Team Flat

Run the project backend workflow directly from the root session. This skill is a pure executor:
it does not choose scope, design, gates, acceptance criteria, or fixes. Treat the user's brief as
the sole decision record and relay it verbatim to every worker.

The caller supplies only that finalized brief. This skill owns the coordinator behavior,
worker dispatch order, retry policy, review-cycle limit, and final reporting requirements.

## Gate the brief

Before dispatching a worker, require all of the following in the supplied brief:

- A complete, already-decided implementation scope.
- An explicit finite list of verification gates (each gate must identify the command or other
  concrete check).
- Any acceptance criteria needed to classify tester and reviewer results.

If the scope or finite gate list is missing, do not ask a worker to infer it and do not run a gate
yourself. Return `BLOCKED` and state exactly which required brief element is absent.

If the brief lacks acceptance criteria needed to classify a result, return `BLOCKED` rather than
inventing them.

Preserve the brief byte-for-byte inside a clearly delimited `BEGIN BRIEF` / `END BRIEF` block in
every worker message. Role instructions may be added outside that block, but must not rewrite,
expand, or reinterpret the brief.

## Dispatch one level at a time

Use only the configured project roles. Never spawn `backend-team`; the root session is the
coordinator. Every role spawn must explicitly use the call shape below, which was verified on
`codex-cli 0.147.0`:

```text
spawn_agent({
  task_name: "<unique role and cycle name>",
  agent_type: "coder" | "tester" | "reviewer",
  fork_turns: "none",
  message: "<role instructions with the verbatim brief>"
})
```

Do not omit `fork_turns` when `agent_type` is supplied. Do not let a worker spawn children. Dispatch
strictly in this order and wait for a role result before starting the next role:

1. `coder` (`.codex/agents/coder.toml`) implements only the brief.
2. `tester` (`.codex/agents/tester.toml`) checks the resulting work.
3. `reviewer` (`.codex/agents/reviewer.toml`) performs the read-only review.

Keep the coder's returned agent id. A later fix is a `followup_task` to that same id, never a new
coder spawn. Start a fresh tester and reviewer spawn for each subsequent cycle, still one level
below the root.

Use this shape for each fix relay, preserving the worker output verbatim inside the message:

```text
followup_task({
  target: "<coder agent id>",
  message: "<original brief plus the verbatim tester/reviewer result>"
})
```

If a spawn or follow-up call fails, or a worker session ends without a role result, retry that same
call once. If the retry also fails, classify it as an infrastructure `BLOCKED` result, separate
from worker findings, and stop. A worker's own `FAIL` or `BLOCKED` report is not an infrastructure
failure; process it through the cycle rules below.

## Role contracts

### Coder

Tell the coder to implement the brief exactly, preserve unrelated work, and return a factual
summary of changed paths, decisions made from the brief, and any blocker. The coder may edit only
inside the repository. It must not commit, push, deploy, install dependencies, or alter the
skill/agent configuration. It must follow repository rules, including `.js` on every backend
relative import it touches.

### Tester

Tell the tester to establish real evidence before classifying the result:

- Capture `git status --short` and a readable `git diff` (or equivalent bounded diff evidence) for
  the delegated change.
- Check that no files outside the delegated scope were changed and that the test tree is used only
  when the brief explicitly authorizes it.
- Run exactly and only the named finite gates, recording each actual command and its readable
  stdout/stderr and exit outcome. Do not substitute, add, or silently skip commands.
- Treat unauthorized tests or edits, red commands, unreadable output, skipped required gates, or
  missing git status/diff evidence as `FAIL` or `BLOCKED`, whichever the evidence supports.

The tester is read-only with respect to source changes: it must not repair, format, reset, commit,
or otherwise mutate the repository. It must report `PASS`, `FAIL`, or `BLOCKED`, with the evidence
needed for the final report.

### Reviewer

Tell the reviewer to inspect the current diff and relevant surrounding code without editing files,
running tests, changing configuration, or performing any write. It must report only findings that
are `Confirmed` or `Highly Likely`, with path/line and concrete reasoning. It must say explicitly
when no such finding exists. If the review scope is empty, ambiguous, or unreadable, it must
report `BLOCKED`; that is not a clean review. Do not promote speculative or low-confidence
concerns into a fix cycle.

## Fix/review loop

Count the initial coder -> tester -> reviewer pass as cycle 1. Allow at most three total cycles.

- Stop with `PASS` only when the coder reports no blocker, the tester passes, and the reviewer
  explicitly reports a clean review rather than `BLOCKED` or qualifying findings.
- If the coder reports a blocker, the tester fails or is blocked, the reviewer is blocked, or the
  reviewer reports qualifying findings, forward that worker output verbatim to the same coder
  session using `followup_task`. Include the original brief unchanged and tell the coder to
  address only the reported evidence. Then run a new tester and reviewer in order for the next
  cycle.
- Do not start cycle 4. If cycle 3 still has a coder blocker, tester failure or blocker, reviewer
  blocker, or qualifying reviewer findings, stop with `FAIL` for unresolved worker findings (or
  `BLOCKED` if the evidence is an external/infrastructure blocker). Preserve the final output
  verbatim.
- A coder's inability to satisfy the brief is a worker result and follows the same cycle limit; a
  dead session or failed orchestration call follows the one-retry infrastructure rule instead.

Never make a coordinator-side edit or "small fix" between cycles. Never edit or commit
`.codex/agents/backend-team.toml`; it is intentionally preserved but not a dispatch target.

## Non-negotiable boundaries

- Never edit, commit, push, deploy, or install dependencies from the root coordinator.
- Never write outside the repository. Treat
  `G:\My Drive\Magicwash\Database\GoogleSheets\*.json` as strictly read-only.
- Do not touch `.claude/`, the source paths excluded by the brief, or any unrelated existing work.
- Keep all worker actions within their role contract and the verbatim brief.

## Final report

End with one factual status: `PASS`, `FAIL`, or `BLOCKED`. Include all of the following, without a
generic "all green" summary:

1. Exact delegated scope copied from the brief.
2. Coder result for every cycle, including changed paths and blockers.
3. Tester result for every cycle, including the real `git status`/diff evidence, the test-tree
   authorization check, and every named gate's actual command plus readable outcome.
4. Reviewer result for every cycle, with each `Confirmed`/`Highly Likely` finding quoted verbatim
   and its disposition.
5. The number of completed review cycles and any one-retry infrastructure events.
6. The final status and, when unresolved, the exact remaining worker or infrastructure blocker.

Keep worker findings verbatim in the report; coordinator commentary may label or organize them but
must not paraphrase away evidence.

---
name: backend-team-flat
description: Orchestrate this repository's already-decided backend brief through the configured coder, tester, and reviewer agents from a root-level Codex session, using one-level dispatch, one spawn per role, follow-up to those same sessions, tester-gated review, a three-round reviewer cap, and command-backed final reporting. Use when the brief has an explicit finite gate list and the work must follow the project's .codex/agents/coder.toml, tester.toml, and reviewer.toml roles.
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

Use only the configured project roles. The root session is the coordinator. Every role spawn
must explicitly use the call shape below, which was verified on
`codex-cli 0.147.0`:

```text
spawn_agent({
  task_name: "<unique role and cycle name>",
  agent_type: "coder" | "tester" | "reviewer",
  fork_turns: "none",
  message: "<role instructions with the verbatim brief>"
})
```

Do not omit `fork_turns` when `agent_type` is supplied. Do not let a worker spawn children.

The root plus these three workers are the entire thread budget. Spawn each role at most once,
keep every returned agent id, and never spawn a second coder, tester, or reviewer in the same
root session. Dispatch strictly in this order and wait for a role result before starting the
next role:

1. `coder` (`.codex/agents/coder.toml`) implements only the brief.
2. `tester` (`.codex/agents/tester.toml`) checks the resulting work.
3. `reviewer` (`.codex/agents/reviewer.toml`) — only after the tester of that attempt reports
   `PASS`.

Do not spawn or `followup_task` the reviewer while the current tester result is `FAIL` or
`BLOCKED`. Spawn the reviewer on the first tester `PASS`; every later reviewer contact is a
`followup_task` to that same id. Every later coder or tester contact is a `followup_task` to
those same ids. Do not open a replacement session when a worker is idle or has finished a turn.

Use this shape for each later-cycle relay, preserving the worker output verbatim inside the
message:

```text
followup_task({
  target: "<coder|tester|reviewer agent id>",
  message: "<original brief plus the verbatim prior-role result>"
})
```

If a spawn or follow-up call fails, or a worker session ends without a role result, retry that same
call once. If the retry also fails, classify it as an infrastructure `BLOCKED` result, separate
from worker findings, and stop. Do not spawn a substitute worker. A worker's own `FAIL` or
`BLOCKED` report is not an infrastructure failure; process it through the cycle rules below.

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

Coder and tester have no round cap. The only cap is the reviewer: at most three reviewer
rounds in the whole root session. A reviewer round is one spawn or `followup_task` that
receives a reviewer result. Do not start a fourth reviewer round.

Flow:

1. `coder`, then `tester`.
2. If the tester reports `FAIL` or `BLOCKED`, or the coder reports a blocker, do not contact
   the reviewer. Forward that output verbatim to the same coder with `followup_task`, keep the
   original brief unchanged, and tell the coder to address only the reported evidence. Then
   `followup_task` the same tester. Repeat until the tester reports `PASS`.
3. After a tester `PASS`, dispatch the reviewer: spawn it if this is the first tester `PASS`,
   otherwise `followup_task` the same reviewer. Include the original brief and the tester
   result.
4. If the reviewer reports a clean review, stop with `PASS`.
5. If the reviewer is `BLOCKED` or reports a Confirmed or Highly Likely finding, forward that
   output verbatim to the same coder with `followup_task`. Include the original brief unchanged
   and tell the coder to address only the reported evidence. Then return to step 1 with the
   same tester. Do not return to the reviewer until that tester reports `PASS` again.
6. If the third reviewer round is still `BLOCKED` or still has a qualifying finding, stop with
   `FAIL`. Do not send the work back to the coder after that third reviewer result. Preserve
   the reviewer output verbatim.

Stop with `PASS` only when the coder reports no blocker, the latest tester result is `PASS`,
and the reviewer explicitly reports a clean review. A dead session or failed orchestration
call follows the one-retry infrastructure rule and is `BLOCKED`; that is not a reviewer
round.

Never make a coordinator-side edit or "small fix" between steps.

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
5. The number of completed reviewer rounds (at most three) and any one-retry infrastructure events.
6. The final status and, when unresolved, the exact remaining worker or infrastructure blocker.

Keep worker findings verbatim in the report; coordinator commentary may label or organize them but
must not paraphrase away evidence.

---
name: implementation-team-lead
description: Coordinate the pure-executor Implementation Team. Use only when the caller supplies a finalized brief that already contains complete scope, a labeled Public Contract section, a labeled Acceptance Criteria section, and an explicit finite list of verification gates. This skill never designs, scopes, or invents criteria — it only dispatches the four workers in strict order, enforces frozen tests, handles fix/review loops, detects hollow guards and disputed tests, and ends with a factual report.
---

# Implementation Team Lead

Pure executor. Do not choose scope, design, gates, acceptance criteria, or fixes. Treat the supplied brief as the sole decision record.

## Overview

1. Validate the brief (scope + Public Contract + Acceptance Criteria + finite gates).
2. Dispatch warden (write phase) with Public Contract + Acceptance Criteria only.
3. Dispatch mason with the full brief.
4. Dispatch clerk and run the mason ↔ clerk loop until clerk returns PASS.
5. Dispatch sentinel (only after clerk PASS).
6. Handle sentinel result (loop back to mason/clerk if needed, max 3 rounds).
7. Dispatch warden (mutation phase) after clean sentinel review.
8. Produce the final report with status PASS / FAIL / BLOCKED.

## Gate the brief

Before any dispatch the brief must contain:

- Complete, already-decided implementation scope
- A labeled **Public Contract** section. Minimum: purpose, public methods, dependencies, and each public method's inputs/outputs. If the caller mandated a flow, sequence, helper, or construction recipe, that text belongs here and is required as written. Extractable verbatim.
- A labeled **Acceptance Criteria** section (required success and failure outcomes from that contract). Extractable verbatim.
- Explicit finite list of verification gates. Any gate targeting a test file this pipeline creates must use the exact path the brief names.

If scope, the Public Contract section, the Acceptance Criteria section, or the finite gate list is missing → return `BLOCKED` and state exactly which element is absent. Do not invent or ask workers to infer.

Preserve the full brief byte-for-byte inside `BEGIN BRIEF` / `END BRIEF` for every worker **except warden**.
Warden receives **only** the Public Contract and Acceptance Criteria sections, each wrapped verbatim (`BEGIN PUBLIC CONTRACT` / `END PUBLIC CONTRACT`, then `BEGIN ACCEPTANCE CRITERIA` / `END ACCEPTANCE CRITERIA`). Nothing else. This applies to both write phase and mutation phase.

## Dispatch rules

Root session is the only coordinator. Use only these roles. While a role's agent is alive, later contacts use `followup_task` to that agent id. Do not keep two live instances of the same role.

```text
spawn_agent({
  task_name: "<unique role and cycle name>",
  agent_type: "warden" | "mason" | "clerk" | "sentinel",
  fork_turns: "none",
  message: "<role instructions + verbatim brief (or criteria for warden)>"
})
```

```text
followup_task({
  target: "<agent id>",
  message: "<original brief/criteria + verbatim prior-role result>"
})
```

Strict order — wait for each result before the next:

1. `warden` (write phase) — writes tests from Public Contract + Acceptance Criteria only
2. `mason` — implements against frozen tests
3. `clerk` — checks the work
4. `sentinel` — only after clerk returns `PASS`
5. `warden` (mutation phase via `followup_task`) — only after sentinel reports clean review

Never keep two live instances of the same role. Never let a worker spawn children.
If a spawn/followup fails, retry once. If the same agent is still unreachable after that retry, replace it — see "Dead worker replacement". A failed spawn of a **new** role (first instance, not a replacement) that still fails after one retry → infrastructure `BLOCKED` and stop.

### Dead worker replacement

A worker is dead when `followup_task` or a later contact returns `agent not found`, the agent session is gone, the worker crashes, or it times out with no result — for any reason.

Do **not** do the dead role's work in the root session. Do **not** dispatch a different role to cover that work. Do **not** skip the phase.

Replacement procedure:

1. Retry the failed `followup_task` (or the failed spawn) once.
2. If the agent is still dead: `spawn_agent` a replacement with the **same** `agent_type`. This is not a second live instance — the previous one is gone. The new agent id becomes that role's only live instance; all later `followup_task` calls go to it.
3. The replacement `message` must include:
   - The same payload that role is entitled to (full brief in `BEGIN BRIEF` / `END BRIEF` for mason, clerk, and sentinel; Public Contract + Acceptance Criteria only for warden)
   - What that role was doing when it died
   - What is already done (that role's own checkpoint hash and files, plus — for mason/clerk/sentinel only — verbatim prior-role results needed to continue)
   - What to do next (the next step of **that same role's** contract)
4. Warden replacements still must not see scope, authorized-files, the gate list, or any other worker's output. They may be told which test paths and checkpoint hash **warden already produced**, and which phase (write or mutation) to continue.
5. If the replacement spawn itself fails, retry once. Second failure → infrastructure `BLOCKED` and stop. Record the dead agent id, the replacement attempt, and the error.

## Role contracts

### Warden
State the phase explicitly every time: **write phase** or **mutation phase**.
Hold the team to the Public Contract as received. Test what that contract states. If it mandates a flow, sequence, helper, or construction recipe, that is required. If it does not, do not invent extras.
- Write phase: edit only under the test tree, then commit its own files as `checkpoint: warden write phase`. Report the commit hash.
- Mutation phase: temporary always-reverted mutation of implementation source only — never committed.
Never push, merge, rebase, `reset --hard`, `rm`, `clean`, delete a branch, deploy, or install dependencies.
If write-phase cannot exercise a required outcome from the Public Contract and Acceptance Criteria as written → `BLOCKED`, do not dispatch mason. Do not `BLOCKED` because the contract omitted internals the caller did not mandate.
If mutation-phase finds a guard that stays green when broken → see "Hollow guard".
If instructed to revert a tampered file, see "Tampering" below.

### Mason
Implement the brief exactly. May edit only inside the repository; never touch any file under the test tree (even with brief authorization — every test comes from warden).
Commit its own changed files as `checkpoint: mason implementation` after a successful turn. Report the commit hash.
Return factual summary of changed paths and any blocker.
If mason claims a test file is wrong (without having touched it) → treat according to "Frozen test in dispute" / Exception B below.
Never push, merge, rebase, `reset --hard`, `rm`, `clean`, delete a branch, deploy, install dependencies, or alter skill/agent configuration.

### Clerk
After mason implements, read the diff and write unit/integration tests against the actual functions and modules mason created (proving the pieces work and connect). These are clerk's own files and may be revised across later cycles. Commit them as `checkpoint: clerk tests` before running any gate.
Diff every file warden wrote against the warden checkpoint hash given in the prompt. Never touch a file warden wrote — a difference from that hash is tampering, report it as a finding, see "Tampering" below.

Must also:
- Capture `git status --short` + readable `git diff`
- Run every gate: the named finite list + warden's tests + its own tests — record real command + stdout/stderr + exit code for each

Verdict: required check red → `FAIL`. Anything else (unreadable, skipped gate, a file differing from its owner's checkpoint) → `BLOCKED`.

### Sentinel
Read-only inspection only. Report only `Confirmed` or `Highly Likely` findings with path/line + concrete reasoning (traced concrete failure or direct violation of a rule already stated in the repo).
Explicitly state when no such finding exists, and separately when something is suspected but unconfirmed because confirmation would require execution.
Empty/ambiguous/unreadable scope → `BLOCKED`.

### Checkpoint commits

Warden, mason, and clerk stage **only the files they own for that checkpoint**. Never `git add -A`, never `git commit -a`, never a repo-wide `git diff --check`.

Whitespace and hook checks apply only to what is staged:

1. `git add -- <own-paths>`
2. `git diff --cached --check`
3. If that check fails on a staged file because of trailing whitespace (spaces or tabs at end of line): strip those characters from **that staged file**, re-stage, and retry the commit. Do not stop. Do not report `BLOCKED`. Do not wait for the root session.
4. A dirty file that is not staged is not this worker's problem. Ignore it.

A trailing-whitespace failure on an unrelated working-tree file is not a blocker, not a gate failure, and not a reason to end the turn. Root must not treat it as `BLOCKED`.

If `git add` or `git commit` fails with `Unable to create` + `index.lock` + `Permission denied`: retry that same command immediately, once. Do not report `BLOCKED`. Do not wait for the root session. A second identical failure is infrastructure, not a test or brief failure.

## Fix / review loop

- Mason ↔ clerk have no round limit.
- Sentinel is capped at 3 rounds total in the root session.
- Warden mutation runs exactly once, after a clean sentinel review.

Flow:
1. warden (write) → mason → clerk
2. Clerk `FAIL`/`BLOCKED` or mason blocker → `followup_task` the live mason (keep original brief), then the live clerk. If either agent is dead, replace that same role first (see "Dead worker replacement"). Repeat until clerk `PASS`.
   - Exception A: mason names a **warden** test file as the problem, without having touched it → "Frozen test in dispute" → stop with `BLOCKED`.
   - Exception B: mason names one of **clerk's own** test files as the problem, without having touched it → forward the claim to clerk via `followup_task`; clerk may revise its own test if it agrees, then the loop continues.
   - Exception C: clerk's `BLOCKED` is a tampering finding (a file differs from its owner's checkpoint hash) → see "Tampering" below instead of the normal retry.
3. After clerk `PASS` → spawn/followup sentinel.
4. Sentinel clean → go to step 6.
5. Sentinel finding or `BLOCKED` → `followup_task` the live mason (replace mason first if dead), then back to the live clerk (not warden). Do not return to sentinel until clerk `PASS` again.
   After 3rd sentinel still dirty → stop with `FAIL`.
6. Clean sentinel → `followup_task` the live warden for mutation phase (replace warden first if dead).
   All guards prove red for the right reason and source restored → `PASS`.
   Any guard stays green when broken → "Hollow guard" → `FAIL`.
   Never loop back after mutation phase.

### Frozen test in dispute
Applies only to a **warden**-authored test. Mason reports it as the root cause → stop with `BLOCKED`. Report mason's finding + which test + which clerk result. No role may edit a warden test.

### Tampering
Clerk finds a file differs from its owner's last checkpoint commit — someone other than the file's owner touched it. `followup_task` the file's owner (warden for a warden file, clerk for one of its own) to revert it (`git checkout <owner's checkpoint hash> -- <path>`) and confirm `git diff` is clean. If that owner is dead, replace the same role first. Then `followup_task` the live mason to redo the work, noting which file was restored and why. This may happen **at most once per file**. A second tampering finding on the same file → stop with `BLOCKED`; report the file and both occurrences, do not attempt a third revert.
Distinct from mason merely reporting a belief a test is wrong without having touched it — that stays "Frozen test in dispute" / Exception B.

### Hollow guard
Warden mutation finds a guard that stays green when the rule is broken → stop with `FAIL`. Report the exact rule, file, and result. Do not send back to mason.

## Non-negotiable boundaries

- Root never edits, commits, pushes, deploys, or installs.
- Warden, mason, and clerk may commit only their own checkpoint (as specified in their role contracts). No worker may `git push`, `merge`, `rebase`, `reset --hard`, `rm`, `clean`, or delete a branch — commits are for checkpointing and revert only.
- Never write outside the repository. Treat any path the brief marks read-only as read-only.
- No role may touch skill or agent configuration, paths excluded by the brief, or unrelated work.
- Warden must never see scope, authorized-files list, gate list, or any other worker output.

## Final report

End with exactly one status: `PASS`, `FAIL`, or `BLOCKED`. Include:

1. Exact delegated scope + Public Contract + Acceptance Criteria (copied from brief)
2. Warden write-phase result (tests written, gaps, exact contract and criteria received, checkpoint hash)
3. Mason result for every cycle (changed paths + blockers, checkpoint hash)
4. Clerk result for every cycle (internal tests written/revised + why, checkpoint hash, git evidence, every gate command + outcome)
5. Sentinel result for every cycle (Confirmed/Highly Likely findings quoted + disposition, plus anything reported as unconfirmed)
6. Warden mutation-phase result (one line per guard: rule, file, red/not, source restored)
7. Number of sentinel rounds used + any infrastructure retries + any dead-worker replacements (role, old id, new id, why it died)
8. Any tampering incident (file, owner, both checkpoint hashes, whether it was the 1st revert or the 2nd/stopping occurrence)
9. Final status and exact remaining blocker (including Frozen test, Tampering, or Hollow guard if applicable)

Keep all worker findings verbatim.

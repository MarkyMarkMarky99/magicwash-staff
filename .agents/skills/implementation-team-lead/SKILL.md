---
name: implementation-team-lead
description: Coordinate the pure-executor Implementation Team for backend work. Use only when the caller supplies a finalized brief that already contains complete scope, a labeled Acceptance Criteria section, and an explicit finite list of verification gates. This skill never designs, scopes, or invents criteria — it only dispatches the four workers in strict order, enforces frozen tests, handles fix/review loops, detects hollow guards and disputed tests, and ends with a factual report.
---

# Implementation Team Lead

Pure executor. Do not choose scope, design, gates, acceptance criteria, or fixes. Treat the supplied brief as the sole decision record.

## Overview

1. Validate the brief (scope + Acceptance Criteria + finite gates).
2. Dispatch warden (write phase) with Acceptance Criteria only.
3. Dispatch mason with the full brief.
4. Dispatch clerk and run the mason ↔ clerk loop until clerk returns PASS.
5. Dispatch sentinel (only after clerk PASS).
6. Handle sentinel result (loop back to mason/clerk if needed, max 3 rounds).
7. Dispatch warden (mutation phase) after clean sentinel review.
8. Produce the final report with status PASS / FAIL / BLOCKED.

## Gate the brief

Before any dispatch the brief must contain:

- Complete, already-decided implementation scope
- A labeled **Acceptance Criteria** section (required behavior + required failure behavior only — never implementation approach). Extractable verbatim.
- Explicit finite list of verification gates. Any gate targeting a test file created by this pipeline must use the exact repository convention:
  - Frontend: `tests/web/unit/<mirror of src path>/<name>.dry-test.ts`
  - Backend: `tests/server/...` (same mirrored layout)

If scope, the Acceptance Criteria section, or the finite gate list is missing → return `BLOCKED` and state exactly which element is absent. Do not invent or ask workers to infer.

Preserve the full brief byte-for-byte inside `BEGIN BRIEF` / `END BRIEF` for every worker **except warden**.  
Warden receives **only** the Acceptance Criteria section inside `BEGIN ACCEPTANCE CRITERIA` / `END ACCEPTANCE CRITERIA` (verbatim, nothing else). This applies to both write phase and mutation phase.

## Dispatch rules

Root session is the only coordinator. Use only these roles. Spawn each role at most once; later contacts use `followup_task` to the same agent id.

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

1. `warden` (write phase) — writes tests from Acceptance Criteria only
2. `mason` — implements against frozen tests
3. `clerk` — checks the work
4. `sentinel` — only after clerk returns `PASS`
5. `warden` (mutation phase via `followup_task`) — only after sentinel reports clean review

Never spawn a second instance of any role. Never let a worker spawn children.  
If a spawn/followup fails, retry once. Second failure → infrastructure `BLOCKED` and stop.

## Role contracts

### Warden
State the phase explicitly every time: **write phase** or **mutation phase**.  
- Write phase: edit only under the test tree.  
- Mutation phase: temporary always-reverted mutation of implementation source only.  
Never commit, push, deploy, or install dependencies.  
If write-phase finds criteria untestable → `BLOCKED`, do not dispatch mason.  
If mutation-phase finds a guard that stays green when broken → see "Hollow guard".

### Mason
Implement the brief exactly. May edit only inside the repository; never touch any file under the test tree (even with brief authorization — every test comes from warden).  
Every backend relative import touched must end in `.js`.  
Return factual summary of changed paths and any blocker.  
If mason claims a test file is wrong → treat according to "Frozen test in dispute" / Exception B below.  
Never commit, push, deploy, install dependencies, or alter skill/agent configuration.

### Clerk
After mason implements, read the diff and write unit/integration tests against the actual functions and modules mason created (proving the pieces work and connect). These are clerk's own files and may be revised across later cycles.  
Never touch a file warden wrote — report any problem with it as a finding.  

Must also:
- Capture `git status --short` + readable `git diff`
- Run every gate: the named finite list + warden's tests + its own tests — record real command + stdout/stderr + exit code for each

Verdict: required check red → `FAIL`. Anything else (unreadable, skipped gate, unauthorized change to a warden file) → `BLOCKED`.

### Sentinel
Read-only inspection only. Report only `Confirmed` or `Highly Likely` findings with path/line + concrete reasoning (traced concrete failure or direct violation of a rule already stated in the repo).  
Explicitly state when no such finding exists, and separately when something is suspected but unconfirmed because confirmation would require execution.  
Empty/ambiguous/unreadable scope → `BLOCKED`.

## Fix / review loop

- Mason ↔ clerk have no round limit.
- Sentinel is capped at 3 rounds total in the root session.
- Warden mutation runs exactly once, after a clean sentinel review.

Flow:
1. warden (write) → mason → clerk
2. Clerk `FAIL`/`BLOCKED` or mason blocker → `followup_task` same mason (keep original brief), then same clerk. Repeat until clerk `PASS`.  
   - Exception A: mason names a **warden** test file as the problem → "Frozen test in dispute" → stop with `BLOCKED`.  
   - Exception B: mason names one of **clerk's own** test files as the problem → forward the claim to clerk via `followup_task`; clerk may revise its own test if it agrees, then the loop continues.
3. After clerk `PASS` → spawn/followup sentinel.
4. Sentinel clean → go to step 6.
5. Sentinel finding or `BLOCKED` → `followup_task` mason, then back to clerk (not warden). Do not return to sentinel until clerk `PASS` again.  
   After 3rd sentinel still dirty → stop with `FAIL`.
6. Clean sentinel → `followup_task` same warden for mutation phase.  
   All guards prove red for the right reason and source restored → `PASS`.  
   Any guard stays green when broken → "Hollow guard" → `FAIL`.  
   Never loop back after mutation phase.

### Frozen test in dispute
Applies only to a **warden**-authored test. Mason reports it as the root cause → stop with `BLOCKED`. Report mason's finding + which test + which clerk result. No role may edit a warden test.

### Hollow guard
Warden mutation finds a guard that stays green when the rule is broken → stop with `FAIL`. Report the exact rule, file, and result. Do not send back to mason.

## Non-negotiable boundaries

- Root never edits, commits, pushes, deploys, or installs.
- Never write outside the repository. Treat `G:\My Drive\Magicwash\Database\GoogleSheets\*.json` as read-only.
- No role may touch `.claude/`, paths excluded by the brief, or unrelated work.
- Warden must never see scope, authorized-files list, gate list, or any other worker output.

## Final report

End with exactly one status: `PASS`, `FAIL`, or `BLOCKED`. Include:

1. Exact delegated scope + Acceptance Criteria (copied from brief)
2. Warden write-phase result (tests written, gaps, exact criteria received)
3. Mason result for every cycle (changed paths + blockers)
4. Clerk result for every cycle (internal tests written/revised + why, git evidence, every gate command + outcome)
5. Sentinel result for every cycle (Confirmed/Highly Likely findings quoted + disposition, plus anything reported as unconfirmed)
6. Warden mutation-phase result (one line per guard: rule, file, red/not, source restored)
7. Number of sentinel rounds used + any infrastructure retries
8. Final status and exact remaining blocker (including Frozen test or Hollow guard if applicable)

Keep all worker findings verbatim.

---
name: frontend-team
description: Delivers a frontend feature through a multi-agent workflow. Use when building or reworking a substantial frontend feature, not for small UI tweaks.
---

# Frontend Feature Workflow

You are the orchestrator. You do not write or fix frontend code yourself. You scope the task,
pick the specialists, sequence them, pass context, route review findings, and decide when the
work is done.

## Instructions

0. Understand the request first — the outcome wanted, the scope, and what is outside it; ask the user when it is ambiguous rather than guessing.
1. Pick the agents that scope needs and tell the user the stages you picked — see **Example workflows**. If a worked example under `examples/` matches or is close to the actual task, use it as the concrete template instead of just matching the category label.
2. Plan the run as a todo checklist, one item per stage — see **Planning and briefing**.
3. Work the checklist one item at a time, writing that stage's brief and dispatching it.
4. Check every result against its brief before the next agent starts; if it falls short, send it back to the same agent session.
5. After `frontend-designer`, `ui-builder`, or `frontend-integrator` runs, check the diff against the **Acceptance criteria** — commit if it passes, revert the offending files if not.
6. On `CHANGES_REQUIRED`, route each finding to its owning role and re-review — two rounds maximum.
7. Report back to the user — see **Final report**.

## The team

| Agent | Owns |
|---|---|
| `explorer` | investigating the existing codebase and returning verified context; never plans or writes code. Send it when the relevant area is unfamiliar or reusable patterns must be found before anyone decides anything |
| `frontend-architect` | deciding where new frontend code belongs — files, module boundaries, which route a page gets, which layer owns a piece of state. Decides only; writes nothing. Send it when new files or modules are likely, or placement needs deciding |
| `frontend-designer` | visual direction, UX, interface copy, and the UI implementation of its own design. Send it when a new page, a redesign, or any UI needing a real design decision is on the table |
| `ui-builder` | general frontend code that carries no design decision. Send it for migrations, refactors, renames, deletions, wiring up existing components, and small corrections to existing UI |
| `frontend-integrator` | building those connections — API calls, services, store access, auth, route guards, real data flows. Send it only when the UI must talk to real application infrastructure |
| `frontend-reviewer` | independently verifying the result against requirement, design, conventions, and real behavior. Send it after **any** workflow that modified frontend code |

## Example workflows

The team composition depends on the kind of task. These are illustrations, not a fixed catalogue —
match the shape of the request, not the label.

---

### 1. New feature from scratch
"build an order tracking page"

`explorer` → `frontend-architect` → `frontend-designer` → `frontend-integrator` → `frontend-reviewer`

The full pipeline: nobody knows the area, new files are needed, the page has no design yet, and it
must show real data. See `examples/create-new-customer-form.md` for a worked example.

---

### 2. New feature with the design already decided
a supplied spec, prototype, or page to copy

`explorer` → `frontend-architect` → `ui-builder` → `frontend-integrator` → `frontend-reviewer`

Same shape, but `ui-builder` replaces the Designer because no design decision remains.

---

### 3. Redesign of an existing page
"this page looks wrong, rework it"

`frontend-designer` → `frontend-reviewer`

No Architect: the files already exist. No Integrator: the data is already wired. Add `explorer`
first if you do not know which files the page is made of.

---

### 4. Deleting or removing something
"remove the export button"

`ui-builder` → `frontend-reviewer`

Add `explorer` first when it is not obvious where the thing lives or what else references it.

---

5. **Migration or refactor** - moves or swaps existing code with no design decision, see `examples/swap-date-format-helper.md`

---

### 6. Wiring existing UI to a new endpoint

`explorer` → `frontend-integrator` → `frontend-reviewer`

No Designer or ui-builder: the UI already exists and must not change.

---

### 7. Fixing a reported bug

`explorer` → the role that owns the broken layer → `frontend-reviewer`

Find the cause first; the cause decides the owner.

---

Whatever the shape, `frontend-reviewer` runs last. State the chosen stages before executing when
you are deliberately skipping one a reader would expect.

## Planning and briefing

Write a delegation checklist before dispatching anything — one line per stage, in order:

```
[ ] Discovery — explorer: find the existing tracking components and their routes
[ ] Placement — frontend-architect: decide where the new page and its store live
[ ] UI — frontend-designer: design and build the page
[ ] Data — frontend-integrator: wire it to the orders endpoint
[ ] Review — frontend-reviewer
```

Keep it to that. One stage carries one kind of decision; never merge two roles into one line to
save a round trip. Two stages run in parallel only when their files cannot overlap.

Write each brief when you reach its line, not upfront. State the goal in the user's own terms, the
files in scope, what must not change and **why** — a rule with a reason survives, a bare rule gets
worked around — what to report rather than fix, and how you will judge the result. Ask for a short
report. Cite paths instead of pasting source; the agents share this workspace.

## Acceptance criteria

Judge from `git status` and `git diff`, never the agent's summary. All must hold:

- every changed file was named in the brief, or follows unavoidably from it
- nothing was reformatted or cleaned up along the way
- every rule the brief stated is intact, however small the edit
- shared or cross-cutting code was not bent to fit one local case
- nothing that crosses the API contract (request/response payloads) changed shape — a UI-facing
  change (formatting, display, presentation) must never leak into what's sent to the backend; that
  value is governed by the contract, not by how it happens to render
- nothing the brief did not name was deleted or rewritten
- everything the agent claims to have done is present in the diff
- the stage's own goal is actually met

- **All pass** → commit; the next stage starts from a clean tree.
- **Any fail** → `git checkout -- <path>` the offending files while they are still uncommitted,
  then send the stage back to the same agent session naming the failed line. Keep the in-scope work
  when the two separate. **Maximum 2 send-backs** — after that, stop and take it to the user.
- **`BLOCKED` returned** → the agent could not proceed. Read the reason: if the task was outside
  its role, the stage was mis-routed, so dispatch it to the right role rather than pushing back on
  the same one.

## Correction loop

`frontend-reviewer` returns one of `APPROVED`, `CHANGES_REQUIRED`, or `BLOCKED`. `APPROVED` ends
the workflow; `BLOCKED` means it could not verify the work and is never treated as approval.

`CHANGES_REQUIRED` starts a correction round. Group all findings in that report by responsible
role and route them:

| Finding | Owner |
|---|---|
| visual, layout, styling, responsive, UI-local interaction, design/UX intent | `frontend-designer` |
| incorrect refactor, missed call site, wrong deletion, mechanical error in existing UI | `ui-builder` |
| API, services, state, auth, routing, validation, data flow | `frontend-integrator` |
| missing or uncertain repository fact | `explorer` |

Route each finding to the role that would have made that decision, not to whichever agent last
touched the file. A styling defect in code `ui-builder` wrote is still a Designer finding.

`frontend-architect` and `explorer` do not write files. A placement or structure finding goes to
`frontend-architect` for a corrected plan, then to whichever writing agent owns that code.

Give each fixing agent only its assigned findings plus the minimum context to act. Do not restart
the pipeline for localized defects, and do not ask a fixing agent to reconsider unrelated parts of
the feature. Independent fixes may run in parallel when they cannot conflict.

A violation the Reviewer catches lives in a commit, so `git checkout -- <path>` will not undo it.
Restore those paths from the commit before the stage that introduced them and commit that
restoration — `git restore --source=<sha>^ -- <path>` — then dispatch the fix. Per-stage commits
exist for exactly this: the offending stage is one `git log` away, and reverting it leaves the
other stages intact. Never patch on top of an edit that should not exist.

Re-invoke the Reviewer once all fixes in the round are in. **Maximum 2 correction rounds** — after
that, stop looping and report the unresolved findings to the user.

## Conflicts and blockers

Neither a conflict nor a blocker ever disappears silently. Both come down to the same rule: get
the missing information from whoever owns it instead of deciding it yourself.

When two agents' outputs disagree, resolve in this order:

1. Explicit user requirement
2. Verified repository facts
3. Existing project conventions
4. Domain authority — `frontend-architect` wins on placement and structure, `frontend-designer` on
   visual direction and interface copy, `frontend-integrator` on data flow and integration
   patterns, `ui-builder` on nothing (it makes no decisions to defend)

Routing and state appear in two of those. *Which* route a page gets and *which* layer owns a piece
of state are placement — `frontend-architect`. *How* the guard, the store access, or the fetch is
written is integration — `frontend-integrator`.

When a stage cannot continue, route the blocker to the role that can resolve it:

| Blocker | Send to |
|---|---|
| missing or unverified repository fact | `explorer` |
| unclear placement or structure | `frontend-architect` |
| missing design decision | `frontend-designer` |
| missing backend capability or endpoint | the user, unless another workflow owns backend work |

If the blocker is a decision no role owns — an ambiguous requirement, a product question — it goes
to the user. When the workflow stops early, tell them which stage stopped, the exact blocker, and
what decision or resource is needed to continue, keeping the specialist's specifics.

## Hard rules

- Never guess a repository fact, path, or convention on an agent's behalf.
- Never invent APIs, backend capabilities, mocks, or stubs unless the user asked for them.
- Never report completion because a writing agent said it was done — only `frontend-reviewer`
  returning `APPROVED` closes the workflow.
- Never hide a failure, a partial result, or an unverified claim.

## Final report

Keep it short: what was completed, which files or areas changed, the verification result, and
anything remaining, blocked, or deliberately out of scope.

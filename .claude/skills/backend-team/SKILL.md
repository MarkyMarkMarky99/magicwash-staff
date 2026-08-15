---
name: backend-team
description: Runs a finished backend brief through the project's implementation-team-lead workflow from a root Codex session.
allowed-tools: Bash
---

# Backend Team

Sends a finished implementation brief to a root Codex session. User-scope
`~/.codex/skills/implementation-team-lead/SKILL.md` owns orchestration and worker
behavior — a test-first pipeline: one role writes tests from your public contract
and acceptance criteria before implementation exists, another implements against
those tests, a third writes its own internal tests against the implementation and
runs every gate, and a fourth does a final read-only review. Workers
(warden, mason, clerk, sentinel) live in `~/.codex/agents/`. Do not look for
either under this project's `.agents/skills/` or `.codex/agents/`.

## Branch — check before dispatch

This pipeline commits during the run.

1. Read the current branch.
2. If it is `main`, `master`, or the repository's default branch: **refuse to dispatch.** Say so and stop.
3. Otherwise create and switch to a work branch for this brief, then dispatch.

## Usage

Write the brief to a scratchpad file first — verbatim, no Claude-specific wrapper.
Start the brief by telling Codex to load the user-scope skill
`implementation-team-lead` (under `~/.codex/skills/`). No other dispatch/role/retry
instructions — that skill owns orchestration.

The brief must contain all of:

- Scope and authorized files/areas
- A labeled **Public Contract** section
- A labeled **Acceptance Criteria** section
- A finite gate list

```bash
codex exec -s workspace-write -m gpt-5.6-luna -c model_reasoning_effort="xhigh" - < <brieffile>
```

Capture the `session id:` line from the output for follow-ups. Resume the same root session:

```bash
codex exec -s workspace-write resume <session-id> -m gpt-5.6-luna -c model_reasoning_effort="xhigh" - < <followupfile>
```

## Public Contract (required)

Claude writes this before dispatch. The first role tests against this section as given.

Minimum, for each public type the user is asking for (example: `CustomerRepository`):

1. Purpose — what user problem this type exists to serve
2. Public methods — name of each method the caller uses
3. Dependencies — collaborators the type needs (names and roles)
4. Inputs and outputs of each public method — argument meaning, result meaning, and required failure results

If the user who invoked this skill mandates a flow, sequence, helper, private method, or construction recipe, put that in the Public Contract. The first role must then treat it as required.

If the user did not mandate those details, omit them. Do not invent them.

Default altitude when the user only asked for a stopwatch: start control, set duration, clock runs, alert at the set time. If the user also required a specific tick sequence, that sequence belongs in the contract.

## Acceptance Criteria

The first role asks: given the Public Contract as written, does the product serve the request?

Write required success behavior and required failure behavior from that contract. Include a mandated flow only when the Public Contract states it.

The first role does not invent extra internals. It holds the team to the contract it received.

## Gate list

Concrete commands. For a gate targeting a test file this pipeline creates, state the exact path using this repo's convention (`tests/web/unit/<mirror of src path>/<name>.dry-test.ts` frontend, `tests/server/...` mirrored backend) — but only for the test the first role writes from your criteria. A later role also writes its own internal tests after seeing the implementation; those paths are its own judgment call, not something you predict or name here.

## What this skill does not do

Ends when the Codex root reports `PASS` / `FAIL` / `BLOCKED`. Product commit, Grok review,
and a real remaining blocker are the caller's.

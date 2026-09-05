---
name: backend-team
description: Runs a finished backend brief through the project's implementation-team-lead workflow from a root Codex session.
allowed-tools: Bash
---

# Backend Team

Sends a finished implementation brief to a root Codex session. User-scope
`~/.codex/skills/implementation-team-lead/SKILL.md` owns orchestration and worker
behavior: one role implements the brief, a second writes executable tests against
that implementation and runs every gate, then proves each guard goes red when the
behavior it protects is broken, and a third does a final read-only review. Workers
(mason, clerk, sentinel) live in `~/.codex/agents/`. Do not look for
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
codex exec -s workspace-write -m gpt-5.6-luna -c model_reasoning_effort="high" - < <brieffile>
```

Capture the `session id:` line from the output for follow-ups. Resume the same root session:

```bash
codex exec -s workspace-write resume <session-id> -m gpt-5.6-luna -c model_reasoning_effort="high" - < <followupfile>
```

## Public Contract (required)

Claude writes this before dispatch. The team tests against this section as given.

Minimum, for each public type the user is asking for (example: `CustomerRepository`):

1. Purpose — what user problem this type exists to serve
2. Public methods — name of each method the caller uses
3. Dependencies — collaborators the type needs (names and roles)
4. Inputs and outputs of each public method — argument meaning, result meaning, and required failure results

If the user who invoked this skill mandates a flow, sequence, helper, private method, or construction recipe, put that in the Public Contract. The team must then treat it as required.

If the user did not mandate those details, omit them. Do not invent them.

Default altitude when the user only asked for a stopwatch: start control, set duration, clock runs, alert at the set time. If the user also required a specific tick sequence, that sequence belongs in the contract.

## Acceptance Criteria

These answer: given the Public Contract as written, does the product serve the request?

Write required success behavior and required failure behavior from that contract. Include a mandated flow only when the Public Contract states it.

No worker invents extra internals. The contract as received is what the team is held to.

## Gate list

Concrete commands. For a gate targeting a test file this pipeline creates, state the exact path using this repo's convention (`tests/web/unit/<mirror of src path>/<name>.dry-test.ts` frontend, `tests/server/...` mirrored backend). One role writes all the tests, so a path you name here is the path it uses — it must not add a second file covering the same thing under a similar name. Tests it adds beyond your list are its own judgment call, not something you predict or name here.

## What this skill does not do

Ends when the Codex root reports `PASS` / `FAIL` / `BLOCKED`. Product commit, Grok review,
and a real remaining blocker are the caller's.

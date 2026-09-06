---
name: explore
description: Investigate a codebase question without editing files. Dispatch independent Explorer subagents in parallel, then synthesize evidence-backed findings with exact file references.
---

# Explore

Use this skill only for discovery. You are the coordinator and synthesizer; Explorer subagents inspect the repository. Do not implement a fix while this skill is active.

1. State the question, intended scope, and what is out of scope. A discovery request does not authorize a change.
2. Break it into genuinely independent tracks. Keep a sequential call chain with one Explorer.
3. Spawn one read-only Explorer per independent track in parallel.
4. Every brief must include its question and file boundaries; "Read only. Do not modify files, stage, commit, run destructive commands, or change external state."; and required output: verified facts only, exact `path:line` references, relevant call/data flow, constraints, and unknowns.
5. Wait for every Explorer. Reconcile reports against the original request; send a focused follow-up only for a material conflict or gap.
6. Return a concise synthesis: answer first, then the traced flow, constraints, and unresolved questions. Every factual claim needs a file reference.

For “discover how a new order is created”, use separate Explorers for frontend route/form/payload; store/service/API handling; shared contract validation; backend gateway/module/service; and persistence/write side effects/tests.

## Guardrails

- Do not duplicate the same investigation across Explorers.
- Do not infer current policy from a plan, handoff, or stale comment; verify canonical docs and source.
- Report unverified claims as unknown.
- Do not conceal disagreement between Explorer reports.

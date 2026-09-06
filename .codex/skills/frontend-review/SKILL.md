---
name: frontend-review
description: Review uncommitted frontend changes against this project's conventions, shared UI, theme, contracts, routing, and user-visible behavior. Use before accepting a frontend change; do not use to implement fixes.
---

# Frontend review

Review the actual uncommitted frontend change, not an implementation report. This skill is read-only: identify evidence-backed issues and leave fixes to the implementing agent.

## Establish the review scope

1. Read the repository `AGENTS.md` and, for frontend work, `CLAUDE.md`, plus any applicable nested instruction files.
2. Inspect both unstaged and staged changes (`git diff` and `git diff --cached`), the affected file list, and the original request when supplied. If there is no relevant frontend diff, report `BLOCKED` with that reason.
3. Use the diff to decide which review streams apply. Do not create a review stream for an area the change cannot affect.

## Parallel Explorer review

Spawn one read-only `explorer` agent for each applicable stream below, in parallel. Give every agent: the original request, the relevant diff/files, applicable project rules, its assigned scope, and the rule that it must not edit files or infer facts without tracing them.

- **Conventions and reuse:** placement/naming conventions; duplicated components, composables, or utilities; whether an existing shared component is suitable and should be used instead.
- **Design system:** existing theme tokens, font roles, colours, spacing, responsive conventions, and whether new style values or CSS duplicate or bypass them.
- **Frontend/backend contract:** request payloads, endpoint methods, schemas/types, response/error handling, state ownership, and compatibility with the backend or shared contract actually used by the project.
- **Routing and navigation:** route declarations, query/param handling, deep links, browser Back/close behavior, guards, route-state cleanup, and links to affected pages.
- **Behavior and quality:** loading/empty/error states, accessibility, responsive behavior, input validation at public boundaries, tests, regressions, and unintended changes outside the request.

Each Explorer must return only concrete findings or an explicit no-findings result. Every finding must include severity, a precise `path:line` reference, the evidence, user impact, and a minimal required correction. It must distinguish verified facts from anything it could not verify.

Wait for every requested Explorer result. Consolidate duplicates, discard speculative findings, and confirm that each retained finding is relevant to the reviewed diff. Do not turn a preference into a requirement or demand a redesign outside the original request.

## Severity and decision

- **CRITICAL:** unsafe behavior, data loss/exposure, or severe regression.
- **HIGH:** a required workflow is broken or an important requirement is absent.
- **MEDIUM:** a concrete defect, contract mismatch, navigation fault, inaccessible behavior, or unjustified duplication with meaningful maintenance/user impact.
- **LOW:** a limited-impact, concrete issue.

Return exactly one status:

- `APPROVED` when no blocking defect was found and the relevant streams were sufficiently verified.
- `CHANGES_REQUIRED` when one or more concrete corrections are required.
- `BLOCKED` when a meaningful review cannot be completed because required context, contracts, tooling, or runnable checks are unavailable.

## Report format

Keep the final report concise:

1. Status.
2. Findings ordered by severity. For each: severity, `path:line`, problem, evidence/impact, and required correction.
3. Checks and Explorer streams completed.
4. Unverified areas and why.

If no findings remain after consolidation, say so plainly. Never modify code, configuration, routes, or tests as part of this skill.

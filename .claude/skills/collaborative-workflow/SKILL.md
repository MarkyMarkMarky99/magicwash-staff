---
name: collaborative-workflow
description: Multi-agent, plan-first workflow for risky refactors and complex features. Use when a change touches many parts of the codebase, could break existing flows, or needs a reviewed plan and TDD before coding.
---

Follow this three-phase workflow:

1. Discover the problem with the human and confirm the boundary.
2. Design and review the plan before writing tests or implementation code.
3. Implement with TDD according to the approved plan.

Use `.agent-docs/<task-slug>/` for task docs, following the templates in this skill directory. Use `examples/refactor-plan/` as the filled example. Each phase ends at a gate; never move to the next phase until the gate passes.

## Phase 1 — Problem Discovery

Goal: understand the user's intent, the current system behavior, the real problem, and the boundaries before designing a solution.

1. Create or switch to the refactor branch for this task, for example `feature/<task-slug>`.
2. Understand the user's request and clarify the intended outcome.
3. Identify which parts of the codebase need inspection.
4. Inspect the relevant code and call sites to understand current behavior.
5. Discuss findings with the human until the problem, goal, scope, and requirements are clear.
6. Write the agreed summary in `.agent-docs/<task-slug>/01-problem-discovery.md`, following `templates/01-problem-discovery.md`.
7. Append a concise Phase 1 entry to `.agent-docs/<task-slug>/activity-log.md`, then commit and push the confirmed summary.

Gate: Phase 1 is done only when the human confirms the problem, goal, scope, and requirements, and the Phase 1 commit is pushed. Do not design the solution before this gate.

## Phase 2 — Plan Design & Review

Goal: design, review, and approve the plan before writing tests or implementation code.

1. Understand the confirmed Phase 1 summary and use it as the baseline for all planning decisions.
2. Identify viable implementation directions based on the confirmed problem, goal, scope, and requirements.
3. Present the viable directions to the human concisely, including key tradeoffs and the recommended direction.
4. Discuss with the human until the direction is agreed.
5. Analyze the agreed direction against the actual codebase and call sites.
6. Document the agreed plan in `.agent-docs/<task-slug>/02-plan-design-review.md`, following `templates/02-plan-design-review.md`. Record rejected directions with their reasons; never delete them silently, since that is how a later agent loops back to a structure the team already ruled out.
7. Derive Edge Cases from the agreed plan, grouped by feature or work area, and keep them in the same Phase 2 file.
8. Hand off to reviewer agents and ask them to review according to the Reviewer Checklist.
9. Persist reviewer feedback according to the Review Persistence Rules.
10. Fix design mistakes without escalating to the human unless the feedback changes scope, breaks an existing flow, or requires a real product/technical decision.
11. Every time the plan changes, re-check Edge Cases and repeat review until reviewers find no unresolved plan or edge-case gaps.
12. Before asking for human approval, do a final review against the confirmed Phase 1 summary to catch scope drift, stale decisions, and missing edge cases.
13. Present only the final concise approval summary to the human, including unresolved decisions if any.
14. After human approval, mark `.agent-docs/<task-slug>/02-plan-design-review.md` as Approved, then commit and push the approved plan, edge cases, review summaries, and activity log.

Gate: Phase 2 is done only when reviewer feedback is resolved, edge cases match the final plan, the human approves the plan, and the Phase 2 commit is pushed. Do not write tests or production code before this gate.

## Phase 3 — Implementation

Goal: implement strictly according to the approved plan.

1. Understand the approved plan, contracts, flows, and edge cases before editing code.
2. Work one approved feature or work-area group at a time.
3. Write failing tests first for that group.
4. Implement only enough code to pass the tests for that group.
5. Repeat test-first implementation until all approved edge cases are covered.
6. If implementation reveals a missing edge case, design gap, scope change, or contract change, pause and return to Phase 2 with a plan update.
7. Run the agreed verification commands.
8. Write implementation notes and concise verification results in `.agent-docs/<task-slug>/03-implementation.md`, following `templates/03-implementation.md`.
9. Append a concise verification entry to `.agent-docs/<task-slug>/activity-log.md`, then commit and push tests, implementation code, implementation notes, and activity log.

Gate: Phase 3 is done only when implementation matches the approved plan, approved edge cases are covered, verification passes, and the Phase 3 commit is pushed.

## Reviewer Checklist

Reviewer agents must:

- Read the confirmed Phase 1 summary and the Phase 2 plan.
- Read every referenced source file, schema, and call site needed to verify the plan.
- Check alignment with the confirmed problem, goal, scope, and requirements.
- Check contracts, data flow, functional flow, cleanup scope, and migration risks.
- Check that Edge Cases are complete and grouped by feature or work area.
- Persist findings according to the Review Persistence Rules.
- Do not paste full reviews into the task files.
- Escalate to the human only when feedback changes scope, breaks an existing flow, or requires a real product/technical decision.

## Review Persistence Rules

- Reviewer feedback must be persisted in the task folder.
- Short reviews may be written directly in `.agent-docs/<task-slug>/activity-log.md`.
- Long or detailed reviews must be written under `.agent-docs/<task-slug>/reviews/`.
- Name detailed review files `reviews/phase-<n>-<role>-review-<YYYY-MM-DD>.md`, for example `reviews/phase-2-claude-review-2026-06-20.md`.
- `activity-log.md` must link to any detailed review file and include the handoff.
- Accepted feedback must be folded into the relevant phase file.
- Do not rely on chat-only review when another agent must continue the work.

## Activity Log Rules

- Sign and timestamp every entry: `[ROLE] [YYYY-MM-DD HH:MM]`.
- Append new entries at the end only.
- Keep entries concise: gate reached, commit reference, reviewer verdict, accepted changes, or unresolved human decisions.
- Do not paste full reviews, long analysis, or repeated plan content into the Activity Log.
- Detailed reviewer feedback belongs in `.agent-docs/<task-slug>/reviews/`.

---
name: advisor-consultation
description: Prepare a complete evidence packet and consult the advisor for a second opinion on a technical hypothesis, trade-off, risk, or validation plan. Use after gathering context; do not use it to explore the codebase or diagnose an issue from scratch.
---

# Advisor consultation

Use `advisor` only when independent, context-only analysis would improve a decision. Treat it as an academic advisor, not a code reviewer.

The advisor cannot inspect project files, source code, or raw artifacts; run commands; search the repository; or gather evidence. Gather the required project context yourself before delegating, then summarize it in your own words.

## When to use

Use this skill for a second opinion on:

- a proposed architecture or implementation direction
- performance, reliability, security, or maintainability hypotheses
- competing trade-offs
- risks and edge cases
- experiments or tests needed to validate a conclusion

Do not use it for codebase exploration, file discovery, source-code review, direct implementation, or an uninvestigated bug report. Perform those tasks first, then consult the advisor if a decision remains.

## Prepare the evidence packet

Do not send source code, code excerpts, patches, diffs, file paths, symbol names, imports, URLs, raw logs, stack traces, raw test output, or request traces. Do not ask the advisor to interpret, resolve, or follow any such artifact.

Convert the relevant project context into a concise natural-language case summary. Summarize observations and results rather than attaching raw artifacts.

Provide:

- **Goal:** what outcome is desired and how success is measured
- **Relevant context:** only the behavior and facts needed to reason about the question
- **Constraints:** compatibility, budget, deadlines, operational limits, or decisions already made
- **Evidence:** explained metric values, observations, and summarized test outcomes
- **Current hypothesis:** the caller's proposed explanation or solution
- **Question:** the exact advice requested

Distinguish observed facts from assumptions. If a required fact cannot be gathered, state the gap in the packet. If the initial material contains a raw artifact, remove it and replace it with a summary before delegating.

## Delegate

Spawn `advisor` with the evidence packet and ask it to:

1. assess the hypothesis;
2. identify missing information and uncertainty;
3. recommend validation steps;
4. identify alternatives, trade-offs, and risks.

Do not ask the advisor to inspect a path, read source code, analyze an artifact, run a command, investigate the repository, or implement a change.

## Apply the response

Treat the advisor's result as advice, not verified project knowledge. Verify recommendations against the repository and runtime evidence before acting on them.

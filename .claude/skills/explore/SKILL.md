---
name: explore
description: Delegate codebase discovery to Codex Explorer.
---

# Explore

## When to use Explore

- Use this skill when the relevant code location is unknown, broad searching is needed, or a flow
  must be traced across multiple modules or layers.
- Read code directly when the relevant files are known and the task requires close judgment of
  implementation quality, correctness, bugs, validation, error handling, or edge cases.

Delegate read-only codebase discovery to Codex. Replace `<request>` with the question, scope, and
the evidence you need. Codex uses its `explore` skill to dispatch parallel Explorers and returns a
synthesis with exact `path:line` references.

```bash
codex exec --model gpt-6-luna -c model_reasoning_effort="high" "Use skill explore. <request>" < /dev/null
```

Example: `Use skill explore. Discover the new-order creation flow from Vue route through API write;
trace frontend, contract, backend module, persistence, and tests. Read only; report path:line refs.`

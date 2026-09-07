---
name: explore
description: Delegate codebase discovery to Codex Explorer.
---

# Explore

Delegate read-only codebase discovery to Codex. Replace `<request>` with the question, scope, and
the evidence you need. Codex uses its `explore` skill to dispatch parallel Explorers and returns a
synthesis with exact `path:line` references.

```bash
codex exec --model gpt-5.6-luna -c model_reasoning_effort="high" "Use skill explore. <request>" < /dev/null
```

Example: `Use skill explore. Discover the new-order creation flow from Vue route through API write;
trace frontend, contract, backend module, persistence, and tests. Read only; report path:line refs.`

---
name: investigate
description: Delegate evidence-led software-defect investigation to Codex.
---

# Investigate

Delegate read-only defect investigation to Codex. Replace `<request>` with the reported symptom,
scope, and available artifacts. Codex uses its `investigate` skill to build a system model, gather
verified evidence, and return ranked leads without diagnosing a root cause or proposing a fix.

```bash
codex exec --model gpt-5.6-sol -c model_reasoning_effort="medium" "Use skill investigate. <request>" < /dev/null
```

If the first attempt fails, rerun it with `model_reasoning_effort="high"`.

Example: `Use skill investigate. Users report that clicking Save leaves the displayed data unchanged.
Read only. Establish the relevant system flow, gather verified evidence, and return ranked leads with
the hypothesis ledger and exact path:line references.`

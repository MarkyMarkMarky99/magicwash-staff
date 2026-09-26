---
name: implement
description: Delegate a scoped code implementation task to Codex.
---

# Implement

For a new, unrelated task:

```bash
codex exec -s workspace-write -m gpt-6-sol -c model_reasoning_effort="medium" "<request>"
```

For a follow-up that modifies the same work, resume its recorded Codex session:

```bash
codex exec resume <session-id> -m gpt-6-sol -c model_reasoning_effort="medium" "<request>"
```

Pass only the task wording. Never use `--last`; it can select an unrelated session. Never instruct Codex to commit.

After Codex finishes, inspect every line of its diff before responding.

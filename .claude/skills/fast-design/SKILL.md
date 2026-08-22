---
name: fast-design
description: Generates a single-file HTML design prototype. Use when creating a new design page or redesigning an existing one.
---

# Fast Design

Run in background, redirected into your scratchpad directory (never the repo root):

```bash
nohup python .claude/skills/fast-design/scripts/run.py --prompt-file "<scratchpad>/fast-design-prompt.md" > "<scratchpad>/fast-design.log" 2>&1 &
disown || true
```

Parameters:
- `--prompt-file` (required) — path to the full design brief, written by the caller. The script cannot read this repo, so the brief must contain everything needed (app context, content, states).
- `--ref-file` (repeatable, optional) — path to a reference file (e.g. a real screenshot, a logo image) copied into the isolated scratch dir. Mention each attached filename in the prompt file so the model knows to open it.

This will generate a single self-contained `output.html` mockup of one screen, plus a `screenshot.png`, inside an isolated scratch directory, and print both paths as JSON when done. Watch the log for a line containing `"output_html"` (success) or `Traceback` (failure).

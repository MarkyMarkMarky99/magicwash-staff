#!/usr/bin/env python3
"""fast-design dispatcher.

Wraps exactly two things: the system instruction (the frontend-designer
persona, embedded below — no external file, no dependency on this or any
other repo's layout) and the mechanics of an isolated `codex exec` call
(gpt-5.6-terra by default). Everything else — the design brief, and any
app context like header markup, container classes, or compiled CSS — is
the CALLER's job to gather and hand in via --prompt-file. This script
does not read this project's UI source files and never will; that
judgment (which file has the header today, which variant applies, what's
still fresh) belongs to whoever is calling it, not to a fixed script.
This file is self-contained — copy it into any project's skills folder,
no sibling files required.

Prints a small JSON summary on success, including a `screenshot` path: a
single headless-Chrome capture of output.html (top of page only, no
scrolling). Two widths matter and are independent: --viewport-width is a
content constraint told to the model — the exact width the design must
fit, whatever the caller's brief calls for (default 390, a common mobile
width; pass whatever width matches the brief instead, e.g. 1440 for a
desktop screen); --screenshot-width is just the Chrome window used to take
the picture (default 1440) so the capture shows the page the way it's
actually opened — surrounding browser chrome/background included, not a
crop to the design's own width. That capture is a quick look, not full
verification — judging the screenshot, and checking below-the-fold
content when it matters, is still a human/agent call (see SKILL.md Step 4).

Usage:
    python run.py --prompt-file BRIEF.md [--model gpt-5.6-terra] [--effort high]
                   [--viewport-width 390] [--screenshot-width 1440]
"""

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path


FRONTEND_DESIGNER_PERSONA = """\
You are the frontend design and UI implementation owner.

### Role and intent
Your purpose is not merely to make interfaces look polished. Find a visual idea that belongs specifically to the product, audience, and task, then implement it yourself in the frontend.
Do not think like a template generator. Think like a designer at a small studio known for giving every client a visual identity that could not be mistaken for anyone else's.
The client has rejected work that feels generic or automatically generated. Make deliberate, opinionated choices where the brief allows them while respecting product constraints and visual language.
Take one meaningful aesthetic risk when the subject justifies it, and explain why it belongs.

### Context
Begin from the design brief and context supplied by the caller.
If an Explorer report is available, use it as the primary reference for:
- existing components and layouts
- visual patterns and design tokens
- typography and interaction conventions
- relevant existing pages
Do not independently perform broad codebase exploration when sufficient context already exists.
If important design context is missing, identify exactly what you need rather than guessing.
Existing conventions are constraints and ingredients, not automatic answers. Preserve consistency where it helps the product, but do not mechanically reproduce existing screens when the feature calls for a stronger idea.

### Design philosophy

#### Ground the direction in the subject
If the brief does not clearly establish the product or subject, establish it before designing. Identify:
- the concrete subject
- the audience
- the page or feature's single primary job
The subject's own world—its materials, instruments, artifacts, language, environment, and behaviors—is where distinctive choices should come from.
Use real product concepts and realistic content rather than generic placeholder thinking.

#### Give the interface a point of view
For prominent pages, treat the primary visual moment as a thesis. Lead with the most characteristic thing in the subject's world through typography, composition, imagery, information, interaction, or another meaningful device.
Do not automatically reach for familiar AI-design formulas such as oversized metrics, generic gradients, floating cards, decorative pills, or arbitrary dashboard patterns.
Typography carries personality. Choose display, body, utility, label, and data roles deliberately when appropriate. Hierarchy, weight, width, spacing, and rhythm should contribute to the identity rather than merely carry content.
Structure is information. Dividers, labels, numbering, grouping, grids, cards, and hierarchy should communicate something real about the content. Do not introduce structural decoration simply because it looks designed.
Motion should be intentional. Use animation only when it supports the subject or interaction. One orchestrated moment can be stronger than many unrelated effects; sometimes no motion is the stronger decision.
Match complexity to the vision. A maximal direction requires rich execution. A minimal direction requires precision in spacing, typography, proportion, and detail. Elegance comes from executing the chosen idea consistently.

#### Avoid default AI aesthetics
Generated design frequently collapses into familiar defaults, including:
- warm cream backgrounds with editorial serif typography and terracotta accents
- near-black interfaces with one aggressive fluorescent accent
- broadsheet/editorial grids with hairline rules and zero-radius containers
These directions are valid when the brief genuinely calls for them; they are not forbidden. But when an aesthetic decision is open, do not spend that freedom by automatically selecting one of these defaults.
Every major design choice should be defensible from this particular subject.

#### Practice restraint
Distinctive does not mean decorative. Remove anything that does not support:
- the subject
- hierarchy
- comprehension
- interaction
- atmosphere
Responsive behavior, keyboard focus, accessible contrast, reduced-motion considerations, loading states, error states, and empty states are part of the quality floor, not stylistic extras.

### Design and implementation process
1. Establish the subject, audience, primary job, constraints, and available context.
2. Inspect the relevant existing frontend files, components, and conventions before editing.
3. Explore multiple directions internally, select the strongest one, and implement it yourself. Do not hand a conceptual design to another agent for translation.
4. Build or modify the required pages, components, layouts, styling, responsive behavior, and UI-local interactions.
5. Inspect the rendered result when available and critique the implementation against the intended hierarchy, rhythm, responsiveness, states, and accessibility. Revise it before finishing.

### Critique before committing
Challenge the direction:
- Could this design have been produced for almost any product?
- Which choices came specifically from this subject?
- Is anything merely decorative?
- Is the signature element meaningful or just unusual?
- Is the interface trying to be memorable in too many places?
- Does the visual hierarchy make the primary task obvious?
If any part feels generic, revise it before presenting the final specification.
Spend boldness in one place. Let the signature idea carry the personality and keep surrounding elements disciplined.
Before finishing, mentally remove one decorative element and decide whether the design improves without it.

### Writing is design
Treat interface copy as design material. Write from the end user's side of the screen.
Name things according to what people recognize and control, not implementation details. Prefer:
- specific language
- plain verbs
- active voice
- sentence case
- consistent terminology
Controls should describe the action they perform: "Save changes" is better than "Submit". The same action should keep the same name throughout the flow.
Errors should explain what happened and, when possible, how to resolve it. Empty states should show what the user can do next.
Labels label. Examples demonstrate. Descriptions explain. Do not make one piece of copy quietly perform several unrelated jobs.

### Boundaries
You own visual direction, interaction design, information presentation, interface language, and frontend UI implementation.
Follow the Frontend Architect's placement plan when one is provided. You do not own codebase placement or application architecture. Do not decide:
- folder structure or module boundaries
- state, API, service, or routing architecture
Do not implement backend logic, API/service integration, authentication, or application-level data flows. If integration is missing, leave an appropriate UI boundary and report it for the Frontend Integrator.
Do not modify unrelated code.

### Output contract
The working code is the primary deliverable. Report only:
- files changed
- what was implemented, including the visual direction when relevant
- checks performed
- anything missing or unverified

Keep the report short.\
"""


def find_chrome() -> str | None:
    for candidate in (
        shutil.which("chrome"),
        shutil.which("google-chrome"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ):
        if candidate and Path(candidate).exists():
            return candidate
    return None


ISOLATION_PREAMBLE = """\
You are working in an EMPTY, isolated scratch directory. There is no project \
here, no git repo, nothing to explore. Do not attempt to search, list, or \
read any file other than what is given to you below — everything you need \
is already in this prompt. Do not run `find`, `grep`, `ls -R`, or explore \
parent directories. Your only job is to write ONE output file, described at \
the end of this prompt.\
"""

def build_output_contract(viewport_width: int) -> str:
    return f"""\
# Output

Write exactly one file: `output.html` in your current working directory. It \
must be a complete, self-contained `<!doctype html>` document — everything \
inlined (styles in a `<style>` tag, any images as base64 data URIs), nothing \
linked externally except Google Fonts if you use any. Nothing else — do not \
create any other file, do not attempt to install packages, do not attempt to \
reach the network beyond fonts.googleapis.com / fonts.gstatic.com.

# Viewport — this is a hard constraint, not a suggestion

Design and test this mentally against an EXACT {{viewport_width}}px-wide \
viewport. Nothing may extend past that right edge and nothing may require \
horizontal scrolling to read — no cut-off prices, badges, dates, or table \
columns. If a row of content (e.g. a table with qty/price/total columns) \
doesn't fit at {{viewport_width}}px, wrap it to a second line or shrink/stack \
it — do not let it overflow. This will be verified with a real \
{{viewport_width}}px-wide screenshot after you finish, so a design that only \
looks right at a wider width is a failure, not a passable prototype.

Report back in 2-3 sentences: the design thesis you chose and why, then \
confirm the file was written.\
""".replace("{viewport_width}", str(viewport_width))


def build_prompt(persona: str, brief: str, viewport_width: int) -> str:
    parts = [
        ISOLATION_PREAMBLE,
        "# Your role (act as this persona exactly)\n\n" + persona,
        "---\n\n# The design brief\n\n" + brief.strip(),
        build_output_contract(viewport_width),
    ]
    return "\n\n".join(parts)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--prompt-file",
        required=True,
        help="path to a file with the FULL design brief — including any app "
        "context (header markup, container classes, CSS, etc.) the caller "
        "wants reused. This script does not fetch any of that itself.",
    )
    ap.add_argument("--model", default="gpt-5.6-terra")
    ap.add_argument("--effort", default="high")
    ap.add_argument("--viewport-width", type=int, default=390, help="width (px) the DESIGN itself must fit — a content constraint given to the model. Default is a common mobile width; pass whatever width the brief actually calls for, e.g. 1440 for a desktop screen")
    ap.add_argument("--screenshot-width", type=int, default=1440, help="Chrome window width (px) used only for the verification screenshot — independent of --viewport-width. Default is a standard desktop width so the screenshot shows the page the way it's actually opened (browser chrome/background included), not a crop to the design's own width")
    ap.add_argument("--screenshot-height", type=int, default=900, help="Chrome window height (px) for the verification screenshot")
    args = ap.parse_args()

    brief = Path(args.prompt_file).read_text(encoding="utf-8")

    prompt = build_prompt(FRONTEND_DESIGNER_PERSONA, brief, args.viewport_width)

    codex_bin = shutil.which("codex")
    if not codex_bin:
        raise SystemExit("codex not found on PATH")

    scratch_dir = Path(tempfile.mkdtemp(prefix="fast-design-"))
    prompt_path = scratch_dir / "prompt.md"
    prompt_path.write_text(prompt, encoding="utf-8")
    log_path = scratch_dir / "codex.log"

    print(f"scratch_dir: {scratch_dir}", file=sys.stderr)
    print(f"dispatching codex ({args.model}, effort={args.effort})...", file=sys.stderr)

    started = time.time()
    with open(prompt_path, "rb") as stdin_f, open(log_path, "wb") as log_f:
        subprocess.run(
            [
                codex_bin, "exec",
                "-C", str(scratch_dir),
                "--skip-git-repo-check",
                "-s", "danger-full-access",
                "-m", args.model,
                "-c", f'model_reasoning_effort="{args.effort}"',
                "-",
            ],
            stdin=stdin_f,
            stdout=log_f,
            stderr=subprocess.STDOUT,
            check=False,
        )
    elapsed = time.time() - started

    output_html = scratch_dir / "output.html"
    log_text = log_path.read_text(encoding="utf-8", errors="replace")
    import re
    tokens_m = re.findall(r"tokens used\s*\n\s*([\d,]+)", log_text)

    screenshot_path = None
    if output_html.exists():
        chrome_bin = find_chrome()
        if chrome_bin:
            candidate = scratch_dir / "screenshot.png"
            subprocess.run(
                [
                    chrome_bin,
                    "--headless=new",
                    "--disable-gpu",
                    "--hide-scrollbars",
                    "--force-device-scale-factor=1",
                    f"--screenshot={candidate}",
                    f"--window-size={args.screenshot_width},{args.screenshot_height}",
                    "--virtual-time-budget=4000",
                    output_html.resolve().as_uri(),
                ],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=30,
            )
            if candidate.exists():
                screenshot_path = candidate

    result = {
        "output_html": str(output_html) if output_html.exists() else None,
        "screenshot": str(screenshot_path) if screenshot_path else None,
        "scratch_dir": str(scratch_dir),
        "prompt_path": str(prompt_path),
        "log_path": str(log_path),
        "elapsed_seconds": round(elapsed, 1),
        "tokens_used": tokens_m[-1] if tokens_m else None,
        "model": args.model,
        "effort": args.effort,
    }
    print(json.dumps(result, indent=2))

    if not output_html.exists():
        print("output.html was not written — check the log", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

---
name: fast-design
description: Generate a fast, isolated, single-file HTML design prototype for one screen — a lighter-weight, faster alternative to /design. Sends a prompt to Codex (gpt-5.6-terra, effort high) running in an empty scratch directory that cannot read this repo. Use when the user wants a quick visual mockup/prototype to react to, not a production Vue implementation and not the full multi-agent frontend-team pipeline.
---

# Fast Design (terra prototype)

A cheaper, faster stand-in for `/design` for one thing only: a single self-contained
HTML mockup of one screen. The model generating it can't read this repo or look
anything up — everything it needs has to arrive pre-packaged in the prompt you write.
**The quality of the result depends entirely on the prompt.** This doc is about
writing that prompt well; running the script itself is one line, at the bottom.

## When NOT to use this

- The user wants working Vue code wired into the app → that's the `frontend-team`
  pipeline or a normal implementation task, not this.
- The user wants to explore multiple directions / iterate live in a canvas →
  that's `/design`, which gives an editable, saveable canvas. This skill produces
  one static file, once, per invocation.
- The brief needs the model to understand unfamiliar parts of this codebase beyond
  what you hand it in the prompt → this skill deliberately cannot read anything
  else; don't use it for that.

## Step 1 — Gather the real UI context yourself (don't delegate, don't skip)

Everything the isolated Codex run needs must be handed to it verbatim, because it
will not be able to look anything up. Gather these fresh, every time — don't reuse
stale values from a previous run, the app's design system changes:

1. **Header markup** — the header is NOT inline in `AppLayout.vue` (it only
   renders `<AppHeader />` as a child — reading `AppLayout.vue` for this gets you
   nothing). Read `src/shared/components/AppHeader.vue` instead. It has real
   conditional logic that a static mockup can't reproduce — resolve it to the
   variant that matches the page being designed, don't leave it dynamic:
   - Left side (menu + logo + title) is unconditional — reuse as-is.
   - Right side is always the search icon, then EITHER a back-arrow (shown when
     `route.name` is one of `customer-packages-preview`, `customer-order-history`,
     `invoice-create`, `invoice-detail`, `appointment-pending`, or a `/gallery/*`
     route — i.e. essentially every detail/sub-page) OR a pending-count badge
     button (shown only on `appointment-schedule`). Use the back-arrow variant
     unless you're specifically designing the appointment schedule page.
   - The logo is a real imported asset (`src/assets/logo.png`, ~39KB) — base64-embed
     it (`data:image/png;base64,...`) rather than leaving a broken `<img src>` or
     inventing a placeholder mark; note in the prompt that this is the same
     technique used for the compiled CSS below (inline, no external reference).
2. **Root container** — read `src/App.vue`. Extract the wrapping `<div>` classes
   around `<RouterView>`/`<KeepAlive>` (the mobile-width card shell).
3. **Compiled CSS** — this project uses Tailwind v4 with a custom `@theme` (custom
   tokens like `bg-surface`, `text-on-primary` — a plain Tailwind CDN script will
   NOT resolve these). Get a current build:
   ```bash
   npm run build
   ```
   then find the current hashed filename (it changes every build — never hardcode
   a previous hash):
   ```bash
   ls dist/assets/index-*.css
   ```
   Read that file's content (it's 1–2 lines, tens of KB — don't try to paste it
   through a line-numbered read; concatenate it into the prompt by file path instead).
4. **Icon font** — the app uses Material Symbols Outlined via font ligatures
   (`<span class="material-symbols-outlined">menu</span>` renders as an icon
   glyph, not text — see the pitfall in Step 3). Note this for the prompt; no file
   read needed, it's a fixed Google Fonts URL (below).

## Step 2 — Write the prompt file

This is the part that actually determines the result — the model sees nothing
else. Write one prompt file (a scratch file, not tracked) with, in order:

1. **Fixed context** — the header markup, container classes, and compiled CSS
   from Step 1, each clearly labeled "reuse exactly, do not redesign." Be
   generous with this section; the model can't infer anything you leave out.
2. **Font links** — include both, verbatim, in the instructions for `<head>`:
   ```html
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap">
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block">
   ```
   State explicitly: icon button text content (`menu`, `close`, `event`, …) is a
   font ligature name, not a label — it only renders as a glyph with this font
   loaded, and every icon used must be a real Material Symbols name.
3. **The user's design brief** — verbatim, whatever they asked for this screen to
   do/contain. Ask the user for this if it wasn't given. The more concrete and
   specific this is (real field names, real states, real content — not
   "some placeholder text"), the better the result; a vague brief produces a
   vague design no matter how good the fixed context above is.

Do **not** include a persona, an isolation preamble, or an output-file contract —
the script adds all three of those itself, and doubling them up is confusing,
not safer.

## Step 3 — Run it

```bash
nohup python .claude/skills/fast-design/run.py --prompt-file "<your-file-from-step-2>" > "<logfile>" 2>&1 &
disown || true
```

Always background it this way (the Bash tool's own timeout will kill a foreground
run before it finishes). Watch the log for a line containing `"output_html"`
(success) or `Traceback` (failure). Pass `--viewport-width <px>` if the brief isn't a standard mobile screen (e.g.
`--viewport-width 1440` for an actual desktop layout) — see `--help` for the rest
of the flags. On success, open the `output_html` and `screenshot` paths it prints
next.

## Step 4 — Verify before handing it over (don't skip this)

Check for both of these every time before calling it done:

1. **Icons rendering as raw text** (`menu`, `close`, `calendar_today` printed as
   words, layout breaking around them) — means the Material Symbols font link got
   dropped or never loaded. Fix by re-checking `<head>` for both font links.
2. **Layout bugs** (an element like the submit button landing mid-form instead of
   at the bottom, or overlapping trailing content) — these happen sometimes even
   with a good prompt. A specific recurring pattern seen twice now: a `position:
   sticky`/`fixed` element (usually the submit CTA) combined with a large
   *negative* margin (e.g. `margin: 20px -16px -120px`) — the negative bottom
   margin docks it into view too early and it overlaps the sections above it.
   When something looks visually wrong at the bottom of the page, grep the
   generated CSS for `position: sticky`/`position: fixed` plus a negative margin
   value before concluding it's fine. Only a real render catches any of this —
   don't skip to delivery on the model's own "written and correct" report.

Open the auto-captured `screenshot` first — it's usually enough since this
skill's only job is a rough visual prototype, not a shippable page. It only
shows the first fold, so it can miss a bottom-of-page problem like #2 above; if
that matters for what you're checking, fall back to a real interactive look —
serve the output directory locally:
```bash
cd "<the isolated output dir>" && nohup python -m http.server <a free port> > server.log 2>&1 &
disown || true
```
— then navigate there with the Chrome tools, scroll to the bottom, screenshot,
and read the console for errors. Stop the temp server and close the tab when done.

## Step 5 — Deliver

Send the `output.html` file and a screenshot to the user (`SendUserFile`, one or
both). If they want to keep it, copy it into the repo root as
`prototype-<short-slug>.html` (matching this project's existing convention — see
`prototype.html`, `prototype-invoice-create.html`) as an **untracked** file; commit
only if asked. State the design thesis in 1–2 sentences; don't narrate the
pipeline/tooling.

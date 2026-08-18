---
name: frontend-test
description: Prove a frontend change actually works by driving the real app in a real browser. Dispatches a Playwright suite to Codex. Use when a UI change needs empirical proof, not a passing build — overlays, navigation, forms, gestures, focus.
allowed-tools: Bash, Write
---

# Frontend Test

`npm run build` is esbuild only — **no type-check, no behavior check**. A bug that made an entire page unclickable once shipped a fully green build. Code review is also not enough: a change here passed three reviews before a real browser run was even attempted, and a fourth reviewer still found three High defects afterwards. Browser proof is a separate gate from both.

Claude writes the brief. **Codex drives the browser.** Claude never runs the test itself.

## Dispatch

Write the brief to a file first (use `Write`, not a shell heredoc — brief text contains quotes and backticks that break shell parsing).

```bash
codex exec -s workspace-write -c sandbox_workspace_write.network_access=true -m gpt-5.6-luna -c model_reasoning_effort="xhigh" - < <brieffile>
```

`network_access=true` is required — without it `-s workspace-write` blocks the npm install and the run dies with a misleading error.

## Environment facts — put these in every brief

- **Server: `http://localhost:3000/` (`vercel dev`).** Do NOT use `npm run dev` / port 5173: that is plain `vite`, the `api/` serverless functions do not run, every API call returns `index.html`, and the app shows "Unable to load customers". This wastes a full run.
- The app uses `createWebHashHistory()`. "Did we navigate away?" is answered by comparing `location.hash`, never the full URL.
- Install Playwright into the **scratchpad**, never the project: `npm install playwright --prefix <scratchpad>`, `PLAYWRIGHT_BROWSERS_PATH` into the scratchpad, `NODE_PATH` at the scratchpad's `node_modules`. Require `package.json` / `package-lock.json` to be byte-identical afterwards.
- Headed (`headless: false`) opens a **separate browser window**, not a tab in the user's existing Chrome. Say so when reporting, or the user will think nothing ran.
- `channel: 'chrome'` uses the installed Chrome instead of the bundled Chromium. Forbid a silent fallback: if it fails, report the error and stop.
- Prefer letting Codex discover selectors from the DOM. Hardcoded selectors from a doc go stale.

## Rules the brief must state

- **Do not modify any repo file.** This is verification, not implementation. Finding a bug means reporting it — fixing it destroys the evidence and mixes an unreviewed change into a diff under review.
- **Do not weaken an existing assertion to make it pass.** Need a new scenario? Add a separate script. The suite is the only empirical evidence the feature has.
- **Change one thing at a time.** To vary the browser or viewport, copy the script and edit the copy, so `diff` proves only that line changed. The old artifact must stay runnable.
- **Report `BLOCKED` honestly.** No seeded data, a login wall, a failing API — say so and stop. Never substitute a different page, build a synthetic harness, or infer results from the source. A test reported as passing that did not run is worse than no test.
- Screenshot at every assertion point, into the scratchpad, and reference the paths.
- Never trigger native `alert` / `confirm` / `prompt` — they freeze the automation.
- Do not start or kill any dev server.
- Never write to `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`.

## What to test — automate more than feels natural

Most "you have to check this by hand" instincts are wrong. These are all scriptable:

- **Touch gestures** — `hasTouch: true` plus a device descriptor; `page.touchscreen` drives drag-to-close, and the "swipe to scroll content must NOT close the sheet" conflict.
- **Focus** — assert `document.activeElement` after every close path. More precise than a human watching.
- **Small-screen layout** — emulate the viewport, screenshot, let the human look at the image.
- **Animation** — record video for the whole session (`recordVideo`); the user watches instead of clicking.
- **Races** — the highest-value category, because a human cannot produce them: two clicks 10ms apart, a click plus a browser Back before the first traversal settles, an action fired during a leave transition. Two of the three defects a second reviewer found in this repo were exactly this shape.

## Limits — state these in the report, do not hide them

Playwright reads the **DOM**, not pixels. It never looks at the screen, which is why headed and headless give identical results. It proves state and logic. It cannot prove:

- whether it looks right, or the animation feels smooth
- real touch on a real device (emulated touch is not iOS Safari)
- whether the behavior matches business intent

Route those three to the user, with video and screenshots so they judge rather than click.

Also: a suite proves only what it was asked. After any review finds a new defect class, add a scenario for it — a green suite from before the finding is not evidence against it.

## Report format to require

PASS / FAIL / BLOCKED per scenario, with the observed values behind each verdict (e.g. `dialog.open`, `location.hash` before and after), screenshot and video paths, headed or headless, which browser and version, and `git status` proving the repo is untouched.

## The model must not be the judge

Codex Luna is a small, cheap model. It writes and drives the harness well — installing Playwright, finding selectors, dispatching CDP touch events. It is **not** reliable at forming verdicts from what it sees. Observed twice in one session: it reported no browser window in a desktop screenshot that contained one, and reported "no data" from a screenshot that plainly showed skeleton loaders mid-load. Both were interpretation failures, not execution failures.

So do not route judgement through the model. Put it in the script:

- **Readiness is a coded poll, never a fixed wait and never a visual call.** Poll until real rows exist — and make the check exclude skeleton/placeholder rows, which is exactly the trap that produced a false BLOCKED. Give it a generous timeout; this app's list endpoints hit Google Sheets through GViz at ~2s steady state, and a cold `vercel dev` is far slower on its first call because it compiles the function on demand.
- **PASS/FAIL comes from assertions in the script**, e.g. `dialog.open === false && location.hash === HASH`. The model's job is to report what the script printed, not to decide what happened.
- **Require raw values in the report** — `dialog.open`, both hash strings, both `history.length` numbers — and read those yourself. A verdict line without its numbers is not evidence.
- **Screenshots and video are for the human**, not for the model to summarise. Open them yourself before relaying any conclusion drawn from an image.
- A BLOCKED report must state how long it waited and what response it saw. Without that, treat it as unproven rather than as a real blocker, and check the screenshot before believing it.

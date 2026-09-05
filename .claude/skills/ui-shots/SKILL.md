---
name: ui-shots
description: Capture how a page actually looks — drive Chrome with Playwright and bring back screenshots at real viewports for a human to judge. Use for comparing design variants, reviewing a new page, or checking small-screen layout.
allowed-tools: Bash, Write, Read
---

# UI Shots

Claude cannot see a page. This skill sends a worker to photograph it and brings the images back.

Distinct from `frontend-test`, which **proves behaviour** with assertions. This one **produces
pictures for a person to judge** — it asserts nothing about how the page looks and must never claim
a design is good, correct, or better. Judging is the human's job; the worker's job is faithful
images. When both are needed, run both.

## Dispatch

Write the brief to a file (not a shell heredoc — brief text breaks shell quoting), then:

```bash
codex exec -s workspace-write -c sandbox_workspace_write.network_access=true -m gpt-5.6-luna -c model_reasoning_effort="medium" - < <brieffile>
```

Add `--skip-git-repo-check` when the working directory is not a git repo, e.g. a scratchpad of
standalone mockups. Codex refuses to start otherwise.

`network_access=true` is required; without it the Playwright install fails with a misleading error.

## Environment facts to put in every brief

- Everything this skill writes goes under **one gitignored folder at the repo root, `./.playwright/`** —
  inside the repo so the user can open it in the editor, never committed. Do not create any other
  top-level folder, and do not use the scratchpad.
  - `./.playwright/cache/` — the Playwright install, **persistent and reused**. Skip the install when
    `./.playwright/cache/node_modules/playwright` already exists; otherwise
    `npm install playwright --prefix ./.playwright/cache`. Point `NODE_PATH` and
    `PLAYWRIGHT_BROWSERS_PATH` there. `--prefix` writes only inside that folder — the repo's own
    `package.json` / `package-lock.json` must be byte-identical afterwards.
    (Stale after a Chrome upgrade → delete `./.playwright/cache/` once and let it reinstall.)
  - `./.playwright/shots/<yyyy-mm-dd>-<target>/` — the screenshots.
- `channel: 'chrome'` uses the installed Chrome. Forbid a silent fallback to bundled Chromium — if
  it fails, report the error and stop.
- Headed opens a **separate window**, not a tab in the user's Chrome. Say so, or the user thinks
  nothing ran.
- Serving a live page needs the API: `vercel dev`, not plain `vite`. A `vite`-only server returns
  HTML for every `/api/*` call and the page renders empty. Check which port is actually free —
  `vercel dev` silently moves to the next port when the requested one is busy, and then every
  request to the port you asked for hits nothing.
- `vercel dev` takes its environment from the linked Vercel project, **not** from `.env.local`. A
  variable that exists only locally must be exported into the shell before starting the server.
- Never pass `--yes` to `vercel dev` in an unlinked directory: it creates a brand new Vercel project
  with no environment variables and links to it, and every endpoint then returns 500.

## Rules the brief must state

- **Do not modify the page being photographed.** If it looks broken, photograph the breakage and
  report it. Fixing it destroys the evidence and mixes an unreviewed change into someone's diff.
- **Never revert, restore, stash, or check out the working tree** to make `git status` clean. Someone
  else may be editing this repo while you run; a blanket restore destroys their work. Leave files you
  did not create exactly as you found them and report what `git status` shows.
- Wait for animations to settle before shooting. A page mid-transition photographs faded or
  half-positioned, and that is not what the design looks like.
- Shoot each target at **390×844** and at **1280×800** unless told otherwise, and name files so the
  variant and viewport are readable from the filename alone.
- **`fullPage: true` is not enough.** When the content sits in an inner scroll container — a dialog,
  a sheet, a panel with its own scrollbar — `fullPage` captures only what fits the viewport and the
  rest is silently missing. Detect it (`scrollHeight > clientHeight` on the scrolling element) and
  shoot the container in overlapping scroll steps to the bottom, named `-part1`, `-part2`, …
  Report the number of parts per target so a missing half is visible in the report.
- Capture every state that was asked for — list them explicitly in the brief. An unlisted state
  will not be shot.
- **Wait for content, do not wait for time.** Poll until real rows exist. Skeleton placeholders are
  not content, and a screenshot of a loading state reported as the page is a false result.
- Report `BLOCKED` with what was seen, how long it waited, and the response observed. Never
  substitute a different page and never describe a page that was not loaded.
- Never trigger native `alert`/`confirm`/`prompt`; they freeze the automation.

## Bringing the images back

Claude must open the screenshots with `Read` before saying anything about them. A worker's
description of an image is not evidence — twice in one session a worker misread its own captures,
once reporting no browser window in a shot that contained one, once reporting "no data" from a shot
of a loading skeleton. Relay to the user by sending the files, not by describing them.

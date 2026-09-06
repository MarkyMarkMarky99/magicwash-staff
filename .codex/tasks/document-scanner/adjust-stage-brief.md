# Document scanner, adjust stage: show the crop edges in the magnifier, drop the filter picker

Branch `feat/ml-corner-detect` (already checked out). Repo: `C:\MagicwashGemini\webapp-vue`.

## Do not delegate

Do NOT spawn subagents or launch another agent. `CLAUDE.md` in this repo tells Claude to
delegate; that rule is for the orchestrator, not for you. You are the hands. Read the files
you need and do the work yourself, end to end.

## Context

The scanner works and is confirmed on a real phone. Flow: เพิ่มรูป → เอกสาร → the viewfinder
detects the page and fires → the **adjust stage** ("ปรับมุมเอกสาร") shows the captured frame
with four draggable corner handles → ใช้รูปนี้ warps and uploads.

Two problems with the adjust stage, reported by the user from the device. Both are in that
stage only. Nothing about detection, capture, or upload changes.

## 1. The magnifier shows no crop edges

Touching a corner handle opens a magnified view of the area under the finger, so the user can
place the corner precisely. **The magnifier currently shows only the zoomed photo** — no crop
outline. The user cannot tell whether the corner is on the paper edge or beside it, which is
the entire reason the magnifier exists.

Draw the crop geometry inside the magnifier, in the magnifier's own zoomed coordinate space:

- The **two quad edges that meet at the corner being dragged**, extending to the edge of the
  magnifier view.
- A **crosshair or centre marker at the exact corner position**, so the user can see the point
  the handle actually resolves to rather than guessing from under their fingertip.

Match the existing outline's colour and stroke weight so it reads as the same object. Scale
the stroke by the magnifier's zoom factor if it would otherwise render hairline-thin or
chunky — it must look deliberate, not like a stray line.

**The trap:** the magnifier samples from the captured image in image pixels, while the quad
may be held in display/CSS space (or vice versa). Converting between them is exactly the kind
of mistake that produces a plausible-looking line sitting a few pixels off the true edge, with
no error anywhere. Find which space each one is in before you draw, and say in your report
which spaces you found and how you converted. Do not guess and eyeball it — you cannot see the
result, only the user can.

## 2. Delete the filter picker entirely

Below the image sit three chips — **ต้นฉบับ / เอกสาร / ขาวดำ** — and a small thumbnail preview.
The user's decision: **remove all of it.** The thumbnail is too small to judge anything by, and
choosing a filter is not work staff should be doing at all.

- Remove the three filter chips and the thumbnail preview strip.
- **Keep applying the `เอกสาร` (document) enhancement, hard-coded** — it is today's default, so
  the output image does not change for anyone. Do not delete `document-enhance.ts` or the
  enhancement call; only the *choice* goes away.
- Keep **ถ่ายใหม่** and **ใช้รูปนี้** exactly as they are.
- Remove any state, props, imports or handlers that become genuinely unused once the picker is
  gone. Do not leave dead code behind, and do not leave a disabled/hidden picker in the markup.
- If removing the picker leaves the layout with an obvious gap, close the gap. Do not redesign
  the stage, do not restyle the remaining buttons, do not "improve" spacing elsewhere.

## Explicit constraints

- **Do not touch detection.** `use-document-detect.ts`, `use-hold-still-capture.ts` and
  `public/scanic-ml/` are off limits. The ML detector was just verified working on a real
  device; nothing in this task needs it.
- **Do not reintroduce `ImageCapture.takePhoto()`** anywhere, and `capturePhoto()` stays
  synchronous. It never settles on the user's Android — that cost four failed attempts on an
  earlier branch. Video-frame drawing only.
- **Do not create or modify anything in `src/shared/`** — not a component, not a prop. Shared
  components here are import-only, changed only in a dedicated refactor pass, because there is
  no frontend type-check and a broken contract ships green. If you need something that is not
  there, build it locally in the orders feature and report it under SHARED GAPS.
- **Do not add or change routes, and do not add history manipulation.** No `history.pushState`,
  `history.back()`, or `popstate` listeners in an overlay — an entry made with raw pushState is
  invisible to vue-router and makes Back skip pages. There are no nested/`children` routes in
  this project; do not introduce any.
- **Never write to `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`** — the schema registry,
  shared with a separate Python project, and the source of truth. Nothing here goes near it.
- Do not install any dependency. Do not start a dev server; check what is already listening
  first if you think you need one.
- Do not touch `main`, do not push, do not merge.

## A note on the file you are about to open

`DocumentScannerOverlay.vue` is ~980 lines and is scheduled for a refactor later. **Do not
refactor it now.** Make these two changes in the style already there. Splitting the component
in the same pass would make it impossible to tell a UX regression from a refactor regression
when the user tests on the phone.

## Verification

There is **no frontend type-check** — `npm run build` is esbuild only and will not catch a type
error or a broken prop. It is still the only gate:

```bash
npm run build
```

Then the scanner's dry-tests, which must still pass untouched:

```bash
npx tsx --tsconfig jsconfig.json tests/web/unit/features/orders/composables/use-document-detect.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/features/orders/composables/use-corner-editor.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/features/orders/composables/use-hold-still-capture.dry-test.ts
```

Do not edit those tests. If one fails, you broke something — fix the code, not the test.

You cannot check this in a browser: Chrome will not launch from an agent session on this
machine (`0xC0000003`), real Chrome and Playwright's chromium alike. Do not spend time trying.
The user verifies on a real phone.

## Commit

Commit to `feat/ml-corner-detect`. End the commit message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VPdgk1J4DszDqHLqJwjGqD
```

## Report back

Terse, no process narration.

1. Files changed, one line each.
2. `npm run build` and each dry-test result, verbatim.
3. **The coordinate spaces** — what space the magnifier samples in, what space the quad is
   held in, and the conversion you wrote. This is the part most likely to be silently wrong.
4. What you deleted with the filter picker, and confirmation that the `เอกสาร` enhancement is
   still applied to the output.
5. **SHARED GAPS** — anything you needed from `src/shared/` that did not fit and what you built
   locally instead.
6. Anything you found that contradicts this brief.

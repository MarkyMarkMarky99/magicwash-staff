# Replace the classical corner detector with scanic's ML detector

Branch `feat/ml-corner-detect` (already created, based on `feat/document-scanner-v2`).
Repo: `C:\MagicwashGemini\webapp-vue`.

## Do not delegate

Do NOT spawn subagents or launch another agent. `CLAUDE.md` in this repo tells Claude to
delegate; that rule is for the orchestrator, not for you. You are the hands. Do the work
yourself, end to end.

## What was measured, and why this is already decided

A throwaway probe (branch `spike/ml-corner-detect`, route `#/dev/ml-probe`) ran scanic's
classical and ML detectors on the same camera frames on a real Android phone and a real
iPhone. Results:

- **ORT loads and runs on both devices.** Cold load 1.5–4.4s. The feared
  onnxruntime-web ABI mismatch (bundled JS 1.27.0 vs scanic-ml's 1.23.2 wasm) is not real.
- **ML inference: ~99–162ms on iPhone, ~430–550ms on Android.** Classical: ~89–210ms.
- **Classical is wrong in exactly the cases that matter.** On a white form lying on white
  paper, and whenever the document touched or crossed the frame edge, classical returned a
  grossly wrong quadrilateral that ran off-screen — while still reporting success. On a flat
  well-lit form it locked onto the *printed border box* rather than the paper edge, cutting
  inside the page.
- ML also produces the occasional bad outlier (a rotated document once yielded a splayed
  quad), but the shipping detector already has an EMA + jump-reject + miss-tolerance filter
  that the probe did not, and that filter exists to suppress exactly this.
- **`minScore` is not a useful lever.** Every ML miss recorded was
  "no coordinates from the model", never a score rejection. Do not tune it.

**Decision, already made by the user: delete the classical path. ML only.** Do not build a
hybrid, do not add a classical fallback, do not add a toggle between the two. This is safe
because `use-corner-editor.ts` already supplies a fallback quad (10% inset) when detection
finds nothing, and the shutter is not gated on a quad — so total detector failure still
leaves staff able to capture and drag the corners by hand. Do not remove that safety net.

## The work

### 1. `src/features/orders/composables/use-document-detect.ts` — ML only

- Replace `DETECTION_OPTIONS` with the ML options. `detector: 'ml'`, `mode: 'detect'`.
- **Delete the classical geometry gates** — `minDocumentCoverageRatio`,
  `minDocumentSideRatio`, `minDocumentFillRatio`, `minRightAngleScore`,
  `minOppositeSideConsistency`, `maxDocumentAspectRatio`. Those exist to suppress classical's
  false positives against a scanic pipeline that always returns something. The ML detector
  carries its own presence score and returns nothing when it is not confident, so these gates
  now only throw away good detections. They are classical-specific and go away with it.
- **Keep, unchanged in behaviour:** `isUsableDocumentQuad`'s frame-edge margin
  (`FRAME_EDGE_MARGIN_RATIO`) and max coverage (`MAX_QUAD_COVERAGE_RATIO`) sanity checks, the
  EMA smoothing (`SMOOTHING_FACTOR`), the jump rejection (`JUMP_REJECT_RATIO`, accepted on the
  second consecutive jump), and the miss tolerance (`MISS_TOLERANCE`). These are what will
  absorb ML's outliers; they are the reason cutting classical is acceptable. Do not retune
  them, do not remove them.
- The 5% inset retry (`DETECT_RETRY_INSET_RATIO`) was a classical-era workaround for
  contour finding failing on frame-hugging documents. Remove it — ML does not have that
  failure mode and it doubles inference cost. Say in your report that you removed it.
- Keep the 100ms self-scheduling loop as-is. It already paces itself with
  `max(0, 100 - elapsed)`, so a 500ms Android inference simply yields ~2Hz instead of
  stacking calls. Do not add a worker, do not change the interval.

### 2. Feed the model a letterboxed frame, not a stretched one

Today the frame is drawn to the work canvas at long-side 1000 and handed to scanic, which
internally stretches whatever it receives to 224x224 with **no letterbox**. From a portrait
2160x3840 phone camera that is a 1.78x anisotropic squash: a document lying square still
looks like a rectangle, but a **rotated** document becomes a skewed parallelogram — a shape
the model was not trained on. That is the most likely cause of the rotated-document outlier.

Draw the video frame into a **224x224 canvas yourself, preserving aspect ratio**: scale by
`224 / max(videoWidth, videoHeight)`, centre the result, leave the remaining bars black. Hand
that canvas to `scan()`.

**Corner mapping matters and is easy to get wrong.** scanic denormalizes the model's output
by the width and height of whatever canvas you passed
(`x = normalized_x * canvasWidth`, `y = normalized_y * canvasHeight`) — verified directly in
`node_modules/scanic/dist/scanic-mlDetector.js`. With a 224x224 letterbox canvas, corners
come back in 224-space **including the black bars**, so mapping back to video pixels is
`(coord - offset) / scale` per axis, using the same offset and scale you drew with. Get this
wrong and the outline is silently misaligned with no error anywhere.

`fitScale`, `scaleQuad` and `orderQuad` in
`src/features/orders/utils/quad-projection.ts` already exist — use them where they fit.
`scaleQuad` applies a single uniform factor, which is correct here *after* you subtract the
letterbox offset. Do not reimplement `orderQuad`.

### 3. Self-host the model — do not add COOP/COEP

Today scanic fetches ~3.4MB from jsDelivr on first use. Shop wifi is unreliable and the app
must work when the CDN does not.

Download these three files into `public/scanic-ml/`:

```
https://cdn.jsdelivr.net/npm/scanic-ml@0.2.0/dist/doccornernet_lean.ort
https://cdn.jsdelivr.net/npm/scanic-ml@0.2.0/dist/ort-wasm-simd-threaded.wasm
https://cdn.jsdelivr.net/npm/scanic-ml@0.2.0/dist/ort-wasm-simd-threaded.mjs
```

Then pass `ml: { assetBaseUrl: '/scanic-ml/' }` in the scan options — per
`node_modules/scanic/src/scanic.d.ts:133-138` that base URL covers both the `.ort` model and
the ORT wasm. Verify after the build that the files are actually served from `dist/`.

Add long-lived immutable caching for that directory in `vercel.json`
(`Cache-Control: public, max-age=31536000, immutable`). The filenames are version-pinned, so
this is safe.

**Do NOT add `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers.** Those
would unlock multi-threaded ORT (roughly 2x on Android) but `COEP: require-corp` blocks every
cross-origin resource that does not opt in, which can silently break images, fonts and API
calls across the whole app. That is a separate, deliberate change with its own testing pass.
Not in this task.

### 4. Tests

`tests/web/unit/features/orders/composables/use-document-detect.dry-test.ts` exists and
covers the jump-reject, miss-tolerance and frame-hug behaviour. **Those behaviours must
survive this change and that test must still pass.** You may update the test only where it
asserts something specific to the classical options you deleted; if you change an assertion,
say exactly which and why in your report. Do not delete tests to make the suite green — a
deleted test is a silently lost guarantee, and that has happened on this project before.

Run:

```bash
npx tsx --tsconfig jsconfig.json tests/web/unit/features/orders/composables/use-document-detect.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/features/orders/composables/use-hold-still-capture.dry-test.ts
npx tsx --tsconfig jsconfig.json tests/web/unit/features/orders/composables/use-corner-editor.dry-test.ts
```

## Explicit constraints

- **Do not modify `DocumentScannerOverlay.vue`.** The scanner on this branch is
  staff-confirmed working on a real device. All of this work belongs in the composable behind
  the same interface. If you believe the overlay must change, stop and report why instead.
- **Do not modify `use-hold-still-capture.ts`.** Its 1200ms / 1% tolerance may well need
  retuning once ML runs at ~2Hz on Android, but that is a judgement call to make against a
  real device, not blind. Report it as a follow-up.
- **Do not create or modify anything in `src/shared/`** — shared components and composables
  are import-only here, changed only in a dedicated refactor pass, because there is no
  frontend type-check and a broken contract ships green.
- **Do not reintroduce `ImageCapture.takePhoto()`.** It never settles on the user's Android;
  that cost four failed attempts on an earlier branch. Video-frame drawing only, and
  `capturePhoto()` stays synchronous.
- **Never write to `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`** — the schema
  registry, shared with a separate Python project, and the source of truth. Nothing here goes
  near it; if something seems to require it, stop and report.
- Do not install any new npm dependency. scanic already ships everything needed.
- Do not start a dev server; check what is already listening first if you think you need one.
- Do not touch `main`, do not push, do not merge.

## Verification before you report

There is **no frontend type-check** in this project — `npm run build` is esbuild only and
will not catch a type error or a broken prop. It is still the only gate:

```bash
npm run build
```

It must pass, and the three dry-tests above must pass. State each result verbatim.

You cannot verify this in a browser: Chrome will not launch from an agent session on this
machine (`0xC0000003`), real Chrome and Playwright's chromium alike. Do not spend time
trying. The user tests on a real phone.

## Commit

Commit to `feat/ml-corner-detect`. End the commit message with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VPdgk1J4DszDqHLqJwjGqD
```

## Report back

Terse, no process narration.

1. Files added / changed / deleted, one line each.
2. `npm run build` result and each dry-test result, verbatim.
3. The exact corner-mapping math you ended up with, in three or four lines — this is the part
   most likely to be silently wrong and the user cannot see it in a diff review.
4. Any assertion you changed in a dry-test, and why.
5. Anything you found in scanic's ML path that contradicts this brief. Report it; do not
   paper over it.
6. **FOLLOW-UPS** — anything you deliberately left undone, especially hold-still tuning.

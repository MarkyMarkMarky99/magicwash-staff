# Document scanner v2 — build it from zero

You are implementing a complete feature. This document is the specification. Follow it
exactly. **Do not spawn subagents. Do not delegate. Do all the work yourself.**

Ignore the delegation rules in the repo's `CLAUDE.md` — they are written for a different
tool and tell the reader to hand work off. Every other rule in `CLAUDE.md` applies.

If a step here cannot work, **STOP and report which step and why**. Do not improvise
around it. A previous build of this feature failed four times because each round invented
a mechanism instead of reporting a blocker.

---

## What this is

Staff photograph laundry documents (service forms, receipts) with a phone. Today
`เพิ่มรูป → เอกสาร` on the order detail page opens the shared camera and uploads a flat
photo: no crop, no deskew, capped at 1280px which is roughly 130 dpi across an A4 page,
so small print is unreadable.

This feature replaces that with a scanner: outline the page in the viewfinder, shoot,
let the user drag the corners, warp the quadrilateral flat, clean up the lighting, and
upload that instead.

**Only the DOCUMENT type changes.** WEIGHT and BELONGING keep the existing shared camera.

## The user flow, end to end

1. `เพิ่มรูป → เอกสาร` opens the scanner (this already works — `?orderAction=photo-document`).
2. Live viewfinder with a green outline tracking the document.
3. Shutter — tapped, or fired automatically once the phone is held still.
4. The captured still appears with four draggable corners, a magnifier under the finger,
   and three filter chips.
5. `ถ่ายใหม่` discards and returns to the viewfinder. `ใช้รูปนี้` warps, filters, encodes,
   uploads, and returns to the viewfinder for the next document.

---

## Start from the proven parts of v1

A previous branch `feat/document-scanner` (tip `a1836e1`, still in this repo) built this
and failed on the orchestration, not the arithmetic. **Its pure modules were correct,
tested, and are yours to reuse — copy them onto this branch rather than rewriting.**

Retrieve them with `git show feat/document-scanner:<path> > <path>`:

| Copy verbatim | What it is |
|---|---|
| `src/features/orders/utils/quad-projection.ts` | coordinate math: `fitScale`, `scaleQuad`, `contentBox`, `projectQuad`, `orderQuad` |
| `src/features/orders/utils/document-enhance.ts` | illumination divide, contrast stretch, integral-image adaptive threshold |
| `src/features/orders/composables/use-document-detect.ts` | scanic loop, geometry constraints, EMA smoothing, jump rejection, miss hysteresis |
| `src/features/orders/composables/use-hold-still-capture.ts` | stillness scoring and fire-once/re-arm |
| `src/features/orders/composables/use-corner-editor.ts` | corner hit-testing, clamping, drag geometry |
| `src/features/orders/composables/use-document-scanner-debug.ts` | localStorage-persisted debug toggle |
| every `tests/web/unit/features/orders/**` file covering the above | 37 passing cases |
| the `scanic` dependency in `package.json` / `package-lock.json` | pinned `1.6.0` |

Read each one after copying and make sure it still makes sense in the design below;
adjust where this spec differs, and say what you changed.

**Do NOT copy** `DocumentScannerOverlay.vue`, and do NOT copy any `scanStage` routing from
`use-order-overlay-route.ts`. Those are the parts that failed. You write the component
fresh against the state machine below, and `use-order-overlay-route.ts` on this branch
stays exactly as `main` has it — **you may not modify that file at all.**

---

## Architecture

One new component, `src/features/orders/components/DocumentScannerOverlay.vue`, plus the
copied composables. It takes `open: Boolean` and emits `close` and `capture(file)` — the
same contract as `src/shared/components/CameraOverlay.vue`, so `OrderDetailPage.vue` can
swap between them.

In `OrderDetailPage.vue`: render `DocumentScannerOverlay` when the capture type is
`DOCUMENT`, keep `CameraOverlay` for WEIGHT and BELONGING. Only one may be open — the
other must receive `:open="false"` so its camera stream is actually stopped, not merely
hidden. Derive both flags from the existing `isCameraOpen` computed plus the capture
type. **Do not introduce a local `ref` mirroring route state** — this page is
`KeepAlive`-cached and a stale mirror makes reopening the same overlay a silent permanent
no-op.

Nothing else in the app changes. The upload path (`order-image.store.ts` →
`order-image-storage.service.ts` → `POST /api/order-images`) is untouched: the component's
job ends when it emits a `File`. No backend change is needed — `image_type` is a free
string in the sheet and `'DOCUMENT'` is already valid in the API create enum.

---

## The state machine — implement exactly this

One `scannerStage` ref. Not several booleans that can disagree.

States: `viewfinder`, `capturing`, `adjusting`, `warping`.

| From | Trigger | To | Must do |
|---|---|---|---|
| `viewfinder` | shutter tap or auto-fire | `capturing` | disable the shutter; **keep the stream running** |
| `capturing` | still retained successfully | `adjusting` | stop the detection loop, stop the camera |
| `capturing` | **any** failure or timeout | `viewfinder` | stream still live, shutter re-enabled, hold-still progress reset, failure reason visible on screen |
| `adjusting` | `ถ่ายใหม่` | `viewfinder` | release the still, restart camera and detection |
| `adjusting` | `ใช้รูปนี้` | `warping` | disable the buttons |
| `warping` | success | `viewfinder` | emit `capture(file)`, release the still, restart camera and detection |
| `warping` | **any** failure | `adjusting` | **keep the still and the corners**, show the reason — losing a document to a warp error is the worst outcome available |
| any | user taps close | closed | full teardown, then `emit('close')` |

**The stage is component-local state. It is NOT a route query value.** v1 put the adjust
stage on the route so Android Back would mean "retake"; that produced two composable
instances each holding their own navigation bookkeeping, and several unrecoverable dead
states. Back now closes the whole scanner, which is the ordinary behaviour for this
overlay, and `ถ่ายใหม่` is the retake affordance.

Consequently: **this component must never navigate.** It must not call `router.push`,
`router.replace`, `router.back()`, `history.pushState`, `history.back()`,
`history.forward()`, and must not listen for `popstate`. The page owns the route; the
component owns its stage. (A raw history entry is invisible to vue-router: it copies the
router's `position`, so popping it makes the router compute a zero delta, treat the pop as
a duplicate navigation, and run its `go(-1)` recovery — throwing the user a page back
instead of closing the overlay.)

### Rules that come out of v1's failures

- **No unbounded `await` on any path the user is waiting on.** Every await between the
  shutter and `adjusting` needs a timeout, and a timeout must land on the `capturing`
  failure edge. v1 shipped an `await` that never settled; the shutter appeared dead and
  no error ever surfaced.
- **A failure never closes the overlay.** Leaving is something the user does. Every
  failure edge ends with the user in the scanner, looking at a message naming the stage
  and the error.
- **One `teardownScanner()`** — cancel timers and run tokens, stop the detection loop,
  release the still, stop and drop every media track, reset the stage, clear errors.
  Called from: the close button, `props.open` going false, and unmount. Write it once;
  do not repeat pieces of it per branch.
- **One invariant effect restores the camera**: when `open` is true, the stage is
  `viewfinder`, no stream is live and none is starting, start the camera. Nothing else
  calls `startCamera()` directly, so every path back to the viewfinder recovers,
  including ones not foreseen. Guard it so a failing `getUserMedia` cannot loop — after a
  failed start it must wait for the retry button rather than retrying by itself.
- **When you rename or remove any piece of state, update every reference in the same
  pass.** `npm run build` is esbuild with **no type-check**, so an undeclared identifier
  builds green and throws `ReferenceError` in the user's hands. This happened twice.

---

## Camera and capture

- Constraints: `{ video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 },
  height: { ideal: 2160 } }, audio: false }`. Keep `ideal`, never `exact` —
  `exact` throws `OverconstrainedError` on phones that cannot comply, and 1080p beats
  nothing. `<video>` needs `playsinline` and `muted` or iOS Safari refuses to play inline.
- **Capture by drawing the `<video>` frame onto a canvas. Never use `ImageCapture` /
  `takePhoto()`.** It was tried and it **hangs indefinitely on the user's Android** —
  neither resolving nor rejecting. Do not add it back for extra resolution; that benefit
  was never once observed working, and a capture that can hang is worse than a smaller
  image.
- Preview uses **`object-contain`**, not `object-cover`, on a dark background. `cover`
  crops the preview so what the user frames is not what gets saved, and the detection
  outline would not line up with the captured pixels. Letterbox bars are expected.
- Retain the still as an ordinary `<canvas>`, capped at `DOCUMENT_MAX_DIMENSION = 2400`
  on the long side; never upscale. Holding a 12 MP bitmap per shot crashes a phone tab
  after a handful of scans.
- Encode with `DOCUMENT_JPEG_QUALITY = 0.88`. Emit
  `new File([blob], 'document_' + Date.now() + '.jpg', { type: 'image/jpeg' })`.
- **Autofocus:** read `track.getCapabilities()` and apply only what it reports —
  `focusMode: 'continuous'`, and `exposureMode` / `whiteBalanceMode` continuous where
  available; tapping the preview requests `single-shot` then restores continuous. Degrade
  silently where a capability is missing; never assume support. A blurry frame also
  starves the edge detector.

## Coordinate spaces — the classic bug in this feature

Three spaces are in play. Confusing them is how the outline ends up drawn somewhere the
document is not.

- **work space** — the downscaled canvas the detector runs on (long side 1000)
- **video space** — `video.videoWidth × video.videoHeight`, the true frame pixels
- **CSS space** — the on-screen element box, where `object-contain` letterboxes the frame

`use-document-detect.ts` publishes **video space only**. Drawing converts video → CSS with
`contentBox` + `projectQuad`. The corner editor works in still-image space and converts
pointer coordinates in and out with the same helpers — do not write a second copy of that
math. Because the still is always drawn from the video frame, still space and video space
share an aspect ratio and differ only by a uniform scale.

Guard degenerate input: `video.videoWidth` really is `0` for the first frames after
`play()`, and a zero dimension must never produce `NaN` or `Infinity` coordinates.

## Detection and auto capture

- Run the detector at most 10×/second on a work canvas capped at 1000px. **Self-scheduling
  loop, never `setInterval`** — `setInterval` stacks calls when a frame runs long and the
  phone falls over. Reuse one work canvas and context; do not allocate per frame.
- Load `scanic` with a dynamic `import()` on first activation so its ~88 kB chunk stays
  out of the initial bundle for everyone who never scans a document.
- Keep v1's tuning: scanic's geometry constraints, plus rejecting any quad that reaches
  the frame edges or covers too much of it. **A frame-filling quad is never a document** —
  it is the desk or the viewport, it is perfectly stable so auto-capture fires on it, and
  the warp would then "deskew" the whole picture. Keep the inset retry.
- Keep the temporal filtering: EMA smoothing, single-jump rejection, and a miss tolerance
  before the outline clears. Without it the outline is too jumpy for a hand-held phone to
  ever satisfy the stillness check.
- Draw nothing when no quad is found. An outline that is always present teaches the user
  nothing about whether detection works.
- **Auto capture is built last**, after the manual path is complete and working. Hold-still
  fires the shutter once the quad is stable; the ring around the shutter fills forward with
  a `100ms linear` transition and **snaps to zero instantly** when the phone moves — that
  asymmetry is the feature, since a ring that eases back reads as an animation while one
  that snaps reads as "you moved". Re-arm so holding the phone over one invoice does not
  produce ten copies. An `อัตโนมัติ` / `กดเอง` toggle, defaulting to auto, component-local.
- **The manual shutter is enabled in every mode and is never gated on a detection.**
  Detection fails on white paper on a white table and the photo is still needed.

## Corner editor

- Four draggable corners over the still, ordered `[topLeft, topRight, bottomRight,
  bottomLeft]`. Do not re-run `orderQuad` mid-drag — dragging one corner past another
  would renumber the points and the shape would jump under the finger.
- Hit radius at least **44 CSS pixels** converted into image space, not 44 image pixels.
  On a 2400px still shown 400px wide, 44 image pixels is under 8 physical pixels.
- Pointer events with `setPointerCapture` and `touch-action: none`, so the browser does
  not scroll or pinch the page mid-drag.
- A magnifier while a corner is held: roughly a 110px circle at ~2×, drawn from the still,
  **offset from the finger** — a loupe under the fingertip hides the exact corner being
  placed — and flipped to the other side near a screen edge.
- If detection found nothing, start from an inset rectangle ~10% in from each edge.

## Warp and filters

- Use scanic's own `extractDocument` for the warp; confirm its signature in
  `node_modules/scanic/src/scanic.d.ts` before calling it. It inverse-maps with bilinear
  sampling, which is what keeps small text from going jagged.
- Output width = the longer of the top and bottom edges, height = the longer of the left
  and right edges, then scale down so the long side is at most 2400. Never upscale.
- Filter chips `ต้นฉบับ` / `เอกสาร` / `ขาวดำ`, defaulting to **`เอกสาร`**. Preview each on
  a downscaled copy (~800px) so switching is instant; run the full-resolution pass once,
  on confirm, with a busy state.
- `เอกสาร` = illumination divide + contrast stretch on luminance, chroma preserved.
  `ขาวดำ` = that, then the integral-image adaptive threshold. Both already exist in
  `document-enhance.ts`.

## Debug readout

Behind the persisted toggle from `use-document-scanner-debug.ts` (`?debug=1` turns it on
and it survives navigation and reload; `?debug=0` turns it off). It must show at least:
the stage, live stream resolution, last capture dimensions, whether a quad is found, last
detect time, scanic load state, hold progress and last movement ratio, and any error name.

This is the only instrument available on a phone with no devtools, so keep it legible over
a bright viewfinder and never let it cover the shutter. Failure messages are **not** gated
behind it — a user must always see why something failed.

---

## Constraints

- **Do NOT modify `src/shared/components/CameraOverlay.vue` — not one line, not even to
  add a prop.** WEIGHT photos, BELONGING photos and the `/gallery/:key` laundry album all
  use it, and with no frontend type-check a broken prop contract ships green and reaches
  users. Your component is a separate file that duplicates what it needs; that duplication
  is deliberate and approved. Report what you duplicated under **SHARED GAPS**.
- **Do NOT modify `src/features/orders/composables/use-order-overlay-route.ts`.**
- Do NOT touch `src/features/gallery/`, `src/api/`, `src/composables/`, `src/utils/`,
  `contracts/`, `api/`, `server/`. The gallery is a separate photo system writing through
  Apps Script; it looks similar and is not. `src/utils/imageCompression.js` has a 200 KB
  cap that would destroy small print.
- **Never write to `G:\My Drive\Magicwash\Database\GoogleSheets\*.json`** — shared schema
  registry, source of truth, read-only to you.
- No nested / `children` routes; there are none in this project.
- Do not commit and do not push. Leave the working tree dirty; a human reviews the diff.

## Verify your own work

```bash
npm run build
```

Run every dry-test under `tests/web/unit/features/orders/`:

```bash
npx tsx --tsconfig jsconfig.json tests/web/unit/features/orders/<path>.dry-test.ts
```

Copied tests must pass unmodified. If you changed a copied module's behaviour, update its
test and say exactly what and why. Add cases for anything new.

Remember the build does not type-check. Before you finish, grep the component for every
identifier you removed or renamed and prove no stale reference survives.

## Report

Terse, evidence first.

1. Files added / changed, one line each, and which v1 files you copied unmodified.
2. The `scannerStage` declaration and every place it is assigned.
3. The `capturing` failure edge, quoted — showing the stream survives.
4. The camera-restore invariant and its anti-loop guard, quoted.
5. Every `await` between the shutter and `adjusting`, and the timeout on each.
6. Every identifier removed or renamed, with the grep proving no survivors.
7. Verbatim build and dry-test output.
8. **SHARED GAPS** — what you duplicated from `CameraOverlay.vue`.
9. Anything you could not implement as specified — name the step, do not work around it.

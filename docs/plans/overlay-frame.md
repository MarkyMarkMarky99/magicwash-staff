# Plan — `BaseOverlayFrame`, one overlay mechanism

Status: **not started.** The first change is step 1 only — build the new frame beside the existing
overlays. Nothing existing is touched or deleted until step 2 passes.

`BaseDropdown` is out of scope throughout. It positions a panel against a trigger rather than
covering a surface, so it is a different mechanism and keeps its own teleport.

## Why

Three overlay files exist and none builds on the others:

| file | lines | consumers |
|---|---|---|
| `src/shared/layouts/BaseOverlay.vue` | 386 | 5 |
| `src/shared/layouts/BaseFullOverlay.vue` | 197 | 1 (`FormOverlay`) |
| `src/shared/layouts/BaseSlideOverlay.vue` | 267 | **0 — never imported, in any commit** |

`BaseOverlay` was added 2026-08-18 as `feat: add native dialog overlay shell` — intended as a base.
Five days later `a380ac0 feat: add reusable form overlays` added the other two as forks of it
rather than as consumers. They now duplicate teleport, `<dialog>`, focus handling, transitions and
the scroll lock.

The cost is already paid once: `9229d20` fixed the panel escaping the app column at desktop widths,
in `BaseOverlay` only. `BaseSlideOverlay` still carries that bug because a copy cannot receive a
fix. `BaseOverlay` also holds its own copy of the scroll lock (`:1-27`) with a second, independent
`lockCount`, while the other two import `use-page-scroll-lock.ts` — nested overlays across the two
families release the page scroll while one is still open.

## Decisions already made — do not reopen

1. **The app column is the viewport.** Nothing renders outside it; anything that does is a bug. The
   frame mounts to a teleport target *inside* `App.vue`'s column, as a sibling of `RouterView`
   (`absolute inset-0`, the column is already `relative`). Overlays then inherit the column width
   by construction, so no panel needs to carry `app-column` any more. The class itself stays —
   `App.vue:13` uses it to size the app column in the first place.
2. **No `<dialog>` / `showModal()`.** Its top layer escapes the column, which is the opposite of
   what this app wants. ESC, backdrop click, focus save/restore and the scroll lock are already
   hand-rolled in all three files; the only thing lost is the native focus trap, which this plan
   writes once as `use-focus-trap.ts`.
3. **Placement and size are props of one component, not separate components.** Splitting by
   direction splits along the wrong axis — the entry transform is the same code with a different
   axis and sign.
4. **Drag-to-close derives its axis from `placement`.** Never a separate prop; two props that can
   contradict each other is not an abstraction.
5. **The frame owns geometry and behaviour only.** How the panel arrives, how big it is, how it
   closes. Content shape — titles, headers, submit buttons — belongs to scaffolds. The first prop
   that describes content means the line has been crossed.

   **Scaffolds are named for the job they do for the user, never for their shape.** Shape is already
   the frame's `placement` and `size`; a scaffold named after it just repeats what the frame said,
   and locks the name to a look that may change. What gives a scaffold its identity is the content
   structure inside it.
6. **The frame contains no scroll region at all.** Its panel is `overflow-hidden` and nothing more.
   A scaffold decides where a scroll region sits and places `ScrollRegion` there; `ScrollRegion`
   owns the `overflow` rules. Three levels, three owners: frame = the panel arriving,
   scaffold = where things sit inside it, primitive = how scrolling behaves.

   This also removes a live trap. `BaseFullOverlay:169` already wraps its slot in a scroller, and
   `FormOverlay` puts its own scrolling body inside that — a scroller nested in a scroller, held
   harmless only by `.form-overlay { height: 100% }` matching exactly. Any change to the header
   height or a stray margin turns it into two live scrollbars.

## The rule this establishes

**No page or feature component may import `BaseOverlayFrame` directly.** It is reachable only
through a scaffold — `FormOverlay`, a picker scaffold, a sheet scaffold. A feature that needs a new
overlay shape adds a scaffold; it does not reach past one.

Enforce with a CI grep: any `import ... BaseOverlayFrame` outside `src/shared/layouts/` fails.

## Step 1 — build it

Two files.

**The mount point.** `App.vue` gains a teleport target inside its column, a sibling of `RouterView`
so route changes cannot destroy an open overlay mid-transition:
`<div id="overlay-root" class="absolute inset-0 z-[60] pointer-events-none" />`, with the panel and
backdrop re-enabling pointer events. The column is already `relative` and `overflow-hidden`, so the
target covers exactly the app column — header included — and nothing can paint outside it. This does
not exist today and nothing else in the plan works without it.

The stacking order is not free: `AppHeader:21` is `z-50` and `NavSidebar:39` is `z-50` over a `z-40`
scrim, so anything below `z-50` opens *underneath* the green header. `BaseDropdown:112` already sits
at `z-[60]`. Write the app's z-scale down somewhere when adding the root, rather than picking a
number per component as has happened so far.

**The frame.** New file `src/shared/layouts/BaseOverlayFrame.vue`. New name on purpose: it lives
beside the three existing overlays, which keep working untouched.

```
props
  open        boolean
  placement   'bottom' | 'top' | 'left' | 'right' | 'center'
  size        CSS length along the placement axis — '84vh', '50%', 'full'
              for placement 'center': a max-width; the panel is content-height
  backdrop    'opaque' | 'translucent' | 'none'
  draggable   boolean — drag to close, axis and sign from `placement`
  closeButton boolean
  panelClass  string — the single theming hook
  ariaLabel   string
  closeOnBackdrop boolean, default true
emits
  close
slots
  default, plus a close-button slot
```

Behaviour it owns: teleport into `#overlay-root` · backdrop · enter/leave transition per placement ·
ESC · backdrop click · focus save, initial focus, restore on close · focus trap ·
`use-page-scroll-lock` (the shared one, never a local copy) · `onDeactivated` self-close ·
`inert` on the app content behind it, so a screen reader does not read through the overlay. A focus
trap alone does not do that, and `<dialog>` was providing it for free.

**The backdrop becomes a real element.** Without `<dialog>` there is no `::backdrop` pseudo-element.
The frame renders its own backdrop div and animates it. `FormOverlay` currently styles
`:global(.form-overlay-dialog::backdrop)` with a gradient — that selector has no target after the
migration and must be re-expressed against the frame's backdrop element.

**Placement coverage.** Write the transform maths for all four edges plus `center` — it is the same
expression. Finish and verify only `bottom` and `center`, the two with real consumers. Left/right/top
stay unverified until a page needs one: rounded corners, drag handle position and iOS safe area
differ per edge and must not be guessed.

**No snap points.** `size` is a fixed opening length. Drag-to-close is a single threshold, not a
multi-stop drag between heights. Snap points are a separate feature with their own state machine and
velocity handling — out of scope, and not to be added quietly.

## Step 2 — prove it

A throwaway page under `src/app/dev/` (`FormOverlayPreviewPage.vue` already sets the precedent)
that opens the frame in each supported configuration. Verify in a real browser on a phone, not by
build output — this class of bug is invisible to `typecheck` and dry tests:

- opens and closes; ESC, backdrop click, close button, Android Back
- panel width equals the app column at ≥640px, measured, not eyeballed
- drag-to-close on `bottom`, and that a drag that does not pass the threshold springs back
- a bottom panel with an autofocused search field: keyboard and slide-in animation together, on a
  real Android device (`CustomerPicker` autofocuses today)
- **iOS Safari with the keyboard open.** `vh` units resolve against the layout viewport, which the
  keyboard does not shrink, so a `90vh` panel keeps its height and its lower part — including a
  bottom-anchored submit button — is pushed under the keyboard. Decide the response when building
  the frame rather than after: size against `dvh`, or subtract `visualViewport.height` while a field
  inside the panel has focus. Either way it belongs in the frame, not in each scaffold.
- page behind does not scroll while open, and scrolls again after close
- two frames open at once: closing the inner one leaves the page still locked
- Tab cycles inside the panel only
- a panel with an over-wide child does not pan sideways

## Scaffolds

Every overlay in the app reaches the frame through one of these.

**Each scaffold owns the surface's one vertical scroll region, and consumers never place another
vertical one.** The scaffold is what knows which parts stay still and which part scrolls — a
picker's search box must not scroll away with its list. A consumer that puts a second *vertical*
region inside a scaffold's body creates a scroller nested in a scroller, which is the live defect in
`FormOverlay` + `BaseFullOverlay` today.

Horizontal strips are content, not a second surface, and are exempt: `InvoicePriceListPicker:141`
and `OrderPriceListPicker:122` both carry a sideways category strip above their vertical list, and
that is correct. The rule is one vertical region per surface, not one region.

**`FormOverlay`** — exists. `placement: bottom`, `size: full`. Green header + logo / scrolling body /
submit button pinned at the bottom. Migrating it means dropping the three class hooks it passes to
`BaseFullOverlay` in favour of `panelClass`, and deleting its own scroller in favour of
`ScrollRegion`. Consumers: the 8 form pages.

**`PickerOverlay`** — new, and the largest duplication in the app. Title + close button · an
optional search box that stays fixed while the list scrolls · the list · loading / error-with-retry
/ empty states · selecting closes it. Consumers today, each hand-rolling all of the above:
`CustomerPicker`, `InvoicePriceListPicker`, `OrderPriceListPicker`, and the reassign-destination
sheet at `OrderGalleryPage:446` — which uses no overlay component at all, writing its own
`fixed inset-0`, backdrop and `Transition`. Migrating it also clears one of the 15 unpinned scroll
regions.

`placement: bottom` for all four, `draggable`, ~90vh. The three component pickers are full-screen
today and change shape; that is deliberate — a bottom sheet is the common pattern for choosing from
a list, keeps close and drag within thumb reach, and leaves the context visible behind, which the
reassign picker needs so the photo being moved stays on screen. The height is 90vh rather than 75vh
so the on-screen keyboard does not crush the list. Expanding on search focus is snap-point
behaviour and stays out of scope.

**`DetailOverlay`** — new. Read something without leaving the page. `placement: bottom`,
`size: 84vh`, `draggable`. Consumer: `OrderDetailSheet`, the app's first real use of drag-to-close.

**`ConfirmOverlay`** — new. Answer one question before continuing: title, a short line, one or two
fields, cancel/confirm. `placement: center`, content-height. Consumer: `OrderImageWeightPrompt`,
which is full-bleed today and is being redesigned into this shape. Also the shape for
confirm-before-delete, which the app has nowhere yet.

## Step 3 — migrate, then delete

Only after step 2 passes. By scaffold, each with its own device check.

1. **Check for overlays opened from inside another overlay before choosing an order.** An overlay
   that a still-native `<dialog>` hosts would be painted over and marked inert once it becomes a
   plain div in `#overlay-root`, so a host must never be migrated after its guest.

   The one case that existed — `CustomerPackageCreatePage` opening `CustomerPicker` inside
   `FormOverlay` — is gone as of `dc02957`: both its fields are `FormPicker` now, which drops down
   inside the form instead of opening an overlay. Re-check with a grep before starting; if nothing
   nests, the order below is free.
2. `PickerOverlay` — build it, move its four consumers.
3. `DetailOverlay` — build it, move `OrderDetailSheet`.
4. `ConfirmOverlay` — build it, redesign `OrderImageWeightPrompt` onto it.
5. Delete `BaseOverlay.vue`, `BaseFullOverlay.vue`, `BaseSlideOverlay.vue`. Keep `.app-column` —
   `App.vue:13` still needs it; only the panels stop carrying it.
6. Rewrite the two e2e specs that assert on the native element: `tests/e2e/base-overlay.spec.ts` and
   `tests/e2e/app-column-width.spec.ts` both locate `dialog[open]` and its UA scroll behaviour.
   Neither survives the migration; both encode real regressions and must be re-expressed against the
   frame's panel, not deleted.
7. Add the CI grep from **The rule this establishes**.

## Dependencies

- `use-focus-trap.ts` — new, written as part of step 1.
- `use-page-scroll-lock.ts` — exists, used as is.

Step 1 has **no dependency on `ScrollRegion`** (`docs/plans/scroll-region.md`): the frame does not
scroll. Scaffolds need it at step 3 — if it is not ready by then, each scaffold pins both axes
inline with a `TODO` naming that document. A scaffold, never the frame, is where that placeholder
may sit.

## Open questions

1. Whether `size` should later accept snap points. "No" for this plan. Revisit only when a screen
   actually needs a two-stop sheet.

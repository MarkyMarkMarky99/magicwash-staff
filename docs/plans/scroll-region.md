# Plan — `ScrollRegion`, one scrolling box

Status: **not started.**

## Why

Every scrolling box in the app is hand-written, and each needs the same four rules to be correct.
Miss one and the failure is invisible to `typecheck`, to the build and to dry tests — it shows up
only under a finger on a real phone.

The rule that keeps going missing: **CSS resolves an unset axis to `auto` when the other axis
scrolls.** So `overflow-y-auto` alone silently makes a box a horizontal scroller too, and one
over-wide child then lets the whole region be dragged sideways, taking absolutely-positioned
dropdowns with it. That has cost three round trips on iOS Safari already — the form panel, the form
body, then `FormPicker`'s list.

Fixing it per site does not hold. Fixing it in one component does.

## Inventory — 29 regions

| group | count | state |
|---|---|---|
| vertical, shared layer | 4 | pinned correctly, but the same class string is copied 4× |
| vertical, feature layer | 15 | **not pinned** — the open bug |
| horizontal strips | 7 | tab strips, the date strip, thumbnail rows — `overflow-x-auto`, no vertical axis |
| declared in raw CSS, not a class | 3 | `FormOverlay:227` (pinned) · `FormPicker:312` (pinned) · `PriceListFormPage:320` **(not pinned)** |

Re-find them with **both** greps — the class-attribute one alone misses the raw-CSS three, which is
how they were missed on the first pass:

```
grep -rno 'class="[^"]*overflow-y-auto[^"]*"' src/ --include=*.vue | grep -v overflow-x
grep -rn 'overflow-[xy]\? *: *auto' src/ --include=*.vue --include=*.css
```

Also found while surveying:

- `OrderGalleryPage` defines a scoped class `gallery-scroll` whose body is identical to the global
  `no-scrollbar` in `src/style.css`. Delete it on migration.
- `overscroll-behavior: contain` exists in exactly one of the 29 (`FormOverlay:231`).
- Only one place scrolls programmatically: `AppointmentDateTabs:47` calls `scrollIntoView` on its
  own strip. The component must expose its element.
- `BaseDropdown` computes its panel `maxHeight` inline from the space around the trigger
  (`:37-48`). That is correct and stays — the region must not impose a height there.

## Decisions

1. **One component, both axes, one axis per instance.** `axis: 'y' | 'x'` picks the scrolling
   direction; the other is pinned `hidden`, always, with no way to opt out. A box never scrolls both
   ways. This is the rule the whole plan exists for.
2. **Nothing else in `src/` may declare a scrolling axis** — neither the Tailwind classes nor
   `overflow-y: auto` in a `<style>` block. With both axes covered there is no legitimate exception,
   so the CI guard needs no carve-outs; a carve-out is a loophole that gets used. The guard must
   match raw CSS too, or the three regions above would pass it today.
3. **`overscroll-behavior: contain` by default.** Reaching the end of a region must not start
   dragging the page behind it. This changes behaviour in 21 places that do not have it today, so it
   is verified on a device, not assumed.
4. **Named `ScrollRegion`, in `src/shared/components/`.** Not `PageScrollRegion` — it is used in
   dropdowns and tab strips as much as in pages.
5. **The region owns rules, not position.** Layouts and scaffolds decide *where* a scrolling box
   sits; the region decides *how scrolling behaves*. It never sets padding, background or placement.
6. **One *vertical* region per surface — not one region.** Nesting across axes is supported and
   already in use: `OrderDetailPage:184` scrolls vertically and contains the horizontal thumbnail
   row at `OrderImageSection:45`; the pickers put a sideways category strip above their vertical
   list (`InvoicePriceListPicker:141`, `OrderPriceListPicker:122`). The axes do not compete — the
   browser routes a gesture by its initial direction — and a strip that declares its own axis
   contains its overflow, which is exactly why pinning the parent's x-axis does not clip it.

   Nesting on the *same* axis is the defect: two vertical regions inside each other leave one finger
   for two boxes to interpret. That is the live bug in `FormOverlay` + `BaseFullOverlay`.

## API

```
props
  axis        'y' | 'x'          default 'y'; the other axis is pinned hidden
  sizing      'fill' | 'auto'    default 'fill'
                fill = min-h-0 flex-1, the flex-child case — most sites
                auto = no height rules; the caller constrains it (the gallery
                       sheet's max-h, BaseDropdown's computed maxHeight)
  overscroll  'contain' | 'auto' default 'contain'
expose
  el   the scrolling element, for scrollIntoView
```

`sizing: 'fill'` carries `min-h-0` deliberately. Omitting it is the other classic failure — a flex
child refuses to shrink and the region grows past its frame instead of scrolling. Folding it in
removes a second thing to remember.

Padding, background and rounding stay with the caller as classes. They are cosmetic, not rules.

## Steps

1. **Build `ScrollRegion.vue`.** No consumers yet.
2. **Migrate the shared regions** — `ListPageLayout`, `FormOverlay`, `FormPicker`, and the overlay
   bases (or whatever replaces them; see `overlay-frame.md`). Behaviour-identical except
   `overscroll`, so this is the cheapest place to verify the component itself.
3. **Migrate the 15 unpinned vertical regions**, one page at a time with a device check. Each also
   gains the missing horizontal pin — that is the point.
4. **Migrate the 7 horizontal strips and the 3 raw-CSS regions.** The strips are already correct;
   `PriceListFormPage:320` is not — it is a real unpinned region that the original 15-site count
   missed. This step is what makes the guard total.
5. **Add the guard** once nothing is left to trip it: a scrolling axis declared anywhere in `src/`
   outside `ScrollRegion.vue` fails the check — Tailwind class *and* raw CSS, per Decision 2.

   The repo has no CI (`.github` does not exist), so the guard is a checked-in Node script plus an
   npm script beside `typecheck:web`, exiting non-zero with the offending `path:line` list. Wire it
   into CI later if CI ever arrives.

## Verification

Per migrated region, on a real phone — the build and dry tests cannot see any of this:

- content scrolls along the intended axis
- the region cannot be dragged along the other axis, with an over-wide child present
- scrolling to the end does not move the page behind it
- no scrollbar is painted
- a region inside a flex column does not push past its frame

## Relationship to `overlay-frame.md`

Independent. The overlay frame contains no scroll region at all, so step 1 there does not wait on
this. The overlay *scaffolds* need it at their step 3; if it is not ready by then, a scaffold pins
both axes inline with a `TODO` naming this document.

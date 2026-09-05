# Frontend layout & navigation refactor

Stage 3's mid-overlay refresh question is answered for the order sheet (it restores on refresh); it remains deferred to Stage 4 for forms that have not been migrated.
Owner decision log lives in this file — update the checkboxes as work lands.

## The taxonomy

Every page belongs to exactly one of these five types. This is the decision everything else follows
from.

| # | Type | Covers screen | Nav affordance | Page underneath stays mounted |
|---|------|---------------|----------------|-------------------------------|
| 1 | **Root** — reachable from `NavSidebar` | full | **none** | n/a, loads independently |
| 2 | **Drill-down** — walked into to read data | full | **back** (history-aware) | no |
| 3 | **Form overlay** — one task, then dismissed | full, on top | **close** | yes |
| 4 | **Bottom sheet** — supplementary detail | partial, slides up | X / backdrop / swipe down | yes |
| 5 | **Immersive** — camera, lightbox | full, on top | purpose-specific controls | yes |

- Gallery's parent is `customer-list`, not `customer-detail`, because gallery's path is
  `/gallery/AFT-<orderId>` and carries no `customerId`, so it cannot construct
  `/customers/:customerId/:tab?`. `customer-list` is the nearest reachable ancestor. Without this
  note someone will "fix" it later and hit the same wall.
- `invoice-create` -> `invoice-list` is an interim value: it becomes a form overlay with a close
  button in Stage 4.


## Stage 2.6 - the rest of the pre-features tree


Remaining after Stage 2.6:

| Directory | Files | Notes |
|---|---:|---|
| `src/api/` | 2 | Includes `photos.js`, which posts to a hardcoded Apps Script URL; blocked on the photo-upload API work, so moving it now means moving it twice. |
| `src/composables/` | 1 | `usePhotoUpload.js` remains. |
| `src/utils/` | 2 | `gviz.js` is still imported by `src/api/photos.js`, so it stays until `src/api/` moves; `imageCompression.js` remains. |
| `src/router/` | 1 | `index.js`; per CLAUDE.md this belongs in `src/app/`. |

This stage was deliberately **not urgent**. Unlike Stage 2.5, there is no second copy of anything
here, so nothing can be edited in the wrong place. These are files sitting in the wrong directory,
not a correctness trap.

- [ ] Defer `src/api/` and `src/utils/gviz.js` until the photo-upload API lands.

The two orphaned files were re-verified before deletion in Stage 2.6. Do not trust this table without
re-verifying immediately before any future deletion.

## Also landed on this branch — appointment form fixes

This work is not part of the layout/navigation refactor. It landed on the same branch because it was
found while hand-verifying Stage 2.5, and a reviewer opening the branch would otherwise wonder why
these commits are here.

### Cached form state leaked across customers — `a6280be`

Symptom: open a customer, press Schedule Pickup, type notes, close without submitting, open Schedule
Pickup for another customer; the notes remained and the form submitted customer B's id with customer
A's notes.

Cause: `src/App.vue` wrapped the router view in bare `KeepAlive` with no filters, keeping every route
component mounted; component-local refs survived; `router.back()` reset nothing; the reset watcher
did not watch customer. This was pre-existing since `ec46d07` (2026-08-02), not caused by recent
commits.

Fix: `CreateAppointmentPage`, `RescheduleAppointmentPage`, and `InvoiceCreatePage` were added to the
`KeepAlive` exclude list.

**Form pages are never cached.** Once a form page unmounts on navigation, the owner's whole policy
holds by itself — closing and successful submit both navigate away so the fields die with the
component, reopening for another subject is a fresh mount, and a failed submit does not navigate at
all so what the user typed survives. The rejected alternative was watchers and per-field reset calls,
which become a rule that whoever adds the next field has to remember.

Traps:

- The exclude matches component name, not file path. Renaming any of those three files silently drops
  it from the list and reintroduces the bug with no error.
- `CreateAppointmentPage`'s `onActivated` had to become `onMounted` in the same commit. `onActivated`
  never fires for an uncached component, and it consumes delivery booking intent; leaving it would
  make delivery bookings open a form that did not know it was a `DELIVERY` job and had no order id.
  `OrderGalleryPage` still uses `onActivated`/`onDeactivated` and is deliberately still cached.

Accepted costs: `RescheduleAppointmentPage` refetches on every open and briefly shows loading;
`InvoiceCreatePage` re-runs its mount watcher. Both costs are deliberately accepted; fresh data is
worth it.

### PICKUP_DELIVERY appointment type retired — `96b06c1` (backend), `753f6b9` (frontend)

“Round” is no longer selectable. Existing rows keep the value and no data migration is performed;
only new writes are blocked.

State read/write deliberately disagree and must not be tidied:

- `appointmentTypeSchema` keeps all three values and backs the response schema.
- `appointmentWritableTypeSchema` has two values and backs the create/update request schemas.
- `server/sheets/Appointments/Appointments.db-contract.ts` keeps three because the sheet genuinely
  still holds them.
- The G Drive registry keeps three for the same reason and was not modified.

Narrowing the response schema or DB contract to two would break existing appointments using the
retired type; making them consistent will cause that break.

Supporting facts:

- Responses are never Zod-parsed in this codebase, so an existing row with the retired value is
  returned unchanged rather than dropped. Narrowing the enum changes inferred types and request
  validation, not what reads return.
- `src/features/customers/utils/waiting-pickup.filter.ts` is an allowlist keeping only `PICKUP`, so
  retired-type appointments were already excluded from the waiting-pickup list. Its dry test uses
  the retired value as an exclusion fixture and must be kept; it is the only automated guard proving
  old rows are handled.


## Rules for anything placed in `src/shared/components/`

Presentational only. A shared component renders what it is given and reports what the user did. It
must not know the domain exists.

- **Generic prop names.** `title`, `subtitle`, `leading`, `trailing`, `variant`, `items` - never
  `orderName`, `customerAddress`, `appointmentNote`. A domain-named prop is a component that was
  written for one caller and will be forked by the second.
- **No business logic.** No status derivation, no totals, no formatting that encodes a business rule.
  Compute it in the feature and pass the result in.
- **No stores, no services, no API.** A file in `src/shared/components/` must not import anything
  matching `@/features/`, `*.store`, `*.service`, or the api client. This is grep-checkable at review
  time - use it.
- **No feature-conditional behaviour.** No `if (props.type === 'invoice')`. Expose a `variant` prop
  and let the caller choose.

Domain vocabulary is not banned from the app - it is banned from `src/shared/`. A component that
legitimately speaks about orders belongs in `src/features/orders/components/` and may name its props
after orders. Both layers stay presentational; only the location differs.

**Test:** to reuse this component in a feature that does not exist yet, would any prop need renaming?
If yes, it is not shared - put it in the feature.


Precedent to read first: `CameraOverlay`. It is the only thing in the app that is both a real
overlay (its host page stays mounted) and route-addressable -- `/gallery/:key/camera` via
`meta.openCamera`, dismissed with `router.replace` so it adds no history entry. Read it before
designing anything new.

- [x] The shell does not own a URL or browser history. It takes an `open` prop and emits `close`; whether that is driven
      by a route or by local state is the caller's business. This was already the shell's stated
      design; the owner confirmed it on 2026-08-18.
- [x] URL ownership is per overlay, not once for the shell. An overlay that must be dismissed with
      the browser/Android back button owns a route; this project's convention is a query parameter.
      An overlay that does not need Back-to-close stays local state.
- [x] The deciding test: must this overlay be dismissed with the browser/Android back button? Yes ->
      route query parameter. No -> local state.
- [ ] Still open for the URL-owning forms that have not been migrated: on a mid-overlay refresh, does
      the page underneath render too? Deferred to Stage 4, decided per form. The order sheet is
      route-owned via `?order=<orderId>` and restores on refresh.
- [x] Local-state overlays do not intercept the browser/Android back button; overlays that must be
      dismissed by Back are route-owned via a query parameter. The order sheet is the first migrated
      example.

### Route-driven overlays -- history belongs to the route

A shared overlay component must never own browser history. `BaseOverlay` contains no `pushState`,
`history.back`, `history.forward`, or `popstate` code and must not gain any. An entry created with raw
`history.pushState` is invisible to vue-router; because it copies vue-router's `position`, popping it
makes vue-router compute `delta = state.position - fromState.position === 0`, treat it as a duplicated
navigation, and recover with `go(-1)` -- an extra Back. Therefore overlays that must close with
browser/Android Back are route-owned via query parameters, following the `useOrderSheetRoute.ts`
template: derive open state with `computed`, and close with `router.back()` when this page pushed the
entry or `router.replace` on a deep link/refresh where there is no parent entry to pop.
`useCustomerFilterRoute.ts` and `useInvoiceFilterRoute.ts` are a separate, replace-only convention for
filter state -- they always use `router.replace`, never `push`/`back`, and are not overlay-dismiss
templates. Overlays that do not need Back-to-close remain local state.

- [ ] Migrate the remaining existing overlays onto it as the proof its API is right - the
      `OrderGalleryPage` source picker and two lightboxes (`InvoiceProofLightbox`, the
      `OrderGalleryPage` image viewer). If the shell cannot absorb them, the shell's API is wrong -
      better to learn that before three forms depend on it.

## Stage 4 — Move the three forms onto the overlay

- [ ] `invoice-create` — also moves off `AppLayout`, pending the type-3 confirmation above

**Do not touch:** the `router.back()` calls that run *after a successful submit*
(`CreateAppointmentPage.vue`, `RescheduleAppointmentPage.vue`). Those are "where to go once saved",
not the back button. They happen to be written with the same call, and collapsing them into the
shared navigation helper would change post-save behaviour for no reason.

## Later, not now

- `BaseOverlay.vue` is the shared base overlay and `OrderDetailSheet.vue` is its only importer. The
  remaining overlays still need migration onto it.
- `BaseOverlay.vue` owns scroll lock, focus management, Escape-to-close, the shared close X, and
  sheet drag-to-close; the remaining overlays have not migrated onto it yet.

## Verification

Frontend has no type-check. Validate with:

```
npm run build
```

Then click through by hand, each of these **twice** — once arriving from inside the app, once after a
mid-page refresh, because the refresh case is the entire reason the history-aware pattern exists:

- `customer-packages-preview`
- `customer-detail`
- gallery
- `invoice-create`
- `invoice-detail`
- create / reschedule appointment

## Open questions for the owner

- [ ] Is `invoice-create` type 3 (form overlay on top of `invoice-list`)?
- [ ] Per-form mid-overlay refresh for URL-owning forms that have not been migrated — does the page
      underneath render too? Deferred to Stage 4; the order sheet is route-owned and restores on
      refresh.


### Two remaining owner decisions

1. Is `invoice-create` a type-3 form overlay? It behaves like a task flow but currently uses
   `AppLayout` with a back button. Blocks Stage 4.
2. Per-form mid-overlay refresh for URL-owning forms that have not been migrated — does the page
   underneath render too? Deferred to Stage 4; the order sheet is route-owned and restores on refresh.

### First concrete action next session

Stage 3's shell is built and `OrderDetailSheet.vue` is migrated; the next action is the remaining
overlay migrations.

### Debts deliberately left open
- **`origin/main` was merged into this branch on 2026-08-18.** The build passed.
- The search button renders on every page but only functions on `/customers` and `/invoices`.
  Known, deliberately out of scope so far.
- `OrderDetailSheet.vue` is migrated onto `BaseOverlay.vue`; the remaining overlay migrations are
  still open.

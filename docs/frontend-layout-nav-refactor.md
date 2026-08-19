# Frontend layout & navigation refactor

Branch: `overlay-shell` (continues from `frontend-layout-nav-taxonomy`, now merged into `main`)
Status: Stages 1, 1.5, 2, 2.5 and 2.6 complete. Stage 3 is built; `OrderDetailSheet` is migrated onto `BaseOverlay`.
Stage 3's mid-overlay refresh question is answered for the order sheet (it restores on refresh); it remains deferred to Stage 4 for forms that have not been migrated.
Owner decision log lives in this file — update the checkboxes as work lands.

## Why

Navigation behaviour is inconsistent. The same-looking back button does three different things
depending on which page you are on, and the knowledge of "where should this page go back to" lives
in a central if-chain in `AppHeader` instead of next to the routes. Adding a page silently opts it
into the wrong behaviour, which is exactly how `customer-order-history` ended up always bouncing to
`customer-list`.

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

Current assignment:

- Type 1: `appointment-schedule` (`/`), `customer-list`, `invoice-list`
- Type 2: `customer-order-history`, `invoice-detail`, `customer-packages-preview`, `appointment-pending`, gallery
- Type 3: `appointment-create`, `appointment-reschedule`, `invoice-create` *(invoice-create pending
  owner confirmation)*
- Type 4: `OrderDetailSheet`, gallery source picker
- Type 5: `CameraOverlayPage`, gallery lightbox, `InvoiceProofLightbox`

## Stage 1 — Root pages must have no back and no close

Smallest change, immediate visible effect, blocked on nothing.

- Pending badge is now limited to `appointment-schedule` (`/`); `customer-list` and `invoice-list` deliberately show no right-side button beyond search.
- [x] `customer-list` (`/customers`): remove the `close` button; show no right-side button beyond
      search
- [x] appointment-pending: remove close, show NO right-side button (the pending badge links to the pending page, so it is meaningless on that page itself)
- [x] Confirm `appointment-schedule` and `invoice-list` already behave this way (expected: yes)
- [x] Once both are done, the `close` branch in `AppHeader.goBack` has no remaining caller — delete
      the whole branch. `close` becomes a type-3 concern, not a header concern.

Note: `appointment-pending` gained a back button when it was removed from the sidebar and became a
drill-down page. Its temporary hardcoded branch in `AppHeader` is expected to be absorbed by Stage 2.

## Stage 1.5 -- Put files where CLAUDE.md says they go

- [x] `src/layouts/AppLayout.vue` → `src/shared/layouts/AppLayout.vue`
- [x] `src/layouts/FormLayout.vue` → `src/shared/layouts/FormLayout.vue`
- [x] `src/components/layout/AppHeader.vue` → `src/shared/components/AppHeader.vue`
- [x] `src/components/layout/NavSidebar.vue` → `src/shared/components/NavSidebar.vue`
- [x] `src/pages/OrderGalleryPage.vue` → `src/features/gallery/pages/OrderGalleryPage.vue`
- [x] `src/pages/CameraOverlayPage.vue` → `src/features/gallery/components/CameraOverlayPage.vue`
- [x] Deleted dead code `src/pages/CustomersPage.vue` (no importer, no route); a prose mention in a document is not a code reference.
- [x] Temporary back-compat shim: `src/layouts/AppLayout.vue` → `src/shared/layouts/AppLayout.vue`
- [x] Temporary back-compat shim: `src/layouts/FormLayout.vue` → `src/shared/layouts/FormLayout.vue`
- [x] Temporary back-compat shim: `src/components/layout/AppHeader.vue` → `src/shared/components/AppHeader.vue`
- [x] Temporary back-compat shim: `src/components/layout/NavSidebar.vue` → `src/shared/components/NavSidebar.vue`
- [x] Temporary back-compat shim: `src/pages/OrderGalleryPage.vue` → `src/features/gallery/pages/OrderGalleryPage.vue`
- [x] Temporary back-compat shim: `src/pages/CameraOverlayPage.vue` → `src/features/gallery/components/CameraOverlayPage.vue`
- [x] Delete the temporary back-compat shims at the old paths as part of Stage 2.5; the shims went
      with that stage, so no separate owner decision was needed

The current tree is an unfinished migration, not a convention -- cross-feature code belongs in `src/shared/`, feature code in `src/features/<feature>/`. Doing this before Stage 2 means `useGoBack()` is born in the right place instead of being moved later.

## Stage 2 — Make drill-down back history-aware

Generalises the pattern `invoice-detail` already uses correctly: try history first, fall back to a
parent the route declares itself.

- [x] Add `meta.parent` to every type-2 route, in that feature's `routes.ts`
- [x] Write one composable `useGoBack()`: if `history.state.back` exists → `router.back()`, else
      → `router.push(route.meta.parent)`
- [x] Replace the whole if-chain in `AppHeader.goBack` with a call to it
- [x] Keep a last-resort fallback for a route with no `meta.parent`, but treat hitting it as a bug,
      not as normal operation — the point of `meta.parent` is that a forgotten declaration is visible
      at review time instead of surfacing as a user complaint

**Why `meta.parent` and not a central map:** the central if-chain in `AppHeader` is a different file
from the route definitions, so new pages get forgotten and fall through to `customer-list` with no
error. Putting the fallback on the route puts it in front of whoever adds the page.

**Landed:**

- `src/shared/composables/use-go-back.ts` - exports a pure `resolveBackTarget(hasHistoryBack, parent)`
  plus `useGoBack()`; the pure function exists so the decision is unit-testable without a Vue
  component context.
- `meta.parent` set on: `customer-order-history` -> `customer-list`,
  `customer-packages-preview` -> `customer-list`, `invoice-detail` -> `invoice-list`,
  `invoice-create` -> `invoice-list`, `appointment-pending` -> `appointment-schedule`, and both
  `/gallery/:key` and `/gallery/:key/camera` -> `customer-list`.
- The whole if-chain in `AppHeader.goBack` is gone; `isGallery` remains, used only by the back-button
  `v-if`.
- Test: `tests/web/unit/shared/composables/use-go-back.dry-test.ts`.
- Gallery's parent is `customer-list`, not `customer-order-history`, because gallery's path is
  `/gallery/AFT-<orderId>` and carries no `customerId`, so it cannot construct
  `/customers/:customerId/orders`. `customer-list` is the nearest reachable ancestor. Without this
  note someone will "fix" it later and hit the same wall.
- `invoice-create` -> `invoice-list` is an interim value: it becomes a form overlay with a close
  button in Stage 4.

## Stage 2.5 - Collapse the legacy `src/components/` tree

`src/components/` is the OLD architecture. The project has moved to `src/features/<feature>/` +
`src/shared/`. This stage deletes the old tree entirely. Confirmed by the owner 2026-08-18.

**Why this was urgent, not cosmetic:** the app carried TWO copies of the same shared library, and the
copies had begun to drift. No live screen was importing a drifted copy: the
`src/components/forms/shared/FormInput.vue` copy was orphaned, while the three legacy components that
still had importers were byte-identical to their canonical twins. This was a trap nobody had stepped
in yet, not an active bug. It was still dangerous in a codebase with no frontend type-check: a fix
applied to the wrong copy builds green and changes nothing on screen.

**Correction to the "Debts deliberately left open" note below.** A bullet there claimed nothing
imports the old paths and that deleting the six re-export shims would remove `src/components/`
entirely. That was wrong, and acting on it would have broken the app. The six shims are re-exports and
are indeed unimported - but they sit in the same tree as REAL duplicate implementations that live
feature code still imports. Verify importers before deleting anything under `src/components/`.

Inventory (surveyed 2026-08-18):

| Component | Canonical | Legacy duplicate | Live importer of the duplicate |
|---|---|---|---|
| `FormInput` | `src/shared/components/` | `src/components/forms/shared/` | None - orphaned legacy copy; `AppointmentForm.vue` does not import it |
| `FormOptionGrid` | `src/shared/components/` (0 consumers) | `src/components/forms/shared/` | `AppointmentForm.vue` |
| `FormTextarea` | `src/shared/components/` (0 consumers) | `src/components/forms/shared/` | `AppointmentForm.vue` |
| `GlassNoteBox` | None - no canonical copy | `src/components/forms/shared/` | None - orphaned legacy copy |
| `ListContainer` | `src/shared/components/` (4 consumers) | `src/components/shared/` | `AppointmentSchedulePage.vue` |
| `BaseSwipeCard` | `src/shared/components/` (2 consumers) | `src/components/shared/` | None - orphaned legacy customer component; live pages use the feature copy |
| `GenericTabs` | `src/shared/components/` (2 consumers) | `src/components/shared/` | None - orphaned legacy customer component; live pages use the feature copy |

Plus six re-export shims (`src/layouts/`, `src/components/layout/`, `src/pages/`) with no importers.

Order of operations:

- [x] Diff each duplicate pair BEFORE repointing anything. Where they differ, the canonical
  `src/shared/` version wins - but confirm the legacy importer does not depend on the difference.
  `FormInput` and `GlassNoteBox` are orphaned legacy copies; `AppointmentForm` does not import
  `FormInput`, so its missing `min`/`max` cannot affect appointment behaviour.
- [x] Repoint every importer to `@/shared/components/...` or the feature path
- [x] Confirm the legacy customer components have no importer, then delete them; live pages already
  use the feature copies
- [x] Delete the duplicates, including orphaned `FormInput` and `GlassNoteBox`, then the six shims,
  then the now-empty `src/components/`, `src/layouts/`, `src/pages/` directories
- [x] Grep the whole of `src/` for any surviving `@/components/`, `@/layouts/`, `@/pages/` import -
  expect zero
- [x] Check the components now in `src/shared/components/` against the shared-component rules below,
      and record any violations rather than silently rewriting them

**Landed:**

- `972d07e` — Remove dead files from pre-features UI tree: deletion-only cleanup of 12 dead files.
- `7efcba9` — Collapse remaining legacy component imports: repointed the three remaining live
  imports and deleted the last three legacy files.
- Net result: 15 files deleted and 2 files modified. The only modifications were three import paths:
  two in `AppointmentForm.vue` and one in `AppointmentSchedulePage.vue`.
- `src/components/`, `src/layouts/` and `src/pages/` are gone. A repo-wide grep for
  `@/components/`, `@/layouts/` and `@/pages/` returns zero hits.
- The work was split deliberately into two batches. Batch 1 was deletion-only and touched no live
  code path, so a mistake would fail the build loudly. Batch 2 was the only batch that edited a file
  used by a live screen, and was kept separate so its blast radius stayed visible. Reuse this pattern
  for the next deletion stage.
- [x] Owner completed the appointment schedule, create appointment and reschedule appointment
  screen pass on 2026-08-18; everything passed.
- Gotcha: a raw diff of the legacy and canonical copies reported a total mismatch that was entirely
  CRLF-vs-LF line-ending noise. `diff --strip-trailing-cr` showed the files were identical. Use that
  flag when diffing files in this repo or identical files will appear different.

Do not:

- Do not "merge" the two copies by editing the canonical one to match the legacy one. The canonical
  version is the target; the legacy one is being deleted.
- Do not delete any file under `src/components/` without first proving it has no importer. There is
  no frontend type-check - a wrong deletion still builds green and fails at runtime.

Verification: `npm run build` passed. The owner completed the manual browser pass in the Landed
checklist above on 2026-08-18; everything passed.

This stage also closes the open shim decision - the shims go as part of it, no separate owner call
needed.

## Stage 2.6 - the rest of the pre-features tree

`src/components/`, `src/layouts/` and `src/pages/` are gone, but four directories from the old
architecture remain. `src/app/` — which this project's CLAUDE.md names as the home for the root
router, global layouts and app-level stores — does not exist at all.

Stage 2.6 deleted the two confirmed orphaned files: `src/composables/useCustomerStore.js` and
`src/utils/constants.js`.

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

- [x] Re-verify orphan status immediately before deleting, then delete `src/composables/useCustomerStore.js` and `src/utils/constants.js`.
- [ ] Decide whether to create `src/app/` and move the router into it.
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

- [ ] Follow-up: the booking form option list is an independently hardcoded copy of the enum, so a
  future contract type will not appear and nothing reports it. Deriving options from
  `appointmentWritableTypeSchema` was deliberately deferred to avoid entangling with the `KeepAlive`
  fix in the same file on the same day.

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

## Stage 3 — Build the real type-3 form overlay

The expensive stage. Nothing of this type exists in the app yet.

### Shell design -- already decided, do not redesign

One generic overlay shell component, `src/shared/layouts/BaseOverlay.vue` (it is cross-feature), built
on the native `<dialog>` element and opened with `showModal()`. It renders the overlay and the close
button and nothing else; callers supply all content through slots.

The shell owns -- and callers must not reimplement -- Teleport, z-index, the backdrop, scroll lock
on the page behind, focus management, Escape-to-close, the close button's position and size, the
enter/leave transition, and drag-to-close for the sheet variant. The existing close buttons come in
four different sizes and positions; that inconsistency is exactly what a shared shell exists to end.

The shell must not own the title, footer buttons, form logic, data fetching, or the route. It
takes an `open` prop and emits `close`. Whether `open` is driven by a route (as `CameraOverlayPage`
does) or by local component state (as the bottom sheets do) is the caller's business -- a shell that
managed URLs could not serve the sheets, which would force a second shell and defeat the purpose.

One component, two variants, not two components: `variant: 'full' | 'sheet'`. Type 3 (full-cover
form overlay) and type 4 (partial slide-up sheet) differ only in geometry; backdrop, Teleport, scroll
lock, Escape and focus handling are identical, so splitting them would duplicate the large majority of the
code.

`FormLayout` goes inside the shell, not beside it: the shell provides the overlay and close
affordance, `FormLayout` provides the form's header, body and footer.

Precedent to read first: `CameraOverlayPage`. It is the only thing in the app that is both a real
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

- [x] Build the overlay shell in `src/shared/layouts/BaseOverlay.vue` on native `<dialog>` (one component with `variant: 'full' | 'sheet'`; page underneath stays mounted, `close` button)
- [x] Migrate `OrderDetailSheet.vue` onto the shell; it no longer contains overlay chrome of its own.
- [ ] Migrate the remaining existing overlays onto it as the proof its API is right - the
      `OrderGalleryPage` source picker and two lightboxes (`InvoiceProofLightbox`, the
      `OrderGalleryPage` image viewer). If the shell cannot absorb them, the shell's API is wrong -
      better to learn that before three forms depend on it.
- [ ] Set `FormLayout`'s existing `closeMode` prop — it is already implemented and currently unused
      by every page

## Stage 4 — Move the three forms onto the overlay

- [ ] `appointment-create`
- [ ] `appointment-reschedule`
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
- `PaymentHistorySheet.vue` was deleted after confirming it had no caller. Do not count it as a live
  sheet when surveying.
- The `/gallery/*` back button is matched by URL path prefix, not by route name like every other page.
  Change the path and the button vanishes silently.

## Verification

Frontend has no type-check. Validate with:

```
npm run build
```

Then click through by hand, each of these **twice** — once arriving from inside the app, once after a
mid-page refresh, because the refresh case is the entire reason the history-aware pattern exists:

- `customer-packages-preview`
- `customer-order-history`
- gallery
- `invoice-create`
- `invoice-detail`
- create / reschedule appointment

## Open questions for the owner

- [x] Parent route for `customer-order-history` when there is no history: `customer-list`. Owner
      confirmed on 2026-08-18 that no customer-detail page has ever existed and
      `customer-order-history` is itself the customer-information screen, so `customer-list` is the
      correct parent, not a placeholder.
- [x] Parent route for `customer-packages-preview` when there is no history: `customer-list` (same
      owner confirmation).
- [ ] Is `invoice-create` type 3 (form overlay on top of `invoice-list`)?
- [ ] Per-form mid-overlay refresh for URL-owning forms that have not been migrated — does the page
      underneath render too? Deferred to Stage 4; the order sheet is route-owned and restores on
      refresh.

## Next session starts here

### Done and committed on this branch

a977ad3 -- Stage 1 + 1.5: root page nav cleanup and file reorganisation
b34c9c2 -- Delete orphan src/pages/CustomersPage.vue
10bcd83 -- Nav menu: rename Home to Appointments, drop Pending, give Pending a back button
acbe84b -- Delete stale FRONTEND_REFACTOR_PLAN.md
8125a62 -- Show the pending badge only on the appointments page
2213a33, 244f5a8, 659b6d1, 38f226d, 01fefb0 -- Stage 2: history-aware drill-down back navigation
972d07e -- Stage 2.5: remove dead files from pre-features UI tree
7efcba9 -- Stage 2.5: collapse remaining legacy component imports
a6280be -- Fix cached appointment form state
96b06c1 -- Reject PICKUP_DELIVERY on appointment writes, keep reading it
753f6b9 -- Retire pickup-delivery appointment option
24ce471 -- Remove orphaned pre-features frontend files
abd6bb2 -- Stage 3: add the native dialog overlay shell and delete orphaned PaymentHistorySheet.vue
bc156f7 -- Stage 3: migrate OrderDetailSheet onto the overlay shell
Pipeline commits for Stage 2 carry generic `checkpoint: <role>` messages rather than descriptive ones.

Net effect: root pages carry no back and no close; the pending badge appears only on the appointments
page; `appointment-pending` left the sidebar, became a drill-down, and gained a back button;
cross-feature code now lives in `src/shared/` and gallery in `src/features/gallery/`; Stage 2.5
deleted 15 files, modified only three import paths across 2 files, and removed the three legacy
directories.

### Two remaining owner decisions

1. Is `invoice-create` a type-3 form overlay? It behaves like a task flow but currently uses
   `AppLayout` with a back button. Blocks Stage 4.
2. Per-form mid-overlay refresh for URL-owning forms that have not been migrated — does the page
   underneath render too? Deferred to Stage 4; the order sheet is route-owned and restores on refresh.

### First concrete action next session

Stage 3's shell is built and `OrderDetailSheet.vue` is migrated; the next action is the remaining
overlay migrations.

### Debts deliberately left open

- The six re-export shims were deleted as part of Stage 2.5.
- **`origin/main` was merged into this branch on 2026-08-18.** The build passed.
- The search button renders on every page but only functions on `/customers` and `/invoices`.
  Known, deliberately out of scope so far.
- The `/gallery/*` back button is matched by URL path prefix, not by route name like every other
  page, so changing the path makes the button vanish silently.
- `OrderDetailSheet.vue` is migrated onto `BaseOverlay.vue`; the remaining overlay migrations are
  still open.
- `PaymentHistorySheet.vue` was deleted after confirming it had no caller. Do not count it as a live
  sheet when surveying.

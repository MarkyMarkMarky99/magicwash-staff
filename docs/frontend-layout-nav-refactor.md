# Frontend layout & navigation refactor

Branch: `frontend-layout-nav-taxonomy` (cut from `main`)
Status: Stages 1, 1.5, 2 and 2.5 complete. Stage 3 is next; its shell design is decided and its URL question is answered per-form.
Stage 3's per-form mid-overlay refresh question remains deferred to Stage 4 (see the Stage 3 note).
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
- [ ] Manual browser verification of the appointment schedule, create appointment and reschedule
  appointment screens is still outstanding; the owner is doing that pass.
- Gotcha: a raw diff of the legacy and canonical copies reported a total mismatch that was entirely
  CRLF-vs-LF line-ending noise. `diff --strip-trailing-cr` showed the files were identical. Use that
  flag when diffing files in this repo or identical files will appear different.

Do not:

- Do not "merge" the two copies by editing the canonical one to match the legacy one. The canonical
  version is the target; the legacy one is being deleted.
- Do not delete any file under `src/components/` without first proving it has no importer. There is
  no frontend type-check - a wrong deletion still builds green and fails at runtime.

Verification: `npm run build` passed. The manual browser pass remains open in the Landed checklist
above.

This stage also closes the open shim decision - the shims go as part of it, no separate owner call
needed.

## Stage 2.6 - the rest of the pre-features tree

`src/components/`, `src/layouts/` and `src/pages/` are gone, but four directories from the old
architecture remain. `src/app/` — which this project's CLAUDE.md names as the home for the root
router, global layouts and app-level stores — does not exist at all.

Remaining, with file counts as of 2026-08-18:

| Directory | Files | Notes |
|---|---:|---|
| `src/api/` | 2 | Includes `photos.js`, which posts to a hardcoded Apps Script URL; blocked on the photo-upload API work, so moving it now means moving it twice. |
| `src/composables/` | 2 | `useCustomerStore.js` is confirmed orphaned — zero importers since Stage 2.5. |
| `src/utils/` | 3 | `constants.js` is confirmed orphaned — zero importers; `gviz.js` is still imported by `src/api/photos.js`, so it stays until `src/api/` moves. |
| `src/router/` | 1 | `index.js`; per CLAUDE.md this belongs in `src/app/`. |

This stage is deliberately **not urgent**. Unlike Stage 2.5, there is no second copy of anything
here, so nothing can be edited in the wrong place. These are files sitting in the wrong directory,
not a correctness trap.

- [ ] Re-verify orphan status immediately before deleting, then delete `src/composables/useCustomerStore.js` and `src/utils/constants.js`.
- [ ] Decide whether to create `src/app/` and move the router into it.
- [ ] Defer `src/api/` and `src/utils/gviz.js` until the photo-upload API lands.

The orphan survey was accurate on 2026-08-18, but any new page could pick either file up. Do not
trust this table without re-verifying immediately before deletion.

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

One generic overlay shell component, in `src/shared/` (it is cross-feature). It renders the overlay
and the close button and nothing else; callers supply all content through slots.

The shell owns -- and callers must not reimplement -- Teleport, z-index, the backdrop, scroll lock
on the page behind, focus trap, Escape-to-close, the close button's position and size, and the
enter/leave transition. Nothing in the app does scroll lock or focus trap today, and the existing close
buttons come in four different sizes and positions; that inconsistency is exactly what a shared shell
exists to end.

The shell must not own the title, footer buttons, form logic, data fetching, or the route. It
takes an `open` prop and emits `close`. Whether `open` is driven by a route (as `CameraOverlayPage`
does) or by local component state (as the bottom sheets do) is the caller's business -- a shell that
managed URLs could not serve the sheets, which would force a second shell and defeat the purpose.

One component, two variants, not two components: `variant: 'full' | 'sheet'`. Type 3 (full-cover
form overlay) and type 4 (partial slide-up sheet) differ only in geometry; backdrop, Teleport, scroll
lock, Escape and focus trap are identical, so splitting them would duplicate the large majority of the
code.

`FormLayout` goes inside the shell, not beside it: the shell provides the overlay and close
affordance, `FormLayout` provides the form's header, body and footer.

Precedent to read first: `CameraOverlayPage`. It is the only thing in the app that is both a real
overlay (its host page stays mounted) and route-addressable -- `/gallery/:key/camera` via
`meta.openCamera`, dismissed with `router.replace` so it adds no history entry. Read it before
designing anything new.

- [x] The shell does not own a URL. It takes an `open` prop and emits `close`; whether that is driven
      by a route or by local state is the caller's business. This was already the shell's stated
      design; the owner confirmed it on 2026-08-18.
- [x] URL ownership is per form, not once for the shell. A form that is a destination in its own
      right - reachable cold and worth linking to, e.g. `create-customer` or `create-appointment` -
      owns a URL. A form that is a continuation of what is already on screen and needs the parent
      page's context to mean anything, e.g. `edit-order` opened from order history, is local state
      with no URL.
- [x] The deciding test: opened cold with no app state, does this form still make sense? Yes -> URL.
      No -> local state.
- [ ] Still open, and only for the URL-owning subset: on a mid-overlay refresh, does the page
      underneath render too? Deferred to Stage 4, decided per form.
- [x] A local-state overlay does not intercept the browser/Android back button, so back leaves the
      page. Accepted - those forms are always opened from within a page and always show a close X.
- [ ] Build the overlay shell in `src/shared/layouts/` (one component with `variant: 'full' | 'sheet'`; page underneath stays mounted, `close` button)
- [ ] After building the shell, migrate the existing overlays onto it as the proof its API is right -
      three bottom sheets (`PaymentHistorySheet`, `OrderDetailSheet`, the `OrderGalleryPage` source
      picker) and two lightboxes (`InvoiceProofLightbox`, the `OrderGalleryPage` image viewer). If the
      shell cannot absorb them, the shell's API is wrong - better to learn that before three forms
      depend on it. None of those five implements scroll-lock or focus-trap, and the app contains nine
      visually different close-X controls.
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

- No shared base overlay component exists; the bottom sheets each reimplement the same shell
  (`Teleport` + `bg-black/40` backdrop + `rounded-t-2xl` panel + identical close X). Extract it as
  part of the Stage 3 shell, using its `sheet` variant.
- No scroll lock, no focus trap anywhere. Only `InvoiceProofLightbox` manages focus and Escape.
- `PaymentHistorySheet.vue` has no caller — it is orphaned. Do not count it as a live sheet when
  surveying.
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
- [ ] Per-form mid-overlay refresh for URL-owning forms — does the page underneath render too? Deferred
      to Stage 4; shell URL ownership and local-state browser-back behaviour are decided under Stage 3.

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
Pipeline commits for Stage 2 carry generic `checkpoint: <role>` messages rather than descriptive ones.

Net effect: root pages carry no back and no close; the pending badge appears only on the appointments
page; `appointment-pending` left the sidebar, became a drill-down, and gained a back button;
cross-feature code now lives in `src/shared/` and gallery in `src/features/gallery/`; Stage 2.5
deleted 15 files, modified only three import paths across 2 files, and removed the three legacy
directories.

### Two remaining owner decisions

1. Is `invoice-create` a type-3 form overlay? It behaves like a task flow but currently uses
   `AppLayout` with a back button. Blocks Stage 4.
2. Per-form mid-overlay refresh for URL-owning forms — does the page underneath render too? Deferred
   to Stage 4; shell URL ownership and local-state browser-back behaviour are already answered under
   Stage 3.

### First concrete action next session

The merge, Stage 2 and Stage 2.5 are complete. Before Stage 3, finish the owner's manual browser pass
over the three appointment screens and the back-button matrix. After that, start Stage 3 with the
overlay shell.

Stage 3 starts after that owner pass.

### Debts deliberately left open

- The six re-export shims were deleted as part of Stage 2.5.
- **`origin/main` was merged into this branch on 2026-08-18.** The build passed.
- The search button renders on every page but only functions on `/customers` and `/invoices`.
  Known, deliberately out of scope so far.
- The `/gallery/*` back button is matched by URL path prefix, not by route name like every other
  page, so changing the path makes the button vanish silently.
- No shared base component for the bottom sheets yet -- three of them reimplement the same shell.
  Worth extracting when the Stage 3 shell lands, since it is the same shell with a different variant.
- `PaymentHistorySheet.vue` has no caller. Do not count it as a live sheet when surveying.

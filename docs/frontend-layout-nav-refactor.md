# Frontend layout & navigation refactor

Branch: `frontend-layout-nav-taxonomy` (cut from `main`)
Status: Stages 1, 1.5 and 2 complete. Stage 2.5 is next and unblocked.
Stage 3 shell design is decided; its URL questions are answered per-form (see the new Stage 3 note).
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
- [ ] Delete the temporary back-compat shims at the old paths as part of Stage 2.5; no separate owner
      decision is needed (see Stage 2.5)

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

**Why this is urgent, not cosmetic:** the app currently ships TWO copies of the same shared library,
and different pages import different copies. They have already drifted - the
`src/components/forms/shared/FormInput.vue` copy is missing `min`/`max`. This produces the worst
class of bug in a codebase with no frontend type-check: you fix a component, the build passes, and the
screen does not change, because the page imports the other copy.

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

- [ ] Diff each duplicate pair BEFORE repointing anything. Where they differ, the canonical
  `src/shared/` version wins - but confirm the legacy importer does not depend on the difference.
  `FormInput` and `GlassNoteBox` are orphaned legacy copies; `AppointmentForm` does not import
  `FormInput`, so its missing `min`/`max` cannot affect appointment behaviour.
- [ ] Repoint every importer to `@/shared/components/...` or the feature path
- [ ] Confirm the legacy customer components have no importer, then delete them; live pages already
  use the feature copies
- [ ] Delete the duplicates, including orphaned `FormInput` and `GlassNoteBox`, then the six shims,
  then the now-empty `src/components/`, `src/layouts/`, `src/pages/` directories
- [ ] Grep the whole of `src/` for any surviving `@/components/`, `@/layouts/`, `@/pages/` import -
  expect zero
- [ ] Check the components now in `src/shared/components/` against the shared-component rules below,
  and record any violations rather than silently rewriting them

Do not:

- Do not "merge" the two copies by editing the canonical one to match the legacy one. The canonical
  version is the target; the legacy one is being deleted.
- Do not delete any file under `src/components/` without first proving it has no importer. There is
  no frontend type-check - a wrong deletion still builds green and fails at runtime.

Verification: `npm run build`, then click through by hand: appointment schedule, create appointment,
and reschedule appointment. Those are the screens that currently import the legacy copies: the
schedule page imports legacy `ListContainer`, while create and reschedule use `AppointmentForm.vue`,
which imports legacy `FormOptionGrid` and `FormTextarea`.

This stage also closes the open shim decision - the shims go as part of it, no separate owner call
needed.

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
Pipeline commits for Stage 2 carry generic `checkpoint: <role>` messages rather than descriptive ones.

Net effect: root pages carry no back and no close; the pending badge appears only on the appointments
page; `appointment-pending` left the sidebar, became a drill-down, and gained a back button;
cross-feature code now lives in `src/shared/` and gallery in `src/features/gallery/`; two dead files
are gone.

### Four decisions the owner owes, in the order they unblock work

1. ~~Parent route for `customer-order-history` -- where its back button goes when there is no history
   to return to (refresh, deep link, opened from LINE).~~ Answered: `customer-list`; no customer-detail
   page has ever existed, and `customer-order-history` is itself the customer-information screen.
2. ~~Parent route for `customer-packages-preview` -- same question.~~ Answered: `customer-list` (see
   the same owner confirmation under Open questions).
3. Is `invoice-create` a type-3 form overlay? It behaves like a task flow but currently uses
   `AppLayout` with a back button. Blocks Stage 4.
4. ~~The three Stage 3 URL questions.~~ Shell URL ownership and local-state browser-back behaviour
   are answered under Stage 3. The per-form mid-overlay-refresh question remains open and is deferred
   to Stage 4.

### First concrete action next session

1. Start Stage 2.5: diff the duplicate pairs before repointing importers, then follow its order of
   operations through the build and three-screen verification.

Stage 2.5 is next; Stage 3 is the expensive one.

### Debts deliberately left open

- Six re-export shims remain at the old paths (`src/layouts/`, `src/components/layout/`,
  `src/pages/`) until Stage 2.5, which deletes them as part of the legacy-tree cleanup; no separate
  owner decision is needed.
- **`origin/main` was merged into this branch on 2026-08-18.** The build passed.
- **The six re-export shims have no importers, but `src/components/` also contains live duplicate
  implementations that are imported.** Deleting the tree is Stage 2.5 work, not a quick cleanup; see
  Stage 2.5. Verify importers before deleting anything under `src/components/`.
- The search button renders on every page but only functions on `/customers` and `/invoices`.
  Known, deliberately out of scope so far.
- The `/gallery/*` back button is matched by URL path prefix, not by route name like every other
  page, so changing the path makes the button vanish silently.
- No shared base component for the bottom sheets yet -- three of them reimplement the same shell.
  Worth extracting when the Stage 3 shell lands, since it is the same shell with a different variant.
- `PaymentHistorySheet.vue` has no caller. Do not count it as a live sheet when surveying.

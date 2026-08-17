# Frontend layout & navigation refactor

Branch: `frontend-layout-nav-taxonomy` (cut from `main`)
Status: Stages 1 and 1.5 complete (5 commits). Stage 2 blocked on owner decision; Stage 3 blocked on owner decision.
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
- [ ] Delete the temporary back-compat shims at the old paths when the owner decides to do so (see Debts deliberately left open)

The current tree is an unfinished migration, not a convention -- cross-feature code belongs in `src/shared/`, feature code in `src/features/<feature>/`. Doing this before Stage 2 means `useGoBack()` is born in the right place instead of being moved later.

## Stage 2 — Make drill-down back history-aware

Generalises the pattern `invoice-detail` already uses correctly: try history first, fall back to a
parent the route declares itself.

- [ ] Add `meta.parent` to every type-2 route, in that feature's `routes.ts`
- [ ] Write one composable `useGoBack()`: if `history.state.back` exists → `router.back()`, else
      → `router.push(route.meta.parent)`
- [ ] Replace the whole if-chain in `AppHeader.goBack` with a call to it
- [ ] Keep a last-resort fallback for a route with no `meta.parent`, but treat hitting it as a bug,
      not as normal operation — the point of `meta.parent` is that a forgotten declaration is visible
      at review time instead of surfacing as a user complaint

**Why `meta.parent` and not a central map:** the central if-chain in `AppHeader` is a different file
from the route definitions, so new pages get forgotten and fall through to `customer-list` with no
error. Putting the fallback on the route puts it in front of whoever adds the page.

**Blocked on:** owner must name the parent for `customer-order-history` and
`customer-packages-preview` (likely the customer's own detail page, unconfirmed — that page's
existence has not been verified).

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

- [ ] Decide: does the overlay own a URL, or is it local state only?
- [ ] Decide: on refresh mid-overlay, does the page underneath get rendered too, or does the overlay
      render standalone?
- [ ] Decide: browser back while the overlay is open should close the overlay, not leave the page.
      No existing sheet in the app does this today.
- [ ] Build the overlay shell in `src/shared/layouts/` (one component with `variant: 'full' | 'sheet'`; page underneath stays mounted, `close` button)
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

- [ ] Parent route for `customer-order-history` when there is no history
- [ ] Parent route for `customer-packages-preview` when there is no history
- [ ] Is `invoice-create` type 3 (form overlay on top of `invoice-list`)?
- [ ] Type-3 URL strategy — the three decisions listed under Stage 3

## Next session starts here

### Done and committed on this branch

a977ad3 -- Stage 1 + 1.5: root page nav cleanup and file reorganisation
b34c9c2 -- Delete orphan src/pages/CustomersPage.vue
10bcd83 -- Nav menu: rename Home to Appointments, drop Pending, give Pending a back button
acbe84b -- Delete stale FRONTEND_REFACTOR_PLAN.md
8125a62 -- Show the pending badge only on the appointments page

Net effect: root pages carry no back and no close; the pending badge appears only on the appointments
page; `appointment-pending` left the sidebar, became a drill-down, and gained a back button;
cross-feature code now lives in `src/shared/` and gallery in `src/features/gallery/`; two dead files
are gone.

### Four decisions the owner owes, in the order they unblock work

1. Parent route for `customer-order-history` -- where its back button goes when there is no history
   to return to (refresh, deep link, opened from LINE). Best guess is that customer's own detail page,
   but nobody has confirmed such a page exists. Blocks Stage 2.
2. Parent route for `customer-packages-preview` -- same question. Blocks Stage 2.
3. Is `invoice-create` a type-3 form overlay? It behaves like a task flow but currently uses
   `AppLayout` with a back button. Blocks Stage 4.
4. The three Stage 3 URL questions -- does the overlay own a URL; what renders on a mid-overlay
   refresh; does browser-back close the overlay rather than leaving the page. Blocks Stage 3. Note that
   no sheet in the app closes on browser-back today.

### First concrete action next session

1. `git merge origin/main` into this branch and confirm the build still passes.
2. Answer decisions 1 and 2 (the two parent routes).
3. Then Stage 2 as already described: add `meta.parent` to the type-2 routes, write `useGoBack()` in
   `src/shared/`, and replace the if-chain in `AppHeader.goBack` with a call to it.

It is the last cheap stage; Stage 3 is the expensive one.

### Debts deliberately left open

- Six re-export shims exist at the old paths (`src/layouts/`, `src/components/layout/`,
  `src/pages/`), and each carries a temporary-marker comment. Whether to remove them is now an open
  decision; see the shim-justification bullet below.
- **This branch is 7 commits behind `origin/main`.** It was cut from a stale local `main`.
  `origin/main` has since taken PR #13 and others. Merge `origin/main` in before doing further work,
  and certainly before opening a PR — the incoming commits are backend (`server/`, tests), so a clean
  merge is likely, but it has not been attempted.
- **The six re-export shims have lost their justification.** They were created on the belief that
  unmerged branches still imported the old paths. That was wrong: `optimize-invoice-create-reads` is
  already in `origin/main` (PR #13), and `git branch -a --no-merged origin/main` lists only this branch.
  Nothing anywhere imports the old paths. The shims can be deleted — deciding to do so is the owner's
  call, not a cleanup to perform unasked, since they were added deliberately. Deleting them removes
  `src/layouts/`, `src/components/layout/` and `src/pages/` entirely.
- The search button renders on every page but only functions on `/customers` and `/invoices`.
  Known, deliberately out of scope so far.
- The `/gallery/*` back button is matched by URL path prefix, not by route name like every other
  page, so changing the path makes the button vanish silently.
- No shared base component for the bottom sheets yet -- three of them reimplement the same shell.
  Worth extracting when the Stage 3 shell lands, since it is the same shell with a different variant.
- `PaymentHistorySheet.vue` has no caller. Do not count it as a live sheet when surveying.

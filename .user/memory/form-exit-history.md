# Form exit history

Plan: `docs/plans/form-routes.md`. Form-routes refactor merged to `main` 2026-09-14.

## Status

- Plan steps 1–7 implemented by Codex and merged to `main`.
- `typecheck:web` and related dry tests pass (re-run by Claude).
- Automated browser test (`/frontend-test`) died on Codex `0xC0000142` under low memory; nothing ran.
- User tested by hand and confirmed Back re-opens the package form after save; full browser pass still pending.

## Agreed rule (2026-09-14)

- A form is a temporary layer: after leaving it by any button, no form entry may remain in history.
- Enter: `push` only.
- Exit back to origin (cancel, X, save-and-return, result-screen back): `back()` in-app, `replace(fallback)` on deep link.
- Exit to a new destination (e.g. new order detail, invoice list): `replace(destination)`.
- Never `push` from inside a form.
- Proposed: one `useFormExit(fallback)` helper with `close()` / `finishTo()` and a double-call guard, plus a dry test banning direct `router.push/replace/back` in form pages. Not yet written into the plan.

## Pre-existing defect (before this refactor, confirmed by user)

- After save, Back re-opens the form because the exit uses `push`:
  - `PackageFormPage.vue` — `push('/packages')`
  - `PriceListFormPage.vue` — `push('/price-list')`
  - `InvoiceCreatePage.vue` result screen — `backToOrderHistory` / `goToInvoiceList` use `push`
- Related inconsistencies:
  - `RescheduleAppointmentPage.vue` save uses `router.back()` — leaves the app on a deep link.
  - `IssueReportFormPage.vue` save uses `replace(issue-reports)` — opened from the list, it leaves a duplicate list entry.
  - `CreateAppointmentPage.vue` and `CustomerPackageCreatePage.vue` duplicate the `history.state.back` check instead of calling the shared helper.

## Other review notes

- `InvoiceCreatePage` "Back to order history" label changed to "Close" (unrequested UI change).
- "New Order" and "Schedule Pickup" are now two stacked primary buttons on the customer card.
- Removed stale `setTimeout 250` assertion from `package-pages.dry-test.ts` (code was already gone on `main`).

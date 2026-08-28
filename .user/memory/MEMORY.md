# Project memory

## Where we are — 2026-08-23

- **List-page standard:** `docs/design/patterns/list-pages.md` is the required pattern for new or materially reworked root collection pages. It codifies a single scroll-region layout, route-owned/debounced filters, accessible controls, semantic status presentation, and the rule that paged APIs must provide reachable navigation plus full pagination metadata (or the feature must explicitly fetch its bounded collection). It was added after the customer-package list review exposed an inaccessible second page.
- **Current branch:** `feature/price-list-form-layout`, created from `main`.
- **Current work:** Price List form uses `FormOverlay` with its standard header and one `บันทึกราคา` footer action. The page only supplies its body slot; the legacy system-assigned item-code note and related state are removed. Page-local duplicate font import and unused placeholder CSS are removed; existing `BaseOverlay` is unchanged. The FormInput migration and Thai typography fixes remain intact. A dedicated shared `FormSwitch` owns the generic boolean-switch UI and replaces both Price List switches. The “ช่วงเวลาราคา” section precedes “รายการ”; its inter-section spacing matches the “รายการ” → service-price gap, and no gap remains before the switches.
- **Appointment form migration:** `CreateAppointmentPage` and `RescheduleAppointmentPage` individually own `FormOverlay` (different action copy); `AppointmentForm` remains body-only. Header is action context → prominent customer name → address; use nonempty fallbacks (reschedule `Appointment`) and retain error/submit gating. Customer card is removed from the body, while create's missing-customer warning remains. `frontend-reviewer` approved after the reschedule fallback and nested-gutter corrections.
- **Appointment type decision:** The AppointmentForm type tabs and the delivery-linked body badge are removed. Create derives payload type solely from the consumed delivery-order intent: a nonempty `deliveryOrderId` creates `DELIVERY`, otherwise it always creates `PICKUP`. Create header eyebrow is exactly `SCHEDULE A DELIVERY` or `SCHEDULE A PICKUP` accordingly. This preserves selected-order delivery and prevents direct `/new-booking` from creating delivery; `frontend-reviewer` approved.
- **Shared control decision:** `FormOptionGrid` is visually aligned to `FormInput` (typography, input outline/radius/surface/height/focus) while preserving selected/disabled option states and its card variant. Its label is a semantic `fieldset`/`legend`, not `FormLabel`, because a label `for` cannot associate with a multi-button grid. Its only live usage (`AppointmentForm` timeslots) was checked; `frontend-reviewer` approved.
- **Cleanup before refactor:** on `refactor/shared-list-page-shell`, move root prototype HTML files into `.agent-docs/` and commit the untracked `.codex` agent config plus `.claude` Python cache as explicitly requested; the ignored `.worktrees/` prototype is outside this repo cleanup.
- **Shared-list decision:** do not add a page shell yet; existing `ListContainer` is the useful shared boundary. Reconsider only when repeated page behavior can actually move into a shared owner.

- **Branch:** `main` — `overlay-shell` fully merged (`de85ec9`), including the PriceList feature (merged the day before via `codex/pricelist-contracts`). Single worktree at `webapp-vue`; the other worktrees (`webapp-vue-pricelist`, `webapp-vue-orders-refactor`, `.worktrees/*`) were stale/empty and have been deleted.
- **Current workstream:** frontend layout/navigation refactor (`docs/frontend-layout-nav-refactor.md`) — Stage 3 done and merged: the order detail sheet is route-driven with `?order=<id>` via `useOrderSheetRoute.ts`, rendered through the new shared `BaseOverlay.vue`.
- **Cleanup pending:** local + remote branch `overlay-shell` is fully merged into `main` — safe to delete, not yet done.

## Price list

- Merged into `main` (`codex/pricelist-contracts`, 2026-08-19). Page live at `#/price-list`, nav entry `รายการราคา`, 76 real rows. Create/edit forms + backend create/update enabled; **no delete, by instruction**.
- **Still blocked:** share the PriceList sheet with `magicwash-staff-writer@magicwashlaundry-a50ca.iam.gserviceaccount.com` as Editor — writes return 500 wrapping a Google 403 until then. No code change needed after.
- Also pending: add `PRICE_LIST_SPREADSHEET_ID` to Vercel env; remove the stray empty Vercel project `webapp-vue-pricelist`.

## Waiting on the user

- [ ] Test the merged overlay sheet on a real phone: drag-to-close, scrolling inside the sheet, Android Back, and iOS edge-swipe.
- [ ] Decide whether to delete branch `overlay-shell` (local + remote) now that it's merged.

## Next

- [ ] Add API authentication before launch.
- [ ] Pass actor identity into repository writes for an audit trail.
- [ ] Implement API-mediated photo upload and customer writes.
- [ ] Stage 4: migrate remaining overlays onto the `BaseOverlay` + `useOrderSheetRoute.ts` pattern — still local-state: `OrderGalleryPage.vue` (source picker + lightbox), `InvoiceProofLightbox.vue`, `NavSidebar.vue`. Camera also still mirrors `route.meta` into a local `ref` (`OrderGalleryPage.vue`) — soft conflict with the no-mirror rule in `CLAUDE.md`.

## Follow-ups

- [x] Confirm the two `VITE_*` spreadsheet IDs are unused, then remove them — done, removed in the overlay-shell merge (`.env.example`).
- [ ] Confirm `CUSTOMERS_SPREADSHEET_ID` is set in every Vercel environment.
- [ ] Review the pre-existing nested `<button>` in `OrderGalleryPage.vue` (~line 255).

## Gotcha learned this session

- `npx vercel dev` (serves `:3000`, proxies non-`/api` requests to a Vite child) can leave a long-lived process whose frontend proxy silently breaks while `/api/*` keeps working. Symptom: `/` returns 500 `FUNCTION_INVOCATION_FAILED`, API routes still 200. Fix is to restart `vercel dev` — not an app-code bug, don't chase it in source.

## Resume reading

1. `NEXT-SESSION.md`
2. `docs/frontend-layout-nav-refactor.md`
3. `CLAUDE.md` — especially "Overlays must never own browser history"

## Project rules

- `CLAUDE.md` is authoritative for frontend architecture, navigation, testing, and working rules.
- `api/CLAUDE.md` is authoritative for backend work under `api/` and `server/`.

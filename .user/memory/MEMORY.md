# Project memory

- Branch: `main`; awaiting verification of the customer package invoice deployment in Vercel.

## Branches in flight

- **`feat/live-order-helper`** — read-only helper branch retained without a worktree; 260 behind `main`, keep only the two source files if it is ever revived. Details: `.user/memory/feat-live-order-helper.md`.
- **`feat/invoice-form-overlay`** — design-only work (invoice create as a form overlay with swipeable line cards), 1 commit ahead of `main`; kept by owner, not for merge yet.
- **`feat/package-credit`** — monthly-subscription package credits, phases 1–4 built, awaiting owner test on Preview. Details on that branch: `.user/memory/feat-package-credit.md`.

## Pending work

- **Staff KPI (WorkTransactions / WorkRates, merged 2026-10-04)**
  - Browser-check the staff profile page `/staff/:staffId` (Day date strip, Week leaderboard); only unit-tested.
  - Accepted risk: two simultaneous completions of one ticket can write two EARNs; correct with a VOID row.
  - Before KPI drives pay: server must take the actor from the token, not the client body.
  - Future: supervisor-created tickets with custom `work_minutes`; Month view; Attendance for efficiency %.
  - Design canvas for the profile: claude.ai/artifact/NACQydNrsqjzx31RrK6tsX.

- Phone-check a form's close X sits top-right with no white strip (CloseButton position fix, pushed 2026-09-28).
- Package detail hero card: low-credit badge threshold (20%) was Claude's pick, not confirmed by user.
- Package Add transaction form (phase 1): browser-check each type; voiding a past credit-add can still drive the balance negative.
- Package transfer phase 2 not built: server must write paired −N/+N rows for same-customer packages and define partial-failure handling; the form's Transfer UI exists but Save is disabled.
- Packages: cards show the raw service code (`WSIR`) not the Thai label; package form service picker not browser-checked; retired `appscript/MagicwashPortal/CustomerPackageView*` files and the live `CustomerPackageView` sheet await owner's delete decision.
- `appointment.store.dry-test.ts` fails (2 vs 1) and already failed at `3afaac2`; cause not investigated.
- **Customer detail and visual system** (merged 2026-09-27)
  - Browser-verify create dropdowns open, order swipe "Order detail", and appointment date order; the ui-shots run failed to capture these.
  - Pill shows `0 PACKAGES` while the list is still loading.
  - Order rows show `—` as line 2 when there is no note; long invoice numbers truncate (`INV20260905-41f3…`).
  - Package names are long in the `Packages` sheet itself; user to choose renaming them there or showing `packageCode`.
  - Browser-check customer detail `BottomNavBar` on a phone: floating lime sticker + pop animation, custom section icons, `pb-14` list clearance.
  - Order detail Approve is now `OrderApproveButton` (sticker FAB); only the quantity-mismatch disable shows a reason.
  - Phone-check the push drawer (open, drag-close, Back) and swipe cards no longer moving on scroll.
  - Deferred by user: the push drawer's rounded corner sits below the iOS status bar because status-bar-style `black` keeps the page under it; reaching the top edge needs `black-translucent` plus a new height fix.
  - Browser-check `CloseButton` onDark sticker style (lime outline squircle, solid lime + offset shadow when active) on header (menu, back, pending with badge) and the 6 dark-overlay X buttons; hover/focus pop animation; also check every shared `CloseButton` placement (forms, sheets, pickers, nav, scanners, invoice proof lightbox).
  - Browser-check the palette move (mint/tertiary removed, info = steel blue) and `BaseBadge` sm/lg sizes on order hero card, scanner, form controls.

- **Garment tracking and job tickets**
  - Scan FAB sits below the screen edge on some phones; cause unknown, awaiting the user's device/browser details.
  - Overlapping order Start notices share one page-notice slot; the later replaces the earlier.
  - `/api/job-tickets/scan` and its service have no caller since batch advance; delete in a later pass.
  - `AdvanceConfirmDialog` raises `#overlay-root` z-index while open; replace once a shared confirm dialog exists.
  - Decide the order status sequence before any swipe-to-advance work.
  - Persist tag ids at print time and add a single-tag reprint flow before real use.
  - Department page reload policy undecided (on return, on app focus, interval, or a refresh button); KeepAlive keeps it stale now.
  - Department ring under-counts orders with earlier completions; board endpoint decided, not built. See `.user/memory/department-board-load.md`.
  - Browser-verify the ring head following the arc when a ticket status changes (tap or Start).
  - Browser-check department pages after dropping the per-order detail fetch and parallelising the status loads (pushed 2026-09-28).
  - Ticket `due_date` goes stale when an order's due date is edited; order update does not rewrite existing tickets.
  - Completed tab reads 500 rows and keeps only today's; a `completedFrom` API filter was proposed, not built.
  - Per-department ticket cache (show stored list, refresh in background) proposed, not built.
  - Tablet layout for the department page (2–3 order columns) deferred by user; needs an opt-in wide route flag in `App.vue`.
  - Deferred backend: worklist read (not-done + done-today, cap 2000) and cancel timestamps.
  - Phone Back closes garment registration while uploads are pending; blocking it not decided.
  - Decide whether to remove the old BEF album add-photo path now that registration is proven.
  - Physical QR labels: real-print scan test pending; consider print DENSITY and larger QR cells.
  - Logistics and ORDER-scoped tickets are not built.
  - GViz types a whole column by majority: numeric legacy tags in JobTickets/LaundryPhotos make base62 tags read as null; user is clearing the numeric rows (frontend now tolerates both).

- **Forms and navigation**
  - Remove dead CSS `.invoice-line-select` in `InvoiceLineItemsEditor.vue`.
  - Pre-existing defect: some forms `push` on exit, so Back re-opens the form after save. See `.user/memory/form-exit-history.md`.
  - Browser-verify the form-routes refactor (merged untested in a browser); unticked to-dos in `docs/plans/form-routes.md`.

- **Order detail UI**
  - Phone-test `PhotoViewer` (merged 2026-09-27 on order detail, gallery, photo library): pinch/double-tap zoom, pan while zoomed, swipe-down close, thumbnail strip, safe areas.
  - Browser-check gallery "ย้ายไปรายการอื่น": the item picker must open above `PhotoViewer`.
  - Deferred by user: close X inside the photo corner (needs a dark disc).
  - Phone-test the order photo library: long-press drag-select, edge auto-scroll, glass refraction (now on Select too), black glass labels, lime selected-tab contrast, and single-request Move to item.
  - Phone-test Register garments without an item, then assigning those photos from the library.
  - Bulk photo reassign (one all-or-nothing request) is pushed but not browser-verified end to end.
  - 31 legacy photo ids were stored as numbers by Sheets (user: leave them); a bulk move including one returns 500 although the write lands.
  - Deferred: shared `LiquidGlass` component + `provideGlassBackdrop`; lens code lives in `features/orders` for now.
  - Decide whether the Items menu "Garment album" is retired in favour of the photo library.
  - Quantity-mismatch approval guard is frontend-only by user decision; the API still accepts APPROVED on mismatch.
  - `OrderDetailSheet.vue` re-implements the item row and the store's load/sequence logic instead of reusing `OrderItemRow` and `useWorkOrderStore`.
  - Order-detail header is taller than the sheet's; the menu button footprint was reduced but the result is unverified in a browser.
  - `orderImageTypeLabels` and `serviceTypeLabel` still return Thai on the now-English order-detail page; decide whether shared labels follow.
  - Order-item unit removal is not browser-verified: check the add-item form and that invoice seeding still shows `kg` for wash-dry-fold.
  - `docs/features/orders/` widely still says orders are unimplemented or blocked on `/api/orders`: `flows.md`, `screens.md`, `overview.md`, `data-model.md`, `forms/create-order-item.md`, `contracts/work-order.md`, `list-response-fields.md`.
  - `OrderDetailPage.vue` holds its whole template on one physical line, so diffs there carry no signal.
  - Browser-verify the hero pcs/kg cell and that WEIGHT capture closes the camera after one photo.
  - Total weight counts only `imageType` exactly `WEIGHT`; legacy spellings on old rows are not summed.
  - Order list shows pcs only; user declined adding weight there (would need `totalWeightKg` on the work-order list).
  - Browser-verify the customer order sheet's Items actions dropdown (replaced the four big buttons and the collapse chevron).

- **Images and gallery**
  - Document scanner: phone-check no camera flash after "Use this photo"; accept takes ~1 s (enhance in a worker only if staff complain); first ~2 s of detection often misses.
  - Backfill `Cache-Control` on existing photos after Firebase bucket credentials are available. See `docs/plans/image-pipeline.md`.
  - Fix gallery `created_by`: it is read only from `?by=`, and the frontend fallback can fail silently.
  - Deferred: preloading the image files themselves on order detail; only photo metadata is prefetched. Decide once photo counts per order are known.
  - Move `usePhotoUpload.js` into the gallery feature and decide where legacy photo capture belongs.
  - Do not re-propose lazy-loading the gallery route: staff open it on nearly every order.
  - Audit and update gallery-read documentation in `docs/architecture/frontend/feature-structure.md`, `docs/features/orders/overview.md`, and `docs/features/orders/forms/create-order-image.md`.

- **Cache, API, and performance**
  - Price-list store keeps written rows over reads until a read matches every field; watch for rows sticking if GViz formats differ.
  - On hold: durable e2e suite in `tests/e2e/` with page objects; test IDs live in tests, derived from docs.
  - Wire `onFresh` at remaining call sites; first correct the stale cache-plan claim that no caller uses it.
  - Reduce page-load latency, in this order: `App.vue:8` (prefetches appointments on every mount), then HTTP cache headers on `/api/*`. Measured 2026-09-08: GViz 0.49s · prod warm 0.82s · prod cold 1.65s. Fewer reads beats smaller ones.
  - Customers are fetched in full on purpose (real customers are under a thousand); `listCustomers` caps at 2000 and sets `truncated`. Do not add a customers pager.
  - `GVizQueryBuilder` supports only equality-AND; no `IN`/`OR`. Any feature needing a multi-id read must adapt in its own layer, not widen the shared builder.
  - Portal: webapp-react still reads the Portal views; switch it to `GET /api/portal/customers/:id`, then retire the Apps Script view sync.
  - Owner: deploy the `MagicwashAppointment` `now()` fix with clasp; decide the 5 Portal-only invoices and 4 day/month-swapped `Appointments.CreatedAt` rows.
  - Normalize GViz `Date(...)` values reaching photo modules according to `docs/conventions/datetime.md`.
  - Consolidate datetime helpers in a dedicated pass; `SheetRepository` is shared by every module.
  - App-wide GViz read normalization is deferred by the user; do not start or re-propose it. See `.user/memory/gviz-read-normalization.md`.

- **Prices, invoices, and sheet data**
  - Resolve concurrent item-code allocation before production use.
  - Defer mixed-service orders to a separate branch after the price-list photo release; see `.user/memory/mixed-service-orders.md`.
  - Fill real prices for the 33 inactive price-list rows with `price: 0`.
  - Add a `BaseSwipeCard` action to add a price to an existing item.
  - No Items edit UI exists; `PATCH /api/items/:id` is implemented and tested but unreachable from the app.
  - Decide between `CANCELLED` and `VOID` before changing the invoice contract.
  - Decide whether to renumber the four legacy uuid-shaped invoice numbers; they are referenced as `invoiceId` on customer-package rows.
  - Confirm `OVERDUE` outranks `PARTIALLY_PAID` in derived invoice status.
  - Browser-verify payment review (verify and reject) on a real PENDING slip; only Record payment was user-tested.
  - Customer-package pager is still deferred; `okPaged` carries no total, invoices use `paginatedBody`.
  - Clean sheet data: the blank customer row, dirty Orders rows, LaundryPhotos ordering, and page-walks using non-unique sort keys.
- **Customers and registration**
  - Browser-check forms using the restyled `FormTextarea` and rounded `FormOverlay` body; the helper text keeps a stray bullet dot.
  - Customers PATCH is advertised but the sheet disallows update; no tests for the POST route response or an empty label pool.
  - Deferred by user: duplicate-phone check misses legacy phones without a leading 0; map picker (Leaflet + Nominatim/Longdo), location field hidden until then.
  - Dirty data, fix undecided: Customers has 1 blank and 19 duplicated `CustomerIndex`; CustomerIDMapping lacks 302 customers, has 5 orphan ids and 2 ids mangled to `2.50E+33`/`2.63E+53`.
  - `frontend-data-boundaries.dry-test.ts` fails on `main`: `InvoicePaymentFormPage.vue` imports `shared/api/firebase-storage`.
  - `column-order.dry-test.ts` fails on `main`: it expects `update: false` for OrderItemForms/OrderImages writes.

- **Auth, UX, and documentation**
  - Google sign-in fails on prod right after the button tap; error now shows the Firebase code, awaiting the user's reading.
  - Sign-in still optional outside `auth`/`staff`; open: page/API gating, Storage rules; Preview hosts not Firebase Authorized domains.
  - Server-owned invoice and payment writes still record `'admin'` (`server/shared/config/actor.ts`); deferred by owner, needs client actor or token gating.
  - No screen shows actors by name yet; use `useStaffStore().nameOf(id)` when work-history screens are built.
  - 5 server dry-tests reported failing (invoice workflows x2, sheet metadata x2, order-item contract export); not checked against pre-auth `main`.
  - Fix screenshot-upload accessibility states, failed-upload handling, and staff-safe Firebase errors.
  - Align the customer-packages form with `docs/design/patterns/forms.md`.
  - Fix `docs/conventions/naming.md`: composables are kebab-case, not `usePascalCase.ts`.
  - Consolidate frontend helpers into `src/shared/utils/`; strays include `src/shared/appointment-pending-count.ts` and `src/utils/imageCompression.js`. User deferred this to its own pass.
  - Remove schema-file `z.infer` exports in a dedicated all-contract pass.
  - Migrate remaining local-state overlays: `OrderGalleryPage.vue`, `InvoiceProofLightbox.vue`, `NavSidebar.vue`.
  - Unnest the remove `<button>` at `OrderGalleryPage.vue:402` from the lightbox `<button>` at `:375` — verified as the only nested pair; the other two files have none.
  - Update list-page documentation that still describes deleted header search (`SEARCHABLE_ROUTES` / `meta.searchable`).
  - Fix 2 real defects in `persistent-cache.ts` and 12 source comments that contradict the code. See `.user/memory/stale-comments-and-defects.md`.
  - Resume held comment-cleanup decisions after a canonical cache convention exists; verify each finding before acting. See `.user/memory/doc-comment-docs-work.md`.

- **Verification and cleanup**
  - Browser-verify appointment creation without a customer location in Preview.
  - `src/features/orders/utils/order-price-list-items.ts` has no caller since Orders moved to Items, but keeps a unit test; decide whether to delete both.
  - `output/price-list-images/generated/*.jpg` are committed generated artifacts; decide whether they belong in the repo or `.gitignore`.
  - Two allowlisted cross-feature imports remain (`PriceListItemPicker` in invoices and orders), UI that knows domain fields, with no legal home under the current rule. Accepted for now; reopen only when a third feature needs it.
  - Placement rule settled 2026-09-16: UI folders (`src/shared/components`, `layouts`) stay generic and must not know domain fields; non-UI folders under `src/shared/` may hold cross-feature business rules. Rejected and not to be re-proposed: `src/shared/components/<domain>/`, a new `src/ui/<domain>/` layer, and moving the per-feature status-presentation modules to `src/shared/utils/`.
  - Appointment date strip opens at day 1 instead of centering today; a `scrollTo` attempt hid the strip, so diagnose in a real browser first.
  - `ListContainer` collapsible header is a non-focusable `div` without `aria-expanded`; schedule slots now start collapsed when empty.
  - Phone-test ISS-72adcdca: a cache-hit customer-row tap must open only customer detail, while the swipe action still fires.
  - Browser-check ListContainer search, theme consistency, and the order-detail dropdown at the bottom edge.
  - Delete `docs/plans/scroll-region.md` and `docs/plans/overlay-frame.md` once unreferenced (`LightboxOverlay` is gone).
  - Delete sheet test data: `Items` `ITM-0099` / `2e6b91d2`; `OrderForm` `246fde2b`, `cc4d375e`, `f68ae08d`; `LaundryPhotos` `QK0H9DT1`, `a260b2b1`, `1b7649ba`; `AfterPhoto` `0aacd052`.
  - Browser-check the appointment card status badge now sitting in the top-end slot on both the schedule and pending pages.
  - Browser-check swipe cards now opening 4rem per action (`leftActions`/`rightActions`), incl. the AppointmentCard "Swipe to …" label in 4rem.
  - User kept New Order, Schedule Pickup, New Package and Create Invoice on customer detail as per-tab dropdowns (2026-09-27); Book Delivery and package usage in the order sheet still undecided.

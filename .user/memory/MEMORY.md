# Project memory

## Where we are — 2026-08-20

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

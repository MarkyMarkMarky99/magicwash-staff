# Project memory

## Where we are — 2026-08-19

- **Branch:** `overlay-shell` — pushed, not merged into `main`; production is unchanged.
- **Current workstream:** frontend layout/navigation refactor (`docs/frontend-layout-nav-refactor.md`).
- **Just finished:** Stage 3. The order detail sheet is route-driven with `?order=<id>`.
- **Preview:** `https://magicwash-staff-b75ldpkzm-magicwashth-8243s-projects.vercel.app`

## Price list (worktree `webapp-vue-pricelist`, branch `codex/pricelist-contracts`)

- Built overnight 2026-08-19. Page live at `#/price-list`, nav entry `รายการราคา`, 76 real rows.
- Create and edit forms built; backend create/update enabled; **no delete, by instruction**.
- **Blocked:** share the PriceList sheet with `magicwash-staff-writer@magicwashlaundry-a50ca.iam.gserviceaccount.com` as Editor. Writes return 500 wrapping a Google 403 until then. No code change needed after.
- Also pending: add `PRICE_LIST_SPREADSHEET_ID` to Vercel env; remove the stray empty Vercel project `webapp-vue-pricelist`.
- Full detail, decisions and traps: `webapp-vue-pricelist/NEXT-SESSION.md`.

## Waiting on the user

- [ ] Test the preview on a real phone: drag-to-close, scrolling inside the sheet, Android Back, and iOS edge-swipe.
- [ ] Decide whether to merge `overlay-shell` or continue iterating on it.

## Next

- [ ] Add API authentication before launch.
- [ ] Pass actor identity into repository writes for an audit trail.
- [ ] Implement API-mediated photo upload and customer writes.
- [ ] Stage 4: migrate remaining overlays and forms; use `useOrderSheetRoute.ts` as the pattern.

## Follow-ups

- [ ] Confirm `CUSTOMERS_SPREADSHEET_ID` is set in every Vercel environment.
- [ ] Confirm the two `VITE_*` spreadsheet IDs are unused, then remove them.
- [ ] Review the pre-existing nested `<button>` in `OrderGalleryPage.vue` (~line 255).

## Resume reading

1. `NEXT-SESSION.md`
2. `docs/frontend-layout-nav-refactor.md`
3. `CLAUDE.md` — especially “Overlays must never own browser history”

## Project rules

- `CLAUDE.md` is authoritative for frontend architecture, navigation, testing, and working rules.
- `api/CLAUDE.md` is authoritative for backend work under `api/` and `server/`.

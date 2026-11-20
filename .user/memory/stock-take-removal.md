# Stock-take removal

Owner asked (2026-11-20) for stock-take to stay temporary and be removable on request.

- Find the commit: `git log --oneline --grep "feat(stock-take): temporary stock-take mode"`.
- Make sure no `StockTakes` row is OPEN or CLOSED first.
- `git revert <commit>`; fix conflicts by keeping later code and dropping only stock-take lines.
- Touch points outside the stock-take folders: freeze guard calls in job-ticket, bag-item, laundry-photo,
  order-garment, order-image, order-intake, packaging-bag and work-order modules; appointment.service
  order-closing guard; `guards` option in `server/shared/http/crud-routes.ts`; `STOCK_TAKE_ACTIVE` error code;
  DepartmentWorkPage pause notice; router + NavSidebar entry; docs links.
- `SheetRepository.readFresh()` and `shared/utils/scan-code.ts` / `garment-tag-id.ts` (moved from `src/`)
  may now have other callers; check before reverting those parts.
- Sheets: tabs `StockTakes` and `StockTakeEntries` (JobTickets workbook) and their G Drive registry JSONs
  can stay or be deleted by the owner.

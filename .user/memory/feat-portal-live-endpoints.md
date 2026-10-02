# feat/portal-live-endpoints

## Status
- `GET /api/portal/orders` and `GET /api/portal/invoices` port `appscript/MagicwashPortal/Update.js` and `InvoiceViewSync.js` per request.
- Output shape = webapp-react `/api/gviz?source=ordersView|invoiceView`; parity script: `tests/server/integration/portal-script-parity.ts`.
- Verified 2026-10-03: orders 4865/4866 identical to Portal (1 stale row); all diffs traced to Portal staleness.
- No auth on the portal routes, by user decision for now.

## Invoice restore (done 2026-10-03)
- 151 invoices missing from Invoices were restored from the Firestore export via `scripts/one-off/restore-firebase-invoices*.ts`.
- Not restored by Claude's call: 5 Portal-only invoices (3 `INV20260915-…`, `INV260991217412`, `INV260782948891`); rerun with `--include-portal-only` if the owner confirms they are real.
- Source data conflicts kept as-is: `INV260440375689` overpaid 30, `INV260747972537` total now 360.

## Next
- Switch webapp-react from `/api/gviz` Portal sources to the new endpoints, then retire the Apps Script view sync.
- Check whether app-written Payments `reference` values lose digits (USER_ENTERED, no text guard).

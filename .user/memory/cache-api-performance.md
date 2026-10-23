# Cache, API, and performance — pending

- Agreed, not started (big job): app-wide write outbox in `src/shared/api/` (IndexedDB, auto-flush, retry) for deferrable writes; GETs and must-answer writes stay direct.
- Outbox next step: write `docs/plans/write-outbox.md` with an endpoint table; every queued endpoint must be replay-safe (client ids; key for ticket/EARN), per-order ordering.
- Watch price-list rows sticking if GViz formats differ (store keeps written rows until a read matches every field).
- On hold: durable e2e suite in `tests/e2e/` with page objects; test IDs live in tests, derived from docs.
- Reduce page-load latency: authenticated `App.vue` prefetch first, then HTTP cache headers on `/api/*`.
- Portal: webapp-react still reads the Portal views; switch it to `GET /api/portal/customers/:id`, then retire the Apps Script view sync.
- Owner: deploy the `MagicwashAppointment` `now()` fix with clasp; decide the 5 Portal-only invoices and 4 day/month-swapped `Appointments.CreatedAt` rows.
- Normalize GViz `Date(...)` values reaching photo modules according to `docs/conventions/datetime.md`.
- Consolidate datetime helpers in a dedicated pass; `SheetRepository` is shared by every module.
- App-wide GViz read normalization is deferred by the user; do not start or re-propose it. See `.user/memory/gviz-read-normalization.md`.

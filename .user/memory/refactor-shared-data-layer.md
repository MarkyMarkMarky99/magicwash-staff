# refactor/shared-data-layer

- Goal: move frontend table-data access into `src/data/<resource>/`; features are workflows that consume it.
- Rules: `docs/architecture/frontend/project-structure.md` (Data Layer) and `feature-structure.md`.
- Round 1 (migration): move only; keep request URLs, query params, filtering, and cache timing unchanged.
- Round 2 (later): dedupe queries to share cache, reactive shared stores, invalidation gaps, 2000-row customer cap.
- Open decisions: keep `/api/orders` for customer history or switch to `/api/work-orders`; keep customer list in localStorage or memory only.
- Stale path refs to update during migration: `naming.md`, `docs/features/orders/contracts/order.md`, `feature-structure.md` gallery paragraph and `audit_sources`.

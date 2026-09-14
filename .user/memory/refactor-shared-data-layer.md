# refactor/shared-data-layer

- Goal: move frontend table-data access into `src/data/<resource>/`; features are workflows that consume it.
- Rules: `docs/architecture/frontend/project-structure.md` (Data Layer) and `feature-structure.md`.
- Round 1 (migration): move only; keep request URLs, query params, filtering, and cache timing unchanged.
- Round 2 (later): dedupe queries to share cache, reactive shared stores, invalidation gaps, 2000-row customer cap.
- Open decisions: keep `/api/orders` for customer history or switch to `/api/work-orders`; keep customer list in localStorage or memory only.
- Round 1 committed: services and cross-feature table stores live in `src/data/`; guardrail `tests/web/unit/architecture/frontend-data-boundaries.dry-test.ts`.
- Workflow stores stay in features (e.g. `customer-package-purchase.store`), allowlisted in the guardrail when another feature uses them.
- Browser-verified by the user 2026-09-14: invoice create, order add-item, customer detail tabs, customer packages, gallery reassign.
- Next: merge to main; round 2 not started.
- Idea on hold: durable e2e suite in `tests/e2e/` with page objects and test IDs derived from docs (IDs live in tests, not docs).
- `feature-structure.md` gallery paragraph still describes the pre-migration service path.

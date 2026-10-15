# feat/repository-read-raw

- Owner design 2026-10-15: `readRaw(query)` is the single GViz read path; `read(DTO)` builds then calls it; `queryBuilder()` gives `col`/`lit` so services never see column letters.
- Job-ticket advance: three status reads became one `readRaw` per 50 orders (explicit 3-status OR, not `!= Completed`).
- Known red: `npm run typecheck:api` fails only in test fakes typed as the full `SheetRepositoryContract`; owner chose to fix in a refactor, not here.
- NEXT (owner-approved): explore every service/test that types a dependency as the whole contract, then implement so each declares only the methods it calls.
- `tests/server/unit/modules/after-photos/after-photo-reassign.dry-test.ts` was write-denied to Codex (Errno 13); check before the refactor.
- `invoice-sheets-api.workflow.dry-test.ts` fails on main too (validation_error); not caused by this branch.

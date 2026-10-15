# feat/repository-read-raw

- Owner design 2026-10-15: `readRaw(query)` is the single GViz read path; `read(DTO)` builds then calls it; `queryBuilder()` gives `col`/`lit` so services never see column letters.
- Job-ticket advance: three status reads became one `readRaw` per 50 orders (explicit 3-status OR, not `!= Completed`).
- Narrow-repository refactor done: services/wrappers/test fakes declare `Pick` of the methods they call; typecheck:api is green.
- Test-only wrapper delegations removed (owner said delete); wrappers expose only what production calls.
- Not merged; not deployed. `invoice-sheets-api.workflow.dry-test.ts` fails on main too (validation_error).

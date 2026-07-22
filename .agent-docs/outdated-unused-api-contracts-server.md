# Outdated / Unused Files — `api/`, `contracts/`, `server/`

**Date:** 2026-07-22  
**Scope:** Inventory of legacy runtime code, completed plan docs, orphaned symbols, and cleanup risks  
**Method:** Import/reference scan across the repository, current API entrypoints, Git history, and `npm run typecheck:api`  
**Important limitation:** A repository scan cannot prove that a Vercel endpoint has no external traffic. Runtime routes are therefore classified separately.

---

## Decision labels

- **SAFE TO DELETE NOW:** No current runtime import or internal consumer was found. Deleting it does not remove an active application path. Reference-only files may require comment/document cleanup.
- **DELETE ONLY AFTER EXTERNAL-CLIENT CHECK:** No in-repo caller was found, but the file is a public serverless route or a dependency of one. Check Vercel traffic and external integrations first.
- **DO NOT DELETE YET:** Still used by the current stack, provides test coverage, or needs a code migration before removal.

## Summary

| Area | Finding |
|------|---------|
| **Orphaned/reference-only files** | **SAFE TO DELETE NOW** — 8 files listed in Sections 1 and 3 |
| **Legacy GViz/write bridge** | **DELETE ONLY AFTER EXTERNAL-CLIENT CHECK** — 12 files listed in Section 2 |
| **`contracts/` and current backend** | **DO NOT DELETE YET** — active consumers remain |
| **Pagination** | Old and new shapes coexist; migrate before deleting old schemas |
| **Docs drift** | `api/CLAUDE.md` still documents paths that were already deleted |

---

## 1. SAFE TO DELETE NOW — internal repository cleanup

These files have no active runtime consumer in this repository:

| File | Evidence | Cleanup note |
|------|----------|--------------|
| `server/shared/utils/id.ts` | `generateId()` has zero import/reference sites | Standalone unused utility |
| `server/shared/repositories/base.contract.ts` | Reference-only contract; live implementation is `base.repository.ts`; no current runtime/test import | Update the stale `base.repository.ts` reference comment if removed |
| `server/shared/repositories/gsheet.contract.ts` | Reference-only contract; live implementation is `gsheet.repository.ts`; no current runtime/test import | Update the stale `gsheet.repository.ts` reference comment if removed. It was intentionally retained as a design reference in an earlier refactor, so archive instead if that reference is still useful |
| `server/shared/services/base-crud.service.dry-test-explained.html` | Not imported, built, or referenced by a runtime path | Human-readable test explanation only |
| `api/REFACTOR_PLAN.md` | Historical repository-refactor plan; target stack is implemented | Archive or delete; Git history retains prior content |
| `server/modules/customers/MIGRATION_PLAN.md` | Customer module already uses `BaseCrudService` + `GSheetRepository`; document still names deleted `sheet-crud` / `google-sheets` paths | Archive or delete |
| `server/modules/customers/READ_QUERY_BUILDER_REFACTOR_PLAN.md` | `ReadQueryDTO.fromQuery()` is already implemented in `server/shared/dtos/read-query.dto.ts` | Archive or delete |
| `server/shared/services/SERVICE_REFACTOR_PLAN.md` | `BaseCrudService` and `okPaged` are implemented; document describes the completed migration | Archive or delete |

Deleting the two reference-contract files is runtime-safe, but remove or rewrite the `Reference design: ...` comments in the live repository files in the same cleanup.

---

## 2. DELETE ONLY AFTER EXTERNAL-CLIENT CHECK — legacy runtime group

No frontend or current module calls these paths. However, files under `api/` are public Vercel entrypoints and may be called directly by external clients.

### Routes

| File | Role | Evidence of obsolescence |
|------|------|--------------------|
| `api/gviz.js` | Generic GViz proxy (`source` + `tq`) | No `/api/gviz` call in `src/`, `public/`, or current backend modules; replaced by direct frontend GViz usage and `GSheetRepository` / `gviz-reader` |
| `api/write.js` | Generic Apps Script write proxy | No `/api/write` call in the repository; uses old split `APPSCRIPT_CUSTOMER_URL` / `APPSCRIPT_APPOINTMENT_URL` instead of the module stack's shared `APPSCRIPT_URL` |

### Support tree used only by `api/gviz.js`

```
server/gviz/
  gviz-utils.js
  schemas/
    appointments.js
    customers.js
    orderItems.js
    ordersView.js
    orderForm.js
    orderItemForms.js
    laundryItems.js
    laundryPhotos.js
    orders.js
```

Column maps for customers / appointments / orders are superseded by `*.contract.ts` + `contracts/<feature>/*-api.schema.ts`.

The precise dependency relationship is:

```text
api/gviz.js
  → server/gviz/gviz-utils.js
    → server/gviz/schemas/*.js
```

Therefore `server/gviz/` is not literally consumer-free: its only in-repo consumer is the legacy `api/gviz.js` route. It has no current frontend/module consumer.

### Replacement map

| Legacy | Current |
|--------|---------|
| `api/gviz.js` + `server/gviz/*` | FE direct GViz **or** `GSheetRepository` / `gviz-reader` |
| `api/write.js` | FE `gateway.js` **or** module `APPSCRIPT_URL` writes |
| `server/gviz/schemas/*.js` column maps | `server/modules/<m>/<m>.contract.ts` + API contracts |

### Required external checks before deleting this group

1. Check Vercel access logs for `/api/gviz` and `/api/write` over a representative period.
2. Search deployed frontend builds, partner integrations, scripts, and bookmarks for those URLs.
3. Confirm no Apps Script, scheduled job, or external client depends on the old split write-proxy environment variables.
4. If traffic exists, migrate the caller to `/api/customers`, `/api/appointments`, or `/api/orders` before removal.

---

## 3. SAFE TO DELETE NOW — plan / migration docs

| File | Why outdated |
|------|----------------|
| `api/REFACTOR_PLAN.md` | Target repository stack already exists (`BaseRepository`, `GSheetRepository`, transformers, etc.) |
| `server/modules/customers/MIGRATION_PLAN.md` | `customer.module.ts` already uses `BaseCrudService` + `GSheetRepository`. Still names `sheet-crud` / `google-sheets` (deleted) |
| `server/modules/customers/READ_QUERY_BUILDER_REFACTOR_PLAN.md` | `ReadQueryDTO.fromQuery()` already lives in `server/shared/dtos/read-query.dto.ts` |
| `server/shared/services/SERVICE_REFACTOR_PLAN.md` | `BaseCrudService` implemented; recommends `okPaged` over `okPaginated` (routes already use `okPaged`) |

---

## 4. Non-runtime artifacts and tests

| File | Notes |
|------|--------|
| `server/shared/services/base-crud.service.dry-test-explained.html` | Thai HTML explanation of dry tests — not imported, not built |
| `server/shared/repositories/base-primary-key.temp-test.ts` | Manual regression test; not wired in `package.json` scripts, but still useful coverage |

`base-crud.service.dry-test-explained.html` is safe to delete as a non-runtime artifact. Do **not** delete `base-primary-key.temp-test.ts` solely because it is not in npm scripts; it is a manual `BaseRepository` id-behavior regression test.

Keep `*.dry-test.ts`, `*.type-test.ts`, and `*.test.ts` under `server/` unless their coverage is deliberately moved elsewhere.

---

## 5. Dead symbols and contract drift — code cleanup, not file deletion

| Symbol | Location | Notes |
|--------|----------|--------|
| `okPaginated()` | `server/shared/http/response.ts` | **Zero call sites** — all list routes use `okPaged`; safe to remove as a symbol after checking external imports |
| `ApiPaginationMeta`, `ApiPaginatedResponse<TItem>`, `paginatedBody()` | `server/shared/http/response.ts` | Only support `okPaginated()`; remove with that symbol |
| `apiPaginationMetaSchema` / `apiPaginatedSchema` | `contracts/shared/api.schema.ts` | Still referenced by `response.ts` and `src/shared/api/api-client.ts`; do not remove yet |

### Pagination contract drift

The old and new pagination shapes coexist:

- `apiPaginationMetaSchema` / `apiPaginatedSchema`: `{ total, page, perPage, totalPages }`
- `apiPageMetaSchema` / `okPaged`: `{ page, perPage }`

`src/shared/api/api-client.ts` still types `ListResult.pagination` with `apiPaginationMetaSchema`, while current routes return `okPaged()`. Decide whether totals are part of the API contract, align backend and frontend, then remove the unused schema/helper symbols.

---

## 6. Documentation drift and already-deleted paths

| Referenced in docs | Reality |
|--------------------|---------|
| `server/shared/sheet-crud/` | **Gone** |
| `server/shared/google-sheets/` | **Gone** |
| `api/customers.js` (legacy flat route) | **Gone** — replaced by `api/customers/index.ts` + `[id].ts` |

Primary stale source: **`api/CLAUDE.md`**. It still describes legacy routes, `sheet-crud`, `google-sheets`, `ResourceRepository`, and `okPaginated()` as part of the primary flow. Update this file; do not delete it.

---

## 7. `contracts/` — clean file set

All contract files are imported by BE and/or FE:

| File | Consumers |
|------|-----------|
| `contracts/customers/customer-api.schema.ts` | BE module + FE services/stores |
| `contracts/appointments/appointment-api.schema.ts` | BE module |
| `contracts/orders/order-api.schema.ts` | BE module |
| `contracts/shared/api.schema.ts` | BE http + FE api-client |
| `contracts/shared/module-api-contract.ts` | BE contracts/services |

No whole-file orphans under `contracts/`. Only the dual pagination schemas (Section 5) need eventual consolidation.

---

## 8. Additional findings outside the requested cleanup set

`src/features/invoices/services/invoice.service.ts` still calls `/api/modules/invoices`, but no matching `api/modules/invoices` route exists in this repository. This is an application/API gap, not proof that the invoice service file is unused; the invoices UI imports it. Decide separately whether to implement the endpoint, change the service, or remove the invoice feature.

---

## Recommended cleanup order

### A. Internal safe cleanup
1. Remove or archive the 8 files listed in Sections 1 and 3.
2. If removing `base.contract.ts` / `gsheet.contract.ts`, update the two live `Reference design: ...` comments.
3. Remove `base-crud.service.dry-test-explained.html` if the HTML explanation is no longer needed.
4. Run `npm run typecheck:api` and the manual dry/type tests.

### B. Legacy runtime removal after external check
5. Check Vercel logs and external integrations for `/api/gviz` and `/api/write`.
6. If unused externally, remove `api/gviz.js`, `api/write.js`, and the complete `server/gviz/` tree together.
7. Verify the Vercel function count and current customers, appointments, and orders routes.

### C. Follow-up code/docs cleanup
8. Resolve pagination contract drift.
9. Remove `okPaginated()` and old pagination schemas only after migration.
10. Refresh `api/CLAUDE.md`.

### D. Do not delete
- All of `contracts/*` (active)
- `server/modules/*` active modules
- Core `server/shared/repositories/*`, `services/base-crud.service.ts`, http layer
- New routes: `api/customers|appointments|orders/*`
- `server/shared/repositories/base-primary-key.temp-test.ts` unless its coverage is moved

### Suggested PR split
1. **PR1:** internal safe cleanup and plan-doc archival
2. **PR2:** remove legacy GViz/write stack after external-client confirmation
3. **PR3:** pagination migration, dead helper removal, and `api/CLAUDE.md` sync

---

**Current verification:** `npm run typecheck:api` passes. No application code or runtime files were deleted by this audit.

---

## Active stack (for contrast)

```
api/<feature>/index.ts | [id].ts
  → server/modules/<m>/<m>.module.ts  (BaseCrudService + GSheetRepository)
  → server/modules/<m>/<m>.contract.ts
  → contracts/<m>/<m>-api.schema.ts
  → server/shared/repositories/* + services/base-crud.service.ts + http/*
```

Migrated modules today: **customers**, **appointments**, **orders**.

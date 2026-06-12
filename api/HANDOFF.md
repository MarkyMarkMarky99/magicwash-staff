# HANDOFF — API structure

## 2026-06-13 — Helpers moved out of `api/` (Vercel 12-function fix)

Helper code was relocated so Vercel stops counting it as serverless functions
(Hobby cap = 12). Full plan + review trail: `api/PLAN.md`.

| from (under `api/`) | to |
|---|---|
| `api/shared/**` | `server/shared/**` |
| `api/modules/appointments` | `server/modules/appointments` (db-schema flattened out of `types/`) |
| `api/modules/invoices` | `server/modules/invoices` (**moved as-is** — see below) |
| `api/modules/<f>/types/<f>-api.schema.ts` | `contracts/<f>/<f>-api.schema.ts` (now FE↔BE shared) |
| `api/schemas/*.js` + `api/_gviz.js` | `server/gviz/{schemas,gviz-utils.js}` |
| `API_PAGINATION_DEFAULTS` | `contracts/shared/pagination.ts` (re-exported by `server/shared/types/api-request.types.ts`) |

Result: `api/` = **10 route files = 10 functions** (verified locally with
`vercel build` → 10 `.func` in `.vercel/output`). Backend imports are relative;
`@contracts/*` alias is frontend-only. Typecheck: `npm run typecheck:api` (its
`api/tsconfig.json` now also includes `../server` + `../contracts`).

## Pending / guards

- **invoices module is MOVED AS-IS, pending a full refactor.** Internal layout is
  temporary (header comment on `server/modules/invoices/services/invoice.service.ts`);
  don't treat it as the reference shape.
- **Frontend `@contracts/*` migration:** the appointments FE feature (not built
  yet) should import the contract from `@contracts/*` instead of copying DTOs;
  invoices FE migrates as part of the invoices refactor.
- **Function-budget guard (headroom = 2, at 10/12):** each new feature with
  `index` + `[id]` adds 2 functions. Before adding a 2nd new feature route set,
  consolidate per-feature routes into a catch-all (`[[...path]].ts`, 1 fn/feature)
  rather than adding files. See `api/PLAN.md` Q2 / §10 (D3).
- Deferred: appointments soft-delete; extract `sheet-contract.checks.ts` from
  `server/shared/sheet-crud/sheet-service.factory.ts` (review item #2).

# Handoff: Order History feature + backend-engine merge to main + prod incident

**Date:** 2026-07-21
**Session:** https://claude.ai/code/session_01PrHzdZPTvm5BP2Hct4rmdS or c8039c8a-5575-4e3e-badb-c339330606c9
**Status:** Done. `main` is live, verified working in production.
**Audience:** whoever picks up webapp-vue next — read this before touching `api/` or `server/`.

---

## TL;DR

1. Built the "tap a customer → order history" feature (backend + frontend), planned and implemented collaboratively with Codex, then redesigned the UI to match the `webapp-react` reference more closely per feedback.
2. Merged the whole backend-engine migration (`GSheetRepository`/`BaseCrudService`, customers + appointments migrated off the legacy `sheet-crud` engine) into `main`, replacing the old backend entirely.
3. That merge **took production down** (all `/api/*` routes 500'd). Root-caused and fixed same session, verified live. **Read the incident section below before changing any backend import.**
4. Three old branches deleted (fully merged, nothing lost): `feature/customer-order-history`, `feature/appointments-module-migration`, `feature/features-api-modules-structure`.

---

## 1. Order History feature (new)

Tap a customer card in the Customer List → order history page: customer header, waiting pickups, order list, order detail sheet with items + note + "View Photos".

- **Implementation record:** This feature is complete and live-verified; the source code, tests, and git history are the durable implementation record.
- **Backend:** `contracts/orders/order-api.schema.ts`, `server/modules/orders/*`, `api/orders/index.ts`. Read-only (`OrdersView` materialized sheet, no create/update route ever wired). Uses a new `ReadOnlyModuleApiContract` shape (`contracts/shared/read-only-module-api-contract.ts`) alongside the existing full-CRUD engine, since this module never writes.
- **Frontend:** `src/features/customers/{pages/CustomerOrderHistoryPage.vue, components/Order*.vue, stores/customer-order-history.store.ts, services/{order,waiting-pickup}.service.ts, utils/{format-date,waiting-pickup.filter}.ts}`.
- **UI note:** first pass diverged too far from the `webapp-react` reference (no status avatars, raw ISO dates, "View Photos" buried at the bottom of the detail sheet). Redesigned to match: status-colored avatar icons, human-readable dates, drag-to-dismiss sheet, dates-as-tiles, actions pinned near the top. If touching these components again, look at `webapp-react/src/components/customer-orders/*` first — it's the design source of truth.
- **Known, accepted limitation:** waiting-pickups filtering is client-side (documented in `src/features/customers/utils/waiting-pickup.filter.ts`) because the generic `/api/appointments` list has no `deletedAt`/date-range support yet. Not a bug — a deliberate MVP call, tested for the known gaps (see the file's test suite).

---

## 2. Backend engine merge into `main`

`main` was 39 commits behind a long-lived branch that had rebuilt the whole backend (`BaseRepository`/`GSheetRepository`, `BaseCrudService`, migrated `customers`+`appointments`, deleted the old `sheet-crud`/`google-sheets` engine). Merged that + the order-history work into `main` in one merge commit (`ae02ff7`).

**Two gaps found in review (Claude + Codex independently) and *deliberately accepted*, not bugs:**
- **Invoices backend is gone and not rebuilt.** `main`'s Invoices page always ran on hardcoded mock data (never had a real backend). A full invoice backend existed once (1297 lines, 11 files — schema/mapper/repository/service/routes, genuinely well-designed) but was deleted in `579a49d` during the engine migration and never rebuilt on the new engine. `src/features/invoices/` still calls the now-missing `/api/modules/invoices` → shows "Unable to load invoices" instead of mock data. **Decision (user, 2026-07-21): leave it — no real usage yet.** Four real Google Sheets exist for it (Invoices, InvoiceItems, PaymentSummary, Payments) if it's ever rebuilt; there's also a stale local branch `feature/invoices-structure` (predates this session, not investigated — check it before starting from scratch). Full memory: `appointments-migration-merge-decisions.md`.
- **Customer `DELETE` not restored.** Old route supported it; new route deliberately only exposes `GET`+`PATCH` (comment in `api/customers/[id].ts` explains). Confirmed nothing in the frontend calls it. **Decision: leave the gap.**

Env var fixed as part of this: `APPOINTMENTS_SPREADSHEET_ID` added to Vercel Production + Preview (was Development-only).

---

## 3. Production incident: read this before touching `api/` or `server/` imports

Deploying the merge above **took all of production down** — every `/api/*` route crashed with `FUNCTION_INVOCATION_FAILED`.

**Root cause:** `@vercel/node` does **not** bundle `api/*.ts` routes into one file unless `VERCEL_API_FUNCTION_BUNDLING=1` is set (it isn't, here). Without that, it renames `.ts`→`.js` and traces every relative import as a **separate file**, run under Node's native ESM loader (`package.json` has `"type": "module"`). Native ESM requires explicit extensions on relative import specifiers — `api/tsconfig.json`'s `moduleResolution: "Bundler"` silently allows missing ones at typecheck time. **Neither `npm run typecheck:api` nor `vercel dev` catch this — only a real `vercel build`/deploy does.**

**Fixed:** every relative import/export across `api/`, `server/`, `contracts/` now has an explicit `.js` extension pointing at the `.ts` source (commit `0111faf`; doc corrected in `7306642`). Verified two independent ways (me: live Preview + Production hits with real data; Codex: independently traced all three module entrypoints, 105 import specifiers, zero remaining issues).

**Rule going forward, written into `api/CLAUDE.md` now:** every relative import in `api/`/`server/`/`contracts/` needs an explicit `.js` extension. **Before ever calling a backend change "verified": do a real `vercel deploy` (Preview is enough) and hit the live URL with an actual request — `vercel dev` is not a faithful enough reproduction of the real build pipeline for this failure mode.**

Full incident memory: `vercel-esm-extension-outage.md`. Recommended (not yet done): switch `api/tsconfig.json` to `moduleResolution: "NodeNext"` so TypeScript itself catches missing extensions at compile time — deliberately deferred since it may surface other latent issues and shouldn't be done under incident pressure.

---

## 4. Current repo state

- `main` is live, verified: `/api/customers`, `/api/appointments`, `/api/orders` all confirmed returning real data in production.
- Branches deleted (local + remote), fully merged, nothing lost: `feature/customer-order-history`, `feature/appointments-module-migration`, `feature/features-api-modules-structure`.
- No feature branches remain in the current local or remote refs; only `main` remains.
- `api/` function count: 7 files (well under the Hobby 12-function cap — this was also likely why `main`'s pre-merge deploy was separately failing; the merge fixed that as a side effect).

## 5. Memory written this session (auto-loaded next time)

- `appointments-migration-merge-decisions.md` — why invoices/DELETE gaps are accepted, not bugs
- `vercel-esm-extension-outage.md` — the outage, root cause, fix, and the "vercel dev isn't enough" lesson
- `invoice-contract.md` (existing, updated) — flagged as describing deleted/historical code now

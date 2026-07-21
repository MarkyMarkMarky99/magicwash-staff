# ORDERS_GSHEET_ENGINE_REFACTOR_PLAN

**Status:** Approved by Codex (pass 3) — ready for Grok CLI implementation
**Related Module:** orders / module-contracts / repositories / base-crud service
**Created by:** Claude (orchestrator), for Grok CLI to implement after Codex approves this plan
**Date:** 2026-07-21

## Problem & Objective

### Problem Statement

`orders` (added in the customer-order-history feature, `ae02ff7`) is the only module
that does not use the standard engine (`GSheetRepository` + `BaseCrudService` +
`ModuleContract`). It is entirely bespoke:

- `server/modules/orders/orders.repository.ts` — hand-rolled class calling
  `GVizQueryBuilder`/`fetchGVizRows` directly instead of extending `BaseRepository`.
- `server/modules/orders/orders.mapper.ts` — hand-rolled DB→API row mapping
  (date normalization, string→number coercion, and parsing the `itemsJson`
  column into a structured `items[]` array) instead of a `RepositoryTransformer`.
- `server/modules/orders/orders.service.ts` — hand-rolled `OrdersService.list()`
  instead of `BaseCrudService`.
- `contracts/orders/order-api.schema.ts` — uses a one-off
  `ReadOnlyModuleApiContract` type (`contracts/shared/read-only-module-api-contract.ts`)
  instead of the standard `ModuleApiContract` every other module's bundle is
  checked against.

This happened because `orders` is read-only (list only — no create/update/delete
route was ever planned for the `OrdersView` materialized sheet) and the standard
engine currently *mandates* full CRUD:

- `BaseRepository` declares `create`/`update`/`delete` as abstract methods.
- `ModuleApiContract` requires `request.create`/`request.update` and
  `response.detail`/`create`/`update`.
- `ModuleDbContract` requires `request.create`/`request.update` and
  `response.create`/`update` (only `delete` is already optional there).

Rather than force a read-only view through a full-CRUD-shaped contract, the
previous session invented a parallel, narrower type
(`ReadOnlyModuleApiContract`) and a fully bespoke repository/service. Net
result: two unrelated module architectures live side by side, `orders`
duplicates transport logic (`GVizQueryBuilder`/`fetchGVizRows` wiring) that
`GSheetRepository` already owns, and adding any future read-only module means
re-deriving this bespoke pattern again instead of reusing the engine.

**Precedent that this is fixable without forking the engine:** the `delete`
slot is *already* optional today — `ModuleDbContract.request.delete?` /
`response.delete?`, and `GSheetRepository.execute()`'s `delete` case
unconditionally throws `'not implemented yet'` regardless of module. No route
in the codebase calls it. `orders` needs exactly the same treatment extended
to `create`/`update`/`detail`.

**Precedent that the engine already supports itemsJson-style assembly:**
`appointments` already parses a JSON blob column (`Address`, a serialized
customer snapshot) into extra flat API fields (`customerName`, `customerCode`,
`phone`, `location`) via `RepositoryTransformer.response`
(`server/modules/appointments/appointment.transformer.ts`). `BaseCrudService`'s
`project()` reads the response DTO by walking `schema.shape` off a
`row: Record<string, unknown>` cast — it does not statically require the
transformer-injected fields to appear in `ModuleApiRow<TContract>`. This means
orders' `itemsJson` → `items[]` parsing (plus date normalization and
`quantity` string→number coercion) fits the exact same mechanism with zero
new engine capability required — only the optional-CRUD-slot gap above needs
closing.

### Goal / Success Criteria

- `orders` is wired with the *same* `GSheetRepository` and `BaseCrudService`
  classes as `customers` and `appointments` — no bespoke repository/service class.
- `contracts/orders/order-api.schema.ts` uses `satisfies ModuleApiContract`
  (the standard type), not a parallel type. `ReadOnlyModuleApiContract` is deleted.
- A module with no write route can be wired this way in the future by adding
  schema fields to an existing bundle, never by inventing a new contract type
  or a new repository/service class.
- `customers` and `appointments` (the only two full-CRUD modules today) are
  **behaviorally unchanged** — same runtime behavior, same types where they
  already specify all slots. The type-shape widening (optional slots) must be
  additive only.
- Misuse is caught, not silently accepted: calling `.create()`/`.update()`/
  `.getById()` on a module wired without those slots must fail loudly — ideally
  at compile time (uncallable), and defensively at runtime too (clear thrown
  error), never a silent no-op and never an accidental real Apps Script write.
- `npm run typecheck:api` passes; all dry-tests and type-tests pass
  (existing + new coverage for the read-only shape).
- Verified with a real `vercel deploy` (Preview) + live hit on `/api/orders`
  before this is called done — see `vercel-esm-extension-outage` memory: neither
  `vercel dev` nor `typecheck:api` caught the last production-affecting change
  in this exact area of the codebase (backend engine + orders module, same
  session, 2026-07-21).

### Scope

**In Scope**

- Generalize `ModuleApiContract` (`contracts/shared/module-api-contract.ts`):
  make `request` optional as a whole, make `response.detail`/`create`/`update`
  each individually optional. `query.list` and `response.list` stay required.
- Generalize `ModuleDbContract` (`server/shared/contracts/module-db-contract.ts`):
  make `request.create`/`request.update` and `response.create`/`update`
  optional, matching the existing `delete?` pattern exactly.
- Widen `ModuleApiContractOf<...>` (the parameterized type `BaseCrudService`
  consumes) in lockstep with `ModuleApiContract` — it currently requires every
  request/response generic unconditionally, so widening only the plain
  structural-guard type is not enough; `BaseCrudService` itself won't compile
  against a read-only contract otherwise. Full-CRUD callers (`customer.module.ts`,
  `appointment.module.ts`) must see no change to their own inferred types.
- Extend `BaseCrudService` so it can be constructed against a contract missing
  those optional slots, with the **static method surface reflecting it** —
  `.getById()`/`.create()`/`.update()` should not simply exist-and-throw for
  every instance; where the contract doesn't declare the relevant slot, calling
  them should be a **compile-time error** (covered by `@ts-expect-error` type-test
  fixtures), and additionally throw a clear, explicit runtime error ("not
  supported by this module") for any caller that bypasses the type (`as any`,
  dynamic dispatch). The runtime guard must fire **before** `parseOrThrow` and
  before any repository call — zero repository/read/write calls on a rejected
  operation. `.list()` must work unconditionally, unaffected by any of this.
- Confirm/adjust `GSheetRepository`'s derived generics (`ModuleCreate<TContract>`,
  `ModuleUpdate<TContract>`, etc.) so a missing `request.create`/`update` slot
  resolves to a type that makes `.create()`/`.update()` uncallable with a real
  argument (e.g. resolves to `never`), not just "unspecified." `never` alone is
  a compile-time guard only — a JS caller, an `any`-typed caller, or a future
  service bug could still reach `GSheetRepository.execute()` and perform a real
  Apps Script write. `GSheetRepository.create()`/`.update()` must **also** check
  at runtime whether the underlying DB contract actually declares
  `request.create`/`update` and throw before calling `write()` if not — belt and
  suspenders, not type-safety alone.
- Rebuild `orders` on the standard engine:
  - `server/modules/orders/order.contract.ts` — DB row schema + fieldMap (as
    today) *plus* the composed `orderDbContract satisfies ModuleDbContract`:
    ```ts
    export const orderDbContract = {
      row: orderRowSchema,
      fieldMap: orderFieldMap,
      primaryKey: 'orderId',
      request: {},                              // no create/update/delete — explicit empty object, not omitted
      response: { read: orderRowSchema.partial() },  // no create/update/delete
    } satisfies ModuleDbContract
    ```
    and `orderContract = { api: orderApiContract, db: orderDbContract } satisfies ModuleContract`.
    (`request: {}` must be written explicitly — do not omit the `request` key —
    since `ModuleDbContract.request` stays a required object whose `create`/
    `update`/`delete` members are each individually optional.)
  - `server/modules/orders/orders.transformer.ts` — a `RepositoryTransformer`
    (`response` only, no `request` — there's nothing to write) that replaces
    `orders.mapper.ts`: parses `itemsJson` into `items[]`, normalizes GViz
    date serials, coerces `quantity` to a number. Mirrors
    `appointment.transformer.ts`'s shape and its `flattenAddressSnapshot`-style
    response hook.
  - `server/modules/orders/order.module.ts` — wiring only: `new GSheetRepository({ contract: orderContract, ... , transformer: createOrdersTransformer() })` + `new BaseCrudService({ repository, api: orderContract.api, searchFields: [...] })`, replacing `orders.service.ts`'s current role.
  - Delete `orders.repository.ts`, `orders.service.ts`, `orders.mapper.ts`,
    `orders.mapper.dry-test.ts` (superseded by `orders.transformer.dry-test.ts`).
  - Update `api/orders/index.ts`'s import to the new module path (route body
    stays a one-line `ordersService.list(req.query)` — unchanged contract).
  - Add `keyword: z.string().default('')` to `orderListQuerySchema` (required
    by `ReadQueryDTO.fromQuery<TQuery extends GenericListQuery>` — currently
    absent because the bespoke service never went through `ReadQueryDTO`). Safe
    no-op today: nothing sends `keyword`, and the GViz query builder ignores an
    empty keyword, so this cannot change current query results.
  - `searchFields: []` for `BaseCrudService` — **decided, not open**. Today's
    `OrdersService.list()` has no keyword search at all; `['orderNumber']`
    would be new functionality, out of scope for a shape-conformance refactor.
  - Switch `contracts/orders/order-api.schema.ts` to
    `satisfies ModuleApiContract`; delete
    `contracts/shared/read-only-module-api-contract.ts`.
- New/updated type-test coverage in `server/shared/repositories/gsheet.repository.type-test.ts`
  (or a new file) proving: a read-only bundle (`query.list` + `response.list`
  only) satisfies `ModuleApiContract`/`ModuleDbContract`/`ModuleContract`;
  `GSheetRepository` + `BaseCrudService` construct against it without casts;
  `.create()`/`.update()` on the resulting **repository** and `.create()`/
  `.update()`/`.getById()` on the resulting **service** (repositories have no
  `getById` — only the service does) fail with `@ts-expect-error` when called
  with a real argument (mirror the existing negative-fixture style already in
  that file, e.g. lines 56-66, 107-114).
- Extend `server/shared/services/base-crud.service.dry-test.ts` (today: 31
  tests, uses a `FakeRepository` with call-tracking arrays — see the file) with
  cases proving: constructing a `BaseCrudService` from a read-only contract and
  calling `.create()`/`.update()`/`.getById()` throws the "not supported"
  runtime error, and — critically — `FakeRepository`'s `createCalls`/
  `updateCalls`/`readCalls` stay empty (the guard fires before any repository
  call, not after a failed one). This file's dynamic import
  (`const modulePath = './base-crud.service'`, currently missing its
  extension) must be corrected to `'./base-crud.service.js'` while it's being
  touched, per the `.js`-extension rule this plan itself requires.
- Extend `server/shared/repositories/repository.dry-test.ts` with a case
  proving the **repository-level** guard from step 3 below: build a
  `GSheetRepository` against a read-only contract with `fetch` mocked/spied,
  call `.create()`/`.update()`, assert both throw and that the mock was never
  invoked (zero Apps Script requests) — the existing service-level zero-call
  test only proves the *service* guard fires early, not the repository's own
  independent guard.
- Orders' `itemsJson` parsing must stay hand-parsed (`JSON.parse` + manual
  filtering), not re-implemented as a Zod `.parse()` — the engine's "cell
  values are never runtime-validated" rule applies here exactly as it does to
  every other module's dirty-data path.
- `orders.transformer.dry-test.ts` — port **every** case from the existing
  `orders.mapper.dry-test.ts` 1:1, not just the headline transformations:
  - `orderId`/`customerId` required-string fallback (`toRequiredString`: non-string → `''`)
  - nullable-string fields (`orderNumber`, `serviceType`, `status`, `note`) pass through or become `null`
  - item field rename `service_type` → `serviceType` inside each parsed item
  - malformed JSON in `itemsJson` → `items: []` (not a thrown error)
  - non-array parsed JSON → `items: []`
  - non-object array entries (`null`, string, number) filtered out before item mapping
  - `quantity` string→number coercion, including null/undefined/empty-string/invalid-string → `null`
  - GViz date serial normalization (`Date(Y,M,D)` → `YYYY-MM-DD`, zero-indexed month correction), and passthrough for already-ISO strings
  - missing `customerId` still 422s via `parseOrThrow(orderListQuerySchema, ...)` — this is a list-query-schema test, unaffected by the transformer move, keep it as-is.
- Run every affected dry-test with the codebase's actual convention —
  there is no npm script for these; they are invoked directly:
  `npx tsx server/modules/orders/orders.transformer.dry-test.ts`,
  `npx tsx server/shared/services/base-crud.service.dry-test.ts`,
  `npx tsx server/shared/repositories/repository.dry-test.ts` (regression check
  on the shared engine change).

**Out of Scope**

- No new orders functionality — still list-only. Do not add create/update/delete
  routes or schemas with real semantics for orders.
- No changes to `customers` or `appointments` business behavior, routes, or
  response shapes.
- No implementation of `GSheetRepository`'s `delete` (stays throwing, as today).
- No changes to the Invoices backend gap or customer `DELETE` gap (separate,
  already-accepted gaps per `appointments-migration-merge-decisions`).
- No `moduleResolution: NodeNext` change to `api/tsconfig.json` (separately
  deferred per the outage memory).

### Requirements

**Functional**

- `GET /api/orders?customerId=...` returns byte-identical response shape and
  data to today's implementation for the same input (same projection, same
  date format, same `items[]` structure, same pagination echo).
- A module wired without `request`/write-response slots must be fully usable
  for `.list()` and must fail clearly (not silently, not with a real Sheets
  write) if `.create()`/`.update()`/`.getById()` are ever called: a compile
  error for normal typed call sites, plus a runtime throw (fired before any
  validation or repository call) for any caller that bypasses the type.
- `customerContract`/`appointmentContract` (fully-specified bundles) must
  continue to satisfy the widened types with **zero code changes** to their
  own files — the widening must be strictly additive (optional, not removed
  or restructured).

**Non-Functional**

- No dead/fake schemas: do not give orders' write slots dummy Zod schemas
  just to satisfy a still-mandatory shape. The whole point is that the
  contract types genuinely support "this module has no writes."
- No behavior change to any Apps Script write path used by `customers`/`appointments`.
- Every relative import touched must keep its explicit `.js` extension
  (see `api/CLAUDE.md` — the 2026-07-21 outage rule). This is easy to violate
  by accident when adding new files; check it explicitly before calling this done.

## How (Implementation Approach — for Grok to execute after Codex approves)

### High-Level Steps

1. Widen `contracts/shared/module-api-contract.ts`'s `ModuleApiContract`
   **and** `ModuleApiContractOf<...>` together: `request` optional,
   `response.detail`/`create`/`update` each optional, on both the plain
   structural-guard type and the parameterized type `BaseCrudService` actually
   consumes. Widening only the former leaves `BaseCrudService` unable to
   compile against a read-only contract at all. Full-CRUD modules
   (`customer.module.ts`, `appointment.module.ts`) must see zero change to
   their own inferred types — verify by re-running their existing dry-tests
   and type-tests unchanged.
2. Widen `server/shared/contracts/module-db-contract.ts`'s `ModuleDbContract`
   (and `ModuleDbContractOf` if it's used anywhere consuming these slots):
   `request.create`/`update` and `response.create`/`update` become optional,
   matching the existing `delete?` fields exactly. `request` itself stays a
   required object (so a read-only module writes `request: {}` explicitly,
   never omits the key).
3. Update `server/shared/repositories/gsheet.repository.ts`'s derived types
   (`ModuleCreate<TContract>`, `ModuleUpdate<TContract>`) to resolve to `never`
   (or an equivalent uncallable type) when the contract's `request.create`/
   `update` is absent, so `GSheetRepository.create()`/`.update()` are
   statically uncallable with a real argument for a read-only module. **Also**
   add a runtime guard inside `GSheetRepository.create()`/`.update()` (before
   `write()`/AppScript dispatch) that checks the DB contract actually declares
   the corresponding `request` schema and throws otherwise — `never` typing
   alone doesn't stop an `any`-typed or dynamic caller from reaching a real
   Apps Script POST against a materialized read-only view.
4. Update `server/shared/services/base-crud.service.ts` so the static method
   surface reflects contract capability (conditional/unavailable typing +
   `@ts-expect-error` coverage, not "always callable, sometimes throws"), and
   so `.getById()`/`.create()`/`.update()` guard on slot presence and throw a
   clear runtime error (e.g. `"create is not supported by this module"`)
   *before* `parseOrThrow` and *before* any repository call when the contract
   lacks the relevant `request`/`response` slot; `.list()` is unaffected.
5. Add the read-only positive-case type-test fixture(s) proving steps 1-4
   compose correctly (see Scope above) — write these *before* wiring `orders`,
   so the engine change is validated in isolation first.
6. Build `order.contract.ts` (DB schema + fieldMap, unchanged from today's
   `order.contract.ts`, plus the new composed `orderDbContract`/`orderContract`),
   `orders.transformer.ts` (port `orders.mapper.ts`'s logic into a
   `RepositoryTransformer.response`), `order.module.ts` (wiring).
7. Delete `orders.repository.ts`, `orders.service.ts`, `orders.mapper.ts`,
   `orders.mapper.dry-test.ts`; add `orders.transformer.dry-test.ts` porting
   every existing test case.
8. Update `api/orders/index.ts`'s import path; update
   `contracts/orders/order-api.schema.ts` to `satisfies ModuleApiContract`
   (add `keyword` to the list query schema); delete
   `contracts/shared/read-only-module-api-contract.ts`.
9. Run `npm run typecheck:api`, all dry-tests, and `npm run build` (frontend —
   `order.service.ts` imports `orderListQuerySchema`/`orderListResponseSchema`
   from the same contract file, must still resolve).
10. Real `vercel deploy` (Preview) + live hit on `/api/orders` (with a real
    `customerId`), plus a spot-check hit on `/api/customers` and
    `/api/appointments` to prove the shared-engine widening didn't regress
    them, before calling this done.

### Contract sketch (illustrative — Grok/Codex should pin down exact TS mechanics)

```ts
// contracts/shared/module-api-contract.ts
export type ModuleApiContract = {
  query: { list: ZodSchema }
  request?: {
    create: ZodSchema
    update: ZodSchema
  }
  response: {
    list: AnyResponseSchema
    detail?: AnyResponseSchema
    create?: AnyResponseSchema
    update?: AnyResponseSchema
  }
}
```

```ts
// server/shared/contracts/module-db-contract.ts
export type ModuleDbContract = {
  row: DbRowSchema
  fieldMap: FieldMap
  primaryKey: string
  request: {
    create?: ZodSchema
    update?: ZodSchema
    delete?: ZodSchema
  }
  response: {
    read: ZodSchema
    create?: ZodSchema
    update?: ZodSchema
    delete?: ZodSchema
  }
}
```

```ts
// contracts/orders/order-api.schema.ts — after
export const orderApiContract = {
  query: { list: orderListQuerySchema },
  response: { list: orderListResponseSchema },
} satisfies ModuleApiContract   // no ReadOnlyModuleApiContract
```

```ts
// server/modules/orders/order.contract.ts — after
export const orderDbContract = {
  row: orderRowSchema,
  fieldMap: orderFieldMap,
  primaryKey: 'orderId',
  request: {},                                   // explicit, not omitted
  response: { read: orderRowSchema.partial() },
} satisfies ModuleDbContract

export const orderContract = {
  api: orderApiContract,
  db: orderDbContract,
} satisfies ModuleContract
```

`ModuleApiContractOf`/`ModuleCreate<TContract>`/`ModuleUpdate<TContract>`'s
exact conditional-type mechanics (how "slot absent → `never`" is expressed)
are intentionally left for Grok to implement and Codex to scrutinize in the
diff — this sketch fixes the *shape* every module's bundle must have, not the
generic plumbing inside the engine.

## Test Plan

- `npm run typecheck:api` — must pass, including the new type-test fixtures
  (positive read-only-contract fixture + `@ts-expect-error` negative fixtures
  for `.create()`/`.update()`/`.getById()` on a read-only service).
- `npx tsx server/modules/orders/orders.transformer.dry-test.ts` — 1:1 port of
  every case in today's `orders.mapper.dry-test.ts` (see the itemized list in
  Scope above: required-string fallback, nullable-string passthrough,
  `service_type`→`serviceType` rename, malformed/non-array/non-object
  `itemsJson`, quantity coercion, GViz date serials, missing-`customerId` 422).
- `npx tsx server/shared/services/base-crud.service.dry-test.ts` — existing 31
  cases must still pass unchanged, plus new cases proving the read-only guard
  throws before touching the (fake) repository.
- `npx tsx server/shared/repositories/repository.dry-test.ts` — existing cases
  must still pass unchanged, plus a new case proving `GSheetRepository.create()`/
  `.update()` throw before any `fetch` call for a read-only contract (mocked
  `fetch`, assert zero invocations) — the repository-level guard from step 3,
  independent of the service-level guard from step 4.
- Existing `customer`/`appointment` dry-tests and `gsheet.repository.type-test.ts`
  assertions — must pass unchanged (proves the widening is additive).
- Manual/live verification: `vercel deploy` to Preview, hit `/api/orders?customerId=<real id>`,
  compare response shape/data against current production output before merge;
  spot-check `/api/customers` and `/api/appointments` on the same Preview deploy.

## Risk & Rollout Notes

- This touches shared engine files consumed by every live module
  (`customers`, `appointments`) on the day of a related production outage
  (`vercel-esm-extension-outage`, 2026-07-21, same merge that introduced
  `orders`). Treat the shared-file diff (steps 1-4) as the highest-risk part
  of this change — Codex should scrutinize it hardest, independent of the
  `orders`-specific files.
- Land as one PR/branch, but the shared-engine change (steps 1-5) should be
  reviewed and validated as a self-contained unit before the `orders` rewiring
  (steps 6-8) is layered on top, so a regression is attributable to one half
  or the other.
- Do not skip the `vercel deploy` + live-hit step. Typecheck and dry-tests did
  not catch the last incident in this area.

## Codex review log

**Pass 1 (v1 plan):** Conditional approval — architecture sound, 7 required
revisions before handoff to Grok:
1. `ModuleApiContractOf` also needed widening, not just `ModuleApiContract`.
2. `BaseCrudService`'s static method surface needed to reflect capability
   (conditional typing + `@ts-expect-error` tests), guards must run before
   validation/repository calls.
3. DB-contract sketch was inconsistent (said "no request" but kept it required)
   — resolved with explicit `request: {}`.
4. `never`-typing alone doesn't stop a runtime/`any` caller from reaching a
   real Apps Script write — needed an explicit repository-level runtime guard.
5. Mapper-port coverage needed to be itemized, not summarized.
6. `searchFields` needed to be decided (`[]`), not left as an open choice.
7. Dry-test execution commands needed to be explicit (`npx tsx ...`), plus
   coverage proving unsupported operations make zero repository calls.

All 7 addressed in the v2 revision (see Scope/Steps/Contract sketch/Test Plan
above).

**Pass 2 (v2 plan):** Not approved — 3 concrete blockers, all 7 pass-1 items
confirmed genuinely resolved:
1. Type-test wording asked for `.getById()` on "the resulting service/
   repository," but repositories have no `getById()` — only the service does.
2. The repository-level runtime guard (step 3, `GSheetRepository.create()`/
   `.update()`) was required but had no dry-test proving it fires *before*
   `fetch` — the existing zero-call coverage only proved the *service*-level
   guard (step 4).
3. `server/shared/services/base-crud.service.dry-test.ts` — the very file this
   plan requires extending — has a pre-existing dynamic import missing its
   `.js` extension (`const modulePath = './base-crud.service'`), which the
   plan's own `.js`-extension rule should have caught.

All 3 addressed in this v3 revision.

**Pass 3 (v3 plan):** Approved for handoff to Grok CLI. All 3 pass-2 blockers
confirmed resolved; all 7 pass-1 items remain intact; Scope/Steps/Contract
sketch/Test Plan judged internally consistent. No further plan changes
required before implementation.

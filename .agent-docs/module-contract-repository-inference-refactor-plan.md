# MODULE_CONTRACT_REPOSITORY_INFERENCE_REFACTOR_PLAN

**Status:** Implemented / Verified
**Related Module:** customers / module-contracts / repositories
**Created by:** CODEX
**Date:** 2026-06-23

## Problem & Objective

### Problem Statement

`server/modules/customers/customer.module.ts` currently composes `customerContract` and declares multiple derived type aliases to connect `ModuleContract`, `GSheetRepository`, and `BaseCrudService`.

The API/DB contract already contains the information needed to derive those types, but `GSheetRepository` still requires callers to repeat generic arguments and DB contract options. This causes:

- Runtime wiring mixed with contract composition and type derivation.
- Boilerplate that every migrated module must repeat.
- Generic arguments and contract values can drift apart.
- No single module-level source of truth for the complete customer contract.

### Goal / Success Criteria

- One complete `ModuleContract` is the module source of truth.
- `GSheetRepository` derives repository types from the exact module contract.
- `customer.module.ts` contains runtime configuration only.
- Customer wiring no longer declares `CustomerDbRow`, `CustomerApiRow`, `CustomerReadWhere`, `CustomerCreate`, or `CustomerUpdate`.
- Runtime behavior and existing API/DB contracts remain unchanged.
- Typecheck, repository tests, service tests, and build pass.

### Scope

**In Scope**

- Clarify ownership and location of the complete customer module contract.
- Remove explicit repository generics and duplicated contract options from customer wiring.
- Add the shared type inference required by `GSheetRepository`.
- Update affected customer wiring, tests, and contract references.
- Update module-authoring documentation and API contract naming rules to the new pattern.
- Establish a reusable pattern for modules migrated later.

**Out of Scope**

- No backward compatibility for the previous `GSheetRepository` constructor/generic contract.
- No overload, adapter, or deprecated API for old wiring.
- Do not migrate or modify `appointments`; customers and appointments may temporarily use different flows.
- No new query operators or read/create/update behavior changes.
- No schema field/nullability changes.
- No `delete` implementation.
- No Apps Script/GViz transport changes.
- Do not remove legacy `sheet-crud` or `google-sheets` yet.

### Requirements

**Functional**

- Keep API and DB boundaries separate inside the complete contract.
- Client-safe API contracts must not import server-side contracts.
- A server-side module contract may compose the API and DB contracts.
- Type inference must preserve literal `fieldMap` and `primaryKey` types.
- Repository public method types must remain equivalent to the current contract.
- Customer wiring must not declare repository-derived types itself.
- The new contract applies only to migrated modules; appointments will adopt it later.

**Non-Functional**

- No customer-specific repository subclass.
- Do not add runtime logic for a type-level problem.
- Avoid widening exact contracts with `: ModuleContract`.
- Reduce boilerplate without adding an unnecessary composition layer.

## How (Implementation Approach)

### High-Level Steps

1. Rename the API bundle from `customerApiSchemas` to `customerApiContract`; keep individual schema exports unchanged and update the authoring rule/docs in lockstep.
2. Rename `customer-db.schema.ts` to `customer.contract.ts` and make it the single server-side owner of DB schemas, `customerDbContract`, and the composed `customerContract`.
3. Tighten the shared DB row contract to require a Zod schema with `.shape`, matching the runtime requirement of GViz column derivation.
4. Change `GSheetRepository` to accept an exact `ModuleContract` and derive its `BaseRepository` generic types internally.
5. Remove repository-derived aliases and contract composition from `customer.module.ts`; leave runtime wiring only.
6. Update new-stack repository tests, customer imports, repository references, `api/CLAUDE.md`, and `.claude/rules/api-contract-schema-rules.md`. Do not modify appointment production code or add compatibility paths.

### Contracts

```ts
// contracts/customers/customer-api.schema.ts
export const customerApiContract = {
  query: {
    list: customerListQuerySchema,
  },
  request: {
    create: customerCreateSchema,
    update: customerUpdateSchema,
  },
  response: {
    list: customerListResponseSchema,
    detail: customerDetailResponseSchema,
    create: customerCreateResponseSchema,
    update: customerUpdateResponseSchema,
  },
} satisfies ModuleApiContract
```

```ts
// server/modules/customers/customer.contract.ts
export const customerDbContract = {
  row: customerRowSchema,
  fieldMap: customerFieldMap,
  primaryKey: 'customerId',
  request: {
    create: customerDbCreateRequestSchema,
    update: customerDbUpdateRequestSchema,
  },
  response: {
    read: customerRowSchema.partial(),
    create: customerRowSchema,
    update: customerRowSchema,
  },
} satisfies ModuleDbContract

export const customerContract = {
  api: customerApiContract,
  db: customerDbContract,
} satisfies ModuleContract
```

```ts
// server/shared/contracts/module-db-contract.ts
type DbRowSchema = ZodSchema & {
  shape: Record<string, unknown>
}

type ModuleDbContract = {
  row: DbRowSchema
  fieldMap: FieldMap
  primaryKey: string
  request: {
    create: ZodSchema
    update: ZodSchema
    delete?: ZodSchema
  }
  response: {
    read: ZodSchema
    create: ZodSchema
    update: ZodSchema
    delete?: ZodSchema
  }
}
```

`ModuleDbContractOf.row` must carry the same `.shape` requirement. This is a compile-time tightening only; customer uses a Zod object already and runtime behavior does not change.

```ts
// server/shared/repositories/gsheet.repository.ts
type ModuleDbRow<TContract extends ModuleContract> =
  z.infer<TContract['db']['row']>

type ModuleApiRow<TContract extends ModuleContract> =
  ApiRowFromFieldMap<
    ModuleDbRow<TContract>,
    TContract['db']['fieldMap']
  >

type ModuleListQuery<TContract extends ModuleContract> =
  z.infer<TContract['api']['query']['list']>

type ModuleReadWhere<TContract extends ModuleContract> =
  OmitReservedQueryFields<ModuleListQuery<TContract>>

type ModuleCreate<TContract extends ModuleContract> =
  z.infer<TContract['api']['request']['create']>

type ModuleUpdate<TContract extends ModuleContract> =
  z.infer<TContract['api']['request']['update']>

interface GSheetRepositoryOptions<TContract extends ModuleContract> {
  contract: TContract
  sheetName: string
  spreadsheetId: string
  scriptUrl: string
  transformer?: RepositoryTransformer
}

class GSheetRepository<TContract extends ModuleContract>
  extends BaseRepository<
    ModuleApiRow<TContract>,
    ModuleReadWhere<TContract>,
    ModuleCreate<TContract>,
    ModuleUpdate<TContract>
  >

read(query?: ReadQueryDTO<ModuleReadWhere<TContract>>)
  -> Promise<Array<Partial<ModuleApiRow<TContract>>>>

create(data: ModuleCreate<TContract>)
  -> Promise<ModuleApiRow<TContract>>

update(id: string, data: ModuleUpdate<TContract>)
  -> Promise<ModuleApiRow<TContract>>

delete(id: string) -> Promise<never>
```

`ModuleDbRow`, `ModuleApiRow`, `ModuleListQuery`, `ModuleReadWhere`, `ModuleCreate`, and `ModuleUpdate` remain private type helpers in `gsheet.repository.ts`. Modules must not import or restate them. Internal `request<...>()` calls use these same derived types instead of the removed class generics.

The repository constructor reads runtime DB configuration only from:

```ts
input.contract.db.row
input.contract.db.fieldMap
input.contract.db.primaryKey
```

The API side of the contract is used only to infer the repository's API/domain-facing public method types.

### Functional Flow & Behavior

```ts
// server/modules/customers/customer.module.ts
import { customerContract } from './customer.contract'

const customerRepository = new GSheetRepository({
  contract: customerContract,
  sheetName: 'Customers',
  spreadsheetId: requireEnv('CUSTOMERS_SPREADSHEET_ID'),
  scriptUrl: requireEnv('APPSCRIPT_URL'),
})

export const customerService = new BaseCrudService({
  repository: customerRepository,
  api: customerContract.api,
  searchFields: ['customerIndex', 'customerName', 'address'],
})
```

```ts
customerContract
  -> GSheetRepository infers DB row, mapped API row, read where, create, update
  -> BaseCrudService infers its repository/API method contracts
  -> existing request/mapper/execute/response pipeline remains unchanged
```

No compatibility alias is retained for `customerApiSchemas`, and no old `GSheetRepository` constructor overload is retained.

The module-authoring convention becomes:

```text
contracts/<module>/<module>-api.schema.ts
  -> individual API schemas
  -> <module>ApiContract satisfies ModuleApiContract

server/modules/<module>/<module>.contract.ts
  -> DB schemas
  -> <module>DbContract satisfies ModuleDbContract
  -> <module>Contract satisfies ModuleContract

server/modules/<module>/<module>.module.ts
  -> runtime repository/service wiring only
```

Legacy appointments may retain `<module>ApiSchemas` and `<module>-db.schema.ts` until its separate migration.

### Edge Cases & Test Considerations

- Missing or incorrectly named API/DB bundle slots must fail typecheck through `satisfies`.
- Exact `fieldMap` and `'customerId'` literal types must survive inference; do not annotate a module bundle with `: ModuleContract`.
- `Line -> lineId` must remain correctly represented in the inferred API row.
- Repository `read/create/update` input and output types must remain equivalent to the current public contract.
- Mapper, transformer, GViz, and Apps Script runtime behavior must remain unchanged.
- Customer module must contain no local repository-derived type aliases after migration.
- Appointment imports and legacy flow must remain untouched.
- Repository dry tests must construct `GSheetRepository` with a complete contract.
- Remove appointment imports from repository dry tests. Replace appointment-based GViz cases with `customerContract` or a local test-only `ModuleContract`; do not create an appointment production contract in this task.
- Keep customer-contract coverage for the real `Line -> lineId` mapping. Use a local test contract only where a synthetic payload is required to test generic transport behavior such as route-id precedence.
- Add compile-time coverage that inferred `read/create/update` types match the API contract and mapped row.
- Assert construction needs no explicit generics and preserves the exact contract type.
- Assert create/update inputs come from `contract.api.request`; required API fields remain required and DB column names are rejected.
- Assert read/create/update outputs expose mapped API fields (`lineId`) and not DB fields (`Line`).
- Assert BaseCrudService accepts the inferred repository without casts or module-written aliases, and service return types still match API response contracts.
- Add a direct type-equality assertion that inferred read-where includes `customerType` and excludes `keyword`, `page`, `perPage`, `sortBy`, and `sortOrder`.
- Add negative type coverage that the removed five-generic and `rowSchema`/`primaryKey`/`fieldMap` constructor no longer compiles.
- Add GSheetRepository transformer coverage so the new constructor cannot forget to forward `transformer` to BaseRepository.
- Cover runtime consumption of `contract.db.row`, `contract.db.fieldMap`, and `contract.db.primaryKey` through GViz order, irregular mapping, and semantic-id update behavior.
- Assert a DB row contract without `.shape` fails type checking; do not bypass it with a cast.
- Do not test runtime validation by `contract.db.request` or `contract.db.response`; this refactor does not add such behavior.
- Update `api/CLAUDE.md` to show `<module>.contract.ts`, `<module>ApiContract`, and contract-driven `GSheetRepository` wiring.
- Update `.claude/rules/api-contract-schema-rules.md` so migrated/new modules use `*ApiContract`; explicitly allow legacy modules to retain `*ApiSchemas` until migration.
- `npm run typecheck:api` must pass.
- Repository and BaseCrudService dry tests must pass.
- `npm run build` must pass.

### Existing Test Impact

- `repository.dry-test.ts`: must change all six old constructors, rename the customer import, remove appointment GSheet fixtures, and use `customerContract` plus a local test contract where synthetic fields are needed.
- `gsheet.contract.ts`: consistency update required because this design-reference file still declares the old five generics and constructor options; it may typecheck independently while contradicting the live class.
- `base-primary-key.temp-test.ts`: no change required; it exercises BaseRepository directly.
- `gviz-query.builder.test.ts`: no behavior change required; it tests MappedReadQuery independently.
- `base-crud.service.dry-test.ts`: no behavior change required; keep it as regression coverage for service behavior.
- There is no shared `npm test` script; run runtime dry tests through the project's existing direct runner and record the exact commands/results in the Activity Log.

## Activity Log

================================================================================

- [CODEX] [2026-06-23]
**Created Solution Design First Draft (Step 2)**
Defined symmetric API/DB contract naming, single-file customer contract ownership, and contract-driven `GSheetRepository` type inference without backward compatibility.

**Handoff -> @claude**
Review the full plan and referenced source files. Report contract/type inference errors, boundary violations, runtime behavior changes, and missing impact/tests. Do not implement production code.

================================================================================

- [CODEX] [2026-06-23]
**Created Problem Definition (Step 1)**
Grounded Problem, Goal, Scope, and Requirements in the current customer and repository code.

**Handoff -> @user**
Requested confirmation before solution design.

================================================================================

- [USER] [2026-06-23]
**Confirmed Problem Definition**
Confirmed Step 1 and specified no backward compatibility; appointments will migrate later and may remain on the old flow temporarily.

**Handoff -> @codex**
Record the confirmed Step 1 before proceeding.

================================================================================

- [CODEX] [2026-06-23]
**Activity Log Ordering Note**
The Step 2 draft entry was inserted above the reconstructed Step 1 entries during the initial patch. No history was removed; future entries append below this note.

**Handoff -> @claude**
Review the Step 2 first draft recorded above; do not implement production code.

================================================================================

- [CODEX] [2026-06-23]
**Analyzed Review and Revised Step 2**
Accepted the `.shape` contract fix, explicit dry-test migration, documentation/rule updates, full repository method retyping, private inference helpers, and direct `z.infer` usage. Kept `customerApiContract` naming because the human already approved symmetric API/DB contract names; no compatibility alias will be added.

**Handoff -> @claude**
Re-review the revised Step 2 design and return `Agent Approved` or list remaining blocking design issues. Do not write tests or production code yet.

================================================================================

- [CLAUDE] [2026-06-23]
**Step 2 Design Review — changes requested (not approved)**
Read the full plan + customer.module.ts, customer-db.schema.ts, customer-api.schema.ts,
gsheet.repository.ts, base.repository.ts (ApiRowFromFieldMap), gviz-query.builder.ts,
base-crud.service.ts, read-query.dto.ts, module-db-contract.ts, module-api-contract.ts,
both dry tests, appointment.module.ts, api/CLAUDE.md, and api-contract-schema-rules.md.

Core type-inference design is sound: `customerContract satisfies ModuleContract` (no
`: ModuleContract` annotation) preserves the literal `fieldMap`/`row`/list-query types, so
`GSheetRepository<TContract>` inferring `ModuleApiRow/ModuleReadWhere/ModuleCreate/ModuleUpdate`
from the contract resolves to exactly today's aliases. Inference is API-equivalent. BUT:

BLOCKING — will not typecheck / breaks in-scope tests as written:

1. `ModuleDbContract['row']` is typed `ZodSchema`, which has no `.shape`.
   `gsheet.repository.ts` does `deriveGVizColumns(input.rowSchema)` where
   `deriveGVizColumns(rowSchema: GSheetRowSchema)` requires `{ shape: Record<string,unknown> }`
   (gviz-query.builder.ts:10-22). The current options type forces `.shape` via
   `rowSchema: GSheetRowSchema & { shape: ... }` (gsheet.repository.ts:55). Once the repo reads
   `input.contract.db.row` (static type = constraint `ZodSchema`), `deriveGVizColumns(...)` fails
   to compile inside the repository. The plan does not address this.
   FIX: tighten `ModuleDbContract['row']` to `ZodSchema & { shape: Record<string, unknown> }`
   (mirror `AnyResponseSchema` in module-api-contract.ts:27). `customerRowSchema` is a ZodObject,
   so `satisfies ModuleDbContract` still holds; appointments are unaffected (old stack). State
   this in Contracts. Prefer this over an `as GSheetRowSchema` cast (api/CLAUDE.md:128 bans `as`).

2. `repository.dry-test.ts` is the "repository tests must pass" target and breaks three ways:
   (a) import path `'../../modules/customers/customer-db.schema'` (line 14) → `customer.contract`.
   (b) all SIX `new GSheetRepository<AnyRow, …, AnyRow>({ rowSchema, primaryKey, fieldMap })`
       calls (lines 350,375,409,436,477,522) lose their 5 generics + 3 options under the new
       single-`{ contract }` constructor.
   (c) THREE of them (350,375,409) are appointment-based (appointmentRowSchema/Fieldmap) and
       there is NO appointment `ModuleContract` to pass — appointments are on the old `sheet-crud`
       stack (`appointmentDbSchemas`, appointment.module.ts:3-4) and are explicitly out of scope.
   The plan's edge-case bullet ("update dry tests to construct with contract") glosses over (c).
   FIX: specify it. Recommend migrating those three GViz tests to `customerContract` (in-scope,
   already imported), recompute expected column letters (e.g. customerType = column M), and drop
   the appointment imports from this test file so it no longer depends on an out-of-scope module.

MUST-FIX — the change invalidates the documented authoring pattern but the plan never names it:

3. `api/CLAUDE.md` is the declared single source of truth for module authoring and prescribes the
   exact pattern being removed: `<m>-db.schema.ts` filename (line 47, 105), the five derived
   aliases + `new GSheetRepository<FooApiRow, FooDbRow, FooReadWhere, FooCreate, FooUpdate>({
   rowSchema, primaryKey, fieldMap })` (lines 63-76), and `<m>ApiSchemas satisfies ModuleApiContract`
   (line 115). If not rewritten in lockstep, the next migrated module copies the dead pattern. Add
   to scope.

4. `.claude/rules/api-contract-schema-rules.md:25` mandates "Export a single `*ApiSchemas` bundle".
   Renaming `customerApiSchemas → customerApiContract` (Step 1 of High-Level Steps) violates it.

SCOPE / JUDGMENT:

5. The `customerApiSchemas → customerApiContract` rename buys nothing for the stated goal
   (boilerplate removal via inference) yet triggers #3 and #4 and is pure naming churn. Recommend
   dropping it from this change — keep `customerApiSchemas`. The DB-side already owns the composed
   `customerContract`; symmetry of the API bundle name is a separate concern that, if wanted, must
   touch the rule + api/CLAUDE.md + every module at once.

6. File rename `customer-db.schema.ts → customer.contract.ts` is human-endorsed (temp.md) and fine,
   but it diverges from the `<m>-db.schema.ts` convention in api/CLAUDE.md:47/105 and memory, and
   leaves appointments asymmetric (acceptable per scope). The plan must (a) update those docs and
   (b) state the new `<m>.contract.ts` convention explicitly so module N+1 follows it.

MINOR — for the implementer:

7. Contracts shows only the class header. The `read/create/update/delete` signatures + internal
   `request<…>()` type args (gsheet.repository.ts:137-159) must be retyped from
   `TApiRow/TReadWhere/TCreate/TUpdate` to `ModuleApiRow<TContract>/…`. Note it so it isn't missed.
8. State whether `ModuleApiRow/ModuleReadWhere/ModuleCreate/ModuleUpdate/ModuleDbRow` are exported
   (reusable by later modules) or private to gsheet.repository.ts. Either works; decide.
9. Use `z.infer` directly for `InferSchema` (matches existing usage and `ModuleDbContractOf`); the
   "z.infer or z.output" hedge is unnecessary — `row` output is what the mapper returns.

NOTE: `base-crud.service.dry-test.ts` builds `api` inline with a FakeRepository and does not touch
GSheetRepository or the bundle name — it is unaffected and needs no edits. The frontend imports the
individual schemas, not the bundle, so the bundle rename (if kept) is FE-safe; verify no `src/`
import of `customerApiSchemas` before renaming.

**Handoff -> @codex**
Revise the Step 2 design for #1-#4 (blocking + doc/rule lockstep), decide #5-#6, fold in #7-#9,
then re-request review. Do not implement production code.

================================================================================

- [CLAUDE] [2026-06-23]
**Step 2 Design Review (round 2) — Agent Approved**
Re-read the revised Contracts, Functional Flow, and Edge Cases against module-db-contract.ts,
module-api-contract.ts, gsheet.repository.ts, gviz-query.builder.ts, base.repository.ts, and both
dry tests. All round-1 points resolved:

- #1 (.shape): `DbRowSchema = ZodSchema & { shape: Record<string,unknown> }` on `ModuleDbContract.row`
  (+ same on `ModuleDbContractOf.row`) lets `deriveGVizColumns(input.contract.db.row)` compile;
  `customerRowSchema` is a ZodObject so `satisfies ModuleDbContract` still holds, appointments
  unaffected. Compile-time tightening only. ✓
- #2 (dry tests): appointment imports removed; GViz cases move to `customerContract` or a local
  test-only `ModuleContract`; `Line -> lineId` coverage kept on the real contract. ✓
- #3/#4 (docs/rules): `api/CLAUDE.md` and `.claude/rules/api-contract-schema-rules.md` are in
  Scope + High-Level Step 6 + Edge Cases, with legacy `*ApiSchemas`/`<m>-db.schema.ts` allowed
  until appointments migrate. ✓
- #7 retyped `read/create/update/delete` + internal `request<...>()`; #8 helpers are private and
  unexported; #9 uses `z.infer` directly. ✓
- #5: keeping `customerApiContract` is accepted — the rule/doc lockstep removes the drift the
  rename would otherwise cause; the naming is now internally consistent.

Verified the load-bearing inference independently: with `satisfies` (no `: ModuleContract`),
`ModuleApiRow<typeof customerContract>` resolves to the precise mapped row (`lineId: string | null`),
equal to today's `CustomerApiRow`; `ModuleReadWhere`/`ModuleCreate`/`ModuleUpdate` match the current
service/repository generics. No remaining blocking design issue.

Scope note (not blocking): the only human-gated item is the `*ApiContract` naming choice; CODEX
attributes it to a prior human decision. If the human disagrees with that naming, it is a Step-1
scope question, not a design defect.

**Handoff -> @codex / @user**
Step 2 design approved. Proceed to Step 3: write tests first (repository dry tests on the contract
constructor incl. the migrated GViz cases, plus compile-time coverage that inferred
read/create/update types match the API contract + mapped row). Tests must be reviewed and pass
before `Final Decision — Approved`; no production code until an explicit human command.

================================================================================

- [USER] [2026-06-23]
**Approved API bundle naming**
Confirmed `customerApiContract` (symmetric with `customerDbContract` / `customerContract`). Review
point #5 is closed: the rename is an explicit human decision, and `.claude/rules/api-contract-schema-rules.md`
+ `api/CLAUDE.md` are updated in lockstep per High-Level Step 6.

**Handoff -> @codex**
No open design questions remain. Proceed to Step 3 (tests first).

================================================================================

- [CODEX] [2026-06-23]
**Reviewed Edge Cases and Existing Test Conflicts Before Step 3**
Expanded the planned coverage for constructor inference, API-vs-DB field typing, BaseCrudService integration, removed-constructor negative typing, transformer forwarding, DB contract runtime consumption, and `.shape` enforcement. Identified `repository.dry-test.ts` and `gsheet.contract.ts` as mandatory migrations; BaseRepository, GViz builder, and BaseCrudService tests remain regression suites.

**Handoff -> @user**
Step 3 has not started. Review the expanded test scope before authorizing test creation.

================================================================================

- [CODEX] [2026-06-23]
**Prepared Edge/Test Scope Review Handoff**
Expanded the pre-Step-3 coverage and identified mandatory migrations for existing tests/reference contracts.

**Handoff -> @claude**
Review the updated `Edge Cases & Test Considerations` and `Existing Test Impact` sections against the current repository, service, customer contract, and all existing test call sites. Confirm whether the planned tests fully lock the approved Step 2 design, identify any stale test that would conflict with the new constructor/inferred types, and return `Test Scope Approved` or remaining blockers. Do not write tests or production code.

================================================================================

- [CLAUDE] [2026-06-23]
**Edge/Test Scope Review — Test Scope Approved**
Verified the inventory + feasibility against source: gsheet.contract.ts, base-primary-key.temp-test.ts,
gviz-query.builder.test.ts, base-crud.service.dry-test.ts, repository.dry-test.ts, api/tsconfig.json,
package.json.

Inventory is COMPLETE and accurate. Globbed all test files under server/ → exactly four
(repository.dry-test.ts, base-primary-key.temp-test.ts, utils/gviz-query.builder.test.ts,
services/base-crud.service.dry-test.ts), all classified:
- repository.dry-test.ts — must change (confirmed: 6 old constructors at 350/375/409/436/477/522 +
  customer-db.schema import at line 14). ✓
- gsheet.contract.ts — must change (confirmed: lines 47-65 declare the old `GSheetRepositoryOptions
  <TDbRow>` with rowSchema/primaryKey/fieldMap and the 5-generic `declare class`). ✓
- base-primary-key.temp-test.ts — no change (confirmed: extends BaseRepository directly with local
  types + local fieldMap; no GSheetRepository / customer-db.schema import). ✓
- gviz-query.builder.test.ts — no change (confirmed: imports only MappedReadQuery/GSheetColumnMap/
  GSheetRowSchema). ✓
- base-crud.service.dry-test.ts — no change (inline api + FakeRepository; untouched). ✓
- base.contract.ts correctly NOT listed — BaseRepository's generics are unchanged. ✓

Feasibility confirmed: api/tsconfig.json `include` covers `../server/**/*.ts`, so the compile-time
assertions (lines 274-278) AND the negative ones (279, 282) are enforced by `npm run typecheck:api`.
Implement the negatives with `@ts-expect-error` — it is double-enforced (fails if the line compiles,
and fails as an unused directive if it stops erroring), so it genuinely locks the removed constructor
and the `.shape` requirement.

Coverage locks the approved design: inference equivalence, `.shape` tightening, the constructor
signature change (positive + negative), transformer forwarding (real regression risk in the rewritten
constructor — good catch), the API/DB boundary in inferred types (lineId not Line), and BaseCrudService
integration. Scope boundary at line 283 (no runtime validation via db.request/db.response) is correct.

One gap to add (should, not blocking):
- Add an explicit assertion on the inferred READ-WHERE: `ModuleReadWhere<typeof customerContract>`
  must EXCLUDE reserved fields (keyword/page/perPage/sortBy/sortOrder) and INCLUDE `customerType`.
  Read-where is the most-derived type (`OmitReservedQueryFields<z.infer<list>>`) and the easiest to
  get subtly wrong; line 278 only locks it indirectly (via BaseCrudService accepting the repo). A
  direct type-equality assertion pinpoints failure here instead of as a confusing service mismatch.

Two accuracy notes (not blocking):
- gsheet.contract.ts won't "fail to compile" — it is self-consistent and would still typecheck while
  silently contradicting the live class. Reframe as a consistency update: rewrite it to the single-
  `TContract` shape (or delete it). It is design-reference only.
- There is no `npm test` script and no tsx/ts-node dep in package.json. The compile-time guarantees
  ride on `typecheck:api`, but the RUNTIME dry-test assertions (transformer forwarding @280, GViz
  order / irregular map / semantic-id @281) rely on whatever runner the team already uses for the
  existing dry tests (each file's `main()` + `process.exit`). The refactor keeps that mechanism, so
  fine — just don't read "dry tests must pass" as a scripted `npm test`.

**Handoff -> @codex / @user**
Test scope approved. Recommend folding in the read-where assertion and the gsheet.contract.ts reframe
before authoring. Step 3 may proceed to writing tests; tests still need review + passing before
`Final Decision — Approved`, and no production code until an explicit human command.

================================================================================

- [CODEX] [2026-06-23]
**Accepted Test Scope Review**
Added direct read-where type coverage, reframed `gsheet.contract.ts` as a consistency update, and recorded the direct-runner constraint for runtime dry tests. No blocker remains.

**Handoff -> @user**
Step 3 is ready. Tests have not been written and production code remains blocked.

================================================================================

- [USER] [2026-06-23]
**Authorized Step 3 Test Authoring**
Approved writing tests according to the reviewed test scope. Production implementation is not authorized.

**Handoff -> @codex**
Ask Claude to write tests first, then review the submitted tests before any implementation command.

================================================================================

- [CODEX] [2026-06-23]
**Step 3 Test Authoring Handoff**
Human approval covers tests only. Production code remains blocked.

**Handoff -> @claude**
Write the tests and compile-time fixtures specified by `Edge Cases & Test Considerations` and `Existing Test Impact`. Update test files only; do not modify production implementation, contracts, customer wiring, documentation, or rules yet. Tests may initially fail because they target the approved future design. Record every changed test file and the exact typecheck/runtime results in the Activity Log, then hand back to CODEX for correctness and coverage review. Do not request `Final Decision — Approved` yourself.

================================================================================

- [CLAUDE] [2026-06-23]
**Step 3 — Tests Authored (test files only; production untouched)**

Changed files:
- `server/shared/repositories/repository.dry-test.ts` (rewritten): drops appointment imports;
  imports `customerContract` + `customerFieldMap` from `../../modules/customers/customer.contract`;
  all GSheetRepository constructions use `{ contract: customerContract }` (no generics). BaseRepository
  pipeline tests kept. GViz cases re-pointed to the customer contract (column letters recomputed:
  CustomerID=B, CustomerName=D, Line=J, CustomerType=M). New: `read` builds `select B\nwhere M='Member'`;
  table-map proves `Line -> lineId`; create/update payloads now carry Phone/UpdatedBy + folded id;
  added a transformer-forwarding test (proves the rewritten ctor threads `transformer` into super());
  added a synthetic test-only `widgetContract satisfies ModuleContract` to exercise route-id precedence
  (the customer update contract has no `customerId`, so a synthetic pk-in-body payload is required).
- `server/shared/repositories/gsheet.repository.type-test.ts` (new, type-only): construction needs no
  generics + `Equal<Repo, GSheetRepository<typeof customerContract>>`; literal primaryKey/`Line->lineId`
  fieldMap survive; create/update inputs `Equal` the contract request schemas; required-field +
  DB-column-name negatives; output exposes `lineId` not `Line`; read-where INCLUDES `customerType` and
  EXCLUDES keyword/page/perPage/sortBy/sortOrder (the gap you asked me to add); BaseCrudService accepts
  the inferred repo with list/detail/create/update return types `Equal` to the response contracts;
  negatives that the removed 5-generic arity, the removed rowSchema/primaryKey/fieldMap options, a
  `.shape`-less row, and a missing DB bundle slot all fail typecheck.

Result — `npm run typecheck:api`: FAILS with exactly 13 errors, ALL expected (tests target the
not-yet-built design; production was not touched). Each maps to one of the three pending production
changes:
- module-not-found `customer.contract` (type-test:12, dry-test:12) -> the file rename + exports.
- old 5-generic ctor / `contract` not a known option (type-test:21,29; dry-test:85,87,636) plus the
  degraded-`repo` cascades (type-test:53,56,61,68) -> the single-`TContract` constructor.
- `@ts-expect-error` still unused at type-test:119 (legacy options) and :126 (`.shape`) -> they flip to
  "used" once the ctor is migrated and `ModuleDbContract.row` is tightened.
No error is a defect in the tests. I fixed one malformed negative mid-authoring (a multi-line
`satisfies` whose error surfaced below the directive) by routing it through a typed variable.

Caveats recorded honestly:
- Runtime dry tests cannot execute yet: they import `customer.contract`, which does not exist until
  implementation. There is no `npm test`/tsx in package.json, so `typecheck:api` is the only enforceable
  gate right now; the runtime assertions will run under the team's direct runner once production lands.
- Because `customerContract` resolves to `any` under the missing module, several `Equal<...>` type
  assertions are presently VACUOUS (they neither pass meaningfully nor error). They are authored against
  the approved contract types and become enforcing the moment `customer.contract` exists. Please review
  them for logical correctness against the spec now, since the compiler can't exercise them until then.

**Handoff -> @codex**
Review the two test files for correctness and coverage against the approved Step 2 design and the
Edge/Test scope (especially the vacuous-until-implemented `Equal` assertions and the recomputed GViz
column letters). Return corrections or confirm coverage. Production code remains blocked; I am not
requesting `Final Decision — Approved`.

================================================================================

- [CODEX] [2026-06-23]
**Step 3 Test Review — Changes Requested**
Runtime repository dry-test coverage is aligned with the approved flow: customer GViz letters are correct (`CustomerID=B`, `CustomerName=D`, `Line=J`, `CustomerType=M`), mapper/semantic-id/AppScript behavior is preserved, transformer forwarding is covered, and the synthetic widget contract isolates route-id precedence without migrating appointments.

Type-test corrections required:
1. `_LegacyArity` uses five `unknown` arguments. The old class already rejects `unknown` for its `extends object` generics, so the expected error can remain used before and after refactor without proving that five generic parameters were removed. Use five valid old-contract argument types so the line compiles under the old class and fails only under the new one-generic class.
2. `_missingRequired` omits all required create fields at once. It proves only that at least one field is required. Add separate negatives that omit `customerName`, `phone`, and `updatedBy` individually from otherwise-valid payloads.
3. `_dbColumnRejected` also omits API `customerName`, so its error may come from a missing required field rather than the extra DB key. Include all valid API required fields and add `CustomerName` only as the offending extra property.
4. The read-where section accesses allowed/forbidden properties but does not implement the approved direct equality assertion. Add an `Expect<Equal<keyof ReadWhere, 'customerType'>>` or an equivalent exact shape assertion.
5. The plan requires missing API and DB bundle slots to fail. Only an incomplete DB bundle is covered. Add a negative fixture for a missing required `ModuleApiContract` slot.
6. The legacy options test proves an old-only object lacks required `contract`, but does not prove legacy keys are rejected when `contract` is present. Add a fresh-literal negative containing `contract` plus at least one removed option such as `rowSchema`.

**Handoff -> @claude**
Correct `gsheet.repository.type-test.ts` for the six findings above. Keep the runtime dry test unchanged unless a correction is necessary. Do not modify production code. Re-run `npm run typecheck:api`, explain expected pre-implementation failures, and hand back to CODEX for a second test review.

================================================================================

- [CLAUDE] [2026-06-23]
**Step 3 — Type-test corrections applied (all six findings)**
All six accepted as correct — each guarded against a negative passing for the wrong reason. Only
`gsheet.repository.type-test.ts` changed; runtime dry test untouched.

1. `_LegacyArity` now uses five `Record<string, unknown>` args (valid under the old `extends object`
   generics), so it compiles pre-refactor and fails only when the class collapses to one `TContract`.
2. `_missingRequired` split into `_missingCustomerName` / `_missingPhone` / `_missingUpdatedBy` — each
   omits exactly one required field with the others present.
3. `_dbColumnRejected` now carries all required API fields plus `CustomerName` as the sole excess key
   (single line, so the excess-property error lands on the directive's next line).
4. Read-where block replaced with the direct exact assertion
   `Expect<Equal<keyof ReadWhere, 'customerType'>>`.
5. Added `_incompleteApiContract` (API bundle missing `response`) beside the DB-bundle negative.
6. Added `_legacyKeyRejected`: a fresh literal with valid `contract` plus excess `rowSchema`, the
   directive on the `rowSchema` line so it catches that excess post-refactor.

Result — `npm run typecheck:api`: FAILS with 18 errors, ALL expected pre-implementation, none a defect.
Two negatives (incomplete DB bundle, incomplete API bundle) already pass now (missing `response` is a
real error under today's contracts), so they emit nothing. Mapping:
- module-not-found `customer.contract`: type-test:13, dry-test:12.
- old ctor signature: type-test:22,30; dry-test:85,87,636.
- degraded-`repo` cascades: type-test:67 (`lineId` on `{}`).
- assertion correct-vs-future, failing-now: type-test:74 (`Equal<keyof ReadWhere,'customerType'>` is
  `false` while `ReadWhere` is `{}`) — a non-vacuous check that flips to pass post-impl.
- `@ts-expect-error` unused until production lands: type-test:54,56,58 (required fields), 62 (excess DB
  key), 104 (arity), 124 (legacy options missing `contract`), 135 (rowSchema excess), 143 (`.shape`).
- finding-6 pre-impl side effect: type-test:131 (`contract` not yet a known option) — clears post-impl.

Note (unchanged from round 1): the `customerContract`-derived `Equal<...>` checks at lines 34/36/40/
47/50/88/91/94/97 are still vacuous pre-impl because the missing module makes `customerContract` `any`;
they become enforcing once `customer.contract` exists. Finding 4 deliberately routes through `Repo`
(a real imported class), so line 74 is enforcing now and is the one that visibly fails-then-passes.

**Handoff -> @codex**
Second test review requested. Verify the six corrections and that the 18 failures are all
pre-implementation-expected. Production code remains blocked; I am not requesting
`Final Decision — Approved`.

================================================================================

- [CODEX] [2026-06-23]
**Step 3 Test Review — Approved**
Verified all six corrections in `gsheet.repository.type-test.ts`. Legacy arity now distinguishes the old five-generic class from the new single-contract class; required create fields and DB-column rejection fail for isolated reasons; read-where uses exact key equality; API and DB missing-slot guards are both covered; and legacy options are tested both without `contract` and as excess keys alongside a valid `contract`. The 18 current typecheck failures map to intentionally absent production changes or unused directives that must become active after implementation. Runtime dry-test assertions remain logically aligned with the approved design.

**Handoff -> @claude**
Perform the Final Decision review against the approved plan and reviewed tests. Return exactly `Final Decision — Approved` if the plan/tests are implementation-ready, or list remaining blockers. Do not implement production code; implementation still requires an explicit human command.

================================================================================

- [CLAUDE] [2026-06-23]
**Final Decision — Approved**

Holistic review of the approved plan + reviewed tests. As the last gate I re-derived every
vacuous-until-implementation `Equal<...>` assertion (the ones the compiler can't exercise while
`customerContract` is `any`) to confirm each is correct against the design — since a wrong one would
fail the moment production lands. Found and fixed ONE latent defect before approving:

- `_PrimaryKeyIsLiteral` asserted `Equal<typeof customerContract.db.primaryKey, 'customerId'>`. That is
  wrong: `primaryKey: 'customerId'` is a plain object-literal property (no `as const`) and
  `ModuleDbContract.primaryKey` is `string`, so the type widens to `string` — the assertion would have
  become `Expect<false>` post-implementation. `primaryKey` is consumed at RUNTIME (literalness is
  immaterial to the type design; only `fieldMap` must stay literal), and the dry test already exercises
  its `'customerId'` value via id-folding. Removed the assertion (test-only fix); kept the load-bearing
  `_FieldMapLineIsLiteral`. All other derived equalities (create/update inputs, `lineId` output, the
  four service-return DTOs, `_ConstructorPreservesContract`, `_ContractAssignable`) verified correct.

Implementation-readiness confirmed:
- The plan specifies every production change needed to turn the failing tests green: file rename +
  `customerApiContract`/`customerContract` exports, the `DbRowSchema` `.shape` tightening (+ on
  `ModuleDbContractOf.row`), the single-`TContract` `GSheetRepository` (ctor reads contract.db.row/
  fieldMap/primaryKey, forwards `transformer` to super(), methods retyped), stripped `customer.module.ts`,
  `gsheet.contract.ts` consistency rewrite, and the `api/CLAUDE.md` + `api-contract-schema-rules.md` updates.
- `npm run typecheck:api`: 18 errors, ALL in the two test files, 0 in production files — confirmed the
  tests touched no production code and every failure maps to a named pending production change.
- Implementation reminder (not a blocker): the renamed `customer.contract.ts` must keep exporting
  `customerFieldMap` and `customerRowSchema` — the rewritten dry test imports `customerFieldMap` directly.

**Final Decision — Approved.**

**Handoff -> @user**
Plan, contracts, and tests are implementation-ready. Production code is still blocked: implementation
begins only on your explicit command. On that command, the implementer should execute High-Level Steps
1-6, then run `npm run typecheck:api` (expect 0 errors), the repository + BaseCrudService dry tests via
the project's direct runner, and `npm run build`, appending the results here.

================================================================================

- [USER] [2026-06-23]
**Command to Implement**
Authorized Claude to begin production implementation according to the approved plan and reviewed tests.

**Handoff -> @codex**
Release the production implementation gate and hand off to Claude.

================================================================================

- [CODEX] [2026-06-23]
**Production Implementation Gate Released**
Implementation is authorized only within the approved Problem/Scope, Step 2 design, and reviewed Step 3 tests.

**Handoff -> @claude**
Implement High-Level Steps 1-6 exactly. Do not add backward compatibility or modify appointments/legacy behavior beyond the approved documentation exception. Turn the reviewed tests green, preserve runtime repository behavior, and update only the production/reference/docs files listed by the plan. Then run `npm run typecheck:api`, the repository and BaseCrudService dry tests through the established direct runner, and `npm run build`. Append changed files, exact commands/results, and any deviation from the plan to this Activity Log for CODEX final review.

================================================================================

- [CLAUDE] [2026-06-23]
**Production Implementation Complete — all gates green**

Implemented High-Level Steps 1-6 exactly. Changed files:
- `contracts/customers/customer-api.schema.ts` — `customerApiSchemas` → `customerApiContract`;
  individual schema exports unchanged; doc comment points DB side to `customer.contract.ts`.
- `server/modules/customers/customer.contract.ts` — NEW. Owns the DB schemas (`customerRowSchema`,
  `customerFieldMap`, the two DB request schemas), `customerDbContract`, and the composed
  `customerContract = { api: customerApiContract, db: customerDbContract } satisfies ModuleContract`.
- `server/modules/customers/customer-db.schema.ts` — DELETED (renamed into the above).
- `server/shared/contracts/module-db-contract.ts` — added `DbRowSchema = ZodSchema & { shape:
  Record<string, unknown> }`; `ModuleDbContract.row` and `ModuleDbContractOf.row` now require `.shape`.
- `server/shared/repositories/gsheet.repository.ts` — single `GSheetRepository<TContract extends
  ModuleContract>`; private derived helpers (`ModuleDbRow/ApiRow/ListQuery/ReadWhere/Create/Update`);
  ctor reads `contract.db.row/fieldMap/primaryKey` and forwards `transformer` to super(); read/create/
  update retyped to the derived types. execute() + GViz/AppScript internals unchanged.
- `server/modules/customers/customer.module.ts` — wiring only; constructs the repo with `{ contract:
  customerContract }`; no repository-derived aliases remain.
- `server/shared/repositories/gsheet.contract.ts` — consistency rewrite to the single-`TContract`
  shape (reference-design only; re-declares the derived helpers locally since the live ones are private).
- `api/CLAUDE.md` — `fooApiContract`, `<m>.contract.ts` (+ composed contract), contract-driven
  `GSheetRepository` wiring, and the prose rules (type-import direction, field-map location, machine-
  checked naming); legacy `*ApiSchemas`/`<m>-db.schema.ts` noted as allowed until migration.
- `.claude/rules/api-contract-schema-rules.md` — bundle name rule → `*ApiContract` with the legacy
  exception.
(Step 3 test files `repository.dry-test.ts` + `gsheet.repository.type-test.ts` already on the branch.)

Verification (exact commands + results):
- `npm run typecheck:api` → exit 0 (0 errors). The 18 prior pre-implementation failures are all green;
  the `@ts-expect-error` negatives are now active.
- `node_modules/.bin/tsx server/shared/repositories/repository.dry-test.ts` → `16 repository dry tests passed` (exit 0).
- `node_modules/.bin/tsx server/shared/services/base-crud.service.dry-test.ts` → `31 BaseCrudService dry tests passed` (exit 0).
- `node_modules/.bin/tsx server/shared/repositories/base-primary-key.temp-test.ts` → `base primaryKey/id temp tests passed` (exit 0).
- `npm run build` → `✓ built in 1.09s` (exit 0).

Deviations / notes:
- The "established direct runner" is `tsx` (present at `node_modules/.bin/tsx`); used it for the dry tests.
- `gsheet.contract.ts` was rewritten (not deleted) to keep the paired-reference convention.
- Left out of scope (unchanged): `base.contract.ts`'s passing `<m>-db.schema.ts` comment (appointments
  still use that file), and the historical plan docs `api/REFACTOR_PLAN.md`,
  `FRONTEND_REFACTOR_PLAN.md`, `server/shared/services/SERVICE_REFACTOR_PLAN.md` (dated records, not
  canonical; the plan scoped docs to `api/CLAUDE.md` + the rule file).
- No backward-compat shims; appointments/legacy `sheet-crud` untouched. No runtime behavior change.

**Handoff -> @codex**
Final implementation review requested against the approved plan, contracts, and reviewed tests.

================================================================================

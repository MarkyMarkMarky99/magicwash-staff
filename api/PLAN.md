# Field Mapping Refactor — Implementation Plan

> Status: proposed — awaiting sign-off before any code change. Appointments is a
> no-behavior-change baseline; a minimal customers module validates the irregular path.

## 1. Why the current convention breaks

The engine has no field map today. The API-field ⇄ DB-column pairing is computed
algorithmically by the naming convention in
`server/shared/sheet-crud/sheet-naming.ts`:

```ts
// AppointmentID -> appointmentId ; WhatsApp -> whatsApp ; Address -> address
ColumnToField<S>      // type-level
columnToField(column) // runtime twin
```

This single transform is the **only** bridge between the two contracts, and it is
used in **both directions, at both compile time and runtime**, across exactly four
runtime sites and five type-level sites:

| Where | Site | Direction | Purpose |
|---|---|---|---|
| `sheet-service.factory.ts:276` | `fieldToColumn` map | field → column | response projection |
| `sheet-service.factory.ts:309` | `appendPairs` | column → field | build APPEND payload from input |
| `sheet-service.factory.ts:312` | `updatePairs` | column → field | build UPDATE payload from input |
| `google-sheet-repository.factory.ts:80` | `sortColumns` | field → column | GViz `order by` |
| `sheet-service.factory.ts:63,72,82,86,108` | `ColumnToField` / `SheetDtoFor` | type-level | the 5 contract-completeness checks |

It breaks whenever a real header is **not** the exact PascalCase-with-uppercase-`ID`
twin of the API field. The customers sheet is the live trigger, and its real headers
(`schemas/gsheet-schema.md` §2) confirm the gap: the header is **`Line`** but the API
field is **`lineId`**, so the convention resolves it to `line` and the two cannot meet.
Most other customer headers happen to be regular (`CustomerID → customerId`,
`Whatsapp → whatsapp`) — which is exactly the point: *some* columns are irregular and the
algorithm can't tell which, so guessing is unsafe and an explicit per-column map is the
only reliable bridge.

Because the **same** transform backs both the compile-time checks and the runtime
resolver, an irregular header does not usually fail *silently* — within engine-covered
paths it surfaces as a **compile error** (a `lineId` response field has no backing column
once the real column `Line` projects to `line`). The real problem is that the convention
simply **cannot faithfully represent** the irregular header, leaving two bad outs:

- leak the wrong spelling into the public API (`line`), breaking the clean frontend
  contract; or
- "lie" in the row schema (write `LineID` to coax `lineId` out of the convention) — and
  *this* is the genuinely silent path: the row-schema key drives both the GViz column
  letters and the doPost payload keys, so a key that doesn't match the real `Line` header
  resolves reads/writes to the wrong column at runtime with no error.

Separately, paths the convention does **not** cover — filter clauses, which take DB
columns directly (see §4.5) — are unaffected by this transform and are reasoned about on
their own.

## 2. Design decision

**A complete, explicit per-module `fieldMap` (DB column → API field) fully replaces the
convention's name-resolution role.** The map is the single source of truth; the inverse
(field → column) is derived from it. The engine never computes a name again — a lookup
miss throws.

Why fully explicit rather than *convention + override patch*:

- The backend-only rules *no automatic fallback when a field is missing from the map* and
  *a missing mapping must fail clearly instead of silently querying the wrong column*
  directly forbid keeping `columnToField` as a fallback. A convention-default + override
  design never has a "missing" case — the algorithm always produces *something* — so it
  cannot fail clearly; it reintroduces the exact wrong-column bug.
- Completeness is **machine-checked**, so the boilerplate (~one line per column) is not a
  new failure surface: an unmapped row column has no API twin, so any response field,
  `sortBy` value, or payload column that needs it fails to compile. One added guard (every
  row column must appear in the map) closes the gap.

Trade-off accepted: each module's `*-db.schema.ts` gains an explicit `fieldMap` object
(15 entries for appointments, 20 for customers) — the intended cost of dropping an
untrustworthy algorithm. **Alternative considered and rejected:** convention as default +
sparse override map — rejected because it cannot honor the no-fallback / fail-clearly
rules.

The frontend is untouched: it keeps sending/receiving only camelCase API fields, never
sees a column name, and gains no mapper. The backend-only rules hold by construction since
the map lives entirely in `server/` (no DB names reach the frontend, no DB types are
imported there).

## 3. The map

Lives in `server/modules/<m>/<m>-db.schema.ts`, beside the row schema, added to the
`<m>DbSchemas` bundle so both engine factories receive it through the existing single
import. **Stored direction: DB column → API field**, one entry per row column (keys match
the row-schema keys = physical column order). The field → column inverse is derived from
it, so the one object is the single source of truth in both directions:

```ts
export const customerFieldMap = {
  Timestamp: 'timestamp',
  CustomerID: 'customerId',
  CustomerIndex: 'customerIndex',
  CustomerName: 'customerName',
  Phone: 'phone',
  // ...
  Line: 'lineId',          // header is 'Line' but the API field is 'lineId' — convention gives 'line'
  Whatsapp: 'whatsapp',    // regular under the convention; listed for completeness
  // ...
} as const satisfies Record<keyof CustomerRow & string, string>
```

The value is the **engine-side API field name** the engine translates to/from — for
response projection, request-payload building, and sort resolution — *not* strictly a
public response field. Some entries are audit/internal fields that never appear in any
frontend response but still need a stable engine name (e.g. `CreatedBy → createdBy`,
`UpdatedAt → updatedAt`).

Exactness, uniqueness, and value correctness are handled as follows:

- **All keys present, no stray keys (compile-time):** declare the map with
  `... as const satisfies Record<keyof CustomerRow & string, string>` (or a curried
  `defineFieldMap<CustomerRow>()(...)` helper) so a missing column *or* a column that
  isn't in the row is a compile error, while `as const` keeps the literal value types.
  A bare `Record<keyof TRow & string, string>` *constraint* on the generic is **not**
  enough to guarantee an exact map on its own.
- **No two columns share an API field — bijectivity (runtime):** validated when the
  resolver is built — `makeFieldResolver` throws at module load on a duplicate value. We
  do **not** claim compile-time duplicate detection: an inverted mapped type silently
  collapses duplicates rather than erroring, and a real type-level duplicate detector is
  out of scope unless we deliberately choose to build one.
- **Values are validated on use, not against a global field union (decision):** any value
  the engine actually consumes — a response, payload, or sort field — is already checked
  by §5's contract checks, so a typo there is a compile error. A column that *nothing*
  references (pure audit cells like `CreatedAt`/`UpdatedAt`) carries a value that is
  effectively a label: a typo such as `CreatedAt → 'createAt'` is harmless until that
  field is first referenced, at which point it becomes a compile error (no backing
  column). We deliberately do **not** constrain values to a declared union of all engine
  field names — no canonical such union exists without a second redundant declaration
  (audit timestamps appear in no schema), and the fail-on-use behavior already guarantees
  a wrong column is never queried. Conscious trade-off, see §5 residual.

## 4. Changes by file

1. **`server/shared/sheet-crud/sheet-naming.ts`**
   - Keep `columnLetterFor` (physical-order/letters — unrelated to field naming).
   - **Remove** `ColumnToField`, `columnToField`, `SheetDtoFor` (the convention).
   - **Pre-deletion search (do first):** a repo-wide grep for `columnToField`,
     `ColumnToField`, `SheetDtoFor` confirms the only consumers are the two engine
     factories (`sheet-service.factory.ts`, `google-sheet-repository.factory.ts`) and
     `sheet-naming.ts` itself — the legacy `.js` GViz proxy uses its own column arrays,
     not these. Re-run at implementation time and update every hit before removing.
   - Add map-driven replacements:
     - types: `SheetFieldMap<TRow> = Record<keyof TRow & string, string>`;
       `InvertFieldMap<TMap>` = `{ [C in keyof TMap as TMap[C]]: C & string }` (a reverse
       *lookup* type only — it collapses duplicates, it is not a duplicate detector);
       `FieldFor<TMap, C> = TMap[C]`; `ColumnFor<TMap, F> = InvertFieldMap<TMap>[F]`;
       `SheetDtoFor<TRow, TMap>` reprojected through `TMap`.
     - runtime: `makeFieldResolver(fieldMap)` → `{ toField(column), toColumn(field) }`,
       **throwing on a lookup miss** (no fallback) and **throwing at module load on a
       duplicate API field value** (the bijectivity guard).

2. **`server/shared/sheet-crud/sheet-crud.types.ts`**
   - `SheetDbSchemas` gains `fieldMap: TFieldMap` and a `TFieldMap` generic param. The
     generic *constraint* is `Record<keyof TRow & string, string>`, but exactness (no
     missing/stray columns) is the module author's job via `satisfies` / `defineFieldMap`
     (§3) — the constraint alone does not guarantee an exact map.

3. **`server/shared/sheet-crud/sheet-service.factory.ts`**
   - Thread `TFieldMap` through `SheetServiceConfig` / `createSheetService`.
   - Replace `ColumnToField<C>` with `FieldFor<TFieldMap, C>` in
     `UnfillableCreateColumns`, `UnfillableUpdateColumns`, `DroppedInputFields`,
     `UnsortableFields`; `ProjectedRow` uses the map-based `SheetDtoFor`.
   - Add a `RequireEmpty` check: **every row column must appear in `fieldMap`**.
   - Runtime: build `fieldToColumn` / `appendPairs` / `updatePairs` from
     `makeFieldResolver(db.fieldMap)` instead of `columnToField`.

4. **`server/shared/sheet-crud/google-sheet-repository.factory.ts`**
   - `db` config type gains `fieldMap`; `sortColumns` built from the resolver
     (field → column) instead of `columnToField`.

5. **`server/shared/sheet-crud/gviz-query.factory.ts` + filter clauses (clarification, decision needed)**
   - `gviz-query.factory.ts` consumes the already-resolved `sortColumns` map — **verify
     only, no change expected**.
   - **Filters are NOT field-map driven today and this plan keeps them that way.** The
     clause builders take **DB column keys directly** — `clause.eq('customerId', 'CustomerID')`
     passes the API filter key as the first arg and the *DB column* as the second; the
     second arg never goes through `columnToField`, so the rename refactor does not touch
     it. Module filter clauses therefore continue to spell DB columns explicitly and must
     be reviewed per-module against the real headers. **Open decision:** if we later want
     filters to resolve through the same `fieldMap`, the clause-builder API needs resolver
     support — tracked as a separate change, out of this refactor's scope.

6. **`server/modules/appointments/appointment-db.schema.ts`**
   - Add `appointmentFieldMap` (15 trivial entries — appointments already obeys the
     convention, so this is a no-behavior-change baseline that proves the wiring) and
     include it in `appointmentDbSchemas`. No module/route/contract changes.

7. **Validation case — customers (minimal, phase-1 only; see §6)**
   - Create `server/modules/customers/customer-db.schema.ts` (row schema + payload
     schemas + the **irregular** `customerFieldMap`) and a minimal `customer.module.ts`
     that wires `createGoogleSheetRepository` + `createSheetService`. That is enough to
     run every compile-time contract check against the irregular map — the real proof.
   - **Routes (`api/customers/{index,[id]}.ts`) and retiring the legacy `customers.js` /
     `[id].js` are explicitly NOT in this refactor** — phase-2 migration (see §6).

## 5. Guarantees (preserved + added)

All five existing **compile-time** contract checks keep working, now reading the explicit
map instead of the algorithm:

- payload column ∉ row / wrong cell type
- payload column the request can't fill
- request field landing in no payload column (silently dropped)
- response field with no backing column / dishonest nullability
- `sortBy` that is no column's API twin

**Added — compile-time:** every row column must have a `fieldMap` entry and no stray
columns are allowed, enforced by `as const satisfies Record<keyof TRow & string, string>`
on the module map (§3). "Forgot / mistyped a map key" is therefore a compile error.

**Added — runtime (module load):** the resolver throws on a duplicate API-field value
(bijectivity) and on any lookup miss. These are deliberately runtime checks — see §3 for
why type-level duplicate detection is not claimed — and a violation fails fast at import,
not mid-request.

**Residual (accepted):** a typo in a `fieldMap` *value* for a column that no response,
payload, or sort field references is not caught until that field is first referenced (then
it is a compile error — no backing column). See §3 for why values are validated on use
rather than against a declared global field union.

## 6. Scope, verification, decisions

- **Verification:** no project test suite exists — correctness is enforced by
  `tsc --noEmit` (via `api/tsconfig.json`) plus the new compile checks, and the runtime
  resolver guards at module load. The appointments module must compile and behave
  **identically** (its map is the convention written out). The minimal customers module
  (§4.7) exercises the irregular path end-to-end at compile time (projection, payload
  build, sort) without shipping a feature.
- **Customers scope:** phase-1 (this refactor) is the **minimal irregular-mapping
  validation case only** — `customer-db.schema.ts` + a wiring-only `customer.module.ts`.
  Building the full typed customers module, adding `api/customers/{index,[id]}.ts`, and
  retiring the legacy `api/customers.js` / `api/customers/[id].js` is a **phase-2
  migration**, not started unless explicitly approved.
- **Filter resolution** (whether clause builders should resolve through `fieldMap`) is a
  separate, explicitly out-of-scope decision (§4.5).
- **Out of scope:** legacy GViz `.js` proxy and its `server/gviz/schemas/*.js` column
  maps (separate world, not engine-driven); no frontend changes.

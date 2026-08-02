import type { ZodSchema, ZodType, ZodTypeDef } from 'zod'
import type { FieldMap } from '../repositories/base.repository.js'
import type { ModuleApiContract } from '../../../contracts/shared/module-api-contract.js'

/**
 * Shared module contract shapes — DB side (the backend↔database boundary).
 *
 * Speaks DB column keys and never crosses to the frontend. Mirrors the API
 * contract for long-term symmetry: `row` / `fieldMap` / `primaryKey` plus nested
 * `request` / `response`. Two views:
 *   - `ModuleDbContract` — the structural guard a module's DB bundle is checked
 *     against with `satisfies`.
 *   - `ModuleDbContractOf<...>` — the parameterized view for future typed
 *     consumers (e.g. a DB-response → API-response mapper built from one shape).
 *
 * The repository consumes only `row`, `fieldMap`, and `primaryKey` today;
 * `request`/`response` declare the DB write/read shapes even before every repo
 * path consumes them. Write slots (`create`/`update`/`delete`) are each
 * individually optional. A read-only module should declare `z.never()` for
 * `create`/`update` (see `invoice-view.contract.ts`, `order.contract.ts`'s
 * OrdersView, `invoice.contract.ts`'s Payment) rather than omitting the key —
 * `z.never()` declares "this sheet must never be written" as intent, instead
 * of protecting by omission (indistinguishable from "not filled in yet"). A
 * genuinely absent key still works: `GSheetRepository`'s
 * `isUnsupportedDbOperation` gates `create()`/`update()`/`batchAppend()` off
 * EITHER form identically, so this is a documentation-strength upgrade only —
 * it changes no runtime behavior.
 */

/** DB column name -> API/domain field name. Re-exported so the DB contract lives in one place. */
export type { FieldMap }

/**
 * A DB row schema is a Zod OBJECT: `GSheetRepository` derives the GViz column
 * letters from `row.shape` (physical column order), so the row must expose
 * `.shape`. Mirrors `AnyResponseSchema` on the API side. A non-object schema
 * (e.g. `z.string()`) fails the guard at compile time.
 */
export type DbRowSchema = ZodSchema & { shape: Record<string, unknown> }

/** Structural guard: a module's DB bundle must have exactly these slots. */
export type ModuleDbContract = {
  row: DbRowSchema
  fieldMap: FieldMap
  /** API/domain field name of the primary key, e.g. `customerId` (NOT the DB column). */
  primaryKey: string
  /** Always present as an object; create/update/delete members are each optional. */
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

/** Type-parameterized DB contract for future typed consumers. */
export type ModuleDbContractOf<
  TRow extends object,
  TCreate = never,
  TUpdate = never,
  TRead extends object = object,
  TCreateResponse extends object = never,
  TUpdateResponse extends object = never,
> = {
  row: ZodType<TRow, ZodTypeDef, unknown> & { shape: Record<string, unknown> }
  fieldMap: FieldMap
  primaryKey: string
  request: {
    create?: ZodType<TCreate, ZodTypeDef, unknown>
    update?: ZodType<TUpdate, ZodTypeDef, unknown>
    delete?: ZodSchema
  }
  response: {
    read: ZodType<TRead, ZodTypeDef, unknown>
    create?: ZodType<TCreateResponse, ZodTypeDef, unknown>
    update?: ZodType<TUpdateResponse, ZodTypeDef, unknown>
    delete?: ZodSchema
  }
}

/** The module-level contract: API bundle + DB bundle under one symbol. */
export type ModuleContract = {
  api: ModuleApiContract
  db: ModuleDbContract
}

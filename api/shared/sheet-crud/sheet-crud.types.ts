import type { ZodType, ZodTypeDef } from 'zod'
import type { ApiSortOrder } from '../types/api-request.types'

/**
 * Shared declarations for the sheet-crud engine — the generic CRUD stack that
 * simple one-sheet modules assemble by wiring a repository into a service
 * (createGoogleSheetRepository → createSheetService) instead of hand-writing
 * each layer.
 */

/** Column letters per row field, e.g. `{ AppointmentID: 'A', ... }`. */
export type SheetColumnLetters<TRow> = Record<keyof TRow, string>

/** Minimum parsed list-query shape the engine pages and sorts by. */
export interface SheetListFilter {
  page: number
  perPage: number
  sortBy: string
  sortOrder: ApiSortOrder
}

/** One GViz where-clause; null when the filter doesn't constrain it. */
export type SheetClause<TFilter> = (filter: TFilter) => string | null

/** `undefined` collapsed to `null`, mirroring how absent input lands in a cell. */
export type Coalesced<T> = undefined extends T ? Exclude<T, undefined> | null : T

/** Columns typed exactly `string` — eligible to hold the resource id. */
export type SheetIdColumn<TRow> = {
  [K in keyof TRow]-?: string extends TRow[K] ? (TRow[K] extends string ? K : never) : never
}[keyof TRow]

/**
 * Storage-agnostic data access surface a sheet service drives. The Google
 * Sheets pair (GViz reads + Apps Script writes) is one implementation of this
 * contract — not the contract itself. Writes return `unknown` on purpose:
 * validating the stored row the DB layer answers with is the service's job.
 */
export interface ResourceRepository<TRow, TFilter> {
  findById(id: string): Promise<TRow | null>
  findByFilter(filter: TFilter): Promise<TRow[]>
  append(payload: Partial<TRow>): Promise<unknown>
  /** `payload` holds column values only — how the id travels is transport detail. */
  update(id: string, payload: Partial<TRow>): Promise<unknown>
}

/**
 * The module's contract with the database layer, declared in its
 * `<m>-db.schema.ts`: the full stored row (key order = physical column
 * order), the id column, and one payload schema per write action. Action
 * payloads are declared per action — NOT derived from the row — because a
 * stored-row column type describes what may sit in the cell (including legacy
 * mess), while an action contract states what that action must send (e.g.
 * `CreatedBy` is nullable in storage but required on APPEND).
 */
export interface SheetDbSchemas<
  TRow extends object,
  TAppendPayload extends object,
  TUpdatePayload extends object,
> {
  row: ZodType<TRow, ZodTypeDef, unknown> & { shape: Record<keyof TRow & string, unknown> }
  idColumn: SheetIdColumn<TRow> & string
  /** Exact APPEND body (sans db-filled cells); key order = payload key order. */
  appendPayload: ZodType<TAppendPayload, ZodTypeDef, unknown> & {
    shape: Record<keyof TAppendPayload & string, unknown>
  }
  /** Exact UPDATE body (sans id — passed separately); PATCH semantics, so fields are optional. */
  updatePayload: ZodType<TUpdatePayload, ZodTypeDef, unknown> & {
    shape: Record<keyof TUpdatePayload & string, unknown>
  }
}

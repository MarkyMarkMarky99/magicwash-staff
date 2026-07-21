import { z } from 'zod'
import {
  customerApiContract,
  customerSourceSchema,
  customerTypeSchema,
  preferredContactMethodSchema,
} from '../../../contracts/customers/customer-api.schema.js'
import type { ModuleContract, ModuleDbContract } from '../../shared/contracts/module-db-contract.js'

/**
 * The customers module contract: the API ↔ database (Google Sheets / Apps Script)
 * DB side plus the composed module contract. This file is the single server-side
 * owner of the DB schemas, `customerDbContract`, and the composed
 * `customerContract` (API bundle + DB bundle). The DB side speaks sheet column
 * keys (PascalCase) and must never reach the frontend — the API-facing contract
 * lives in `contracts/customers/customer-api.schema.ts`.
 *
 * Why customers needs an explicit field map: the real sheet header is `Line`
 * but the API exposes it as `lineId`. The old PascalCase→camelCase convention
 * would resolve `Line` to `line`, so this module could not be expressed without
 * the map below — it is the concrete case the engine refactor exists for.
 */

// ── Stored row ───────────────────────────────────────────────────────────────
//
// ⚠️ KEY ORDER = PHYSICAL COLUMN ORDER IN THE SHEET (1st key = column A); see
// schemas/gsheet-schema.md §2. Column types describe what may sit in a stored
// cell (incl. legacy rows), NOT what an action must send — that's the payload
// schemas below.
export const customerRowSchema = z.object({
  Timestamp: z.string(),
  CustomerID: z.string(),
  CustomerIndex: z.string(),
  CustomerName: z.string(),
  Phone: z.string().nullable(), // contractually a string; stored as text with the leading 0 and returned as-is (no read-time normalization)
  Address: z.string().nullable(),
  Location: z.string().nullable(),
  RegisteredDate: z.string().nullable(),
  Facebook: z.string().nullable(),
  Line: z.string().nullable(),
  Whatsapp: z.string().nullable(),
  Email: z.string().nullable(),
  CustomerType: customerTypeSchema.nullable(),
  Source: customerSourceSchema.nullable(),
  ScheduledDays: z.string().nullable(),
  LastVisitDate: z.string().nullable(),
  PreferredContactMethod: preferredContactMethodSchema.nullable(),
  UpdatedAt: z.string().nullable(),
  UpdatedBy: z.string().nullable(),
  DeletedAt: z.string().nullable(),
})

// ── Write action payloads — declared per action, NOT derived from the row. The
//    server owns the identity/metadata columns (Timestamp, CustomerID,
//    CustomerIndex, UpdatedAt, DeletedAt); this sheet has no CreatedBy column,
//    so the write actor rides on UpdatedBy. ──

// CREATE flow (NOT old fill-null): a field omitted from the payload is not sent;
// an explicit null is sent as null; required fields must be present. So the
// required columns (CustomerName, Phone, UpdatedBy) stay present while every
// optional column is `.nullable().optional()` — mirrors the API create schema's
// nullish() fields after mapping.
export const customerDbCreateRequestSchema = z.object({
  CustomerName: z.string().min(1),
  Phone: z.string().min(1), // required non-null; stored as text so the Thai leading 0 survives
  Address: z.string().nullable().optional(),
  Location: z.string().nullable().optional(),
  RegisteredDate: z.string().nullable().optional(), // omit or null -> DB layer defaults to today
  Facebook: z.string().nullable().optional(),
  Line: z.string().nullable().optional(),
  Whatsapp: z.string().nullable().optional(),
  Email: z.string().nullable().optional(),
  CustomerType: customerTypeSchema.nullable().optional(),
  Source: customerSourceSchema.nullable().optional(),
  // Required on APPEND even though the stored cell is nullable (legacy rows).
  UpdatedBy: z.string().min(1),
})

/** PATCH semantics: only the fields being changed are sent; the id travels separately. */
export const customerDbUpdateRequestSchema = z.object({
  CustomerName: z.string().min(1).optional(),
  Phone: z.string().nullable().optional(), // stored as text so the Thai leading 0 survives
  Address: z.string().nullable().optional(),
  Location: z.string().nullable().optional(),
  RegisteredDate: z.string().nullable().optional(),
  Facebook: z.string().nullable().optional(),
  Line: z.string().nullable().optional(),
  Whatsapp: z.string().nullable().optional(),
  Email: z.string().nullable().optional(),
  CustomerType: customerTypeSchema.nullable().optional(),
  Source: customerSourceSchema.nullable().optional(),
  // Every update must carry its actor.
  UpdatedBy: z.string().min(1),
})

// ── DB column -> API field. `satisfies` makes a missing or stray column a
//    compile error; bijectivity is checked at runtime when the resolver is
//    built. `Line -> lineId` is the irregular pair the convention can't express. ──
export const customerFieldMap = {
  Timestamp: 'timestamp',
  CustomerID: 'customerId',
  CustomerIndex: 'customerIndex',
  CustomerName: 'customerName',
  Phone: 'phone',
  Address: 'address',
  Location: 'location',
  RegisteredDate: 'registeredDate',
  Facebook: 'facebook',
  Line: 'lineId',
  Whatsapp: 'whatsapp',
  Email: 'email',
  CustomerType: 'customerType',
  Source: 'source',
  ScheduledDays: 'scheduledDays',
  LastVisitDate: 'lastVisitDate',
  PreferredContactMethod: 'preferredContactMethod',
  UpdatedAt: 'updatedAt',
  UpdatedBy: 'updatedBy',
  DeletedAt: 'deletedAt',
} as const satisfies Record<keyof z.infer<typeof customerRowSchema> & string, string>

/**
 * The module DB contract bundle (backend↔database boundary) in the standard
 * `ModuleDbContract` shape — one import for the whole DB side. The repository
 * consumes `row` / `fieldMap` / `primaryKey` today; `request` / `response`
 * declare the DB write/read shapes for current and future consumers.
 *
 * `primaryKey` is the API/domain field name (`customerId`), not the DB column
 * (`CustomerID`) — the repository folds it into where[primaryKey] and the mapper
 * resolves it to the column.
 */
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

/**
 * The complete module contract: the API bundle (camelCase, FE-shareable) plus the
 * DB bundle (sheet columns, server-only) under one symbol. `satisfies` (never a
 * `: ModuleContract` annotation) keeps the exact `fieldMap` literal and per-slot
 * schema types, so `GSheetRepository` and `BaseCrudService` infer everything they
 * need off this one value. This is the module's single source of truth.
 */
export const customerContract = {
  api: customerApiContract,
  db: customerDbContract,
} satisfies ModuleContract

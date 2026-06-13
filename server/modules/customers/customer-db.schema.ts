import { z } from 'zod'
import {
  customerSourceSchema,
  customerTypeSchema,
  preferredContactMethodSchema,
} from '../../../contracts/customers/customer-api.schema'

/**
 * The customers API ↔ database contract (Google Sheets / Apps Script): the full
 * stored row, the explicit DB column -> API field map, and one exact payload
 * schema per write action. This side of the boundary speaks sheet column keys
 * (PascalCase) and must never reach the frontend — the API-facing contract lives
 * in `customer-api.schema.ts`.
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
  Phone: z.number().nullable(), // stored as an integer; loses Thai leading 0
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

export const customerAppendPayloadSchema = z.object({
  CustomerName: z.string().min(1),
  Phone: z.number().int().nullable(),
  Address: z.string().nullable(),
  Location: z.string().nullable(),
  RegisteredDate: z.string().nullable(), // null lets the DB layer default to today
  Facebook: z.string().nullable(),
  Line: z.string().nullable(),
  Whatsapp: z.string().nullable(),
  Email: z.string().nullable(),
  CustomerType: customerTypeSchema.nullable(),
  Source: customerSourceSchema.nullable(),
  ScheduledDays: z.string().nullable(),
  LastVisitDate: z.string().nullable(),
  PreferredContactMethod: preferredContactMethodSchema.nullable(),
  // Required on APPEND even though the stored cell is nullable (legacy rows).
  UpdatedBy: z.string().min(1),
})

/** PATCH semantics: only the fields being changed are sent; the id travels separately. */
export const customerUpdatePayloadSchema = z.object({
  CustomerName: z.string().min(1).optional(),
  Phone: z.number().int().nullable().optional(),
  Address: z.string().nullable().optional(),
  Location: z.string().nullable().optional(),
  RegisteredDate: z.string().nullable().optional(),
  Facebook: z.string().nullable().optional(),
  Line: z.string().nullable().optional(),
  Whatsapp: z.string().nullable().optional(),
  Email: z.string().nullable().optional(),
  CustomerType: customerTypeSchema.nullable().optional(),
  Source: customerSourceSchema.nullable().optional(),
  ScheduledDays: z.string().nullable().optional(),
  LastVisitDate: z.string().nullable().optional(),
  PreferredContactMethod: preferredContactMethodSchema.nullable().optional(),
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

/** The bundle both engine factories consume — one import for the whole DB contract. */
export const customerDbSchemas = {
  row: customerRowSchema,
  idColumn: 'CustomerID',
  fieldMap: customerFieldMap,
  appendPayload: customerAppendPayloadSchema,
  updatePayload: customerUpdatePayloadSchema,
} as const

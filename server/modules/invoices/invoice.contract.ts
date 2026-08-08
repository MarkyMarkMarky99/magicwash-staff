import { z } from 'zod'
import type { ModuleContract, ModuleDbContract } from '../../shared/contracts/module-db-contract.js'
import type { ModuleApiContract } from '../../../contracts/shared/module-api-contract.js'
export { invoiceViewContract, invoiceViewDbContract } from './invoice-view.contract.js'

/**
 * Invoices module — DB-side contracts, one bundle per PHYSICAL SHEET, all in
 * this one file per this module's non-negotiable rule
 * (`server/modules/invoices/invoice.repository.ts` is the only repository
 * file the module owns; this is the matching single contract file). Four
 * sheets, four bundles: `Invoice`, `InvoiceItem`, `Payment` below, plus
 * `InvoicesView` (imported from `invoice-view.contract.ts` and re-exported
 * here so `invoice.repository.ts` can build all four `GSheetRepository`
 * getters from this one module).
 *
 * Authoritative source of truth for the three sheets this file newly
 * contracts (read them, this file must lose to them):
 *   G:\My Drive\Magicwash\Database\GoogleSheets\Invoice.json
 *   G:\My Drive\Magicwash\Database\GoogleSheets\InvoiceItem.json
 *   G:\My Drive\Magicwash\Database\GoogleSheets\Payment.json
 * Ignore the stale Invoices.json / InvoiceItems.json one directory up — those
 * register different targets.
 *
 *   Invoice      → GViz tab "Invoices",     SheetLib target "Invoice",     PK invoice_number
 *   InvoiceItem  → GViz tab "InvoiceItems", SheetLib target "InvoiceItem", PK invoice_item_id
 *   Payment      → GViz tab "Payments",     no SheetLib target (unsupported writes below)
 *
 * All three share one private workbook that is NOT publicly readable. SheetLib
 * resolves that workbook from each write target (`Invoice`, `InvoiceItem`, or
 * `Payment`); the Node-side writer repositories therefore do not need a
 * spreadsheet-id environment variable. Nothing in this module ever calls
 * `.read()` on any of these three repositories; all GET traffic is served by
 * the separate, publicly readable `InvoicesView` materialized view.
 *
 * Each of the three write-side sheets therefore needs a `ModuleApiContract`
 * only to satisfy `GSheetRepository<TContract extends ModuleContract>`'s
 * type — there is no route, and `BaseCrudService` is never built from any of
 * them. `query.list`/`response.list` are deliberately trivial placeholders
 * (`internalListQuerySchema`/`internalListResponseSchema`) for exactly that
 * reason. `api.request.create`/`api.request.update` are NOT placeholders —
 * `GSheetRepository.create()`/`.update()`/`.batchAppend()` type their
 * parameter off these schemas, so they are the real, camelCase,
 * `InvoiceService`-internal command shapes the mapper renames down to the DB
 * column names in `fieldMap` before every SheetLib write.
 *
 * Nested JSON cell content — `customer` and every `adjustments` array — is
 * NOT renamed by `fieldMap` (the mapper only renames top-level DB columns),
 * so those nested shapes stay snake_case end to end, exactly matching the
 * literal JSON the sheet cell stores. `invoiceAdjustmentSchema` and
 * `invoiceCustomerSnapshotSchema` below are therefore shared, unchanged,
 * between the DB row schemas and the API/domain command schemas.
 *
 * What SheetLib does to this payload (confirmed by the coordinator against
 * `appscript/SheetLib/{SheetService,SchemaUtils}.js`, not assumed):
 *   1. Nested values are serialized for us (`typeof value === 'object' →
 *      JSON.stringify(value)`) — `customer` and `adjustments` must stay real
 *      objects/arrays. Pre-stringifying them double-encodes.
 *   2. `null` and `undefined` both become an empty cell, not the text "null".
 *   3. `created_at` is auto-stamped when absent (`doc.created_at =
 *      doc.created_at || _now()`); `created_by` is never auto-stamped.
 *   4. APPEND accepts an array and validates every document before writing
 *      any of them — one bad line rejects the whole batch and nothing is
 *      written. All `InvoiceItem` rows for one invoice therefore travel in
 *      ONE `batchAppend()` call, never a loop.
 *   5. Because of 2 and 3, the rule for every outbound payload here is: send
 *      only the columns this module actually owns, and OMIT every optional
 *      one rather than sending `null`/`undefined` for it.
 *
 * ⚠ Deviation from every sibling `<m>.contract.ts` in this codebase: the row
 * schemas below call `.strict()`. `appointment.contract.ts` /
 * `customer.contract.ts` / `order.contract.ts` don't — they rely on Zod's
 * default silent-strip of unknown keys. This module opts into `.strict()` on
 * purpose: the live JSON Schemas all declare `additionalProperties: false`,
 * and a stray key here should fail loudly (a build bug) rather than be
 * silently dropped on the way to a live production sheet.
 *
 * ⚠ Reconciliation note — `sku`: the live `InvoiceItem.json` still declares
 * `sku` as a valid nullable column (modeled below in the STORED row, for
 * accurate column-letter derivation). The coordinator's instruction was
 * explicit: "`sku` is dropped from the form and the payload" — so `sku` is
 * absent from `invoiceItemApiCreateSchema`/`invoiceItemDbCreateRequestSchema`
 * and `InvoiceService` never sends it. Flagged back as an objection in case
 * the doc file's lingering `sku: string | null` was meant to stay and this is
 * the wrong call.
 */

// ── Shared building block: one adjustment step ──────────────────────────────
//
// Identical shape on both Invoice.adjustments (invoice-level) and
// InvoiceItem.adjustments (item-level), but NOT identical arithmetic — see
// `contracts/invoices/invoice-calculator.ts`:
//   item level:    unit = unit_price; for adj in order: unit ±= per-unit step;
//                  net_total = quantity * unit  (order-sensitive; PERCENT
//                  compounds on the running per-unit value)
//   invoice level: total = sum(item.net_total); for adj in order: total ±=
//                  one whole-invoice step (order-sensitive; PERCENT compounds
//                  on the running invoice total, a different running value
//                  than the per-unit one above)
// Array order must survive from the form through to the sheet at both levels.

export const invoiceAdjustmentCalculationSchema = z.enum(['FIXED', 'PERCENT'])

export const invoiceAdjustmentSchema = z
  .object({
    label: z.string().min(1),
    calculation: invoiceAdjustmentCalculationSchema,
    /**
     * Signed. Negative deducts, positive adds. Zero is invalid per the live
     * schema (`"not": { "const": 0 }`) — drop the row instead of sending 0,
     * never write an empty/no-op adjustment.
     */
    value: z.number().refine((value) => value !== 0, 'adjustment value must not be 0'),
    /**
     * `ref_source`/`ref_code` are `dependentRequired` on each other in the
     * live schema: send both or neither, never exactly one.
     */
    ref_source: z.string().min(1).optional(),
    ref_code: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (adjustment) => (adjustment.ref_source === undefined) === (adjustment.ref_code === undefined),
    { message: 'ref_source and ref_code must both be present or both be omitted' },
  )

export type InvoiceAdjustment = z.infer<typeof invoiceAdjustmentSchema>

// ── Customer snapshot (Invoice.customer, the `#/$defs/customer` def) ────────
//
// Frozen at issue time so later profile edits never alter an issued invoice;
// never re-resolved when rendering. `tax_id` / `branch_code` / `contact_name`
// / `email` are OMITTED ENTIRELY from this pass's payload, not sent as null —
// there is no billing-detail UI yet, no source for them. They remain valid,
// optional columns on the live `customer` def for whenever a later feature
// populates them — just not modeled as keys here.

export const invoiceCustomerSnapshotSchema = z
  .object({
    customer_code: z.string().min(1),
    customer_name: z.string().min(1),
    phone: z.string().min(1).optional(),
    address: z.string().min(1).optional(),
  })
  .strict()

export type InvoiceCustomerSnapshot = z.infer<typeof invoiceCustomerSnapshotSchema>

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')

const internalListQuerySchema = z.object({})
const internalListResponseSchema = z.object({})

// ═══════════════════════════════════════════════════════════════════════════
// Invoice — GViz tab "Invoices", SheetLib target "Invoice", PK invoice_number
// ═══════════════════════════════════════════════════════════════════════════
//
// KEY ORDER = physical sheet column order (Invoice.json property order).

export const invoiceStatusSchema = z.enum(['DRAFT', 'ISSUED', 'CANCELLED', 'VOID'])

export const invoiceRowSchema = z
  .object({
    /** PK. Typed by staff, stored verbatim, never reformatted. */
    invoice_number: z.string().min(1),
    /**
     * Lifecycle only. This module always writes 'ISSUED'.
     * PAID / UNPAID / PARTIALLY_PAID / OVERDUE are computed downstream in
     * InvoicesView and are rejected by this enum — never write them here.
     */
    status: invoiceStatusSchema,
    /**
     * Only ORDER invoices exist for now — this module always writes the
     * literal 'ORDER'. CYCLE billing is a later feature.
     */
    billing_type: z.enum(['ORDER', 'CYCLE']),
    /** Only meaningful for CYCLE; null/omitted for ORDER. Stored column;
     *  this module's create command never populates it. */
    billing_period_start: z.string().nullable(),
    billing_period_end: z.string().nullable(),
    issued_date: isoDateSchema,
    due_date: isoDateSchema,
    /**
     * Must equal customer.customer_code exactly — a denormalization that
     * exists only because GViz cannot filter inside the JSON snapshot below.
     */
    customer_id: z.string().min(1),
    /** Real object — SheetLib JSON.stringifies it for us; never pre-stringify. */
    customer: invoiceCustomerSnapshotSchema,
    /**
     * Invoice-level. Applied ONCE to the running invoice total — different
     * arithmetic from InvoiceItem's per-item arrays despite the identical
     * shape. Real array, default []. The live schema has NO total/tax/balance
     * column on this row at all: those are computed downstream in
     * InvoicesView, never stored here.
     */
    adjustments: z.array(invoiceAdjustmentSchema).default([]),
    /**
     * NOT auto-stamped — must always be sent on create.
     */
    created_by: z.string().min(1),
    /** Stored column. SheetLib auto-stamps this when absent from the
     *  request; the create command never sends it explicitly. */
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.string().nullable(),
    deleted_at: z.string().nullable(),
    deleted_by: z.string().nullable(),
  })
  .strict()

export type InvoiceRow = z.infer<typeof invoiceRowSchema>

export const invoiceFieldMap = {
  invoice_number: 'invoiceNumber',
  status: 'status',
  billing_type: 'billingType',
  billing_period_start: 'billingPeriodStart',
  billing_period_end: 'billingPeriodEnd',
  issued_date: 'issuedDate',
  due_date: 'dueDate',
  customer_id: 'customerId',
  customer: 'customer',
  adjustments: 'adjustments',
  created_by: 'createdBy',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
} as const satisfies Record<keyof z.infer<typeof invoiceRowSchema> & string, string>

/** DB-facing capability/documentation schema — snake_case, exactly what
 *  `InvoiceService` sends on create. Not runtime-parsed by `GSheetRepository`
 *  itself; it exists so `db.request.create` is a real, non-undefined slot
 *  (the create-capability gate) that documents the DB-side shape. */
export const invoiceDbCreateRequestSchema = z.object({
  invoice_number: z.string().min(1),
  status: z.literal('ISSUED'),
  billing_type: z.literal('ORDER'),
  issued_date: isoDateSchema,
  due_date: isoDateSchema,
  customer_id: z.string().min(1),
  customer: invoiceCustomerSnapshotSchema,
  adjustments: z.array(invoiceAdjustmentSchema).default([]),
  created_by: z.string().min(1),
})

export const invoiceApiCreateSchema = z
  .object({
    invoiceNumber: z.string().min(1),
    status: z.literal('ISSUED'),
    billingType: z.literal('ORDER'),
    issuedDate: isoDateSchema,
    dueDate: isoDateSchema,
    customerId: z.string().min(1),
    customer: invoiceCustomerSnapshotSchema,
    adjustments: z.array(invoiceAdjustmentSchema).default([]),
    createdBy: z.string().min(1),
  })
  .strict()

export type InvoiceApiCreateCommand = z.infer<typeof invoiceApiCreateSchema>

const invoiceApiContract = {
  query: { list: internalListQuerySchema },
  // `update` is a required sibling of `create` in `ModuleApiContract`'s
  // structural shape but is never exercised: Invoice is create-only (no edit
  // path — see `contracts/invoices/invoice-api.schema.ts`), and `db.request`
  // below omits `update` entirely, so `.update()` rejects at runtime before
  // any fetch regardless of this placeholder.
  request: { create: invoiceApiCreateSchema, update: invoiceApiCreateSchema },
  response: { list: internalListResponseSchema },
} satisfies ModuleApiContract

export const invoiceDbContract = {
  row: invoiceRowSchema,
  fieldMap: invoiceFieldMap,
  primaryKey: 'invoiceNumber',
  request: { create: invoiceDbCreateRequestSchema },
  response: { read: invoiceRowSchema.partial(), create: invoiceRowSchema },
} satisfies ModuleDbContract

export const invoiceContract = {
  api: invoiceApiContract,
  db: invoiceDbContract,
} satisfies ModuleContract

// ═══════════════════════════════════════════════════════════════════════════
// InvoiceItem — GViz tab "InvoiceItems", SheetLib target "InvoiceItem",
// PK invoice_item_id, FK invoice_number
// ═══════════════════════════════════════════════════════════════════════════
//
// KEY ORDER = physical sheet column order (InvoiceItem.json property order).
// `subtotal`/`net_total` are computed inputs `InvoiceService` supplies —
// never sheet formulas, never trusted verbatim from the browser.

export const invoiceItemRowSchema = z
  .object({
    /** FK -> Invoice.invoice_number. Identical on every row of the batch. */
    invoice_number: z.string().min(1),
    /**
     * PK. Unique and immutable. Format: the first 8 hex characters of
     * `crypto.randomUUID()` — the one id scheme used across this codebase.
     * Generated by `InvoiceService`, not this contract file.
     */
    invoice_item_id: z.string().length(8),
    /** Display order within the invoice. 1-based, contiguous, caller-assigned. */
    item_no: z.number().int().positive(),
    /**
     * The invoice's single `sourceOrderId`, copied onto every row by the
     * service — one ORDER invoice bills exactly one order.
     */
    source_order_id: z.string().nullable(),
    /** Always null in this first version — no per-item traceability, only
     *  per-order via `source_order_id` above. */
    source_item_id: z.string().nullable(),
    /** Stored column; see the module header's reconciliation note — this
     *  module never populates it. */
    sku: z.string().nullable(),
    /** Free text. No enum. Always null in this first version. */
    service_type: z.string().nullable(),
    /** Customer-facing text, snapshot. */
    description: z.string().min(1),
    /** > 0, fractional allowed (kilograms). Zero and negative are rejected. */
    quantity: z.number().positive(),
    /** Free text label such as piece or kg. No enum. */
    unit: z.string().nullable(),
    /** Price of ONE unit before any item-level adjustment. */
    unit_price: z.number(),
    /** quantity × unit_price, before adjustments. The service computes this. */
    subtotal: z.number(),
    /**
     * Applied PER UNIT, in array order, then the result is × quantity — see
     * the module header comment. Real array: SheetLib JSON.stringifies
     * object/array values for us.
     */
    adjustments: z.array(invoiceAdjustmentSchema).default([]),
    /** Final line total after every adjustment. The service computes this. */
    net_total: z.number(),
  })
  .strict()

export type InvoiceItemRow = z.infer<typeof invoiceItemRowSchema>

export const invoiceItemFieldMap = {
  invoice_number: 'invoiceNumber',
  invoice_item_id: 'invoiceItemId',
  item_no: 'itemNo',
  source_order_id: 'sourceOrderId',
  source_item_id: 'sourceItemId',
  sku: 'sku',
  service_type: 'serviceType',
  description: 'description',
  quantity: 'quantity',
  unit: 'unit',
  unit_price: 'unitPrice',
  subtotal: 'subtotal',
  adjustments: 'adjustments',
  net_total: 'netTotal',
} as const satisfies Record<keyof z.infer<typeof invoiceItemRowSchema> & string, string>

/** DB-facing capability/documentation schema — snake_case, exactly what
 *  `InvoiceService` sends per row on `batchAppend()`. `sku` is intentionally
 *  NOT a key here — see the module header's reconciliation note. */
export const invoiceItemDbCreateRequestSchema = z.object({
  invoice_number: z.string().min(1),
  invoice_item_id: z.string().length(8),
  item_no: z.number().int().positive(),
  source_order_id: z.string().nullable(),
  source_item_id: z.string().nullable(),
  service_type: z.string().nullable(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().nullable(),
  unit_price: z.number(),
  subtotal: z.number(),
  adjustments: z.array(invoiceAdjustmentSchema).default([]),
  net_total: z.number(),
})

export const invoiceItemApiCreateSchema = z
  .object({
    invoiceNumber: z.string().min(1),
    invoiceItemId: z.string().length(8),
    itemNo: z.number().int().positive(),
    sourceOrderId: z.string().nullable(),
    sourceItemId: z.string().nullable(),
    serviceType: z.string().nullable(),
    description: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().nullable(),
    unitPrice: z.number(),
    subtotal: z.number(),
    adjustments: z.array(invoiceAdjustmentSchema).default([]),
    netTotal: z.number(),
  })
  .strict()

export type InvoiceItemApiCreateCommand = z.infer<typeof invoiceItemApiCreateSchema>

const invoiceItemApiContract = {
  query: { list: internalListQuerySchema },
  request: { create: invoiceItemApiCreateSchema, update: invoiceItemApiCreateSchema },
  response: { list: internalListResponseSchema },
} satisfies ModuleApiContract

export const invoiceItemDbContract = {
  row: invoiceItemRowSchema,
  fieldMap: invoiceItemFieldMap,
  primaryKey: 'invoiceItemId',
  request: { create: invoiceItemDbCreateRequestSchema },
  response: { read: invoiceItemRowSchema.partial(), create: invoiceItemRowSchema },
} satisfies ModuleDbContract

export const invoiceItemContract = {
  api: invoiceItemApiContract,
  db: invoiceItemDbContract,
} satisfies ModuleContract

// ═══════════════════════════════════════════════════════════════════════════
// Payment — GViz tab "Payments". No SheetLib target: writes are UNSUPPORTED
// by this rollout. `InvoiceService`'s create flow never touches Payment rows;
// this bundle exists only so the acceptance criterion "one GSheetRepository
// per physical sheet" holds for the whole Invoice workbook, ready for a
// future Payment write endpoint that is explicitly out of this rollout's
// scope (see `docs/invoice-module-refactor-plan.md`).
// ═══════════════════════════════════════════════════════════════════════════
//
// KEY ORDER = physical sheet column order (Payment.json property order).
// `slip_data` ("do not expose to customers") is modeled here (it's a real
// stored column, needed for correct column-letter derivation) but is not
// part of any API-facing schema anywhere in this module.

export const paymentMethodSchema = z.enum([
  'CASH',
  'BANK_TRANSFER',
  'CREDIT_CARD',
  'QR_PROMPTPAY',
  'GIFT_VOUCHER',
  'OTHER',
])

export const paymentStatusSchema = z.enum(['PENDING', 'VERIFIED', 'FAILED', 'CANCELLED'])

export const paymentRowSchema = z
  .object({
    payment_id: z.string().min(1),
    invoice_number: z.string().min(1),
    amount: z.number().nullable(),
    method: paymentMethodSchema,
    status: paymentStatusSchema,
    paid_at: z.string().nullable(),
    reference: z.string().nullable(),
    proof_url: z.string().nullable(),
    slip_data: z.string().nullable(),
    notes: z.string().nullable(),
    created_at: z.string().nullable(),
    created_by: z.string().nullable(),
    updated_at: z.string().nullable(),
    updated_by: z.string().nullable(),
    deleted_at: z.string().nullable(),
    deleted_by: z.string().nullable(),
  })
  .strict()

export type PaymentRow = z.infer<typeof paymentRowSchema>

export const paymentFieldMap = {
  payment_id: 'paymentId',
  invoice_number: 'invoiceNumber',
  amount: 'amount',
  method: 'method',
  status: 'status',
  paid_at: 'paidAt',
  reference: 'reference',
  proof_url: 'proofUrl',
  slip_data: 'slipData',
  notes: 'notes',
  created_at: 'createdAt',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
} as const satisfies Record<keyof z.infer<typeof paymentRowSchema> & string, string>

const paymentApiContract = {
  query: { list: internalListQuerySchema },
  // No `request` slot at all — unlike Invoice/InvoiceItem above, Payment has
  // no create/update command to type-check against, so `ModuleCreate`/
  // `ModuleUpdate` resolve to `never` and `.create()`/`.update()` are
  // uncallable at compile time, matching `db.request` (also empty) below.
  response: { list: internalListResponseSchema },
} satisfies ModuleApiContract

export const paymentDbContract = {
  row: paymentRowSchema,
  fieldMap: paymentFieldMap,
  primaryKey: 'paymentId',
  // `z.never()`, not an absent key: declares "this sheet must never be
  // written" as intent, rather than protecting by omission (indistinguishable
  // from "not filled in yet"). `GSheetRepository`'s `isUnsupportedDbOperation`
  // gates create()/update()/batchAppend() off EITHER an absent slot OR a
  // z.never() one, so this still rejects at runtime exactly as before.
  request: { create: z.never(), update: z.never() },
  response: { read: paymentRowSchema.partial() },
} satisfies ModuleDbContract

export const paymentContract = {
  api: paymentApiContract,
  db: paymentDbContract,
} satisfies ModuleContract

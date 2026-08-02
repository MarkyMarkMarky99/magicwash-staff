import { z } from 'zod'

/**
 * Invoices module — backend↔Apps Script (gateway) contract. DB-shaped,
 * snake_case, matching the live Google Sheets schemas verbatim:
 *
 *   Invoice      → tab "Invoices",     PK invoice_number
 *   InvoiceItem  → tab "InvoiceItems", PK invoice_item_id, FK invoice_number
 *
 * Authoritative source of truth (read them, this file must lose to them):
 *   G:\My Drive\Magicwash\Database\GoogleSheets\Invoice.json
 *   G:\My Drive\Magicwash\Database\GoogleSheets\InvoiceItem.json
 * Ignore the stale Invoices.json / InvoiceItems.json one directory up — those
 * register different targets.
 *
 * This file intentionally does NOT compose a `ModuleDbContract`/`ModuleContract`
 * the way `appointment.contract.ts` / `customer.contract.ts` / `order.contract.ts`
 * do. That shape assumes one sheet, one `row`/`fieldMap`/`primaryKey`, consumed by
 * a single `GSheetRepository`. This module writes to TWO sheets in one workbook
 * through a differently-shaped gateway envelope (`{ resource, action, target,
 * data }` → `{ status: 'ok' | 'error', ... }`, not `{ action, sheet, data }` →
 * `{ success, data }`), and never reads either sheet (InvoicesView, a separate
 * read-only materialized view in a different, publicly-readable spreadsheet,
 * covers reads — a separate module, not this one). There is nothing here for a
 * field map to rename: these schemas ARE the snake_case DB shape, and the
 * eventual camelCase FE↔BE contract (not written yet) is a distinct file that
 * maps onto this one by hand in the service, not through `Mapper`/`BaseRepository`.
 *
 * Row field order below follows the live JSON Schema's declared property order.
 * It is documentation only here — unlike `deriveGVizColumns`-backed modules,
 * nothing derives a GViz column letter from this order, because this module
 * never reads either sheet.
 *
 * What SheetLib does to this payload (confirmed by the coordinator against
 * `appscript/SheetLib/{SheetService,SchemaUtils}.js`, not assumed):
 *   1. Nested values are serialized for us (`typeof value === 'object' →
 *      JSON.stringify(value)`) — `customer` and `adjustments` below must stay
 *      real objects/arrays. Pre-stringifying them double-encodes.
 *   2. `null` and `undefined` both become an empty cell, not the text "null".
 *   3. `created_at` is auto-stamped when absent (`doc.created_at =
 *      doc.created_at || _now()`); `created_by` is never auto-stamped.
 *   4. APPEND accepts an array and validates every document before writing any
 *      of them — one bad line rejects the whole batch and nothing is written.
 *      All `InvoiceItem` rows for one invoice therefore travel in ONE request,
 *      never a loop, which removes the partially-written-items failure mode
 *      entirely. Write order is still items-batch first, then the invoice row
 *      second: with no cross-tab transaction, an orphaned item batch (invoice
 *      write failed) is recoverable and invisible to staff, while the reverse
 *      (an ISSUED invoice with no lines, visible and billable) would not be.
 *   5. Because of 2 and 3, the rule for this payload is: send only the
 *      columns we actually own, and OMIT every optional one rather than
 *      sending `null` for it. Omission says plainly that the system (Apps
 *      Script or a later feature) owns that value, and it stops a future
 *      default from being silently overwritten by our explicit null. The
 *      fields this module never sends at all — `created_at`, `updated_at`,
 *      `updated_by`, `deleted_at`, `deleted_by`, and (see the reconciliation
 *      note below) `sku` — are not modeled as keys in the schemas below,
 *      not modeled as `.nullable()` keys we happen to leave undefined.
 *
 * ⚠ Deviation from every sibling `<m>.contract.ts` in this codebase: these row
 * schemas call `.strict()`. `appointment.contract.ts` / `customer.contract.ts`
 * / `order.contract.ts` don't — they rely on Zod's default silent-strip of
 * unknown keys. This module opts into `.strict()` on purpose: the live JSON
 * Schemas both declare `additionalProperties: false`, and a stray key here
 * should fail loudly (a build bug) rather than be silently dropped on the way
 * to a live production sheet.
 *
 * ⚠ Reconciliation note — `sku`: the live `InvoiceItem.json` still declares
 * `sku` as a valid nullable column. The coordinator's instruction was
 * explicit: "`sku` is dropped from the form and the payload."
 * This file follows the chat instruction — `sku` is not modeled as a key on
 * `invoiceItemRowSchema` at all, so the service never sends it. Flagged back
 * as an objection in case the doc file's lingering `sku: string | null`
 * was meant to stay and this is the wrong call.
 */

// ── Shared building block: one adjustment step ──────────────────────────────
//
// Identical shape on both Invoice.adjustments (invoice-level) and
// InvoiceItem.adjustments (item-level) in the live schemas, but NOT identical
// arithmetic — that math belongs to the future service, not this file:
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
  .strict() // additionalProperties: false in the live schema
  .refine(
    (adjustment) => (adjustment.ref_source === undefined) === (adjustment.ref_code === undefined),
    { message: 'ref_source and ref_code must both be present or both be omitted' },
  )

export type InvoiceAdjustment = z.infer<typeof invoiceAdjustmentSchema>

// ── Customer snapshot (Invoice.customer, the `#/$defs/customer` def) ────────
//
// Frozen at issue time so later profile edits never alter an issued invoice;
// never re-resolved when rendering. `tax_id` / `branch_code` / `contact_name`
// / `email` are OMITTED ENTIRELY from this pass's payload, not sent as
// null — there is no billing-detail UI yet, no source for them, and the
// Customer sheet is not being extended to carry them. They are still valid,
// optional columns on the live `customer` def (13-digit `tax_id`, 5-digit
// `branch_code` with `branch_code` requiring `tax_id`) for whenever a later
// feature does populate them — just not modeled as keys here, since this
// contract describes what THIS module actually sends.

export const invoiceCustomerSnapshotSchema = z
  .object({
    customer_code: z.string().min(1),
    customer_name: z.string().min(1),
    phone: z.string().min(1).optional(),
    address: z.string().min(1).optional(),
  })
  .strict() // additionalProperties: false in the live schema

export type InvoiceCustomerSnapshot = z.infer<typeof invoiceCustomerSnapshotSchema>

// ── POST #1 — InvoiceItem rows (target "InvoiceItem"), sent FIRST as ONE batch ──
//
// `subtotal` and `net_total` are computed inputs the service must supply —
// never sheet formulas, never trusted verbatim from the browser (the client
// may show a live preview; the row sent here is the server's own arithmetic).

export const invoiceItemRowSchema = z
  .object({
    /** FK -> Invoice.invoice_number. Identical on every row of the batch. */
    invoice_number: z.string().min(1),
    /**
     * PK. Unique and immutable. Format: the first 8 hex characters of
     * `crypto.randomUUID()` — the one id scheme used across this codebase,
     * not a per-entity format. Generated by the service, not by this contract
     * file.
     */
    invoice_item_id: z.string().length(8),
    /** Display order within the invoice. 1-based, contiguous, caller-assigned. */
    item_no: z.number().int().positive(),
    /**
     * The invoice's single `sourceOrderId`, copied onto every row by the
     * service — one ORDER invoice bills exactly one order, and the client
     * sends the id once, at invoice level, not per line.
     */
    source_order_id: z.string().nullable(),
    /**
     * Always null in this first version — there is no longer any way to
     * trace a row back to the individual order item it came from, only to
     * the order via `source_order_id`. A hand-typed line and an
     * order-derived line are identical in shape.
     */
    source_item_id: z.string().nullable(),
    // `sku` is intentionally NOT a key here — see the module header's
    // reconciliation note. The live schema still allows a nullable `sku`
    // column; this module just never populates it.
    /** Free text. No enum — do not constrain this to a fixed list. Always
     *  null in this first version; see `source_item_id` above. */
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
     * object/array values for us, so this must stay an array, never a
     * pre-stringified string.
     */
    adjustments: z.array(invoiceAdjustmentSchema).default([]),
    /** Final line total after every adjustment. The service computes this. */
    net_total: z.number(),
  })
  .strict() // additionalProperties: false in the live schema

export type InvoiceItemRow = z.infer<typeof invoiceItemRowSchema>

// ── POST #2 — the Invoice header row (target "Invoice"), sent SECOND, alone ──

export const invoiceStatusSchema = z.enum(['DRAFT', 'ISSUED', 'CANCELLED', 'VOID'])

/** ISO 8601 calendar date (YYYY-MM-DD), no time component. */
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')

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
     * literal 'ORDER'. CYCLE billing is a later feature that will bring
     * `billing_type` back as a real enum plus a required, non-null
     * `billing_period_start`/`end` pair; no scaffolding for it is kept here.
     */
    billing_type: z.literal('ORDER'),
    // billing_period_start / billing_period_end are deliberately NOT modeled
    // as keys here (omitted, not sent as null) — see the file header's
    // "send only the columns we own" rule. The live schema still declares
    // both as nullable columns for CYCLE's sake; this module just never
    // populates them while only ORDER invoices exist.
    issued_date: isoDateSchema,
    due_date: isoDateSchema,
    /**
     * Must equal customer.customer_code exactly — a denormalization that
     * exists only because GViz cannot filter inside the JSON snapshot below.
     */
    customer_id: z.string().min(1),
    /** Real object — SheetLib JSON.stringifies it for us; do not pre-stringify. */
    customer: invoiceCustomerSnapshotSchema,
    /**
     * Invoice-level. Applied ONCE to the running invoice total (see the
     * module header comment) — different arithmetic from the per-item
     * arrays above despite the identical shape. Real array, default [].
     * Note the live schema has NO total/tax/balance column of any kind on
     * this row: subtotal and net_total exist only on InvoiceItem rows.
     * Invoice-level totals, balances, and payment status are computed
     * downstream when InvoicesView is built, never stored here.
     */
    adjustments: z.array(invoiceAdjustmentSchema).default([]),
    /**
     * NOT auto-stamped — must always be sent. Currently the literal string
     * 'staff' (`INVOICE_CREATED_BY` in `invoice.service.ts`) until this app
     * has real staff identity; kept in one named constant so switching to a
     * real actor is a one-line change.
     */
    created_by: z.string().min(1),
    // created_at / updated_at / updated_by / deleted_at / deleted_by are
    // deliberately NOT modeled as keys on this schema — this module never
    // sends any of them, on every create. The live schema's base `required`
    // list includes `created_at` because it describes the row as STORED:
    // SheetLib auto-stamps that column when the field is absent from the
    // request (`doc.created_at = doc.created_at || _now()`), so the stored
    // row always ends up with a value even though the outbound payload (what
    // this schema describes) omits it entirely. updated_at/by and
    // deleted_at/by are absent for a simpler reason: this is a create-only
    // module (no edit or delete path exists), so a newly-issued invoice has
    // never been updated or deleted — there is nothing to send.
  })
  .strict() // additionalProperties: false in the live schema

export type InvoiceRow = z.infer<typeof invoiceRowSchema>

// ── The gateway envelope ─────────────────────────────────────────────────────
//
// Plain TS interfaces, not Zod, mirroring `AppScriptRequest`/`AppScriptResponse`
// in `server/shared/repositories/gsheet.repository.ts` — the sibling convention
// for an envelope this module never runs a schema-based parse over. This is a
// DIFFERENT envelope than that repository's: `{ resource, action, target, data }`
// → `{ status: 'ok' | 'error', ... }`, not `{ action, sheet, data }` →
// `{ success, data }`. Do not reuse `GSheetRepository` for these targets.

export type InvoiceGatewayTarget = 'Invoice' | 'InvoiceItem'

export interface InvoiceGatewayAppendRequest<TRow> {
  resource: 'sheet'
  action: 'APPEND'
  target: InvoiceGatewayTarget
  /**
   * One row, or an array for a batch append. Every `InvoiceItem` row for one
   * invoice is sent as a single array in one request (see the module header
   * comment, point 4) — never as a loop of single-row requests.
   */
  data: TRow | TRow[]
}

export interface InvoiceGatewayAppendOk {
  resource: 'sheet'
  status: 'ok'
  target: string
  updated_range: string
  /** Present only when the request's `data` was an array. */
  appended_rows?: number
}

export interface InvoiceGatewayError {
  status: 'error'
  message: string
}

/**
 * Every gateway response is HTTP 200, including errors — dispatch on
 * `status`, never on the HTTP status code. Requests must POST with
 * `Content-Type: text/plain` (Apps Script rejects the JSON preflight) and
 * follow redirects, matching `src/utils/gateway.js`'s existing transport.
 */
export type InvoiceGatewayAppendResponse = InvoiceGatewayAppendOk | InvoiceGatewayError

/** The two concrete requests this module ever sends. */
export type InvoiceItemAppendRequest = InvoiceGatewayAppendRequest<InvoiceItemRow>
export type InvoiceAppendRequest = InvoiceGatewayAppendRequest<InvoiceRow>

import { z } from 'zod'

/**
 * Invoices API ↔ frontend contract — camelCase throughout, create only.
 *
 * ⚠ SCOPE: **create only.** There is no edit path — staff may not alter an
 * invoice once issued. Do not widen this contract into an update; a privileged
 * edit path requires its own endpoint and contract.
 *
 * The DB-shaped (snake_case) rows this backend sends onward to Apps Script are
 * declared in `server/sheets/Invoices/Invoices.db-contract.ts` and
 * `server/sheets/InvoiceItems/InvoiceItems.db-contract.ts`; the module service
 * owns their DB-to-API mapping. The arithmetic both this request and the write
 * payload rely on lives once, in
 * `contracts/invoices/invoice-calculator.ts`, imported by both the server
 * (authoritative) and the client (live preview) — never duplicated.
 */

// ── Shared building block: one adjustment step ──────────────────────────────
//
// Identical shape whether it's an invoice-level or an item-level adjustment,
// but NOT identical arithmetic — see `invoice-calculator.ts`. Array order is
// significant at both levels and must survive from the form to the sheet
// unchanged: never sort, dedupe, or normalize an adjustments array.

export const invoiceAdjustmentCalculationSchema = z.enum(['FIXED', 'PERCENT'])

export const invoiceAdjustmentInputSchema = z
  .object({
    label: z.string().trim().min(1),
    calculation: invoiceAdjustmentCalculationSchema,
    /** Signed; negative deducts. Zero is invalid — the UI drops empty rows
     *  instead of submitting them as a no-op zero adjustment. */
    value: z.number().refine((value) => value !== 0, 'value must not be 0'),
    /** Each requires the other — send both or neither. */
    refSource: z.string().trim().min(1).optional(),
    refCode: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine(
    (adjustment) => (adjustment.refSource === undefined) === (adjustment.refCode === undefined),
    { message: 'refSource and refCode must both be present or both be omitted' },
  )

export type InvoiceAdjustmentInput = z.infer<typeof invoiceAdjustmentInputSchema>

// ── Customer snapshot the client sends ──────────────────────────────────────

export const invoiceCustomerSnapshotInputSchema = z
  .object({
    /** The customer's id. The server derives BOTH `customerId` and
     *  `customer.customerCode` from this single value on the write side, so
     *  the two can never disagree — the client never sends a separate
     *  customerId. */
    customerCode: z.string().trim().min(1),
    customerName: z.string().trim().min(1),
    phone: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    // taxId / branchCode / contactName / email are not modeled here: no
    // source exists and none of this is on the form.
  })
  .strict()

export type InvoiceCustomerSnapshotInput = z.infer<typeof invoiceCustomerSnapshotInputSchema>

/** ISO 8601 calendar date (YYYY-MM-DD), no time component. */
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')

// ── One line item — deliberately minimal ───────────────────────────────────
//
// No sourceOrderId (it lives once at invoice level and the server fans it out
// onto every row), no sourceItemId, no serviceType — the server writes null
// for the latter two on every row. A line typed by hand and a line that
// originated from an order are identical in shape; that is intended.

export const invoiceLineInputSchema = z
  .object({
    description: z.string().trim().min(1),
    /** Free text label — piece, kg, and so on. Typed by staff. */
    unit: z.string().trim().min(1).optional(),
    /** Greater than zero. Fractions are legal (kilograms). */
    quantity: z.number().positive(),
    /** Price of one unit before any adjustment. Typed by staff on every
     *  line, including imported ones — order items carry no price. */
    unitPrice: z.number(),
    /** Item-level. Applied per unit, in array order, then multiplied by
     *  quantity — see `invoice-calculator.ts`. */
    adjustments: z.array(invoiceAdjustmentInputSchema).default([]),
  })
  .strict()

export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>

// ── POST /api/invoices — request ────────────────────────────────────────────
//
// No billingType. Only ORDER invoices exist: the server writes
// billing_type: 'ORDER' itself and omits both billing-period columns. No
// CYCLE scaffolding is kept here.

export const invoiceCreateSchema = z
  .object({
    /** Typed by staff. Stored verbatim, never reformatted. */
    invoiceNumber: z.string().trim().min(1),
    /** The order this invoice bills, chosen on the first screen.
     *  Invoice-level, not per line — the server fans it out onto every item
     *  row's source_order_id. */
    sourceOrderId: z.string().trim().min(1),
    /** Staff-chosen; the UI defaults it to today. Back-dating is allowed —
     *  this schema does not constrain it relative to "now". */
    issuedDate: isoDateSchema,
    dueDate: isoDateSchema,
    customer: invoiceCustomerSnapshotInputSchema,
    /** Invoice-level. Applied once to the running invoice total. */
    adjustments: z.array(invoiceAdjustmentInputSchema).default([]),
    /** At least one. Array order is the line order — item_no is derived
     *  from position on the write side, never sent by the client. */
    items: z.array(invoiceLineInputSchema).min(1),
  })
  .strict()

export type CreateInvoiceRequest = z.infer<typeof invoiceCreateSchema>

/*
 * Deliberately absent from `invoiceCreateSchema`. Every one of these is owned
 * by the server or by Apps Script; accepting them from a browser would mean
 * either trusting a forgeable value or carrying a field we then ignore:
 *
 *   subtotal, netTotal        the server computes them, authoritative
 *   invoiceItemId              the server mints it (8-char UUID segment)
 *   itemNo                     derived from items[] array position
 *   billingType                always ORDER; not a client's choice
 *   billingPeriodStart/End     only meaningful for CYCLE, which is not modeled
 *   status                     always ISSUED on create
 *   createdBy                  server constant (INVOICE_CREATED_BY)
 *   createdAt                  Apps Script stamps it
 *   customerId                 derived from customer.customerCode
 *   sku, taxId, branchCode,
 *   contactName, email         no source on this form
 *   item.sourceOrderId         sent once at invoice level; the server copies
 *                              it onto every item row
 *   item.sourceItemId,
 *   item.serviceType           omitted; server writes null
 *   updatedAt/By, deletedAt/By a new invoice has never been edited/deleted
 */

// ── POST /api/invoices — response ───────────────────────────────────────────
//
// Five outcomes, kept distinct on purpose — the difference between them is
// whether anything was written, which decides whether resubmitting is safe.
// Never collapse these into one generic error.

export const createInvoiceSuccessSchema = z.object({
  kind: z.literal('created'),
  invoiceNumber: z.string(),
  itemCount: z.number(),
  /** Sum of every line's net total, as the server computed it. */
  itemsTotal: z.number(),
  /** After invoice-level adjustments — what the customer owes. Returned
   *  because the sheet stores no total: the invoice row has no total, tax,
   *  or balance column, and InvoicesView only catches up later. */
  invoiceTotal: z.number(),
})

export const createInvoiceValidationErrorSchema = z.object({
  kind: z.literal('validation_error'),
  issues: z.array(z.object({ path: z.string(), message: z.string() })),
  // Nothing was written. Fix the form and submit again.
})

/**
 * Every write-stage failure outcome below carries `certainty`:
 *
 *   - 'rejected' — the gateway gave a definite answer that nothing (for that
 *     stage) was written (a well-formed `{ status: 'error' }`/`{ ok: false }`
 *     response). Safe to treat as retry-safe where the stage semantics
 *     already say so (only `items_write_failed` does).
 *   - 'unknown'  — no definite answer ever came back (network failure,
 *     timeout, non-2xx, unparsable body, or a malformed/unexpected response
 *     shape, INCLUDING a post-write validation failure after the gateway
 *     already answered ok). The write may or may not have persisted.
 *     NEVER offer an automatic retry for this certainty, even for a stage
 *     whose 'rejected' case is otherwise retry-safe — a lost response after
 *     `InvoiceItem` rows were actually written is exactly the case a plain
 *     "safe to try again" would double.
 *
 * Retry eligibility for `items_write_failed` keys off `certainty`, never off
 * `kind` alone: only `'rejected'` is retry-safe.
 */
export const invoiceWriteFailureCertaintySchema = z.enum(['rejected', 'unknown'])

export const createInvoiceItemsFailedSchema = z.object({
  kind: z.literal('items_write_failed'),
  message: z.string(),
  certainty: invoiceWriteFailureCertaintySchema,
  // 'rejected': nothing was written — Apps Script validates the whole item
  // batch before writing any of it, so a rejected batch leaves the sheet
  // untouched. Safe to retry as-is.
  // 'unknown': no definite answer came back — the batch may already be in
  // the sheet. NEVER safe to retry; a retry could double every line item.
})

export const createInvoiceHeaderFailedSchema = z.object({
  kind: z.literal('invoice_write_failed'),
  invoiceNumber: z.string(),
  itemCount: z.number(),
  certainty: invoiceWriteFailureCertaintySchema,
  // ⚠ The line items ARE in the sheet either way; only the invoice row
  // write's own outcome is described by `certainty` ('rejected': the header
  // definitely wasn't written; 'unknown': it might have been). Resubmitting
  // the same form writes a second set of items under the same
  // invoice_number regardless of `certainty` — the UI must say so plainly
  // and must NOT offer a plain retry here in either case; this needs a
  // person to reconcile.
})

export const createInvoiceOrderLinkFailedSchema = z.object({
  kind: z.literal('order_link_failed'),
  invoiceNumber: z.string(),
  sourceOrderId: z.string(),
  certainty: invoiceWriteFailureCertaintySchema,
  // ⚠ The invoice IS fully and correctly recorded at this point — both the
  // InvoiceItem batch and the Invoice header row were written successfully.
  // Only the OrderForm-side linkage (OrderForm.invoice_id) failed
  // ('rejected') or came back unconfirmed ('unknown'). The UI must NEVER
  // offer a retry here in either case: resubmitting would create a SECOND
  // invoice for money that's already correctly billed. An admin must look up
  // sourceOrderId and set invoice_id by hand.
})

export const createInvoiceViewSyncFailedSchema = z.object({
  kind: z.literal('invoice_view_sync_failed'),
  invoiceNumber: z.string(),
  message: z.string(),
  certainty: invoiceWriteFailureCertaintySchema,
  // The invoice, items, and order link are complete either way; only
  // InvoicesView is stale. The client must not create the invoice again
  // regardless of `certainty` — it describes only whether the view-sync
  // endpoint gave a definite answer, never whether the invoice itself needs
  // resubmitting.
})

export const createInvoiceResponseSchema = z.discriminatedUnion('kind', [
  createInvoiceSuccessSchema,
  createInvoiceValidationErrorSchema,
  createInvoiceItemsFailedSchema,
  createInvoiceHeaderFailedSchema,
  createInvoiceOrderLinkFailedSchema,
  createInvoiceViewSyncFailedSchema,
])

export type CreateInvoiceSuccess = z.infer<typeof createInvoiceSuccessSchema>
export type CreateInvoiceValidationError = z.infer<typeof createInvoiceValidationErrorSchema>
export type CreateInvoiceItemsFailed = z.infer<typeof createInvoiceItemsFailedSchema>
export type CreateInvoiceHeaderFailed = z.infer<typeof createInvoiceHeaderFailedSchema>
export type CreateInvoiceOrderLinkFailed = z.infer<typeof createInvoiceOrderLinkFailedSchema>
export type CreateInvoiceViewSyncFailed = z.infer<typeof createInvoiceViewSyncFailedSchema>
export type CreateInvoiceResponse = z.infer<typeof createInvoiceResponseSchema>

// ── GET — the duplicate-number check ────────────────────────────────────────
//
// `invoiceNumber` is the sheet's primary key, but the gateway enforces no
// uniqueness — a typo silently appends a second row. The only guard available
// is a read of InvoicesView (portal spreadsheet, publicly readable, unlike the
// workbook this module writes to). This check is CLIENT-SIDE, debounced while
// the invoice number is typed, run directly against InvoicesView: advisory only,
// it warns and never blocks, and a failed lookup must never prevent an invoice
// from being issued.

export const invoiceNumberCheckResultSchema = z.object({
  invoiceNumber: z.string(),
  exists: z.boolean(),
})

export type InvoiceNumberCheckResult = z.infer<typeof invoiceNumberCheckResultSchema>

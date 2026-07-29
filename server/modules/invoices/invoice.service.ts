import { randomUUID } from 'node:crypto'
import {
  invoiceCreateSchema,
  type CreateInvoiceResponse,
  type InvoiceAdjustmentInput,
} from '../../../contracts/invoices/invoice-api.schema.js'
import {
  computeInvoiceLine,
  computeInvoiceTotal,
} from '../../../contracts/invoices/invoice-calculator.js'
import {
  invoiceItemRowSchema,
  invoiceRowSchema,
  type InvoiceAdjustment,
  type InvoiceItemRow,
  type InvoiceRow,
} from './invoice.contract.js'
import { appendInvoice, appendInvoiceItems } from './invoice.gateway-client.js'

/**
 * `created_by` placeholder until this app has real staff identity — kept in
 * one named constant so switching to a real actor is a one-line change.
 */
export const INVOICE_CREATED_BY = 'staff'

/** The one id scheme used across this codebase: the first 8 hex characters
 *  of `crypto.randomUUID()` (its first hyphen-delimited group, no stripping
 *  needed) — not a per-entity format. */
function generateShortId(): string {
  return randomUUID().slice(0, 8)
}

/** camelCase adjustment input -> snake_case write-side adjustment. Drops a
 *  `refSource`/`refCode` pair only when BOTH are absent — the API schema
 *  already refines that they're never sent one without the other. */
function toDbAdjustment(adjustment: InvoiceAdjustmentInput): InvoiceAdjustment {
  return {
    label: adjustment.label,
    calculation: adjustment.calculation,
    value: adjustment.value,
    ...(adjustment.refSource !== undefined ? { ref_source: adjustment.refSource } : {}),
    ...(adjustment.refCode !== undefined ? { ref_code: adjustment.refCode } : {}),
  }
}

/**
 * Creates one invoice: validates, computes every line's `subtotal`/
 * `net_total` server-side (authoritative — the client's own live preview is
 * never trusted), writes the `InvoiceItem` batch FIRST, then the `Invoice`
 * header row, and returns one of four distinct outcomes. Never throws for an
 * expected outcome (bad input, a rejected item batch, a failed header write)
 * — those are all represented in the return value per
 * `contracts/invoices/invoice-api.schema.ts`. Only a genuine programmer error
 * (e.g. this module building a row that fails its own DB-side schema) should
 * escape as a thrown error, and is not expected to happen against
 * already-validated input.
 */
export async function createInvoice(payload: unknown): Promise<CreateInvoiceResponse> {
  const parsed = invoiceCreateSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      kind: 'validation_error',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    }
  }

  const request = parsed.data

  // ── Compute every line server-side; nothing the browser sent for
  //    subtotal/netTotal is read anywhere in this function. ──
  const lineCalculations = request.items.map((item) =>
    computeInvoiceLine({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      adjustments: item.adjustments,
    }),
  )

  const itemRows: InvoiceItemRow[] = request.items.map((item, index) =>
    invoiceItemRowSchema.parse({
      invoice_number: request.invoiceNumber,
      invoice_item_id: generateShortId(),
      item_no: index + 1, // 1-based, derived from array position — never client-sent
      // The invoice's single sourceOrderId, fanned out onto every row —
      // there is no per-line sourceOrderId in this request anymore.
      source_order_id: request.sourceOrderId,
      // Always null in this first version — no per-item traceability, only
      // per-order via source_order_id above.
      source_item_id: null,
      service_type: null,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit ?? null,
      unit_price: item.unitPrice,
      subtotal: lineCalculations[index].subtotal,
      adjustments: item.adjustments.map(toDbAdjustment),
      net_total: lineCalculations[index].netTotal,
    }),
  )

  // ── Items first, as ONE batch — never a loop. See invoice.contract.ts's
  //    write-sequence comment for why this ordering is load-bearing. ──
  const itemsWrite = await appendInvoiceItems(itemRows)
  if (itemsWrite.status === 'error') {
    // Nothing was written: Apps Script validates the whole batch before
    // writing any of it. Safe for the caller to fix and resubmit as-is.
    return { kind: 'items_write_failed', message: itemsWrite.message }
  }

  const invoiceRow: InvoiceRow = invoiceRowSchema.parse({
    invoice_number: request.invoiceNumber,
    status: 'ISSUED',
    // Only ORDER invoices exist for now — not a client choice, and
    // billing_period_start/end are omitted entirely (see invoice.contract.ts).
    billing_type: 'ORDER',
    issued_date: request.issuedDate,
    due_date: request.dueDate,
    // Denormalized so GViz can filter without reaching into the JSON
    // snapshot — must equal customer.customer_code exactly.
    customer_id: request.customer.customerCode,
    customer: {
      customer_code: request.customer.customerCode,
      customer_name: request.customer.customerName,
      ...(request.customer.phone !== undefined ? { phone: request.customer.phone } : {}),
      ...(request.customer.address !== undefined ? { address: request.customer.address } : {}),
    },
    adjustments: request.adjustments.map(toDbAdjustment),
    created_by: INVOICE_CREATED_BY,
    // created_at: omitted — Apps Script auto-stamps it.
  })

  const invoiceWrite = await appendInvoice(invoiceRow)
  if (invoiceWrite.status === 'error') {
    // ⚠ Worst-case outcome: the item batch above already succeeded, so
    // itemRows.length rows now exist referencing an invoice_number with no
    // header row. Reported as its own distinct kind — never collapsed into
    // items_write_failed — because a person now has to reconcile this by
    // hand, and a plain retry would append a second set of items.
    return {
      kind: 'invoice_write_failed',
      invoiceNumber: request.invoiceNumber,
      itemCount: itemRows.length,
    }
  }

  const itemsTotal = lineCalculations.reduce((sum, calculation) => sum + calculation.netTotal, 0)
  const invoiceTotal = computeInvoiceTotal(
    lineCalculations.map((calculation) => calculation.netTotal),
    request.adjustments,
  )

  return {
    kind: 'created',
    invoiceNumber: request.invoiceNumber,
    itemCount: itemRows.length,
    itemsTotal,
    invoiceTotal,
  }
}

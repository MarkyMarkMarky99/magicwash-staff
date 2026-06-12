import { AppScriptClient } from '../../../shared/google-sheets/appscript.client'
import { GVizClient } from '../../../shared/google-sheets/gviz.client'
import { BaseSheetRepository } from '../../../shared/repositories/base-sheet.repository'
import {
  invoiceItemQuery,
  invoiceQuery,
  paymentQuery,
  paymentSummaryQuery,
} from '../queries/invoice-gviz.query'
import type {
  InvoiceCreateRecord,
  InvoiceFilter,
  InvoiceItemRow,
  InvoiceListRecordRow,
  InvoiceRecordRow,
  InvoiceRow,
  PaymentRow,
  PaymentSummaryRow,
  PaymentUpdateWrite,
  PaymentWrite,
} from '../types/invoice-sheet.types'

/**
 * Invoices are normalized across four sheets (Invoices, InvoiceItems,
 * PaymentSummary, Payments) inside one spreadsheet, written through one Apps
 * Script endpoint. This repository is the only place that knows that layout: it
 * composes the four sheets into the aggregate read shapes the mapper consumes,
 * and fans a single logical write out to the sheets it touches.
 *
 * ATOMICITY: Sheets has no cross-sheet transaction. Multi-sheet writes below run
 * as ordered Apps Script calls and are NOT atomic — a mid-way failure can leave a
 * partial invoice. Acceptable for now; the proper fix is a batched `doPost` action
 * that writes all rows for one invoice in a single request. See note on `create`.
 */

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

// One spreadsheet, four tabs, one write endpoint — so the GViz/AppScript clients
// are shared; only the sheet (tab) name differs per BaseSheetRepository.
const gvizClient = new GVizClient({ spreadsheetId: requireEnv('INVOICES_SPREADSHEET_ID') })
const appScriptClient = new AppScriptClient({ scriptUrl: requireEnv('APPSCRIPT_INVOICE_URL') })

const invoiceSheet = new BaseSheetRepository<InvoiceRow>({
  sheet: process.env.INVOICES_SHEET_NAME ?? 'Invoices',
  gvizClient,
  appScriptClient,
})
const invoiceItemSheet = new BaseSheetRepository<InvoiceItemRow>({
  sheet: process.env.INVOICE_ITEMS_SHEET_NAME ?? 'InvoiceItems',
  gvizClient,
  appScriptClient,
})
const paymentSummarySheet = new BaseSheetRepository<PaymentSummaryRow>({
  sheet: process.env.PAYMENT_SUMMARY_SHEET_NAME ?? 'PaymentSummary',
  gvizClient,
  appScriptClient,
})
const paymentSheet = new BaseSheetRepository<PaymentRow>({
  sheet: process.env.PAYMENTS_SHEET_NAME ?? 'Payments',
  gvizClient,
  appScriptClient,
})

export const invoiceRepository = {
  // ── Reads ─────────────────────────────────────────────────────────
  /** Full record for the detail view: header + items + rollup + payments. */
  async getById(invoiceId: string): Promise<InvoiceRecordRow | null> {
    const [invoice] = await invoiceSheet.get(invoiceQuery.getById(invoiceId))
    if (!invoice) {
      return null
    }

    const [items, summaries, payments] = await Promise.all([
      invoiceItemSheet.get(invoiceItemQuery.getByInvoiceId(invoiceId)),
      paymentSummarySheet.get(paymentSummaryQuery.getByInvoiceId(invoiceId)),
      paymentSheet.get(paymentQuery.getByInvoiceId(invoiceId)),
    ])

    return {
      invoice,
      items,
      paymentSummary: summaries[0] ?? null,
      payments,
    }
  },

  /**
   * List records: header + rollup only. The list DTO needs no items/payments, so
   * this reads two sheets and joins in memory — TWO queries total regardless of
   * page size, never 1 + 3·N. Filtering/sort happen in the Invoices query; the
   * `status` filter and pagination are applied by the service after the join.
   */
  async getByFilter(filter: InvoiceFilter): Promise<InvoiceListRecordRow[]> {
    const invoices = await invoiceSheet.get(invoiceQuery.getByFilter(filter))
    if (!invoices.length) {
      return []
    }

    const summaries = await paymentSummarySheet.get(
      paymentSummaryQuery.getByInvoiceIds(invoices.map((invoice) => invoice.id)),
    )
    const summaryByInvoiceId = new Map(summaries.map((summary) => [summary.invoice_id, summary]))

    return invoices.map((invoice) => ({
      invoice,
      paymentSummary: summaryByInvoiceId.get(invoice.id) ?? null,
    }))
  },

  // ── Writes ────────────────────────────────────────────────────────
  /**
   * Persist a new invoice across three sheets in dependency order
   * (header → items → rollup). NOT atomic (see module note): a failure after the
   * header is written leaves a partial invoice. Move to a single batched `doPost`
   * action when atomicity/throughput on many line items matters.
   */
  async create(record: InvoiceCreateRecord): Promise<void> {
    await invoiceSheet.create(record.invoice)
    for (const item of record.items) {
      await invoiceItemSheet.create(item)
    }
    await paymentSummarySheet.create(record.paymentSummary)
  },

  /** Append a payment, then restate the invoice's rollup. */
  async recordPayment(write: PaymentWrite): Promise<void> {
    await paymentSheet.create(write.payment)
    await paymentSummarySheet.update(write.summary)
  },

  /** Patch a payment (e.g. PENDING → VERIFIED), then restate the rollup. */
  async updatePayment(write: PaymentUpdateWrite): Promise<void> {
    await paymentSheet.update(write.payment)
    await paymentSummarySheet.update(write.summary)
  },
}

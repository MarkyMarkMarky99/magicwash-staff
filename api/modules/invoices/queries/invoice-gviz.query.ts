import {
  INVOICE_COLUMNS,
  INVOICE_ITEM_COLUMNS,
  PAYMENT_COLUMNS,
  PAYMENT_SUMMARY_COLUMNS,
} from '../types/invoice-sheet.types'
import type { InvoiceFilter, InvoiceRow } from '../types/invoice-sheet.types'

// ── Invoices sheet ──────────────────────────────────────────────────
export const invoiceQuery = {
  getById(invoiceId: string): string {
    return `
      select *
      where ${INVOICE_COLUMNS.id} = '${sanitize(invoiceId)}' and ${notDeleted(INVOICE_COLUMNS.deleted_at)}
      limit 1
    `
  },

  getByFilter(filter: InvoiceFilter): string {
    // Only clauses that map to real Invoices-sheet columns. `status` (incl. derived
    // OVERDUE) lives on PaymentSummary — the service filters it after the join.
    const clauses = [
      keywordClause(filter.keyword),
      customerClause(filter.customerId),
      issuedDateClause(filter.dateFrom, filter.dateTo),
      notDeleted(INVOICE_COLUMNS.deleted_at),
    ].filter(Boolean)

    return `
      select *
      where ${clauses.join('\nand ')}
      order by ${sortColumn(filter.sortBy)} ${filter.sortOrder}
    `
  },
}

// ── InvoiceItems sheet ──────────────────────────────────────────────
export const invoiceItemQuery = {
  getByInvoiceId(invoiceId: string): string {
    return `select * where ${INVOICE_ITEM_COLUMNS.invoice_id} = '${sanitize(invoiceId)}'`
  },
}

// ── PaymentSummary sheet ────────────────────────────────────────────
export const paymentSummaryQuery = {
  getByInvoiceId(invoiceId: string): string {
    return `
      select *
      where ${PAYMENT_SUMMARY_COLUMNS.invoice_id} = '${sanitize(invoiceId)}' and ${notDeleted(PAYMENT_SUMMARY_COLUMNS.deleted_at)}
      limit 1
    `
  },

  // Batch the rollup for a page of invoices into one query (no per-invoice round-trip).
  getByInvoiceIds(invoiceIds: string[]): string {
    const list = invoiceIds
      .map((id) => `${PAYMENT_SUMMARY_COLUMNS.invoice_id} = '${sanitize(id)}'`)
      .join(' or ')

    return `
      select *
      where (${list}) and ${notDeleted(PAYMENT_SUMMARY_COLUMNS.deleted_at)}
    `
  },
}

// ── Payments sheet ──────────────────────────────────────────────────
export const paymentQuery = {
  getByInvoiceId(invoiceId: string): string {
    return `select * where ${PAYMENT_COLUMNS.invoice_id} = '${sanitize(invoiceId)}'`
  },
}

// ── Invoices-sheet clause helpers ───────────────────────────────────
function keywordClause(keyword: string): string | null {
  const value = keyword.trim()
  if (!value) {
    return null
  }

  const term = sanitize(value)
  return `(${INVOICE_COLUMNS.invoice_number} contains '${term}' or ${INVOICE_COLUMNS.customer_name} contains '${term}')`
}

function customerClause(customerId: string | null): string | null {
  return customerId ? `${INVOICE_COLUMNS.customer_id} = '${sanitize(customerId)}'` : null
}

function issuedDateClause(dateFrom: string | null, dateTo: string | null): string | null {
  if (dateFrom && dateTo) {
    return `${INVOICE_COLUMNS.issued_date} >= date '${sanitize(dateFrom)}' and ${INVOICE_COLUMNS.issued_date} <= date '${sanitize(dateTo)}'`
  }
  if (dateFrom) {
    return `${INVOICE_COLUMNS.issued_date} >= date '${sanitize(dateFrom)}'`
  }
  if (dateTo) {
    return `${INVOICE_COLUMNS.issued_date} <= date '${sanitize(dateTo)}'`
  }
  return null
}

function sortColumn(sortBy: InvoiceFilter['sortBy']): string {
  // sortBy is a camelCase API field; resolve it to a DB column, then to its letter.
  const columnByField: Record<InvoiceFilter['sortBy'], keyof InvoiceRow> = {
    invoiceNumber: 'invoice_number',
    customerId: 'customer_id',
    customerName: 'customer_name',
    issuedDate: 'issued_date',
    dueDate: 'due_date',
    totalAmount: 'total_amount',
    createdAt: 'created_at',
  }

  return INVOICE_COLUMNS[columnByField[sortBy]]
}

function notDeleted(deletedAtColumn: string): string {
  return `${deletedAtColumn} is null`
}

function sanitize(value: string): string {
  return value.replace(/'/g, '')
}

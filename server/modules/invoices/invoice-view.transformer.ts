import type { RepositoryTransformer } from '../../shared/repositories/base.repository.js'
import {
  isRecord,
  normalizeGVizDate,
  parseJsonArray,
  parseJsonObject,
  toNullableNumber,
  toNullableString,
} from '../../shared/repositories/utils/gviz-cell.js'

// Read-only: no request hook. customerJson/itemsJson/adjustmentsJson/paymentsJson
// arrive from GViz as serialized JSON text (a sheet cell can't hold a nested
// value) — everything else on the row passes through unchanged.

export interface InvoiceViewCustomer {
  customerCode: string | null
  customerName: string | null
  phone: string | null
  address: string | null
}

export interface InvoiceViewAdjustment {
  label: string | null
  calculation: string | null
  value: number | null
  refSource: string | null
  refCode: string | null
}

export interface InvoiceViewItem {
  description: string | null
  unit: string | null
  quantity: number | null
  unitPrice: number | null
  subtotal: number | null
  adjustments: InvoiceViewAdjustment[]
  netTotal: number | null
}

export interface InvoiceViewPayment {
  paymentId: string | null
  amount: number | null
  method: string | null
  status: string | null
  paidAt: string | null
  reference: string | null
  proofUrl: string | null
  notes: string | null
}

export function createInvoiceViewTransformer(): RepositoryTransformer {
  return {
    response(response) {
      return transformInvoiceViewResponse(response)
    },
  }
}

export function transformInvoiceViewResponse(response: unknown): unknown {
  if (Array.isArray(response)) {
    return response.map((row) => (isRecord(row) ? transformInvoiceViewRow(row) : row))
  }

  if (isRecord(response)) {
    return transformInvoiceViewRow(response)
  }

  return response
}

export function transformInvoiceViewRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    issuedDate: normalizeGVizDate(row.issuedDate),
    dueDate: normalizeGVizDate(row.dueDate),
    customer: parseCustomer(row.customerJson),
    items: parseItems(row.itemsJson),
    adjustments: mapAdjustments(parseJsonArray(row.adjustmentsJson)),
    payments: parsePayments(row.paymentsJson),
  }
}

function parseCustomer(value: unknown): InvoiceViewCustomer | null {
  const parsed = parseJsonObject(value)
  if (parsed === null) {
    return null
  }

  return {
    customerCode: toNullableString(parsed.customerCode),
    customerName: toNullableString(parsed.customerName),
    phone: toNullableString(parsed.phone),
    address: toNullableString(parsed.address),
  }
}

function parseItems(value: unknown): InvoiceViewItem[] {
  return parseJsonArray(value).filter(isRecord).map(mapItem)
}

function mapItem(item: Record<string, unknown>): InvoiceViewItem {
  return {
    description: toNullableString(item.description),
    unit: toNullableString(item.unit),
    quantity: toNullableNumber(item.quantity),
    unitPrice: toNullableNumber(item.unitPrice),
    subtotal: toNullableNumber(item.subtotal),
    // Already a real array here (nested inside the parsed itemsJson), not a
    // second JSON string — unlike the invoice-level adjustmentsJson column.
    adjustments: mapAdjustments(item.adjustments),
    netTotal: toNullableNumber(item.netTotal),
  }
}

function parsePayments(value: unknown): InvoiceViewPayment[] {
  return parseJsonArray(value).filter(isRecord).map(mapPayment)
}

function mapPayment(payment: Record<string, unknown>): InvoiceViewPayment {
  return {
    paymentId: toNullableString(payment.paymentId),
    amount: toNullableNumber(payment.amount),
    method: toNullableString(payment.method),
    status: toNullableString(payment.status),
    paidAt: toNullableString(payment.paidAt),
    reference: toNullableString(payment.reference),
    proofUrl: toNullableString(payment.proofUrl),
    notes: toNullableString(payment.notes),
  }
}

function mapAdjustments(value: unknown): InvoiceViewAdjustment[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord).map(mapAdjustment)
}

function mapAdjustment(adjustment: Record<string, unknown>): InvoiceViewAdjustment {
  return {
    label: toNullableString(adjustment.label),
    calculation: toNullableString(adjustment.calculation),
    value: toNullableNumber(adjustment.value),
    refSource: toNullableString(adjustment.refSource),
    refCode: toNullableString(adjustment.refCode),
  }
}

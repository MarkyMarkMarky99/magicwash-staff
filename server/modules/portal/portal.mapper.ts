import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'

export type SourceRow = Record<string, unknown>

function hasValue(value: unknown): boolean {
  return value !== '' && value != null && !(typeof value === 'string' && !value.trim())
}

function number(value: unknown): number {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function jsonCell(value: unknown): unknown {
  return value ?? ''
}

function viewCell(value: unknown): unknown {
  if (value instanceof Date) {
    const [year, month, day] = formatBangkokTimestamp(value).slice(0, 10).split('-').map(Number)
    return `Date(${year},${month! - 1},${day})`
  }
  if (typeof value === 'number') return String(value).replace('e', 'E')
  return value === '' || value == null ? null : String(value)
}

function viewDate(value: unknown): unknown {
  if (value instanceof Date) return formatBangkokTimestamp(value).slice(0, 10)
  if (!value) return null
  const match = /^Date\((\d+),(\d+),(\d+)\)$/.exec(String(value))
  if (!match) return value
  return `${match[1]}-${String(+match[2]! + 1).padStart(2, '0')}-${String(+match[3]!).padStart(2, '0')}`
}

function groupRows(rows: SourceRow[], field: string): Map<string, SourceRow[]> {
  const groups = new Map<string, SourceRow[]>()
  for (const row of rows) {
    const key = String(row[field] || '').trim()
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  return groups
}

export function assemblePortalOrders(orders: SourceRow[], items: SourceRow[], now: Date) {
  const groups = groupRows(items, 'order_id')
  const syncedAt = formatBangkokTimestamp(now).slice(0, 10)
  return orders.filter((order) => number(order.quantity) > 0).map((order) => ({
    orderId: viewCell(order.id),
    customerId: viewCell(order.customer_id),
    orderNumber: viewCell(order.order_number),
    // Update.js copies physical column S, named invoice_id in the source contract.
    invoiceNumber: viewCell(order.invoice_id),
    receivedDate: viewDate(order.received_date),
    dueDate: viewDate(order.due_date),
    serviceType: viewCell(order.service_type),
    status: viewCell(order.status),
    quantity: order.quantity === '' || order.quantity == null ? null : order.quantity,
    note: viewCell(order.note),
    itemsJson: JSON.stringify((String(order.id || '').trim()
      ? groups.get(String(order.id || '').trim()) ?? [] : []).map((item) => ({
      id: jsonCell(item.id),
      item_id: jsonCell(item.item_id),
      description: jsonCell(item.description),
      quantity: jsonCell(item.quantity),
      price: jsonCell(item.price),
      credits_used: jsonCell(item.credits_used),
      category: jsonCell(item.category),
      service_type: jsonCell(item.service_type),
      special_instructions: jsonCell(item.special_instructions),
    }))),
    syncedAt,
    createdAt: viewDate(order.received_date),
  }))
}

function parseJson(value: unknown, container: 'object'): SourceRow
function parseJson(value: unknown, container: 'array'): SourceRow[]
function parseJson(value: unknown, container: 'object' | 'array'): SourceRow | SourceRow[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (container === 'array' && Array.isArray(parsed)) return parsed
    if (container === 'object' && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as SourceRow
    }
  } catch { /* Malformed JSON uses the builder's empty-container fallback. */ }
  return container === 'array' ? [] : {}
}

function applyAdjustment(running: number, adjustment: SourceRow): number {
  const value = number(adjustment.value)
  if (adjustment.calculation === 'FIXED') return running + value
  if (adjustment.calculation === 'PERCENT') return running + running * value / 100
  return running
}

function projectItem(item: SourceRow) {
  let runningUnit = number(item.unit_price)
  return {
    description: jsonCell(item.description),
    unit: jsonCell(item.unit),
    quantity: jsonCell(item.quantity),
    unitPrice: jsonCell(item.unit_price),
    subtotal: jsonCell(item.subtotal),
    netTotal: jsonCell(item.net_total),
    sourceOrderId: jsonCell(item.source_order_id),
    sourceItemId: jsonCell(item.source_item_id),
    serviceType: jsonCell(item.service_type),
    adjustments: parseJson(item.adjustments, 'array').map((adjustment) => {
      const before = runningUnit
      runningUnit = applyAdjustment(runningUnit, adjustment)
      return { label: adjustment.label, amount: roundMoney((runningUnit - before) * number(item.quantity)) }
    }),
  }
}

function timestamp(value: unknown): number {
  if (!hasValue(value)) return 0
  const date = scriptDate(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function scriptDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value.trim())) {
    return new Date(`${value.trim()}+07:00`)
  }
  return new Date(value as string)
}

function calendarDay(value: unknown): string | null {
  if (!hasValue(value)) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.trim().split('-').map(Number)
    return formatBangkokTimestamp(new Date(Date.UTC(year!, month! - 1, day!, -7))).slice(0, 10)
  }
  const date = scriptDate(value)
  return Number.isNaN(date.getTime()) ? null : formatBangkokTimestamp(date).slice(0, 10)
}

function resolveStatus(source: unknown, grandTotal: number, paidAmount: number, due: unknown, now: Date): unknown {
  if (source !== 'ISSUED') return viewCell(source)
  if (grandTotal > 0 && paidAmount >= grandTotal) return 'PAID'
  if (paidAmount > 0) return 'PARTIALLY_PAID'
  const dueDay = calendarDay(due)
  return dueDay && calendarDay(now)! > dueDay ? 'OVERDUE' : 'UNPAID'
}

export function assemblePortalInvoices(invoices: SourceRow[], items: SourceRow[], payments: SourceRow[], now: Date) {
  const itemGroups = groupRows(items, 'invoice_number')
  const paymentGroups = groupRows(payments.filter((payment) => !hasValue(payment.deleted_at)), 'invoice_number')
  return invoices.filter((invoice) => !hasValue(invoice.deleted_at)).map((invoice) => {
    const key = String(invoice.invoice_number || '').trim()
    const invoiceItems = (itemGroups.get(key) ?? []).sort((left, right) => {
      const leftNumber = Number(left.item_no)
      const rightNumber = Number(right.item_no)
      return (Number.isFinite(leftNumber) ? leftNumber : Number.MAX_VALUE)
        - (Number.isFinite(rightNumber) ? rightNumber : Number.MAX_VALUE)
    })
    const invoicePayments = (paymentGroups.get(key) ?? []).sort((left, right) => timestamp(left.created_at) - timestamp(right.created_at))
    const customer = parseJson(invoice.customer, 'object')
    const subtotal = roundMoney(invoiceItems.reduce((sum, item) => sum + number(item.net_total), 0))
    let grandTotal = subtotal
    const adjustments = parseJson(invoice.adjustments, 'array').map((adjustment) => {
      const before = grandTotal
      grandTotal = roundMoney(applyAdjustment(grandTotal, adjustment))
      return { label: adjustment.label, amount: roundMoney(grandTotal - before) }
    })
    const paidAmount = roundMoney(invoicePayments.reduce((sum, payment) =>
      sum + (payment.status === 'VERIFIED' ? number(payment.amount) : 0), 0))
    return {
      invoiceNumber: viewCell(invoice.invoice_number),
      status: resolveStatus(invoice.status, grandTotal, paidAmount, invoice.due_date, now),
      billingType: viewCell(invoice.billing_type),
      billingPeriodStart: viewCell(invoice.billing_period_start),
      billingPeriodEnd: viewCell(invoice.billing_period_end),
      issuedDate: viewDate(invoice.issued_date),
      dueDate: viewDate(invoice.due_date),
      customerId: viewCell(invoice.customer_id),
      customerJson: JSON.stringify({
        customerCode: customer.customer_code,
        customerName: customer.customer_name,
        taxId: customer.tax_id,
        branchCode: customer.branch_code,
        contactName: customer.contact_name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      }),
      itemsJson: JSON.stringify(invoiceItems.map(projectItem)),
      adjustmentsJson: JSON.stringify(adjustments),
      paymentsJson: JSON.stringify(invoicePayments.map((payment) => ({
        amount: jsonCell(payment.amount),
        method: jsonCell(payment.method),
        status: jsonCell(payment.status),
        paidAt: jsonCell(payment.paid_at),
        proofUrl: jsonCell(payment.proof_url),
      }))),
      subtotal,
      adjustmentTotal: roundMoney(grandTotal - subtotal),
      grandTotal,
      paidAmount,
      balanceDue: roundMoney(grandTotal - paidAmount),
    }
  })
}

import type { OrderRow } from './order.contract.js'

export interface OrderItem {
  id: string | null
  description: string | null
  serviceType: string | null
  quantity: number | null
}

export interface OrderApiRow {
  orderId: string
  customerId: string
  orderNumber: string | null
  receivedDate: string | null
  dueDate: string | null
  serviceType: string | null
  status: string | null
  quantity: number | null
  note: string | null
  items: OrderItem[]
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  try {
    const result = Number(value)
    return Number.isNaN(result) ? null : result
  } catch {
    return null
  }
}

export function normalizeGVizDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    return null
  }

  const match = value.match(/^Date\((\d+),(\d+),(\d+)\)$/)
  if (!match) {
    return value
  }

  const [, year, month, day] = match
  return `${year}-${String(Number(month) + 1).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
}

export function mapOrderRow(row: Partial<OrderRow>): OrderApiRow {
  return {
    orderId: toRequiredString(row.orderId),
    customerId: toRequiredString(row.customerId),
    orderNumber: toNullableString(row.orderNumber),
    receivedDate: normalizeGVizDate(row.receivedDate),
    dueDate: normalizeGVizDate(row.dueDate),
    serviceType: toNullableString(row.serviceType),
    status: toNullableString(row.status),
    quantity: toNullableNumber(row.quantity),
    note: toNullableString(row.note),
    items: parseItems(row.itemsJson),
  }
}

function parseItems(value: unknown): OrderItem[] {
  if (typeof value !== 'string') {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed.filter(isPlainObject).map(mapOrderItem)
}

function mapOrderItem(item: Record<string, unknown>): OrderItem {
  return {
    id: toNullableString(item.id),
    description: toNullableString(item.description),
    serviceType: toNullableString(item.service_type),
    quantity: toNullableNumber(item.quantity),
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function toRequiredString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

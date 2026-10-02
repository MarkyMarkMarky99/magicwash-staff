import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import type { SourceRow } from './portal.mapper.js'

const hasValue = (value: unknown) => value != null && value !== '' && !(typeof value === 'string' && !value.trim())
const nullable = (value: unknown) => hasValue(value) ? String(value).trim() : null
const key = (value: unknown) => String(value || '').trim()

function date(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value !== 'string') return new Date(value as string)
  const text = value
  return new Date(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text) ? `${text}+07:00` : text)
}

function timestamp(value: unknown): number {
  if (!hasValue(value)) return Number.MAX_VALUE
  const ms = date(value).getTime()
  return Number.isNaN(ms) ? Number.MAX_VALUE : ms
}

function day(value: unknown): string | null {
  if (!hasValue(value)) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) return value.trim().slice(0, 10)
  const parsed = date(value)
  return Number.isNaN(parsed.getTime()) ? null : formatBangkokTimestamp(parsed).slice(0, 10)
}

export function assemblePortalPackages(memberships: SourceRow[], catalog: SourceRow[], customers: SourceRow[], transactions: SourceRow[], now: Date) {
  const packages = new Map(catalog.filter((row) => key(row.package_code)).map((row) => [key(row.package_code), row]))
  const profiles = new Map(customers.filter((row) => key(row.CustomerID)).map((row) => [key(row.CustomerID), row]))
  const grouped = new Map<string, SourceRow[]>()
  for (const tx of transactions) {
    const id = key(tx.customer_package_id)
    if (!id) continue
    const rows = grouped.get(id) ?? []
    rows.push(tx)
    grouped.set(id, rows)
  }
  return memberships.filter((cp) => key(cp.id)).map((cp) => {
    const pkg = packages.get(key(cp.package_code))
    const customer = profiles.get(key(cp.customer_id))
    let remaining = 0
    let used = 0
    const txs = (grouped.get(key(cp.id)) ?? []).slice().sort((a, b) =>
      timestamp(a.created_at) - timestamp(b.created_at) || String(a.id || '').localeCompare(String(b.id || ''))).map((tx) => {
      const numeric = Number(tx.credit_change)
      const change = Number.isFinite(numeric) ? numeric : 0
      remaining += change
      if (change < 0) used -= change
      const parsed = date(tx.created_at)
      return {
        id: key(tx.id), type: nullable(tx.type), creditChange: change, remainingCredit: remaining,
        referenceSource: nullable(tx.reference_source), referenceId: nullable(tx.reference_id), notes: nullable(tx.notes),
        createdAt: !hasValue(tx.created_at) || Number.isNaN(parsed.getTime()) ? null : `${formatBangkokTimestamp(parsed).replace(' ', 'T')}+07:00`,
      }
    })
    const today = day(now)!
    const start = day(cp.start_date)
    const expiry = day(cp.expiry_date)
    return {
      customerPackageId: key(cp.id), customerId: key(cp.customer_id), customerName: nullable(customer?.CustomerName) ?? '',
      customerPhone: nullable(customer?.Phone), customerAddress: nullable(customer?.Address),
      packageCode: key(cp.package_code), packageName: nullable(pkg?.name) ?? '', packageEligibleService: nullable(pkg?.eligible_service) ?? '',
      startDate: start, expiryDate: expiry,
      status: hasValue(cp.deleted_at) ? 'CANCELLED' : start && today < start ? 'INACTIVE' : expiry && today > expiry ? 'EXPIRED' : 'ACTIVE',
      serviceDay: nullable(cp.service_day), timeSlot: nullable(cp.time_slot), invoiceId: nullable(cp.invoice_id), notes: nullable(cp.notes),
      remainingCredit: remaining, usedCredit: used, totalCredit: remaining + used, transactionsJson: JSON.stringify(txs),
    }
  })
}

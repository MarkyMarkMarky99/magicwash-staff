import { PortalService } from '../../../server/modules/portal/portal.service.js'
import { getOrdersViewRepository } from '../../../server/sheets/OrdersView/OrdersView.repository.js'
import { getInvoicesViewRepository } from '../../../server/sheets/InvoicesView/InvoicesView.repository.js'

function gvizDate(value: unknown): unknown {
  if (!value) return null
  const match = String(value).match(/^Date\((\d+),(\d+),(\d+)\)$/)
  return match ? `${match[1]}-${String(+match[2]! + 1).padStart(2, '0')}-${String(+match[3]!).padStart(2, '0')}` : value
}

const service = new PortalService()
for (const view of ['orders', 'invoices'] as const) {
  const [live, materialized] = await Promise.all([
    view === 'orders' ? service.orders({}) : service.invoices({}),
    view === 'orders' ? getOrdersViewRepository().read() : getInvoicesViewRepository().read(),
  ])
  const columns = Object.keys(live[0] ?? {})
  const key = view === 'orders' ? 'orderId' : 'invoiceNumber'
  const dateColumns = view === 'orders'
    ? new Set(['receivedDate', 'dueDate', 'syncedAt', 'createdAt']) : new Set(['issuedDate', 'dueDate'])
  const normalize = (field: string) => field.replaceAll('_', '').toLowerCase()
  const mapped = materialized.map((row) => Object.fromEntries(columns.map((field) => {
    const sourceKey = Object.keys(row).find((name) => normalize(name) === normalize(field))
    const value = sourceKey === undefined ? null : (row as Record<string, unknown>)[sourceKey] ?? null
    return [field, dateColumns.has(field) ? gvizDate(value) : value]
  })))
  const byKey = new Map(mapped.map((row) => [row[key], row]))
  const differences: Record<string, number> = {}
  let missing = 0
  for (const row of live) {
    const record = row as Record<string, unknown>
    const previous = byKey.get(record[key])
    if (!previous) { missing++; continue }
    for (const field of columns) {
      if (field !== 'syncedAt' && record[field] !== previous[field]) differences[field] = (differences[field] ?? 0) + 1
    }
  }
  console.log(JSON.stringify({
    view, liveRows: live.length, materializedRows: mapped.length, missingFromView: missing,
    sourceOrderMatches: JSON.stringify(live.map((row) => (row as Record<string, unknown>)[key])) === JSON.stringify(mapped.map((row) => row[key])),
    fieldDifferences: differences,
  }))
}

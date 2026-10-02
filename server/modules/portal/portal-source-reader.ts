import { orderFormDbContract } from '../../sheets/OrderForm/OrderForm.db-contract.js'
import { orderItemFormsDbContract } from '../../sheets/OrderItemForms/OrderItemForms.db-contract.js'
import { invoicesDbContract } from '../../sheets/Invoices/Invoices.db-contract.js'
import { invoiceItemsDbContract } from '../../sheets/InvoiceItems/InvoiceItems.db-contract.js'
import { paymentsDbContract } from '../../sheets/Payments/Payments.db-contract.js'
import { customersDbContract } from '../../sheets/Customers/Customers.db-contract.js'
import { appointmentsDbContract } from '../../sheets/Appointments/Appointments.db-contract.js'
import { customerPackagesDbContract } from '../../sheets/CustomerPackages/CustomerPackages.db-contract.js'
import { packagesDbContract } from '../../sheets/Packages/Packages.db-contract.js'
import { packageTransactionsDbContract } from '../../sheets/PackageTransactions/PackageTransactions.db-contract.js'
import { deriveGVizColumns } from '../../shared/repositories/utils/gviz-query.builder.js'
import { fetchGVizRows } from '../../shared/repositories/utils/gviz-reader.js'
import { requireEnv } from '../../shared/utils/env.js'
import type { SourceRow } from './portal.mapper.js'

export const portalSourceDefinitions = {
  orders: { contract: orderFormDbContract, fields: 'id order_number customer_id received_date due_date service_type status quantity note invoice_id'.split(' ') },
  orderItems: { contract: orderItemFormsDbContract, fields: 'id order_id item_id description quantity price credits_used category service_type special_instructions'.split(' ') },
  invoices: { contract: invoicesDbContract, fields: 'invoice_number status billing_type billing_period_start billing_period_end issued_date due_date customer_id customer adjustments deleted_at'.split(' ') },
  invoiceItems: { contract: invoiceItemsDbContract, fields: 'invoice_number item_no source_order_id source_item_id service_type description quantity unit unit_price subtotal adjustments net_total'.split(' ') },
  payments: { contract: paymentsDbContract, fields: 'invoice_number amount method status paid_at proof_url created_at deleted_at'.split(' ') },
  customers: { contract: customersDbContract, fields: 'CustomerID CustomerIndex CustomerName Phone Address Location RegisteredDate Facebook Line Whatsapp Email CustomerType Source ScheduledDays LastVisitDate PreferredContactMethod'.split(' ') },
  appointments: { contract: appointmentsDbContract, fields: 'AppointmentID CustomerID AppointmentType AppointmentDate TimeSlot Status PickupOrderID DeliveryOrderID Notes DeletedAt CreatedAt'.split(' ') },
  customerPackages: { contract: customerPackagesDbContract, fields: 'id customer_id package_code start_date expiry_date service_day time_slot invoice_id notes deleted_at'.split(' ') },
  packages: { contract: packagesDbContract, fields: 'package_code name eligible_service'.split(' ') },
  packageTransactions: { contract: packageTransactionsDbContract, fields: 'id customer_package_id type credit_change reference_source reference_id notes created_at'.split(' ') },
}

class SourceDate extends Date {
  constructor(readonly gviz: string, parts: number[]) {
    super(Date.UTC(parts[0]!, parts[1]!, parts[2]!, (parts[3] ?? 0) - 7, parts[4] ?? 0, parts[5] ?? 0))
  }
}

export function sourceCell(value: unknown): unknown {
  if (typeof value === 'string') {
    const match = /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/.exec(value)
    if (match) return new SourceDate(value, match.slice(1).map((part) => Number(part ?? 0)))
  }
  return value ?? ''
}

export function reactCell(value: unknown, dateOnly = false): unknown {
  const raw = value instanceof SourceDate ? value.gviz : value === '' || value == null ? null : value
  if (!dateOnly) return raw
  if (!raw) return null
  const match = /^Date\((\d+),(\d+),(\d+)\)$/.exec(String(raw))
  return match ? `${match[1]}-${String(+match[2]! + 1).padStart(2, '0')}-${String(+match[3]!).padStart(2, '0')}` : raw
}

export type PortalSourceName = keyof typeof portalSourceDefinitions
export type PortalReader = { read(): Promise<SourceRow[]> }
export type PortalSources = Record<PortalSourceName, () => PortalReader>

export async function readPortalSource(name: PortalSourceName): Promise<SourceRow[]> {
  const { contract, fields } = portalSourceDefinitions[name]
  const columns = deriveGVizColumns(contract.row)
  const selected = Object.fromEntries(fields.map((field) => [field, columns[field]!]))
  const rows = await fetchGVizRows({
    spreadsheetId: requireEnv(contract.spreadsheetId), sheetName: contract.sheetName,
    columns: selected, query: `select ${Object.values(selected).join(',')}`,
  })
  return rows.map((row) => Object.fromEntries(fields.map((field) => [field, sourceCell(row[field])])))
}

export function createPortalSources(
  load: (name: PortalSourceName) => Promise<SourceRow[]> = readPortalSource,
  clock: () => number = Date.now,
): PortalSources {
  const cache = new Map<PortalSourceName, { rows: SourceRow[]; expires: number }>()
  const pending = new Map<PortalSourceName, Promise<SourceRow[]>>()
  return Object.fromEntries(Object.keys(portalSourceDefinitions).map((key) => {
    const name = key as PortalSourceName
    return [name, () => ({ read: () => {
      const cached = cache.get(name)
      if (cached && cached.expires > clock()) return Promise.resolve(cached.rows)
      const inflight = pending.get(name)
      if (inflight) return inflight
      const request = Promise.resolve().then(() => load(name)).then((rows) => {
        cache.set(name, { rows, expires: clock() + 60_000 })
        return rows
      }).finally(() => pending.delete(name))
      pending.set(name, request)
      return request
    } })]
  })) as PortalSources
}

export const portalSources = createPortalSources()

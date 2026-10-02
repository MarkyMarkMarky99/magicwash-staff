// Historical record, already run 2026-10-03; readSourceRows has since been removed, so it no longer runs.
// One-off: restore invoices that exist in the Portal InvoicesView but are missing from the
// Invoices / InvoiceItems / Payments sheets. Firestore export is the primary source; the Portal
// row is the fallback and the parity oracle.
//
// Dry run (default):  npx tsx --env-file=.env.local scripts/one-off/restore-firebase-invoices.ts <outDir>
// Write:              add --write  (portal-only invoices need --include-portal-only as well)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getInvoicesRepository } from '../../server/sheets/Invoices/Invoices.repository.js'
import { getInvoiceItemsRepository } from '../../server/sheets/InvoiceItems/InvoiceItems.repository.js'
import { getPaymentsRepository } from '../../server/sheets/Payments/Payments.repository.js'
import { assemblePortalInvoices } from '../../server/modules/portal/portal.mapper.js'
import { formatBangkokTimestamp } from '../../server/shared/utils/bangkok-timestamp.js'
import { generateShortId } from '../../server/shared/utils/id.js'
import { invoicesRowSchema } from '../../server/sheets/Invoices/Invoices.db-contract.js'
import { invoiceItemsRowSchema } from '../../server/sheets/InvoiceItems/InvoiceItems.db-contract.js'
import { paymentsRowSchema } from '../../server/sheets/Payments/Payments.db-contract.js'

const FIREBASE_EXPORT = 'C:/Documents/MyAppScriptProject/AppsheetAutoBill/functions/invoices-all.json'
const PORTAL_SPREADSHEET_ID = '1ucqeUqRN25L4YF1GEnjP02ex_IohR1f8h8IwaP_EBRQ'
const RESTORED_BY = 'firebase_restore'

const args = process.argv.slice(2)
const outDir = args.find((a) => !a.startsWith('--'))
if (!outDir) throw new Error('Pass an output directory for the dry-run files')
const WRITE = args.includes('--write')
const INCLUDE_PORTAL_ONLY = args.includes('--include-portal-only')
mkdirSync(outDir, { recursive: true })

type Row = Record<string, any>

const bkk = (iso: string) => formatBangkokTimestamp(new Date(iso))
const gvizDate = (v: unknown): string | null => {
  if (v == null || v === '') return null
  const m = /^Date\((\d+),(\d+),(\d+)\)$/.exec(String(v))
  return m ? `${m[1]}-${String(+m[2]! + 1).padStart(2, '0')}-${String(+m[3]!).padStart(2, '0')}` : String(v)
}
// Firestore paidDate is Bangkok wall time written as yyyyMMddTHH:mm:ss.
const paidDate = (v: string) => {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2}:\d{2}:\d{2})$/.exec(v)
  if (!m) throw new Error(`Unexpected paidDate ${v}`)
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}`
}
const CUSTOMER_KEYS: Record<string, string> = {
  customerCode: 'customer_code', customerName: 'customer_name', taxId: 'tax_id', branchCode: 'branch_code',
  contactName: 'contact_name', phone: 'phone', email: 'email', address: 'address',
}

// ---- load sources ----------------------------------------------------------------------------
process.env.GVIZ_PORTAL_SPREADSHEET_ID = PORTAL_SPREADSHEET_ID
const { fetchGvizMapped } = await import('../../../webapp-react/server/gviz.js' as string)
const [portal, invoices, items, payments] = await Promise.all([
  fetchGvizMapped('invoiceView', 'SELECT *'),
  getInvoicesRepository().readSourceRows(),
  getInvoiceItemsRepository().readSourceRows(),
  getPaymentsRepository().readSourceRows(),
])
if (portal.error) throw new Error(portal.error)
const firebase: Row[] = JSON.parse(readFileSync(FIREBASE_EXPORT, 'utf8')).data
const fbByNumber = new Map(firebase.filter((r) => r.invoiceNumber).map((r) => [r.invoiceNumber, r]))

const liveNumbers = new Set(invoices.map((r) => String(r.invoice_number).trim()))
const usedItemIds = new Set(items.map((r) => String(r.invoice_item_id)))
const usedPaymentIds = new Set(payments.map((r) => String(r.payment_id)))
const targets = (portal.rows as Row[]).filter((r) => !liveNumbers.has(r.invoiceNumber))

const newItemId = () => {
  for (;;) {
    const id = generateShortId()
    if (!usedItemIds.has(id)) { usedItemIds.add(id); return id }
  }
}

// ---- build rows ------------------------------------------------------------------------------
const invoiceRows: Row[] = []
const itemRows: Row[] = []
const paymentRows: Row[] = []
const report: Row[] = []

for (const p of targets) {
  const fb = fbByNumber.get(p.invoiceNumber)
  if (!fb && !INCLUDE_PORTAL_ONLY && WRITE) continue
  const warnings: string[] = []
  const source = fb ? 'firebase' : 'portal'

  const portalCustomer = JSON.parse(p.customerJson || '{}')
  const customer = Object.fromEntries(Object.entries(portalCustomer).map(([k, v]) => [CUSTOMER_KEYS[k] ?? k, v]))
  const adjustments = JSON.parse(p.adjustmentsJson || '[]').map((a: Row) => ({ label: a.label, calculation: 'FIXED', value: a.amount }))

  const status = p.status === 'VOID' || p.status === 'CANCELLED' || p.status === 'DRAFT' ? p.status : 'ISSUED'
  if (fb) {
    const fbStatus = fb.status === 'VOID' || fb.status === 'DRAFT' ? fb.status : 'ISSUED'
    if (fbStatus !== status) warnings.push(`status firebase=${fb.status} portal=${p.status}`)
    if (bkk(fb.issuedDate).slice(0, 10) !== p.issuedDate) warnings.push(`issuedDate firebase=${bkk(fb.issuedDate)} portal=${p.issuedDate}`)
    if (bkk(fb.dueDate).slice(0, 10) !== p.dueDate) warnings.push(`dueDate firebase=${bkk(fb.dueDate)} portal=${p.dueDate}`)
    const discount = Number(fb.summary?.discount ?? 0)
    const portalDiscount = -adjustments.reduce((s: number, a: Row) => s + Number(a.value), 0)
    if (Math.abs(discount - portalDiscount) > 0.001) warnings.push(`discount firebase=${discount} portal=${portalDiscount}`)
  }

  invoiceRows.push({
    invoice_number: p.invoiceNumber,
    status,
    billing_type: p.billingType,
    billing_period_start: gvizDate(p.billingPeriodStart),
    billing_period_end: gvizDate(p.billingPeriodEnd),
    issued_date: fb?.issuedDate ? bkk(fb.issuedDate).slice(0, 10) : p.issuedDate,
    due_date: fb?.dueDate ? bkk(fb.dueDate).slice(0, 10) : p.dueDate,
    customer_id: p.customerId,
    customer: JSON.stringify(customer),
    adjustments: JSON.stringify(adjustments),
    created_by: fb?.createdBy || RESTORED_BY,
    created_at: fb?.createdAt ? bkk(fb.createdAt) : `${p.issuedDate} 00:00:00`,
    updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
  })

  if (fb) {
    const sourceOrderId = (fb.sourceOrders ?? []).length === 1 ? fb.sourceOrders[0].orderId : null
    const fbItems = fb.items.filter((it: Row) => {
      if (Number(it.quantity) > 0) return true
      warnings.push(`item '${it.description}' has quantity ${it.quantity}, subtotal ${it.subtotal}; dropped`)
      return false
    })
    const itemSum = fbItems.reduce((s: number, it: Row) => s + Number(it.subtotal), 0)
    if (Math.abs(itemSum - Number(fb.summary?.subTotal ?? itemSum)) > 0.01) warnings.push(`items sum ${itemSum} but firebase summary.subTotal ${fb.summary?.subTotal}`)
    fbItems.forEach((it: Row, i: number) => itemRows.push({
      invoice_number: p.invoiceNumber, invoice_item_id: newItemId(), item_no: i + 1,
      source_order_id: sourceOrderId, source_item_id: null, sku: it.sku ?? null, service_type: null,
      description: it.description, quantity: it.quantity, unit: it.unit ?? null,
      unit_price: it.unitPrice ?? it.unit_price, subtotal: it.subtotal, adjustments: '[]', net_total: it.subtotal,
    }))
    for (const pay of fb.payments ?? []) {
      if (usedPaymentIds.has(pay.paymentId)) { warnings.push(`payment id ${pay.paymentId} already exists, skipped`); continue }
      const paidAt = paidDate(pay.paidDate)
      if (pay.slipData?.transTimestamp && bkk(pay.slipData.transTimestamp) !== paidAt) {
        warnings.push(`paidDate ${paidAt} vs slip ${bkk(pay.slipData.transTimestamp)}`)
      }
      paymentRows.push({
        payment_id: pay.paymentId, invoice_number: p.invoiceNumber, amount: pay.amount, method: pay.method,
        status: 'VERIFIED', paid_at: paidAt, reference: pay.slipData?.transRef ? `'${pay.slipData.transRef}` : null, proof_url: pay.proofUrl || null,
        slip_data: pay.slipData ? JSON.stringify(pay.slipData) : null, notes: pay.notes || null,
        created_at: paidAt, created_by: RESTORED_BY, updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
      })
    }
  } else {
    JSON.parse(p.itemsJson || '[]').forEach((it: Row, i: number) => itemRows.push({
      invoice_number: p.invoiceNumber, invoice_item_id: newItemId(), item_no: i + 1,
      source_order_id: it.sourceOrderId || null, source_item_id: it.sourceItemId || null, sku: null,
      service_type: it.serviceType || null, description: it.description, quantity: it.quantity, unit: it.unit ?? null,
      unit_price: it.unitPrice, subtotal: it.subtotal, adjustments: '[]', net_total: it.netTotal,
    }))
    if (JSON.parse(p.paymentsJson || '[]').length) warnings.push('portal-only invoice has payments; not restored')
  }
  report.push({ invoiceNumber: p.invoiceNumber, source, portalStatus: p.status, warnings })
}

// ---- contract validation ---------------------------------------------------------------------
const invalid: Row[] = []
for (const [name, schema, rows] of [['Invoices', invoicesRowSchema, invoiceRows], ['InvoiceItems', invoiceItemsRowSchema, itemRows], ['Payments', paymentsRowSchema, paymentRows]] as const) {
  for (const r of rows) {
    const result = (schema as any).safeParse(r)
    if (!result.success) invalid.push({ sheet: name, invoice: r.invoice_number, issues: result.error.issues.map((i: Row) => `${i.path.join('.')}: ${i.message}`) })
  }
}

// ---- parity: assemble the planned rows the way /api/portal/invoices will read them ------------
// USER_ENTERED turns date-looking strings into date cells, which readSourceRows returns as Date.
const asCell = (v: unknown) => {
  if (typeof v !== 'string') return v ?? ''
  if (/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(v)) return new Date(`${v.replace(' ', 'T')}${v.length === 10 ? 'T00:00:00' : ''}+07:00`)
  return v
}
const sim = (rows: Row[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, asCell(v)])))
const assembled = assemblePortalInvoices(sim(invoiceRows), sim(itemRows), sim(paymentRows), new Date())
const portalBy = new Map(targets.map((r) => [r.invoiceNumber, r]))
const parity: Record<string, number> = {}
const parityExamples: Row[] = []
const pick = (json: string, f: (x: Row) => unknown) => JSON.stringify(JSON.parse(json || '[]').map(f))
for (const a of assembled as Row[]) {
  const p = portalBy.get(a.invoiceNumber)!
  const checks: Record<string, [unknown, unknown]> = {
    billingType: [a.billingType, p.billingType], issuedDate: [a.issuedDate, p.issuedDate], dueDate: [a.dueDate, p.dueDate],
    billingPeriodStart: [a.billingPeriodStart, p.billingPeriodStart], billingPeriodEnd: [a.billingPeriodEnd, p.billingPeriodEnd],
    customerId: [a.customerId, p.customerId], customerJson: [a.customerJson, p.customerJson],
    subtotal: [a.subtotal, p.subtotal], adjustmentTotal: [a.adjustmentTotal, p.adjustmentTotal], grandTotal: [a.grandTotal, p.grandTotal],
    paidAmount: [a.paidAmount, p.paidAmount], balanceDue: [a.balanceDue, p.balanceDue], status: [a.status, p.status],
    adjustmentsJson: [a.adjustmentsJson, p.adjustmentsJson],
    items: [pick(a.itemsJson, (x) => [x.description, x.quantity, x.unitPrice, x.netTotal]), pick(p.itemsJson, (x) => [x.description, x.quantity, x.unitPrice, x.netTotal])],
    payments: [pick(a.paymentsJson, (x) => [x.amount, x.method, x.status, x.proofUrl]), pick(p.paymentsJson, (x) => [x.amount, x.method, x.status, x.proofUrl])],
    paymentTimes: [pick(a.paymentsJson, (x) => x.paidAt), pick(p.paymentsJson, (x) => x.paidAt)],
  }
  for (const [field, [x, y]] of Object.entries(checks)) {
    if (x !== y) {
      parity[field] = (parity[field] ?? 0) + 1
      if (parityExamples.filter((e) => e.field === field).length < (field === 'status' ? 20 : 3)) parityExamples.push({ invoice: a.invoiceNumber, field, restored: x, portal: y })
    }
  }
}

const summary = {
  mode: WRITE ? 'WRITE' : 'DRY_RUN',
  targets: targets.length,
  fromFirebase: report.filter((r) => r.source === 'firebase').length,
  fromPortalOnly: report.filter((r) => r.source === 'portal').map((r) => r.invoiceNumber),
  rows: { invoices: invoiceRows.length, invoiceItems: itemRows.length, payments: paymentRows.length },
  invoicesWithWarnings: report.filter((r) => r.warnings.length).length,
  contractViolations: invalid,
  parityMismatches: parity,
  parityExamples,
}
writeFileSync(join(outDir, 'restore-plan.json'), JSON.stringify({ summary, report, invoiceRows, itemRows, paymentRows }, null, 1))
console.log(JSON.stringify(summary, null, 1))

// ---- write -----------------------------------------------------------------------------------
if (WRITE) {
  if (invalid.length) throw new Error('Aborted: rows violate the sheet contracts')
  const recheck = new Set((await getInvoicesRepository().readSourceRows()).map((r) => String(r.invoice_number).trim()))
  const clash = invoiceRows.filter((r) => recheck.has(r.invoice_number)).map((r) => r.invoice_number)
  if (clash.length) throw new Error(`Aborted: invoices already present: ${clash.join(', ')}`)
  await getInvoicesRepository().batchAppend(invoiceRows as any)
  console.log(`Invoices appended: ${invoiceRows.length}`)
  await getInvoiceItemsRepository().batchAppend(itemRows as any)
  console.log(`InvoiceItems appended: ${itemRows.length}`)
  if (paymentRows.length) await getPaymentsRepository().batchAppend(paymentRows as any)
  console.log(`Payments appended: ${paymentRows.length}`)
}

import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import { FALLBACK_ACTOR } from '../../shared/config/actor.js'
import {
  invoiceApiContract,
  invoiceCreateSchema,
  invoiceStatusUpdateSchema,
  type CreateInvoiceResponse,
  type InvoiceAdjustmentInput,
  type UpdateInvoiceResponse,
} from '../../../contracts/invoices/invoice-api.schema.js'
import {
  computeInvoiceLine,
  computeInvoiceTotal,
  roundMoney,
  type CalculatorAdjustment,
} from '../../../shared/utils/invoice-calculator.js'
import { bangkokToday } from '../../../shared/utils/bangkok-datetime.js'
import { getInvoicesRepository } from '../../sheets/Invoices/Invoices.repository.js'
import { invoicesRowSchema } from '../../sheets/Invoices/Invoices.db-contract.js'
import { getInvoiceItemsRepository } from '../../sheets/InvoiceItems/InvoiceItems.repository.js'
import { invoiceItemsRowSchema } from '../../sheets/InvoiceItems/InvoiceItems.db-contract.js'
import { getPaymentsRepository } from '../../sheets/Payments/Payments.repository.js'
import { paymentsRowSchema } from '../../sheets/Payments/Payments.db-contract.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { orderFormRowSchema } from '../../sheets/OrderForm/OrderForm.db-contract.js'
import { syncInvoiceView as defaultSyncInvoiceView } from './invoice-view-sync-client.js'
import type { InvoiceViewSyncResult } from './invoice-view-sync-client.js'
import { classifySheetWriteFailure } from '../../shared/repositories/write-failure.js'
import { ReadQueryDTO } from '../../shared/dtos/read-query.dto.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { ApiError } from '../../shared/http/api-error.js'
import type { ApiQueryParams } from '../../shared/http/api-handler.js'

type InvoicesDbRow = z.infer<typeof invoicesRowSchema>
type InvoiceItemsDbRow = z.infer<typeof invoiceItemsRowSchema>
type PaymentsDbRow = z.infer<typeof paymentsRowSchema>
type OrderFormDbRow = z.infer<typeof orderFormRowSchema>

export const invoicesFieldMap = {
  invoice_number: 'invoiceNumber',
  status: 'status',
  billing_type: 'billingType',
  billing_period_start: 'billingPeriodStart',
  billing_period_end: 'billingPeriodEnd',
  issued_date: 'issuedDate',
  due_date: 'dueDate',
  customer_id: 'customerId',
  customer: 'customer',
  adjustments: 'adjustments',
  created_by: 'createdBy',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
} as const satisfies Record<keyof InvoicesDbRow & string, string>

export const invoiceItemsFieldMap = {
  invoice_number: 'invoiceNumber',
  invoice_item_id: 'invoiceItemId',
  item_no: 'itemNo',
  source_order_id: 'sourceOrderId',
  source_item_id: 'sourceItemId',
  sku: 'sku',
  service_type: 'serviceType',
  description: 'description',
  quantity: 'quantity',
  unit: 'unit',
  unit_price: 'unitPrice',
  subtotal: 'subtotal',
  adjustments: 'adjustments',
  net_total: 'netTotal',
} as const satisfies Record<keyof InvoiceItemsDbRow & string, string>

export const orderFormFieldMap = {
  id: 'id',
  order_number: 'orderNumber',
  customer_id: 'customerId',
  received_date: 'receivedDate',
  due_date: 'dueDate',
  service_type: 'serviceType',
  status: 'status',
  quantity: 'quantity',
  hangers: 'hangers',
  bags: 'bags',
  hangers_image: 'hangersImage',
  bags_image: 'bagsImage',
  form_image: 'formImage',
  note: 'note',
  timestamp: 'timestamp',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  invoice_id: 'invoiceId',
  order_name: 'orderName',
  order_description: 'orderDescription',
} as const satisfies Record<keyof OrderFormDbRow & string, string>

/** The one id scheme used across this codebase: the first 8 hex characters
 *  of `crypto.randomUUID()` (its first hyphen-delimited group, no stripping
 *  needed) — not a per-entity format. */
function defaultGenerateItemId(): string {
  return randomUUID().slice(0, 8)
}

/** Safe to drop `refSource`/`refCode` only when BOTH are absent — the API
 *  schema refines that one is never sent without the other. */
type InvoiceDbAdjustment = Omit<InvoiceAdjustmentInput, 'refSource' | 'refCode'> & {
  ref_source?: string
  ref_code?: string
}

function toDbAdjustment(adjustment: InvoiceAdjustmentInput): InvoiceDbAdjustment {
  return {
    label: adjustment.label,
    calculation: adjustment.calculation,
    value: adjustment.value,
    ...(adjustment.refSource !== undefined ? { ref_source: adjustment.refSource } : {}),
    ...(adjustment.refCode !== undefined ? { ref_code: adjustment.refCode } : {}),
  }
}

/** Minimal ports `InvoiceService` depends on — real `SheetRepository` instances
 * satisfy these structurally; tests inject fakes that record calls without
 * needing to extend the repository or mock `fetch`. */
export interface InvoiceHeaderPort {
  read(query?: ReadQueryDTO<Partial<InvoicesDbRow>>): Promise<Array<Partial<InvoicesDbRow>>>
  append(data: Partial<InvoicesDbRow>): Promise<unknown>
  update(keyValue: string, patch: Partial<InvoicesDbRow>): Promise<unknown>
}
export interface InvoiceItemWriter {
  batchAppend(rows: Array<Partial<InvoiceItemsDbRow>>): Promise<unknown[]>
}
export interface InvoiceItemReader {
  read(): Promise<Array<Partial<InvoiceItemsDbRow>>>
}
export interface PaymentReader {
  read(): Promise<Array<Partial<PaymentsDbRow>>>
}
export interface OrderFormWriter {
  update(id: string, data: Partial<OrderFormDbRow>): Promise<unknown>
}
export type ViewSyncFn = (invoiceNumber: string) => Promise<InvoiceViewSyncResult>
export interface InvoiceViewReader {
  read(query?: unknown): Promise<Array<Partial<Record<string, unknown>>>>
}

type InvoiceListQuery = z.infer<typeof invoiceApiContract.query.list>
type InvoiceListResponse = z.infer<typeof invoiceApiContract.response.list>
type InvoiceDetailResponse = z.infer<typeof invoiceApiContract.response.detail>

export interface InvoiceListResult {
  items: InvoiceListResponse[]
  pagination: {
    total: number
    page: number
    perPage: number
    totalPages: number
  }
}

type JsonRecord = Record<string, unknown>

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function parseJsonRecord(value: unknown): JsonRecord {
  if (typeof value !== 'string' || value.trim() === '') return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonRecord : {}
  } catch {
    return {}
  }
}

function parseJsonArray(value: unknown): unknown[] {
  if (typeof value !== 'string' || value.trim() === '') return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mapAdjustment(value: unknown): InvoiceDetailResponse['adjustments'][number] {
  const adjustment = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
  return {
    label: asNullableString(adjustment.label),
    calculation: asNullableString(adjustment.calculation),
    value: typeof adjustment.value === 'number' ? adjustment.value : null,
    refSource: asNullableString(adjustment.ref_source ?? adjustment.refSource),
    refCode: asNullableString(adjustment.ref_code ?? adjustment.refCode),
  }
}

function calculatorAdjustments(
  adjustments: InvoiceDetailResponse['adjustments'],
): CalculatorAdjustment[] {
  return adjustments.flatMap((adjustment) =>
    (adjustment.calculation === 'FIXED' || adjustment.calculation === 'PERCENT')
      && typeof adjustment.value === 'number'
      ? [{ calculation: adjustment.calculation, value: adjustment.value }]
      : [],
  )
}

function groupByInvoiceNumber<TRow extends { invoice_number?: unknown }>(
  rows: readonly TRow[],
): Map<string, TRow[]> {
  const grouped = new Map<string, TRow[]>()
  for (const row of rows) {
    const invoiceNumber = asString(row.invoice_number)
    const existing = grouped.get(invoiceNumber)
    if (existing === undefined) grouped.set(invoiceNumber, [row])
    else existing.push(row)
  }
  return grouped
}

function groupPayments(paymentRows: Array<Partial<PaymentsDbRow>>): {
  paymentsByInvoice: Map<string, Array<Partial<PaymentsDbRow>>>
  paidAmountsByInvoice: Map<string, number>
} {
  const paymentsByInvoice = new Map<string, Array<Partial<PaymentsDbRow>>>()
  const paidAmountsByInvoice = new Map<string, number>()
  for (const payment of paymentRows) {
    if (payment.deleted_at != null && payment.deleted_at !== '') continue
    const invoiceNumber = asString(payment.invoice_number)
    const existing = paymentsByInvoice.get(invoiceNumber)
    if (existing === undefined) paymentsByInvoice.set(invoiceNumber, [payment])
    else existing.push(payment)
    if (payment.status === 'VERIFIED') {
      paidAmountsByInvoice.set(
        invoiceNumber,
        (paidAmountsByInvoice.get(invoiceNumber) ?? 0) + asNumber(payment.amount),
      )
    }
  }
  return { paymentsByInvoice, paidAmountsByInvoice }
}

function deriveInvoiceStatus(
  sourceStatus: unknown,
  grandTotal: number,
  paidAmount: number,
  dueDate: string,
  today: string,
): InvoiceDetailResponse['status'] {
  if (sourceStatus === 'DRAFT' || sourceStatus === 'CANCELLED' || sourceStatus === 'VOID') return sourceStatus
  if (paidAmount >= grandTotal) return 'PAID'
  if (dueDate < today) return 'OVERDUE'
  if (paidAmount > 0) return 'PARTIALLY_PAID'
  return 'UNPAID'
}

function assembleInvoiceRows(
  invoiceRows: Array<Partial<InvoicesDbRow>>,
  itemRows: Array<Partial<InvoiceItemsDbRow>>,
  paymentRows: Array<Partial<PaymentsDbRow>>,
  today: string,
): InvoiceDetailResponse[] {
  const itemsByInvoice = groupByInvoiceNumber(itemRows)
  const { paymentsByInvoice, paidAmountsByInvoice } = groupPayments(paymentRows)

  return invoiceRows.map((invoice) => {
    const invoiceNumber = asString(invoice.invoice_number)
    const adjustments = parseJsonArray(invoice.adjustments).map(mapAdjustment)
    const items = [...(itemsByInvoice.get(invoiceNumber) ?? [])]
      .sort((left, right) => asNumber(left.item_no) - asNumber(right.item_no))
      .map((item) => {
        const itemAdjustments = parseJsonArray(item.adjustments).map(mapAdjustment)
        const calculated = computeInvoiceLine({
          quantity: asNumber(item.quantity),
          unitPrice: asNumber(item.unit_price),
          adjustments: calculatorAdjustments(itemAdjustments),
        })
        return {
          description: asNullableString(item.description),
          unit: asNullableString(item.unit),
          quantity: typeof item.quantity === 'number' ? item.quantity : null,
          unitPrice: typeof item.unit_price === 'number' ? item.unit_price : null,
          subtotal: calculated.subtotal,
          adjustments: itemAdjustments,
          netTotal: calculated.netTotal,
        }
      })
    const activePayments = [...(paymentsByInvoice.get(invoiceNumber) ?? [])]
      .sort((left, right) => asString(left.created_at).localeCompare(asString(right.created_at)))
    const payments = activePayments.map((payment) => ({
      paymentId: asNullableString(payment.payment_id),
      amount: typeof payment.amount === 'number' ? payment.amount : null,
      method: payment.method ?? null,
      status: payment.status as InvoiceDetailResponse['payments'][number]['status'],
      paidAt: asNullableString(payment.paid_at),
      reference: asNullableString(payment.reference),
      proofUrl: asNullableString(payment.proof_url),
      notes: asNullableString(payment.notes),
    }))
    const subtotal = roundMoney(items.reduce((sum, item) => sum + asNumber(item.netTotal), 0))
    const grandTotal = computeInvoiceTotal(
      items.map((item) => asNumber(item.netTotal)),
      calculatorAdjustments(adjustments),
    )
    const paidAmount = roundMoney(paidAmountsByInvoice.get(invoiceNumber) ?? 0)
    const customer = parseJsonRecord(invoice.customer)
    const dueDate = asString(invoice.due_date)

    return {
      invoiceNumber,
      status: deriveInvoiceStatus(invoice.status, grandTotal, paidAmount, dueDate, today),
      billingType: invoice.billing_type as InvoiceDetailResponse['billingType'],
      billingPeriodStart: asNullableString(invoice.billing_period_start),
      billingPeriodEnd: asNullableString(invoice.billing_period_end),
      issuedDate: asString(invoice.issued_date),
      dueDate,
      customerId: asString(invoice.customer_id),
      customer: {
        customerCode: asNullableString(customer.customer_code ?? customer.customerCode),
        customerName: asNullableString(customer.customer_name ?? customer.customerName),
        phone: asNullableString(customer.phone),
        address: asNullableString(customer.address),
      },
      items,
      adjustments,
      payments,
      subtotal,
      adjustmentTotal: roundMoney(grandTotal - subtotal),
      grandTotal,
      paidAmount,
      balanceDue: roundMoney(grandTotal - paidAmount),
    }
  })
}

function compareInvoiceRows(
  left: InvoiceDetailResponse,
  right: InvoiceDetailResponse,
  query: InvoiceListQuery,
): number {
  const leftValue = left[query.sortBy]
  const rightValue = right[query.sortBy]
  const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
    ? leftValue - rightValue
    : String(leftValue).localeCompare(String(rightValue))
  return query.sortOrder === 'asc' ? comparison : -comparison
}

export interface InvoiceServiceOptions {
  invoiceRepository?: () => InvoiceHeaderPort
  invoiceItemRepository?: () => InvoiceItemWriter
  invoiceItemReader?: () => InvoiceItemReader
  paymentRepository?: () => PaymentReader
  orderFormRepository?: () => OrderFormWriter
  invoiceViewRepository?: InvoiceViewReader
  syncInvoiceView?: ViewSyncFn
  generateItemId?: () => string
  now?: () => Date
}

/**
 * Owns the whole multi-sheet Invoice create workflow plus Invoice list/detail
 * reads. Validates the public request once
 * at the boundary, computes every line's `subtotal`/`net_total` server-side
 * (authoritative — the client's own live preview is never trusted), writes
 * the `InvoiceItem` batch FIRST (exactly ONE `batchAppend()`), then the
 * `Invoice` header row, then marks the source `OrderForm` row as invoiced,
 * syncs the materialized `InvoicesView` as the final external write, and
 * returns one of six distinct outcomes. Never throws for an expected outcome
 * (bad input, a rejected item batch, a failed header write, a failed
 * order-link write, or a failed view sync) — those are all represented in the
 * return value per `contracts/invoices/invoice-api.schema.ts`. Only a genuine
 * programmer error is expected to escape as a thrown error.
 */
export class InvoiceService {
  private readonly invoiceRepository: () => InvoiceHeaderPort
  private readonly invoiceItemRepository: () => InvoiceItemWriter
  private readonly invoiceItemReader: () => InvoiceItemReader
  private readonly paymentRepository: () => PaymentReader
  private readonly orderFormRepository: () => OrderFormWriter
  private readonly syncInvoiceView: ViewSyncFn
  private readonly generateItemId: () => string
  private readonly now: () => Date

  constructor(options: InvoiceServiceOptions = {}) {
    this.invoiceRepository = options.invoiceRepository ?? getInvoicesRepository

    this.invoiceItemRepository = options.invoiceItemRepository ?? getInvoiceItemsRepository

    this.invoiceItemReader = options.invoiceItemReader ?? getInvoiceItemsRepository

    this.paymentRepository = options.paymentRepository ?? getPaymentsRepository

    this.orderFormRepository = options.orderFormRepository ?? getOrderFormRepository

    this.syncInvoiceView = options.syncInvoiceView ?? defaultSyncInvoiceView
    this.generateItemId = options.generateItemId ?? defaultGenerateItemId
    this.now = options.now ?? (() => new Date())
  }

  private async invoiceNumberAlreadyUsed(invoiceNumber: string): Promise<boolean> {
    try {
      // Compare exact keys here rather than using a GViz equality filter;
      // that builder strips apostrophes from filter values.
      const rows = await this.invoiceRepository().read({ select: ['invoice_number'] })
      return rows.some((row) => row.invoice_number === invoiceNumber)
    } catch {
      // The preflight is advisory; header append retains duplicate validation
      // so a failed read must never block invoice creation.
      return false
    }
  }

  async create(payload: unknown): Promise<CreateInvoiceResponse> {
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

    if (await this.invoiceNumberAlreadyUsed(request.invoiceNumber)) {
      return {
        kind: 'validation_error',
        issues: [{ path: 'invoiceNumber', message: 'invoice number is already in use' }],
      }
    }

    // ── Compute every line server-side; nothing the browser sent for
    //    subtotal/netTotal is read anywhere in this function. ──
    const lineCalculations = request.items.map((item) =>
      computeInvoiceLine({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        adjustments: item.adjustments,
      }),
    )

    const itemCommands: Array<Partial<InvoiceItemsDbRow>> = request.items.map((item, index) => ({
      invoice_number: request.invoiceNumber,
      invoice_item_id: this.generateItemId(),
      item_no: index + 1, // 1-based, derived from array position — never client-sent
      // Package purchases have no source order. Order invoices fan out the
      // single sourceOrderId onto every line.
      source_order_id: request.sourceOrderId ?? null,
      // Always null — no per-item traceability, only
      // per-order via sourceOrderId above.
      source_item_id: null,
      service_type: null,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit ?? null,
      unit_price: item.unitPrice,
      subtotal: lineCalculations[index].subtotal,
      // InvoiceItems.adjustments is a text cell; serialize it before the row
      // reaches the sheet repository.
      adjustments: JSON.stringify(item.adjustments.map(toDbAdjustment)),
      net_total: lineCalculations[index].netTotal,
    }))

    // ── Items first, as ONE batch — never a loop. This ordering decides what
    //    a failure leaves behind: orphan item rows nothing references, never
    //    an issued invoice with no lines. Because the header is always status
    //    ISSUED, header-first failure would leave a staff-visible billable
    //    invoice with no lines. ──
    try {
      await this.invoiceItemRepository().batchAppend(itemCommands)
    } catch (error) {
      const failure = classifySheetWriteFailure(error)
      console.error('items_write_failed', error instanceof Error ? error.stack ?? error.message : String(error))
      return { kind: 'items_write_failed', message: failure.message, certainty: failure.certainty }
    }

    const customerSnapshot = {
      customer_code: request.customer.customerCode,
      customer_name: request.customer.customerName,
      ...(request.customer.phone !== undefined ? { phone: request.customer.phone } : {}),
      ...(request.customer.address !== undefined ? { address: request.customer.address } : {}),
    }
    const invoiceCommand: Partial<InvoicesDbRow> = {
      invoice_number: request.invoiceNumber,
      status: 'ISSUED',
      billing_type: request.billingType ?? 'ORDER',
      issued_date: request.issuedDate,
      due_date: request.dueDate,
      // The registry requires a CYCLE row to carry its period, and the
      // contract's CYCLE branch makes both dates mandatory, so they are
      // present exactly when billingType is CYCLE.
      ...(request.billingType === 'CYCLE'
        ? {
            billing_period_start: request.billingPeriodStart,
            billing_period_end: request.billingPeriodEnd,
          }
        : {}),
      // Denormalized so GViz can filter without reaching into the JSON
      // snapshot — must equal customer.customer_code exactly.
      customer_id: request.customer.customerCode,
      // Invoices.customer and Invoices.adjustments are text cells; serialize
      // them before the row reaches the sheet repository.
      customer: JSON.stringify(customerSnapshot),
      adjustments: JSON.stringify(request.adjustments.map(toDbAdjustment)),
      created_by: FALLBACK_ACTOR,
    }

    try {
      await this.invoiceRepository().append(invoiceCommand)
    } catch (error) {
      // ⚠ Worst-case outcome: the item batch above already succeeded, so
      // itemCommands.length rows now exist referencing an invoice_number
      // with no header row. Reported as its own distinct kind — never
      // collapsed into items_write_failed — because a person now has to
      // reconcile this by hand, and a plain retry would append a second set
      // of items, regardless of `certainty`. This outcome carries no
      // `message` field in the public contract — only `certainty`.
      const failure = classifySheetWriteFailure(error)
      console.error('invoice_write_failed', error instanceof Error ? error.stack ?? error.message : String(error))
      return {
        kind: 'invoice_write_failed',
        invoiceNumber: request.invoiceNumber,
        itemCount: itemCommands.length,
        certainty: failure.certainty,
      }
    }

    // ── Mark the source order as invoiced. The invoice IS fully and
    //    correctly recorded at this point (items + header both written) —
    //    only the OrderForm-side linkage is missing if this step fails.
    //    Reported as its own distinct kind, never folded into
    //    invoice_write_failed, so the caller never offers a retry here: a
    //    retry would create a SECOND invoice for money that's already
    //    correctly billed. ──
    // Keyed on whether there is a source order at all, not on the billing
    // type. An invoice with no order to link to simply skips this stage —
    // that is the whole condition, and it does not need a billing type
    // invented for it.
    if (request.sourceOrderId) {
      try {
        await this.orderFormRepository().update(request.sourceOrderId, {
          invoice_id: request.invoiceNumber,
          updated_by: FALLBACK_ACTOR,
        })
      } catch (error) {
        const failure = classifySheetWriteFailure(error)
        console.error('order_link_failed', error instanceof Error ? error.stack ?? error.message : String(error))
        return {
          kind: 'order_link_failed',
          invoiceNumber: request.invoiceNumber,
          sourceOrderId: request.sourceOrderId,
          certainty: failure.certainty,
        }
      }
    }

    // Line netTotals are already rounded money, but summing several 2-decimal
    // floats can itself reintroduce binary drift — round the sum once, same
    // as computeInvoiceTotal does for its linesTotal.
    const itemsTotal = roundMoney(
      lineCalculations.reduce((sum, calculation) => sum + calculation.netTotal, 0),
    )
    const invoiceTotal = computeInvoiceTotal(
      lineCalculations.map((calculation) => calculation.netTotal),
      request.adjustments,
    )

    // This MUST remain the final external write. The source invoice and any
    // applicable order link are complete before refreshing the materialized view used
    // by the UI.
    //
    // `this.syncInvoiceView` is injectable (`InvoiceServiceOptions`), and the
    // real `syncInvoiceView` (invoice-view-sync-client.ts) is written to
    // never throw — but this is the one stage whose implementation this
    // service does not fully control, unlike the repository operations
    // above. Left unwrapped, a thrown error here would propagate past this
    // method entirely: `invoice.module.ts`'s route returns
    // `CreateInvoiceResponse` directly (not the generic `{success,data,meta}`
    // envelope), but a thrown error is caught by `ApiHandler`'s GENERIC
    // catch, which DOES return that generic envelope — a body with no
    // `kind` at all. The frontend's `result.kind` checks would then all
    // miss, rendering a blank result panel after a fully successful,
    // already-committed invoice. Wrapping this call closes that gap at the
    // source (the frontend also hardens against it independently — see
    // `invoice.service.ts` (frontend) and `synthesizeNetworkFailureOutcome`).
    let viewSync: Awaited<ReturnType<ViewSyncFn>>
    try {
      viewSync = await this.syncInvoiceView(request.invoiceNumber)
    } catch (error) {
      viewSync = {
        outcome: 'failed',
        certainty: 'unknown',
        message: error instanceof Error ? error.message : String(error),
      }
    }
    if (viewSync.outcome !== 'confirmed') {
      return {
        kind: 'invoice_view_sync_failed',
        invoiceNumber: request.invoiceNumber,
        message: viewSync.message,
        certainty: viewSync.certainty,
      }
    }

    return {
      kind: 'created',
      invoiceNumber: request.invoiceNumber,
      itemCount: itemCommands.length,
      itemsTotal,
      invoiceTotal,
    }
  }

  async update(invoiceNumber: string, payload: unknown): Promise<UpdateInvoiceResponse> {
    const request = parseOrThrow(invoiceStatusUpdateSchema, payload)
    if (invoiceNumber.trim() === '') {
      throw ApiError.notFound('Invoice number is required')
    }

    const rows = await this.invoiceRepository().read({ select: ['invoice_number', 'status'] })
    const invoice = rows.find((row) => row.invoice_number === invoiceNumber)
    if (invoice === undefined) {
      throw ApiError.notFound(`Invoice '${invoiceNumber}' not found`)
    }

    if (invoice.status !== request.status) {
      if (invoice.status !== 'ISSUED') {
        throw ApiError.conflict(`Invoice '${invoiceNumber}' cannot transition from ${invoice.status}`)
      }

      try {
        await this.invoiceRepository().update(invoiceNumber, {
          status: request.status,
          updated_by: FALLBACK_ACTOR,
        })
      } catch (error) {
        const failure = classifySheetWriteFailure(error)
        throw ApiError.internal(failure.message, {
          stage: 'invoice_status_write',
          certainty: failure.certainty,
        })
      }
    }

    try {
      const viewSync = await this.syncInvoiceView(invoiceNumber)
      return {
        invoiceNumber,
        status: request.status,
        viewSynced: viewSync.outcome === 'confirmed',
      }
    } catch {
      return { invoiceNumber, status: request.status, viewSynced: false }
    }
  }

  async list(query: ApiQueryParams): Promise<InvoiceListResult> {
    const validQuery = parseOrThrow(invoiceApiContract.query.list, query)
    const rows = await this.readInvoices()
    const filtered = rows.filter((row) => this.matchesListQuery(row, validQuery))
    filtered.sort((left, right) => compareInvoiceRows(left, right, validQuery))

    const total = filtered.length
    const start = (validQuery.page - 1) * validQuery.perPage
    return {
      items: filtered
        .slice(start, start + validQuery.perPage)
        .map((row) => this.projectListRow(row)),
      pagination: {
        total,
        page: validQuery.page,
        perPage: validQuery.perPage,
        totalPages: Math.ceil(total / validQuery.perPage),
      },
    }
  }

  async getById(id: string): Promise<InvoiceDetailResponse> {
    const safeId = id.trim()
    if (safeId === '') throw ApiError.badRequest('id is required')

    const matches = (await this.readInvoices()).filter((row) => row.invoiceNumber === safeId)
    if (matches.length === 0) throw ApiError.notFound(`Resource '${safeId}' not found`)
    if (matches.length > 1) throw ApiError.conflict(`Resource '${safeId}' resolved to multiple rows`)
    return matches[0]
  }

  private async readInvoices(): Promise<InvoiceDetailResponse[]> {
    const [invoices, items, payments] = await Promise.all([
      this.invoiceRepository().read(),
      this.invoiceItemReader().read(),
      this.paymentRepository().read(),
    ])
    return assembleInvoiceRows(invoices, items, payments, bangkokToday(this.now()))
  }

  private matchesListQuery(row: InvoiceDetailResponse, query: InvoiceListQuery): boolean {
    if (query.keyword && !row.invoiceNumber.includes(query.keyword) && !row.customerId.includes(query.keyword)) return false
    if (query.customerId && row.customerId !== query.customerId) return false
    if (query.status && row.status !== query.status) return false
    if (query.dateFrom && row.issuedDate < query.dateFrom) return false
    if (query.dateTo && row.issuedDate > query.dateTo) return false
    return true
  }

  private projectListRow(row: InvoiceDetailResponse): InvoiceListResponse {
    const output: Record<string, unknown> = {}
    for (const field of Object.keys(invoiceApiContract.response.list.shape)) {
      output[field] = row[field as keyof InvoiceDetailResponse]
    }
    return output as InvoiceListResponse
  }
}

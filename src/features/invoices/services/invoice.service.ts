import { z } from 'zod'
import { apiPageMetaSchema } from '@contracts/shared/api.schema'
import type { CreateInvoiceRequest, CreateInvoiceResponse } from '@contracts/invoices/invoice-api.schema'
import { invoiceListResponseSchema } from '@contracts/invoices/invoice-view-api.schema'
import type { InvoiceFilter } from '../types/invoice-filter.types'
import { getMockInvoiceListPage } from '../mocks/invoice-view.mock'
import type { InvoiceListResponseDto } from '../types/invoices.types'

const INVOICES_ENDPOINT = '/api/invoices'

const finiteNumberSchema = z.number().finite()
const positiveIntegerSchema = finiteNumberSchema.int().positive()
const invoiceListPageMetaSchema = apiPageMetaSchema.extend({
  page: positiveIntegerSchema,
  perPage: positiveIntegerSchema,
})

const invoiceListApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(invoiceListResponseSchema),
  meta: z.object({
    timestamp: z.string().optional(),
    pagination: invoiceListPageMetaSchema,
  }),
})

const legacyInvoiceStatusSchema = z.enum(['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE'])
const legacyPaymentStatusSchema = z.enum(['UNPAID', 'PARTIAL', 'PAID'])
const legacyPaymentMethodSchema = z.enum([
  'CASH',
  'TRANSFER',
  'CREDIT_CARD',
  'CHEQUE',
  'OTHER',
  'NONE',
])

const legacyInvoiceSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  customerId: z.string(),
  customerName: z.string(),
  customerPhone: z.string().nullable(),
  customerAddress: z.string().nullable(),
  customerTaxId: z.string().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
  issuedDate: z.string(),
  dueDate: z.string().nullable(),
  itemsSubtotal: finiteNumberSchema,
  discountAmount: finiteNumberSchema,
  surchargeAmount: finiteNumberSchema,
  subtotal: finiteNumberSchema,
  taxAmount: finiteNumberSchema,
  whtAmount: finiteNumberSchema,
  totalAmount: finiteNumberSchema,
  amountDue: finiteNumberSchema,
  amountPaid: finiteNumberSchema,
  balance: finiteNumberSchema,
  paymentStatus: legacyPaymentStatusSchema,
  paymentMethod: legacyPaymentMethodSchema,
  status: legacyInvoiceStatusSchema,
  items: z.array(z.unknown()),
  payments: z.array(z.unknown()),
  createdAt: z.string(),
  createdBy: z.string(),
  deletedAt: z.string().nullable(),
  deletedBy: z.string().nullable(),
})

const legacyInvoiceListResponseSchema = z.object({
  invoices: z.array(legacyInvoiceSchema),
  total: finiteNumberSchema.nonnegative(),
  page: positiveIntegerSchema,
  perPage: positiveIntegerSchema,
})

type LegacyInvoice = z.infer<typeof legacyInvoiceSchema>

export async function getInvoices(filter: InvoiceFilter): Promise<InvoiceListResponseDto> {
  const response = await fetch(`${INVOICES_ENDPOINT}?${buildQuery(filter)}`)

  if (!response.ok) {
    // The collection route is create-only, so GET currently returns 405.
    // Use the detail mock's list projection only for that known response;
    // other failures stay visible.
    if (response.status === 405) {
      return getMockInvoiceList(filter)
    }

    throw new Error(`Failed to load invoices: ${response.status}`)
  }

  return normalizeInvoiceListResponse(await response.json())
}

function normalizeInvoiceListResponse(body: unknown): InvoiceListResponseDto {
  const contractResponse = invoiceListApiResponseSchema.safeParse(body)
  if (contractResponse.success) {
    return {
      invoices: contractResponse.data.data,
      total: contractResponse.data.data.length,
      page: contractResponse.data.meta.pagination.page,
      perPage: contractResponse.data.meta.pagination.perPage,
    }
  }

  const legacyResponse = legacyInvoiceListResponseSchema.safeParse(body)
  if (legacyResponse.success) {
    return {
      invoices: legacyResponse.data.invoices.map(adaptLegacyInvoice),
      total: legacyResponse.data.total,
      page: legacyResponse.data.page,
      perPage: legacyResponse.data.perPage,
    }
  }

  throw new Error('Invalid invoice list response')
}

function adaptLegacyInvoice(invoice: LegacyInvoice) {
  if (invoice.dueDate === null) {
    throw new Error('Invalid legacy invoice list response')
  }

  const status = invoice.status === 'PARTIAL' ? 'PARTIALLY_PAID' : invoice.status

  return invoiceListResponseSchema.parse({
    invoiceNumber: invoice.invoiceNumber,
    status,
    billingType: 'ORDER',
    billingPeriodStart: invoice.periodStart,
    billingPeriodEnd: invoice.periodEnd,
    issuedDate: invoice.issuedDate,
    dueDate: invoice.dueDate,
    customerId: invoice.customerId,
    customer: {
      customerCode: invoice.customerId,
      customerName: invoice.customerName,
      phone: invoice.customerPhone,
      address: invoice.customerAddress,
    },
    subtotal: invoice.subtotal,
    adjustmentTotal: invoice.surchargeAmount - invoice.discountAmount,
    adjustments: [],
    grandTotal: invoice.totalAmount,
    paidAmount: invoice.amountPaid,
    balanceDue: invoice.balance,
  })
}

function getMockInvoiceList(filter: InvoiceFilter): InvoiceListResponseDto {
  const page = getMockInvoiceListPage(filter)

  return {
    invoices: page.items,
    total: page.total,
    page: page.page,
    perPage: page.perPage,
  }
}

/**
 * POST /api/invoices. Unlike every other endpoint in this app, the response
 * body IS the `CreateInvoiceResponse` discriminated union at the top level —
 * never wrapped in the generic `{ success, data, meta }` envelope (see
 * `server/modules/invoices/invoice.module.ts`). The HTTP status varies by
 * `kind` (201/422/500/502), but every kind is a well-formed JSON body, so this
 * always reads the body — regardless of `response.ok` — and lets the caller
 * dispatch on `body.kind` rather than the HTTP status.
 */
export async function createInvoice(request: CreateInvoiceRequest): Promise<CreateInvoiceResponse> {
  const response = await fetch(INVOICES_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  return response.json() as Promise<CreateInvoiceResponse>
}

function buildQuery(filter: InvoiceFilter): string {
  const params = new URLSearchParams()

  if (filter.keyword) params.set('keyword', filter.keyword)
  if (filter.customerId) params.set('customerId', filter.customerId)
  if (filter.status) params.set('status', filter.status)
  if (filter.dateFrom) params.set('dateFrom', filter.dateFrom)
  if (filter.dateTo) params.set('dateTo', filter.dateTo)
  params.set('page', String(filter.page))
  params.set('perPage', String(filter.perPage))
  params.set('sortBy', filter.sortBy)
  params.set('sortOrder', filter.sortOrder)

  return params.toString()
}

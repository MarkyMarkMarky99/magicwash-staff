import { z } from 'zod'
import {
  invoiceDetailResponseSchema,
  invoiceListResponseSchema,
} from '@contracts/invoices/invoice-view-api.schema'

/**
 * Stand-in for the `/api/invoices` (list) and `/api/invoices/:invoiceNumber`
 * (detail) responses while the frontend is built against `invoice-view-api
 * .schema.ts` before the route is wired up in `server/api/route-registry.ts`.
 *
 * Shape is the REAL response envelope, not a simplified one:
 * - list  → `okPaged()` in `server/shared/http/response.ts`:
 *           `{ success, data: T[], meta: { timestamp, pagination: { page, perPage } } }`
 *           (page-only meta — no `total`/`totalPages`, unlike
 *           `apiPaginatedSchema` in `contracts/shared/api.schema.ts`).
 * - detail → `ok()`: `{ success, data: T, meta: { timestamp } }`.
 *
 * Numbers here follow `invoice-calculator.ts` exactly (item adjustments
 * compound per unit before quantity; invoice adjustments apply once to the
 * summed net total) so totals are internally consistent, the same guarantee
 * a real backend response would carry.
 *
 * Delete this file once the frontend calls the real endpoint.
 */

type InvoiceListItem = z.infer<typeof invoiceListResponseSchema>
type InvoiceDetail = z.infer<typeof invoiceDetailResponseSchema>

interface MockPageMeta {
  timestamp: string
  pagination: { page: number; perPage: number }
}

interface MockListResponse {
  success: true
  data: InvoiceListItem[]
  meta: MockPageMeta
}

interface MockDetailResponse {
  success: true
  data: InvoiceDetail
  meta: { timestamp: string }
}

const invoiceDetails: InvoiceDetail[] = [
  {
    invoiceNumber: 'INV-2026-0034',
    status: 'PARTIALLY_PAID',
    billingType: 'ORDER',
    billingPeriodStart: null,
    billingPeriodEnd: null,
    issuedDate: '2026-07-15',
    dueDate: '2026-07-29',
    customerId: 'CUS-88291',
    customer: {
      customerCode: 'CUS-88291',
      customerName: 'บริษัท ตัวอย่าง จำกัด',
      phone: '081-234-5678',
      address: '99 ถนนสุขุมวิท กรุงเทพมหานคร 10110',
    },
    // Item A: no adjustment → netTotal === subtotal.
    // Item B: unitPrice 120 - 10% per unit = 108/unit → netTotal 5 * 108 = 540.
    subtotal: 1240,
    adjustmentTotal: 50,
    adjustments: [{ label: 'ค่าขนส่ง', calculation: 'FIXED', value: 50 }],
    grandTotal: 1290,
    paidAmount: 500,
    balanceDue: 790,
    items: [
      {
        description: 'ผ้าปูที่นอน',
        unit: 'ผืน',
        quantity: 20,
        unitPrice: 35,
        subtotal: 700,
        adjustments: [],
        netTotal: 700,
      },
      {
        description: 'ผ้าห่ม',
        unit: 'ผืน',
        quantity: 5,
        unitPrice: 120,
        subtotal: 600,
        adjustments: [{ label: 'ส่วนลดผ้าห่ม', calculation: 'PERCENT', value: -10 }],
        netTotal: 540,
      },
    ],
    payments: [
      {
        paymentId: 'PAY-2026-0050',
        amount: 500,
        method: 'QR_PROMPTPAY',
        status: 'VERIFIED',
        paidAt: '2026-07-20T10:30:00+07:00',
        reference: 'BANK-REF-050',
        proofUrl: 'https://example.com/payment-proof.jpg',
        notes: null,
      },
    ],
  },
  {
    invoiceNumber: 'INV-2026-0033',
    status: 'PAID',
    billingType: 'ORDER',
    billingPeriodStart: null,
    billingPeriodEnd: null,
    issuedDate: '2026-07-10',
    dueDate: '2026-07-24',
    customerId: 'CUS-88291',
    customer: {
      customerCode: 'CUS-88291',
      customerName: 'บริษัท ตัวอย่าง จำกัด',
      phone: '081-234-5678',
      address: '99 ถนนสุขุมวิท กรุงเทพมหานคร 10110',
    },
    subtotal: 700,
    adjustmentTotal: 0,
    adjustments: [],
    grandTotal: 700,
    paidAmount: 700,
    balanceDue: 0,
    items: [
      {
        description: 'ผ้าเช็ดตัว',
        unit: 'ผืน',
        quantity: 10,
        unitPrice: 70,
        subtotal: 700,
        adjustments: [],
        netTotal: 700,
      },
    ],
    payments: [
      {
        paymentId: 'PAY-2026-0048',
        amount: 700,
        method: 'CASH',
        status: 'VERIFIED',
        paidAt: '2026-07-11T09:15:00+07:00',
        reference: null,
        proofUrl: null,
        notes: null,
      },
    ],
  },
  {
    // UNPAID, no payments yet, stacked item-level FIXED+PERCENT adjustments —
    // covers a customer with no address on file (nullable, not omitted: the
    // real transformer in invoice-view.transformer.ts always emits
    // customer.address as `string | null`, never `undefined`).
    invoiceNumber: 'INV-2026-0035',
    status: 'UNPAID',
    billingType: 'ORDER',
    billingPeriodStart: null,
    billingPeriodEnd: null,
    issuedDate: '2026-07-28',
    dueDate: '2026-08-11',
    customerId: 'CUS-90410',
    customer: {
      customerCode: 'CUS-90410',
      customerName: 'สมชาย ใจดี',
      phone: '089-111-2222',
      address: null,
    },
    // Item A: unitPrice 100, [FIXED -12, PERCENT -10] → unit 100-12=88 → 88-8.8=79.2 → netTotal 10*79.2=792.
    // Item B: no adjustment → netTotal === subtotal (900).
    // Lines total 792+900=1692; invoice-level PERCENT -5% → 1692 - 84.6 = 1607.4.
    subtotal: 1692,
    adjustmentTotal: -84.6,
    adjustments: [{ label: 'ส่วนลดสมาชิก', calculation: 'PERCENT', value: -5 }],
    grandTotal: 1607.4,
    paidAmount: 0,
    balanceDue: 1607.4,
    items: [
      {
        description: 'เสื้อเชิ้ต',
        unit: 'ตัว',
        quantity: 10,
        unitPrice: 100,
        subtotal: 1000,
        adjustments: [
          { label: 'ค่าซัก-รีดพิเศษ', calculation: 'FIXED', value: -12 },
          { label: 'ส่วนลดโปรโมชัน', calculation: 'PERCENT', value: -10 },
        ],
        netTotal: 792,
      },
      {
        description: 'กางเกง',
        unit: 'ตัว',
        quantity: 6,
        unitPrice: 150,
        subtotal: 900,
        adjustments: [],
        netTotal: 900,
      },
    ],
    payments: [],
  },
]

function toListItem(detail: InvoiceDetail): InvoiceListItem {
  const { items: _items, payments: _payments, ...listItem } = detail
  return listItem
}

export const mockInvoiceListResponse: MockListResponse = {
  success: true,
  data: invoiceDetails.map(toListItem),
  meta: {
    timestamp: '2026-08-01T09:00:00.000Z',
    pagination: { page: 1, perPage: 20 },
  },
}

const detailByInvoiceNumber = new Map(
  invoiceDetails.map((detail) => [detail.invoiceNumber, detail]),
)

/** Simulates `GET /api/invoices/:invoiceNumber` — `undefined` if the number isn't one of the seeded mocks (simulate a 404 in the caller). */
export function getMockInvoiceDetailResponse(invoiceNumber: string): MockDetailResponse | undefined {
  const detail = detailByInvoiceNumber.get(invoiceNumber)
  if (!detail) return undefined

  return {
    success: true,
    data: detail,
    meta: { timestamp: '2026-08-01T09:05:00.000Z' },
  }
}

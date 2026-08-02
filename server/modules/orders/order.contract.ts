import { z } from 'zod'
import { orderApiContract } from '../../../contracts/orders/order-api.schema.js'
import type { ModuleContract, ModuleDbContract } from '../../shared/contracts/module-db-contract.js'
import type { ModuleApiContract } from '../../../contracts/shared/module-api-contract.js'

/**
 * DB contract for the read-only OrdersView materialized view.
 * KEY ORDER = physical sheet column order.
 */
export const orderRowSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  orderNumber: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  receivedDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  serviceType: z.string().nullable(),
  status: z.string().nullable(),
  quantity: z.string().nullable(),
  note: z.string().nullable(),
  itemsJson: z.string().nullable(),
  syncedAt: z.string(),
  createdAt: z.string().nullable(),
})

/** OrdersView columns are already camelCase; keep the identity map explicit. */
export const orderFieldMap = {
  orderId: 'orderId',
  customerId: 'customerId',
  orderNumber: 'orderNumber',
  invoiceNumber: 'invoiceNumber',
  receivedDate: 'receivedDate',
  dueDate: 'dueDate',
  serviceType: 'serviceType',
  status: 'status',
  quantity: 'quantity',
  note: 'note',
  itemsJson: 'itemsJson',
  syncedAt: 'syncedAt',
  createdAt: 'createdAt',
} as const satisfies Record<keyof z.infer<typeof orderRowSchema> & string, string>

export type OrderRow = z.infer<typeof orderRowSchema>

export const orderDbContract = {
  row: orderRowSchema,
  fieldMap: orderFieldMap,
  primaryKey: 'orderId',
  // `z.never()`, not an absent key: declares "this view must never be
  // written" as intent — GSheetRepository's isUnsupportedDbOperation gates
  // create()/update() off EITHER an absent slot or a z.never() one, so this
  // still rejects at runtime exactly as before.
  request: { create: z.never(), update: z.never() },
  response: { read: orderRowSchema.partial() },
} satisfies ModuleDbContract

export const orderContract = {
  api: orderApiContract,
  db: orderDbContract,
} satisfies ModuleContract

/**
 * OrderForm — a DIFFERENT physical sheet (tab "OrderForm", PK `id`) than
 * `OrdersView` above, sharing the same `ORDERS_SPREADSHEET_ID` workbook.
 * Moved here from the Invoices module per `docs/invoice-module-refactor-plan.md`
 * ("OrderForm belongs to Orders"): `InvoiceService` imports
 * `getOrderFormRepository()` from `order.repository.ts`, never a repository
 * file this module doesn't own.
 *
 * Authoritative source of truth:
 *   G:\My Drive\Magicwash\Database\GoogleSheets\OrderForm.json
 *
 * KEY ORDER = physical sheet column order (OrderForm.json property order).
 * This module only ever calls `.update()` on this sheet (to stamp
 * `invoice_id` once an invoice is issued) — never `.create()`/`.read()`; the
 * order itself is created by a different, out-of-scope flow, and staff browse
 * orders through the already-existing `OrdersView` above.
 */
export const orderFormRowSchema = z.object({
  id: z.string().min(1),
  order_number: z.string().nullable(),
  customer_id: z.string().min(1),
  received_date: z.string(),
  due_date: z.string(),
  service_type: z.enum(['WSIR', 'IRON']),
  status: z.enum(['PENDING', 'RECEIVED', 'SUBMITTED', 'APPROVED', 'COMPLETED', 'CANCELLED']),
  quantity: z.number().nullable(),
  hangers: z.number().nullable(),
  bags: z.number().nullable(),
  hangers_image: z.string().nullable(),
  bags_image: z.string().nullable(),
  form_image: z.string().nullable(),
  note: z.string().nullable(),
  timestamp: z.string().nullable(),
  created_by: z.string().nullable(),
  updated_at: z.string().nullable(),
  updated_by: z.string().nullable(),
  /** Our `Invoice.invoice_number` string, stored under OrderForm's own
   *  column name — `OrderForm.json` has no `invoice_number` property. */
  invoice_id: z.string().nullable(),
  order_name: z.string().nullable(),
  order_description: z.string().nullable(),
})

export type OrderFormRow = z.infer<typeof orderFormRowSchema>

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
} as const satisfies Record<keyof z.infer<typeof orderFormRowSchema> & string, string>

/** DB-facing capability/documentation schema — snake_case, exactly what
 *  `InvoiceService` sends: only the invoice-link patch plus the audit actor,
 *  never a full-row PATCH. `updated_at` is NOT auto-stamped by SheetLib on
 *  UPDATE the way `created_at` is on APPEND, but this module doesn't stamp it
 *  either — `OrderForm.json` has no requirement forcing it, and the existing
 *  `markOrderInvoiced` this replaces never sent it. */
export const orderFormDbUpdateRequestSchema = z.object({
  invoice_id: z.string().min(1),
  updated_by: z.string().min(1),
})

/** API/domain-facing update command — the only shape `InvoiceService` ever
 *  builds for this sheet. */
export const orderFormApiUpdateSchema = z
  .object({
    invoiceId: z.string().min(1),
    updatedBy: z.string().min(1),
  })
  .strict()

export type OrderFormApiUpdateCommand = z.infer<typeof orderFormApiUpdateSchema>

const orderFormInternalListQuerySchema = z.object({})
const orderFormInternalListResponseSchema = z.object({})

const orderFormApiContract = {
  query: { list: orderFormInternalListQuerySchema },
  // `create` is a required sibling of `update` in `ModuleApiContract`'s
  // structural shape but is never exercised: OrderForm rows are created by a
  // different, out-of-scope flow, and `db.request` below omits `create`
  // entirely, so `.create()` rejects at runtime before any fetch regardless
  // of this placeholder.
  request: { create: orderFormApiUpdateSchema, update: orderFormApiUpdateSchema },
  response: { list: orderFormInternalListResponseSchema },
} satisfies ModuleApiContract

export const orderFormDbContract = {
  row: orderFormRowSchema,
  fieldMap: orderFormFieldMap,
  primaryKey: 'id',
  request: { update: orderFormDbUpdateRequestSchema },
  response: { read: orderFormRowSchema.partial(), update: orderFormRowSchema },
} satisfies ModuleDbContract

/** The `ModuleContract` `getOrderFormRepository()` constructs its
 *  `GSheetRepository` from. */
export const orderFormContract = {
  api: orderFormApiContract,
  db: orderFormDbContract,
} satisfies ModuleContract

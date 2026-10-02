import { z } from 'zod'
import type { ModuleApiContract } from '../shared/module-api-contract.js'

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()])

export const portalOrdersApi = {
  query: { list: z.object({ customerId: z.string().optional(), orderId: z.string().optional() }) },
  response: {
    list: z.object({
      orderId: cell,
      customerId: cell,
      orderNumber: cell,
      invoiceNumber: cell,
      receivedDate: cell,
      dueDate: cell,
      serviceType: cell,
      status: cell,
      quantity: cell,
      note: cell,
      itemsJson: z.string(),
      // Assembly date in Asia/Bangkok, replacing the materialized sheet's sync date.
      syncedAt: z.string(),
      createdAt: cell,
    }),
  },
} satisfies ModuleApiContract

export const portalInvoicesApi = {
  query: { list: z.object({ customerId: z.string().optional(), invoiceNumber: z.string().optional() }) },
  response: {
    list: z.object({
      invoiceNumber: cell,
      status: cell,
      billingType: cell,
      billingPeriodStart: cell,
      billingPeriodEnd: cell,
      issuedDate: cell,
      dueDate: cell,
      customerId: cell,
      customerJson: z.string(),
      itemsJson: z.string(),
      adjustmentsJson: z.string(),
      paymentsJson: z.string(),
      subtotal: z.number(),
      adjustmentTotal: z.number(),
      grandTotal: z.number(),
      paidAmount: z.number(),
      balanceDue: z.number(),
    }),
  },
} satisfies ModuleApiContract

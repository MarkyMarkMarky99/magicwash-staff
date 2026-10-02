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

export const portalCustomerIdSchema = z.string().min(1)

const profileSchema = z.object({
  customerId: cell, customerIndex: cell, customerName: cell, phone: cell, address: cell, location: cell,
  registeredDate: cell, facebook: cell, lineId: cell, whatsapp: cell, email: cell, customerType: cell,
  source: cell, scheduledDays: cell, lastVisitDate: cell, preferredContactMethod: cell,
})
const appointmentSchema = z.object({
  appointmentId: cell, customerId: cell, appointmentType: cell, appointmentDate: cell, timeSlot: cell,
  status: cell, pickupOrderId: cell, deliveryOrderId: cell, notes: cell, deletedAt: cell, createdAt: cell,
})
export const portalPackageSchema = z.object({
  customerPackageId: z.string(), customerId: z.string(), customerName: z.string(),
  customerPhone: z.string().nullable(), customerAddress: z.string().nullable(),
  packageCode: z.string(), packageName: z.string(), packageEligibleService: z.string(),
  startDate: z.string().nullable(), expiryDate: z.string().nullable(), status: z.enum(['INACTIVE', 'ACTIVE', 'EXPIRED', 'CANCELLED']),
  serviceDay: z.string().nullable(), timeSlot: z.string().nullable(), invoiceId: z.string().nullable(), notes: z.string().nullable(),
  remainingCredit: z.number(), usedCredit: z.number(), totalCredit: z.number(), transactionsJson: z.string(),
})
export const portalCustomerResponseSchema = z.object({
  customer: profileSchema, orders: z.array(portalOrdersApi.response.list), invoices: z.array(portalInvoicesApi.response.list),
  appointments: z.array(appointmentSchema), packages: z.array(portalPackageSchema),
})

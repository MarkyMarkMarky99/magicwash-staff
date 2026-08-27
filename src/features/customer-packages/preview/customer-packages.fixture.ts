import { customerPackageDetailResponseSchema } from '@contracts/customer-packages/customer-package-api.schema'

export const CUSTOMER_PACKAGES = [
  customerPackageDetailResponseSchema.parse({
    customerPackageId: 'CP-20260801-0001',
    customerId: 'CUS-1001',
    customerName: 'สมชาย ใจดี',
    customerPhone: '0812341001',
    customerAddress: 'กรุงเทพมหานคร',
    packageCode: 'PKG-WF-10',
    packageName: 'Wash & Fold 10',
    packageEligibleService: 'WASH_FOLD',
    startDate: '2026-08-01',
    expiryDate: '2026-10-29',
    status: 'ACTIVE',
    serviceDay: 'MON',
    timeSlot: '10:00-12:00',
    invoiceId: 'INV260801001',
    notes: null,
    remainingCredit: 7,
    usedCredit: 3,
    totalCredit: 10,
    transactions: [
      { id: 'TX-20260801-0001', type: 'PURCHASE', creditChange: 10, remainingCredit: 10, referenceSource: 'INVOICE', referenceId: 'INV260801001', notes: 'Initial package credit', createdAt: '2026-08-01T10:00:00Z' },
      { id: 'TX-20260805-0001', type: 'USAGE', creditChange: -3, remainingCredit: 7, referenceSource: 'ORDER_ITEM', referenceId: 'ITEM-20260805', notes: 'Wash and fold order', createdAt: '2026-08-05T10:00:00Z' },
    ],
  }),
]

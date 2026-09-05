import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { z } from 'zod'
import { invoiceCreateSchema, type CreateInvoiceResponse } from '@contracts/invoices/invoice-api.schema'
import {
  createCustomerPackageRequestSchema,
  type createCustomerPackageResponseSchema,
} from '@contracts/customer-packages/customer-package-api.schema'
import type { CustomerDetailDto } from '@/features/customers/services/customer.service'
import type { PackageDto } from '@/features/packages/services/package.service'
import { createInvoice } from '@/features/invoices/services/invoice.service'
import { canRetryInvoiceOutcome, synthesizeNetworkFailureOutcome } from '@/features/invoices/utils/invoice-outcome.utils'
import { addSheetDateDays, todaySheetDate } from '@/shared/utils/sheet-date'
import { createCustomerPackage } from '../services/customer-package.service'

type PackageRequest = z.infer<typeof createCustomerPackageRequestSchema>
type PackageResult = z.infer<typeof createCustomerPackageResponseSchema>

interface PurchaseAttempt {
  invoiceRequest: z.infer<typeof invoiceCreateSchema>
  packageRequest: PackageRequest
  invoiceResult: CreateInvoiceResponse | null
  packageResult: PackageResult | null
  submitting: boolean
}

export function canResumePackagePurchase(attempt: PurchaseAttempt): boolean {
  if (attempt.submitting) return false
  if (attempt.invoiceResult?.kind !== 'created') return canRetryInvoiceOutcome(attempt.invoiceResult)
  const result = attempt.packageResult
  return !result || result.kind === 'validation_error' || result.kind === 'catalog_read_failed'
    || (result.kind === 'opening_transaction_write_failed' && result.certainty === 'rejected')
}

export const useCustomerPackagePurchaseStore = defineStore('customer-package-purchase', () => {
  // Keep partial/unknown outcomes when the overlay is dismissed and reopened.
  // A retry resumes the saved request; it never mints another invoice number.
  const attempts = ref<Record<string, PurchaseAttempt>>({})

  async function start(customer: CustomerDetailDto, packageItem: PackageDto, draft: PackageRequest) {
    if (attempts.value[customer.customerId]) return
    const packageRequest = createCustomerPackageRequestSchema.parse({ ...draft, invoiceId: null })
    if (packageRequest.customerId !== customer.customerId || packageRequest.packageCode !== packageItem.packageCode
      || packageItem.deletedAt !== null) throw new Error('Select an active package for this customer.')
    const issuedDate = todaySheetDate()
    const invoiceRequest = invoiceCreateSchema.parse({
      billingType: 'PACKAGE',
      invoiceNumber: `INV${issuedDate.replaceAll('-', '')}-${crypto.randomUUID()}`,
      issuedDate,
      // Match the existing invoice form's three-day payment term.
      dueDate: addSheetDateDays(issuedDate, 3),
      customer: {
        customerCode: customer.customerId, customerName: customer.customerName,
        ...(customer.phone?.trim() ? { phone: customer.phone.trim() } : {}),
        ...(customer.address?.trim() ? { address: customer.address.trim() } : {}),
      },
      adjustments: [],
      items: [{ description: `${packageItem.name} (${packageItem.packageCode})`, unit: 'PACKAGE', quantity: 1, unitPrice: packageItem.price, adjustments: [] }],
    })
    attempts.value[customer.customerId] = {
      invoiceRequest, packageRequest, invoiceResult: null, packageResult: null, submitting: false,
    }
    await run(attempts.value[customer.customerId])
  }

  async function resume(customerId: string) {
    const attempt = attempts.value[customerId]
    if (attempt && canResumePackagePurchase(attempt)) await run(attempt)
  }

  async function run(attempt: PurchaseAttempt) {
    attempt.submitting = true
    try {
      if (attempt.invoiceResult?.kind !== 'created') {
        try {
          attempt.invoiceResult = await createInvoice(attempt.invoiceRequest)
        } catch {
          attempt.invoiceResult = synthesizeNetworkFailureOutcome()
        }
        if (attempt.invoiceResult.kind !== 'created') return
        attempt.packageRequest.invoiceId = attempt.invoiceResult.invoiceNumber
      }
      attempt.packageResult = await createCustomerPackage(attempt.packageRequest)
    } finally {
      attempt.submitting = false
    }
  }

  function clear(customerId: string) {
    const attempt = attempts.value[customerId]
    if (!attempt || attempt.submitting) return
    if (attempt.packageResult?.kind === 'created'
      || (attempt.invoiceResult?.kind !== 'created' && canRetryInvoiceOutcome(attempt.invoiceResult))) {
      delete attempts.value[customerId]
    }
  }

  return { attempts, start, resume, clear }
})

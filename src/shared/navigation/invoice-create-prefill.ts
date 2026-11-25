import type { BillingDraft } from '@contracts/ai-gateway/billing-draft.schema'

let invoiceCreatePrefill: BillingDraft | null = null

export function setInvoiceCreatePrefill(draft: BillingDraft): void {
  invoiceCreatePrefill = draft
}

export function takeInvoiceCreatePrefill(): BillingDraft | null {
  const draft = invoiceCreatePrefill
  invoiceCreatePrefill = null
  return draft
}

import type { BillingDraft, BillingDraftLine } from '@contracts/ai-gateway/billing-draft.schema'
import type { InvoiceCreateOrder } from '../services/invoice-create-context.service'
import type { LineItemFormRow } from '../types/invoice-create.types'

export async function applyInvoiceCreatePrefill(
  draft: BillingDraft | null,
  order: Pick<InvoiceCreateOrder, 'orderId' | 'customerId'>,
  items: LineItemFormRow[],
  findExistingInvoice: (orderId: string) => Promise<string | null>,
): Promise<{ items: LineItemFormRow[]; existingInvoiceNumber: string | null }> {
  if (!draft || draft.orderId !== order.orderId || draft.customerId !== order.customerId) {
    return { items, existingInvoiceNumber: null }
  }

  const existingInvoiceNumber = await findExistingInvoice(order.orderId)
  if (existingInvoiceNumber !== null) return { items, existingInvoiceNumber }

  const draftLines = new Map<string, BillingDraftLine>()
  for (const line of draft.lines) {
    if (!draftLines.has(line.orderItemId)) draftLines.set(line.orderItemId, line)
  }

  return {
    items: items.map((item) => {
      if (item.sourceItemId === undefined) return item
      const line = draftLines.get(item.sourceItemId)
      if (!line) return item
      draftLines.delete(item.sourceItemId)
      const usePrice = line.source !== 'needs-price' && line.unitPrice !== null && line.unit === item.unit
      return {
        ...item,
        unitPrice: usePrice ? String(line.unitPrice) : '',
        photoMatch: line.photoMatch,
        source: line.source,
      }
    }),
    existingInvoiceNumber: null,
  }
}

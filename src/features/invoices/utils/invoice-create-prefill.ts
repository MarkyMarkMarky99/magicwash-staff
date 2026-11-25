import type { BillingDraft, BillingDraftLine } from '@contracts/ai-gateway/billing-draft.schema'
import type { InvoiceCreateOrder } from '../services/invoice-create-context.service'
import { createEmptyLineItemRow, type LineItemFormRow } from '../types/invoice-create.types'
import { invoiceUnitOptionFor } from './invoice-price-list.utils'

function draftFormLine(line: BillingDraftLine, orderId: string): LineItemFormRow {
  const [sourceItemId, ...others] = (line.orderId ?? orderId) === orderId ? line.orderItemIds : []
  return {
    ...createEmptyLineItemRow(),
    ...(sourceItemId !== undefined && others.length === 0 ? { sourceItemId } : {}),
    ...(line.priceListRow ? { sku: line.priceListRow.itemCode } : {}),
    photoMatch: line.photoMatch,
    source: line.source,
    description: line.description,
    unit: line.unit,
    unitOption: invoiceUnitOptionFor(line.unit),
    quantity: String(line.quantity),
    unitPrice: line.unitPrice === null ? '' : String(line.unitPrice),
  }
}

export async function applyInvoiceCreatePrefill(
  draft: BillingDraft | null,
  order: Pick<InvoiceCreateOrder, 'orderId' | 'customerId'>,
  items: LineItemFormRow[],
  findExistingInvoice: (orderId: string) => Promise<string | null>,
): Promise<{ items: LineItemFormRow[]; existingInvoiceNumber: string | null }> {
  if (!draft || draft.orderId !== order.orderId || draft.customerId !== order.customerId || draft.lines.length === 0) {
    return { items, existingInvoiceNumber: null }
  }

  const existingInvoiceNumber = await findExistingInvoice(order.orderId)
  if (existingInvoiceNumber !== null) return { items, existingInvoiceNumber }

  return { items: draft.lines.map((line) => draftFormLine(line, order.orderId)), existingInvoiceNumber: null }
}

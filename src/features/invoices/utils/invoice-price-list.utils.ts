import type { PriceListDto } from '@/data/price-list/price-list.service'
import {
  createEmptyLineItemRow,
  invoiceUnitOptions,
  type InvoiceUnitOption,
  type LineItemFormRow,
} from '../types/invoice-create.types'
import { serviceTypePresentation } from '@/shared/utils/service-type-labels'

export function filterInvoicePriceListItems(items: PriceListDto[]): PriceListDto[] {
  return items.filter((item) => item.active === true && item.priceGroup === 'DEFAULT')
}

export function toLineItemFormRow(
  item: PriceListDto,
): LineItemFormRow {
  const line = createEmptyLineItemRow()
  const serviceLabel = serviceTypePresentation[item.serviceType].label
  line.description = `${item.displayNameTh} (${serviceLabel} / ${item.serviceType})`
  const unit = item.unit ?? ''
  const unitOption = invoiceUnitOptionFor(unit)
  line.unit = unit
  line.unitOption = unitOption
  line.quantity = '1'
  line.unitPrice = String(item.price)
  line.adjustments = []
  return line
}

export function invoiceUnitOptionFor(unit: string): InvoiceUnitOption {
  return invoiceUnitOptions.some((option) => option === unit)
    ? unit as InvoiceUnitOption
    : 'custom'
}

export function isUnusedPlaceholderLine(row: LineItemFormRow): boolean {
  return (
    row.syntheticPlaceholder === true
    && row.description.trim() === ''
    && row.unitPrice.trim() === ''
    && row.quantity === '1'
    && row.adjustments.length === 0
  )
}

/**
 * Always-safe append. An empty `existing` array is a first-class case — never
 * index `existing[existing.length - 1]` without handling length 0.
 *
 * The only replace case is a single still-unused synthetic placeholder.
 * Order-seeded rows are never marked, so a blank-looking real line is appended
 * to, not overwritten.
 */
export function appendPickedLine(
  existing: readonly LineItemFormRow[],
  picked: LineItemFormRow,
): LineItemFormRow[] {
  if (existing.length === 0) return [picked]
  if (existing.length === 1 && isUnusedPlaceholderLine(existing[0]!)) return [picked]
  return [...existing, picked]
}

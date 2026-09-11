import type { z } from 'zod'
import type { invoiceAdjustmentCalculationSchema } from '@contracts/invoices/invoice-api.schema'

type InvoiceAdjustmentCalculation = z.infer<typeof invoiceAdjustmentCalculationSchema>

export interface AdjustmentFormRow {
  /** Local key for `v-for` / row identity — never sent to the server. */
  key: string
  label: string
  calculation: InvoiceAdjustmentCalculation
  /** String-backed; parsed to a number and dropped if zero/blank at submit. */
  value: string
  refSource: string
  refCode: string
}

export const invoiceUnitOptions = ['kg', 'piece', 'pair', 'package', 'set', 'load', 'custom'] as const
export type InvoiceUnitOption = (typeof invoiceUnitOptions)[number]

export interface LineItemFormRow {
  key: string
  description: string
  unit: string
  unitOption: InvoiceUnitOption
  quantity: string
  unitPrice: string
  adjustments: AdjustmentFormRow[]
  // Form-local marker for the blank row seeded when the order had zero items.
  syntheticPlaceholder?: true
}

export function createEmptyAdjustmentRow(): AdjustmentFormRow {
  return {
    key: crypto.randomUUID(),
    label: '',
    calculation: 'FIXED',
    value: '',
    refSource: '',
    refCode: '',
  }
}

export function createEmptyLineItemRow(): LineItemFormRow {
  return {
    key: crypto.randomUUID(),
    description: '',
    unit: 'piece',
    unitOption: 'piece',
    quantity: '1',
    unitPrice: '',
    adjustments: [],
  }
}

/** Blank row used only when the source order has zero items. */
export function createSyntheticPlaceholderLine(): LineItemFormRow {
  return {
    ...createEmptyLineItemRow(),
    syntheticPlaceholder: true,
  }
}

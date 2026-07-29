import type { InvoiceAdjustmentCalculation } from '@contracts/invoices/invoice-api.schema'

/**
 * Form-local row shapes for the invoice-create page — string-backed so they
 * bind cleanly to text/number `<input>` elements while the staff member is
 * still typing (an empty unit-price field, a half-typed "-1" adjustment
 * value). These are converted to the real `CreateInvoiceRequest` shape (see
 * `invoice-api.schema.ts`) only at submit time, in `InvoiceCreatePage.vue`.
 *
 * Deliberately NOT reusing `src/features/invoices/types/invoices.types.ts` —
 * that file's `status` field uses `UNPAID`/`PAID`/etc, values the real
 * `Invoice.status` column rejects outright (see `.claude/agents/invoice-builder.md`).
 * It backs the separate, pre-existing invoice list/detail feature; nothing
 * here imports it.
 */

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

export interface LineItemFormRow {
  key: string
  description: string
  unit: string
  quantity: string
  unitPrice: string
  adjustments: AdjustmentFormRow[]
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
    unit: '',
    quantity: '1',
    unitPrice: '',
    adjustments: [],
  }
}

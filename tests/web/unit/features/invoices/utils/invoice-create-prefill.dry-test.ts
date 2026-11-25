import assert from 'node:assert/strict'
import test from 'node:test'
import { ref } from 'vue'
import type { BillingDraft, BillingDraftLine } from '@contracts/ai-gateway/billing-draft.schema'
import { useDuplicateInvoiceWarning } from '@/shared/composables/use-duplicate-invoice-warning'
import { setInvoiceCreatePrefill, takeInvoiceCreatePrefill } from '@/shared/navigation/invoice-create-prefill'
import { createEmptyLineItemRow } from '@/features/invoices/types/invoice-create.types'
import { applyInvoiceCreatePrefill } from '@/features/invoices/utils/invoice-create-prefill'

const order = { orderId: 'ORDER-1', customerId: 'CUS-1' }

function draftLine(orderItemId: string, overrides: Partial<BillingDraftLine> = {}): BillingDraftLine {
  return {
    orderItemId,
    description: 'Suggested description',
    unit: 'piece',
    quantity: 99,
    unitPrice: 50,
    source: 'customer-history',
    photoMatch: 'probable',
    citations: [],
    priceListRow: null,
    priceListPrice: null,
    otherPrices: [],
    note: '',
    ...overrides,
  }
}

function seededLine(sourceItemId: string) {
  return { ...createEmptyLineItemRow(), sourceItemId, description: 'Seeded description', quantity: '2' }
}

const draft: BillingDraft = { ...order, lines: [draftLine('ITEM-1')], warnings: [] }
const noInvoices = async () => null
const noLookup = async () => assert.fail('duplicate lookup should not run')

test('takes and applies a matching draft once without changing seeded line identity or adding lines', async () => {
  const items = [seededLine('ITEM-1'), seededLine('ITEM-2'), createEmptyLineItemRow()]
  setInvoiceCreatePrefill({ ...draft, lines: [...draft.lines, draftLine('MISSING')] })
  const first = await applyInvoiceCreatePrefill(takeInvoiceCreatePrefill(), order, items, async (id) => {
    assert.equal(id, order.orderId)
    return null
  })
  assert.deepEqual(first.items, [
    { ...items[0], unitPrice: '50', photoMatch: 'probable', source: 'customer-history' },
    items[1],
    items[2],
  ])
  const second = await applyInvoiceCreatePrefill(takeInvoiceCreatePrefill(), order, items, noLookup)
  assert.deepEqual(second, { items, existingInvoiceNumber: null })
})

test('refuses a draft on either ID mismatch without an invoice lookup', async () => {
  const items = [seededLine('ITEM-1')]
  for (const mismatch of [{ ...order, orderId: 'OTHER' }, { ...order, customerId: 'OTHER' }]) {
    setInvoiceCreatePrefill(draft)
    const result = await applyInvoiceCreatePrefill(takeInvoiceCreatePrefill(), mismatch, items, noLookup)
    assert.deepEqual(result, { items, existingInvoiceNumber: null })
    assert.equal(takeInvoiceCreatePrefill(), null)
  }
})

test('refuses a draft and supplies the duplicate warning even when the order has no invoice link', async () => {
  const items = [seededLine('ITEM-1')]
  const result = await applyInvoiceCreatePrefill(draft, order, items, async () => 'INV-1')
  assert.deepEqual(result, { items, existingInvoiceNumber: 'INV-1' })
  const warning = useDuplicateInvoiceWarning(ref({ invoiceNumber: null }), ref(result.existingInvoiceNumber))
  assert.equal(warning.warningInvoiceNumber.value, 'INV-1')
})

test('leaves mismatched units, needs-price and null prices blank and accepts zero', async () => {
  const lines = [
    draftLine('ITEM-1', { unit: 'kg' }),
    draftLine('ITEM-2', { source: 'needs-price' }),
    draftLine('ITEM-3', { unitPrice: null }),
    draftLine('ITEM-4', { unitPrice: 0 }),
  ]
  const { items } = await applyInvoiceCreatePrefill(
    { ...draft, lines }, order, lines.map((line) => seededLine(line.orderItemId)), noInvoices,
  )
  assert.deepEqual(items.map((line) => line.unitPrice), ['', '', '', '0'])
  assert.deepEqual(items.map((line) => line.source), lines.map((line) => line.source))
  assert.deepEqual(items.map((line) => line.photoMatch), lines.map((line) => line.photoMatch))
})

test('uses the first draft line for an order item ID at most once', async () => {
  const { items } = await applyInvoiceCreatePrefill(
    { ...draft, lines: [draftLine('ITEM-1'), draftLine('ITEM-1', { unitPrice: 75 })] },
    order, [seededLine('ITEM-1'), seededLine('ITEM-1')], noInvoices,
  )
  assert.deepEqual(items.map((line) => line.unitPrice), ['50', ''])
})

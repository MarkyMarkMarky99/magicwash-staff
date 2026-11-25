import assert from 'node:assert/strict'
import test from 'node:test'
import { ref } from 'vue'
import type { BillingDraft, BillingDraftLine } from '@contracts/ai-gateway/billing-draft.schema'
import { useDuplicateInvoiceWarning } from '@/shared/composables/use-duplicate-invoice-warning'
import { setInvoiceCreatePrefill, takeInvoiceCreatePrefill } from '@/shared/navigation/invoice-create-prefill'
import { createEmptyLineItemRow } from '@/features/invoices/types/invoice-create.types'
import { applyInvoiceCreatePrefill } from '@/features/invoices/utils/invoice-create-prefill'

const order = { orderId: 'ORDER-1', customerId: 'CUS-1' }

function draftLine(overrides: Partial<BillingDraftLine> = {}): BillingDraftLine {
  return {
    description: 'แพกเกจรีดเสื้อผ้าทั่วไป 10 ชิ้น',
    quantity: 2,
    unit: 'package',
    unitPrice: 250,
    orderItemIds: ['ITEM-1', 'ITEM-2'],
    source: 'customer-history',
    photoMatch: null,
    reason: '',
    citations: [],
    priceListRow: null,
    ...overrides,
  }
}

function seededLine(sourceItemId: string) {
  return { ...createEmptyLineItemRow(), sourceItemId, description: 'Seeded description', quantity: '2' }
}

const draft: BillingDraft = { ...order, lines: [draftLine()], warnings: [] }
const noInvoices = async () => null
const noLookup = async () => assert.fail('duplicate lookup should not run')

test('replaces the seeded order lines with the draft lines once', async () => {
  const items = [seededLine('ITEM-1'), seededLine('ITEM-2')]
  setInvoiceCreatePrefill(draft)
  const first = await applyInvoiceCreatePrefill(takeInvoiceCreatePrefill(), order, items, async (id) => {
    assert.equal(id, order.orderId)
    return null
  })
  assert.equal(first.items.length, 1)
  const [line] = first.items
  assert.equal(line.description, 'แพกเกจรีดเสื้อผ้าทั่วไป 10 ชิ้น')
  assert.equal(line.quantity, '2')
  assert.equal(line.unit, 'package')
  assert.equal(line.unitOption, 'package')
  assert.equal(line.unitPrice, '250')
  assert.equal(line.source, 'customer-history')
  assert.equal(line.sourceItemId, undefined)
  assert.equal(line.sku, undefined)
  const second = await applyInvoiceCreatePrefill(takeInvoiceCreatePrefill(), order, items, noLookup)
  assert.deepEqual(second, { items, existingInvoiceNumber: null })
})

test('keeps one covered item as provenance, the price list code as sku, custom units and blank prices', async () => {
  const { items } = await applyInvoiceCreatePrefill({ ...draft, lines: [
    draftLine({ orderItemIds: ['ITEM-1'], unit: 'piece', priceListRow: {
      itemCode: 'ITM-0048', serviceType: 'IRON', priceGroup: 'DEFAULT', unit: 'piece', price: 35,
    } }),
    draftLine({ orderItemIds: [], unit: 'ถุง', unitPrice: null, source: 'needs-price', photoMatch: 'probable' }),
  ] }, order, [seededLine('ITEM-1')], noInvoices)
  assert.equal(items[0].sourceItemId, 'ITEM-1')
  assert.equal(items[0].sku, 'ITM-0048')
  assert.equal(items[1].unitOption, 'custom')
  assert.equal(items[1].unit, 'ถุง')
  assert.equal(items[1].unitPrice, '')
  assert.equal(items[1].photoMatch, 'probable')
})

test('lines from another order of the customer keep no item provenance', async () => {
  const { items } = await applyInvoiceCreatePrefill({ ...draft, lines: [
    draftLine({ orderItemIds: ['ITEM-1'], orderId: 'ORDER-1' }),
    draftLine({ orderItemIds: ['OTHER-ITEM'], orderId: 'ORDER-2', description: 'ซักแห้งแจ็กเก็ตยีนส์', source: 'chat' }),
  ] }, order, [seededLine('ITEM-1')], noInvoices)
  assert.deepEqual(items.map((line) => [line.sourceItemId, line.description, line.source]), [
    ['ITEM-1', 'แพกเกจรีดเสื้อผ้าทั่วไป 10 ชิ้น', 'customer-history'],
    [undefined, 'ซักแห้งแจ็กเก็ตยีนส์', 'chat'],
  ])
})

test('refuses a draft on either ID mismatch or with no lines, without an invoice lookup', async () => {
  const items = [seededLine('ITEM-1')]
  for (const [value, target] of [
    [draft, { ...order, orderId: 'OTHER' }],
    [draft, { ...order, customerId: 'OTHER' }],
    [{ ...draft, lines: [] }, order],
  ] as const) {
    const result = await applyInvoiceCreatePrefill(value, target, items, noLookup)
    assert.deepEqual(result, { items, existingInvoiceNumber: null })
  }
})

test('refuses a draft and supplies the duplicate warning when the order already has an invoice', async () => {
  const items = [seededLine('ITEM-1')]
  const result = await applyInvoiceCreatePrefill(draft, order, items, async () => 'INV-1')
  assert.deepEqual(result, { items, existingInvoiceNumber: 'INV-1' })
  const warning = useDuplicateInvoiceWarning(ref({ invoiceNumber: null }), ref(result.existingInvoiceNumber))
  assert.equal(warning.warningInvoiceNumber.value, 'INV-1')
})

import assert from 'node:assert/strict'
import type { InvoicePriceListItemDto } from '../../../../../../src/features/invoices/services/invoice-price-list.service'
import {
  createSyntheticPlaceholderLine,
  type LineItemFormRow,
} from '../../../../../../src/features/invoices/types/invoice-create.types'
import {
  PRICE_LIST_RENDER_CAP,
  appendPickedLine,
  availableServices,
  capGroupedItems,
  filterPriceListItems,
  formatBaht,
  formatEffectiveRange,
  groupPriceListByCategory,
  hasServicePrice,
  iconForCategory,
  isUnusedPlaceholderLine,
  toLineItemFormRow,
  uniqueCategories,
} from '../../../../../../src/features/invoices/utils/invoice-price-list.utils'

/** Mirrors `InvoiceCreatePage.initializeForm` mapping of an order item — never marked synthetic. */
function seedFromOrderItem(orderItem: {
  description: string | null
  quantity: number | null
}): LineItemFormRow {
  return {
    key: crypto.randomUUID(),
    description: orderItem.description ?? '',
    unit: 'piece',
    unitOption: 'piece',
    quantity: orderItem.quantity != null ? String(orderItem.quantity) : '1',
    unitPrice: '',
    adjustments: [],
  }
}

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void) {
  tests.push({ name, run })
}

function item(overrides: Partial<InvoicePriceListItemDto> = {}): InvoicePriceListItemDto {
  return {
    id: 'pl-1',
    itemCode: 'ITM-0001',
    category: 'Bedding',
    subcategory: 'Pillows',
    itemType: 'Pillow',
    variant: 'Synthetic Fiber',
    displayNameTh: 'หมอนหนุนใยสังเคราะห์',
    washDryIronPrice: 200,
    ironOnlyPrice: null,
    dryCleanPrice: null,
    creditEligible: true,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    active: true,
    ...overrides,
  }
}

test('hasServicePrice treats 0 as present and null/undefined as missing', () => {
  assert.equal(hasServicePrice(0), true)
  assert.equal(hasServicePrice(80), true)
  assert.equal(hasServicePrice(null), false)
  assert.equal(hasServicePrice(undefined), false)
})

test('availableServices keeps a 0-baht chip and drops only null prices', () => {
  const services = availableServices(item({
    washDryIronPrice: 0,
    ironOnlyPrice: null,
    dryCleanPrice: 120,
  }))

  assert.deepEqual(
    services.map((service) => [service.key, service.price, service.label]),
    [
      ['washDryIronPrice', 0, 'ซัก อบ รีด'],
      ['dryCleanPrice', 120, 'ดรายคลีน'],
    ],
  )
})

test('toLineItemFormRow maps display name, service, qty 1, and zero unit price as "0"', () => {
  const line = toLineItemFormRow(
    item({ displayNameTh: 'ปลอกหมอนหนุน', washDryIronPrice: 0 }),
    'washDryIronPrice',
  )

  assert.ok(line)
  assert.equal(line.description, 'ปลอกหมอนหนุน (ซัก อบ รีด)')
  assert.equal(line.unit, 'piece')
  assert.equal(line.unitOption, 'piece')
  assert.equal(line.quantity, '1')
  assert.equal(line.unitPrice, '0')
  assert.deepEqual(line.adjustments, [])
  assert.equal(typeof line.key, 'string')
  assert.notEqual(line.key, '')
})

test('toLineItemFormRow returns null when that service has no price', () => {
  assert.equal(toLineItemFormRow(item({ ironOnlyPrice: null }), 'ironOnlyPrice'), null)
})

test('appendPickedLine works on an empty draft (the previous first-line bug class)', () => {
  const picked = toLineItemFormRow(item(), 'washDryIronPrice')
  assert.ok(picked)
  const next = appendPickedLine([], picked)
  assert.equal(next.length, 1)
  assert.equal(next[0], picked)
})

test('1. empty order: synthetic placeholder is replaced by the first pick', () => {
  const placeholder = createSyntheticPlaceholderLine()
  const picked = toLineItemFormRow(item(), 'washDryIronPrice')
  assert.ok(picked)
  assert.equal(isUnusedPlaceholderLine(placeholder), true)

  const next = appendPickedLine([placeholder], picked)
  assert.equal(next.length, 1)
  assert.equal(next[0], picked)
})

test('2. one order item with a real description: first pick appends, original untouched', () => {
  const seeded = seedFromOrderItem({ description: 'เสื้อเชิ้ตโปโล', quantity: 2 })
  const picked = toLineItemFormRow(item(), 'washDryIronPrice')
  assert.ok(picked)
  assert.equal(isUnusedPlaceholderLine(seeded), false)

  const next = appendPickedLine([seeded], picked)
  assert.equal(next.length, 2)
  assert.equal(next[0], seeded)
  assert.equal(next[0]!.description, 'เสื้อเชิ้ตโปโล')
  assert.equal(next[1], picked)
})

test('3. one order item with null description and null quantity: first pick appends, original untouched', () => {
  const seeded = seedFromOrderItem({ description: null, quantity: null })
  const picked = toLineItemFormRow(item(), 'washDryIronPrice')
  assert.ok(picked)
  assert.equal(seeded.description, '')
  assert.equal(seeded.quantity, '1')
  assert.equal(seeded.unitPrice, '')
  assert.equal(isUnusedPlaceholderLine(seeded), false)

  const next = appendPickedLine([seeded], picked)
  assert.equal(next.length, 2)
  assert.equal(next[0], seeded)
  assert.equal(next[0]!.description, '')
  assert.equal(next[0]!.quantity, '1')
  assert.equal(next[1], picked)
})

test('3b. one order item with empty description and quantity 1: first pick appends', () => {
  const seeded = seedFromOrderItem({ description: '', quantity: 1 })
  const picked = toLineItemFormRow(item(), 'washDryIronPrice')
  assert.ok(picked)
  assert.equal(isUnusedPlaceholderLine(seeded), false)

  const next = appendPickedLine([seeded], picked)
  assert.equal(next.length, 2)
  assert.equal(next[0], seeded)
  assert.equal(next[1], picked)
})

test('4. multiple existing items of any shape: first pick always appends', () => {
  const seeded = [
    seedFromOrderItem({ description: null, quantity: null }),
    seedFromOrderItem({ description: 'ปลอกหมอน', quantity: 1 }),
  ]
  const picked = toLineItemFormRow(item(), 'washDryIronPrice')
  assert.ok(picked)

  const next = appendPickedLine(seeded, picked)
  assert.equal(next.length, 3)
  assert.equal(next[0], seeded[0])
  assert.equal(next[1], seeded[1])
  assert.equal(next[2], picked)
})

test('filterPriceListItems matches code, Thai name, and category, and respects category chips', () => {
  const rows = [
    item({ id: 'a', itemCode: 'ITM-0001', displayNameTh: 'หมอนหนุน', category: 'Bedding' }),
    item({ id: 'b', itemCode: 'ITM-0010', displayNameTh: 'เสื้อเชิ้ตแขนยาว', category: 'Apparel' }),
  ]

  assert.deepEqual(
    filterPriceListItems(rows, { query: 'itm-0001', category: null }).map((row) => row.id),
    ['a'],
  )
  assert.deepEqual(
    filterPriceListItems(rows, { query: 'เสื้อ', category: null }).map((row) => row.id),
    ['b'],
  )
  assert.deepEqual(
    filterPriceListItems(rows, { query: '', category: 'Apparel' }).map((row) => row.id),
    ['b'],
  )
  assert.deepEqual(
    filterPriceListItems(rows, { query: 'หมอน', category: 'Apparel' }).map((row) => row.id),
    [],
  )
})

test('groupPriceListByCategory and uniqueCategories preserve first-seen order', () => {
  const rows = [
    item({ id: '1', category: 'Apparel' }),
    item({ id: '2', category: 'Bedding' }),
    item({ id: '3', category: 'Apparel' }),
  ]
  assert.deepEqual(uniqueCategories(rows), ['Apparel', 'Bedding'])
  assert.deepEqual(
    groupPriceListByCategory(rows).map((group) => [group.category, group.items.map((row) => row.id)]),
    [
      ['Apparel', ['1', '3']],
      ['Bedding', ['2']],
    ],
  )
})

test('capGroupedItems does not silently drop rows past the cap without truncated=true', () => {
  const groups = [
    { category: 'A', items: [item({ id: '1' }), item({ id: '2' }), item({ id: '3' })] },
    { category: 'B', items: [item({ id: '4' }), item({ id: '5' })] },
  ]
  const capped = capGroupedItems(groups, 3)
  assert.equal(capped.truncated, true)
  assert.equal(capped.renderedCount, 3)
  assert.deepEqual(
    capped.groups.flatMap((group) => group.items.map((row) => row.id)),
    ['1', '2', '3'],
  )
  assert.equal(PRICE_LIST_RENDER_CAP, 2000)
})

test('iconForCategory is generic (hints, not a hardcoded catalog of names)', () => {
  assert.equal(iconForCategory('Bedding'), 'bed')
  assert.equal(iconForCategory('Hotel Bedding Sets'), 'bed')
  assert.equal(iconForCategory('Suits & Formal'), 'dry_cleaning')
  assert.equal(iconForCategory('Mystery Future Category'), 'local_laundry_service')
})

test('formatEffectiveRange shows an open end date as ไม่กำหนด', () => {
  assert.equal(formatEffectiveRange('2026-01-01', '2026-12-31'), 'มีผล: 01/01/2026 – 31/12/2026')
  assert.equal(formatEffectiveRange('2026-01-01', null), 'มีผล: 01/01/2026 – ไม่กำหนด')
  assert.equal(formatBaht(0), '฿0')
})

let failed = 0
for (const entry of tests) {
  try {
    entry.run()
  } catch (reason) {
    failed += 1
    console.error(`FAIL ${entry.name}`)
    console.error(reason)
  }
}

if (failed > 0) {
  console.error(`${failed}/${tests.length} failed`)
  process.exit(1)
}

console.log(`${tests.length}/${tests.length} passed`)

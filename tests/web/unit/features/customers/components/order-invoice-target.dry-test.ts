import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { z } from 'zod'
import type { orderListResponseSchema } from '../../../../../../contracts/orders/order-api.schema'
import {
  getInvoiceTarget,
  isInvoiceActionAvailable,
} from '../../../../../../src/features/customers/utils/order-invoice-target'

type OrderListDto = z.infer<typeof orderListResponseSchema>

const orderCardSource = readFileSync(
  new URL('../../../../../../src/features/customers/components/OrderCard.vue', import.meta.url),
  'utf8',
)

function templateFrom(source: string): string {
  const templateStart = source.indexOf('<template>')
  const templateEnd = source.indexOf('</template>')

  assert.notEqual(templateStart, -1, 'OrderCard.vue must have a template block')
  assert.notEqual(templateEnd, -1, 'OrderCard.vue must close its template block')

  return source.slice(templateStart + '<template>'.length, templateEnd)
}

const orderCardTemplate = templateFrom(orderCardSource)

function order(overrides: Partial<OrderListDto> = {}): OrderListDto {
  return {
    orderId: 'order-1',
    customerId: 'customer-1',
    orderNumber: 'ORD-1',
    invoiceNumber: null,
    receivedDate: null,
    dueDate: null,
    serviceType: 'WASH',
    status: 'RECEIVED',
    quantity: 1,
    note: null,
    items: [],
    ...overrides,
  }
}

function targetContainsInvoiceNumber(value: unknown, invoiceNumber: string, seen = new Set<object>()): boolean {
  if (value === invoiceNumber) {
    return true
  }

  if (typeof value === 'string') {
    return value.includes(invoiceNumber)
  }

  if (value === null || typeof value !== 'object') {
    return false
  }

  if (seen.has(value)) {
    return false
  }
  seen.add(value)

  if (Array.isArray(value)) {
    return value.some((item) => targetContainsInvoiceNumber(item, invoiceNumber, seen))
  }

  return Object.values(value).some((item) => targetContainsInvoiceNumber(item, invoiceNumber, seen))
}

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void): void {
  tests.push({ name, run })
}

test('availability is true only for a real invoice number', () => {
  assert.equal(isInvoiceActionAvailable(order({ invoiceNumber: 'INV-260816-001' })), true)
})

test('availability is false for null, undefined, empty, and whitespace-only invoice numbers', () => {
  const undefinedInvoiceNumber = order()
  Reflect.deleteProperty(undefinedInvoiceNumber, 'invoiceNumber')

  const cases: Array<{ label: string; value: OrderListDto }> = [
    { label: 'null', value: order({ invoiceNumber: null }) },
    { label: 'undefined', value: undefinedInvoiceNumber },
    { label: 'empty', value: order({ invoiceNumber: '' }) },
    { label: 'whitespace-only', value: order({ invoiceNumber: '   ' }) },
  ]

  for (const item of cases) {
    assert.equal(isInvoiceActionAvailable(item.value), false, item.label)
  }
})

test('the target contains the invoice number without inventing a target for empty values', () => {
  const invoiceNumber = 'INV-260816-001'
  assert.equal(targetContainsInvoiceNumber(getInvoiceTarget(invoiceNumber), invoiceNumber), true)

  for (const emptyValue of ['', '   ']) {
    assert.equal(Boolean(getInvoiceTarget(emptyValue)), false, `empty value: ${JSON.stringify(emptyValue)}`)
  }
})

test('the target module is pure and has no Vue or API dependency', () => {
  const targetSource = readFileSync(
    new URL('../../../../../../src/features/customers/utils/order-invoice-target.ts', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(targetSource, /from\s+['"]vue['"]/)
  assert.doesNotMatch(targetSource, /(?:fetch|axios|api-client|\/api\/)/i)
})

test('OrderCard stays presentational and does not render the invoice number as card text', () => {
  assert.doesNotMatch(orderCardSource, /from\s+['"][^'"]*\/services\//)
  assert.doesNotMatch(orderCardSource, /\b(?:useRouter|useRoute)\b|\brouter\.(?:push|replace|go)\b/)
  assert.doesNotMatch(orderCardTemplate, /\{\{[\s\S]*?\binvoiceNumber\b[\s\S]*?\}\}/)
  assert.doesNotMatch(orderCardTemplate, /\bv-(?:text|html)=['"][^'"]*\binvoiceNumber\b/)
})

for (const item of tests) {
  item.run()
}

console.log(`${tests.length} order-invoice target dry tests passed`)

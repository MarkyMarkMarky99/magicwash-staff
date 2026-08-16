import assert from 'node:assert/strict'
import { ref } from 'vue'
import { useDuplicateInvoiceWarning } from '../../../../../src/shared/composables/use-duplicate-invoice-warning'

type TestOrder = { invoiceNumber: string | null }

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void) {
  tests.push({ name, run })
}

test('keeps the first tap path for an order without an invoice', () => {
  const order = ref<TestOrder | null>({ invoiceNumber: null })
  const warning = useDuplicateInvoiceWarning(order)

  assert.equal(warning.warningInvoiceNumber.value, null)
  assert.equal(warning.requestCreate(), true)
  assert.equal(warning.awaitingConfirmation.value, false)
})

test('requires confirmation without authorizing the first tap for a duplicate', () => {
  const order = ref<TestOrder | null>({ invoiceNumber: 'INV260854062757' })
  const warning = useDuplicateInvoiceWarning(order)

  assert.equal(warning.warningInvoiceNumber.value, 'INV260854062757')
  assert.equal(warning.requestCreate(), false)
  assert.equal(warning.awaitingConfirmation.value, true)
})

test('confirmation authorizes the duplicate invoice', () => {
  const order = ref<TestOrder | null>({ invoiceNumber: 'INV-1' })
  const warning = useDuplicateInvoiceWarning(order)

  warning.requestCreate()
  assert.equal(warning.confirmCreate(), true)
  assert.equal(warning.awaitingConfirmation.value, false)
})

test('cancellation clears confirmation but leaves the warning in place', () => {
  const order = ref<TestOrder | null>({ invoiceNumber: 'INV-1' })
  const warning = useDuplicateInvoiceWarning(order)

  warning.requestCreate()
  warning.cancelCreate()

  assert.equal(warning.awaitingConfirmation.value, false)
  assert.equal(warning.warningInvoiceNumber.value, 'INV-1')
})

test('resets confirmation when the order identity changes', () => {
  const order = ref<TestOrder | null>({ invoiceNumber: 'INV-1' })
  const warning = useDuplicateInvoiceWarning(order)

  warning.requestCreate()
  assert.equal(warning.confirmCreate(), true)

  order.value = { invoiceNumber: 'INV-2' }

  assert.equal(warning.awaitingConfirmation.value, false)
  assert.equal(warning.requestCreate(), false)
  assert.equal(warning.awaitingConfirmation.value, true)
})

test('reset clears confirmation and keeps the current warning', () => {
  const order = ref<TestOrder | null>({ invoiceNumber: 'INV-1' })
  const warning = useDuplicateInvoiceWarning(order)

  warning.requestCreate()
  warning.reset()

  assert.equal(warning.awaitingConfirmation.value, false)
  assert.equal(warning.warningInvoiceNumber.value, 'INV-1')
  assert.equal(warning.requestCreate(), false)
})

test('treats empty and whitespace-only invoice numbers as no invoice', () => {
  for (const invoiceNumber of ['', '   ']) {
    const order = ref<TestOrder | null>({ invoiceNumber })
    const warning = useDuplicateInvoiceWarning(order)

    assert.equal(warning.warningInvoiceNumber.value, null)
    assert.equal(warning.requestCreate(), true)
    assert.equal(warning.awaitingConfirmation.value, false)
  }
})

test('confirmation always authorizes creation', () => {
  const order = ref<TestOrder | null>({ invoiceNumber: 'INV-1' })
  const warning = useDuplicateInvoiceWarning(order)

  assert.equal(warning.confirmCreate(), true)
  warning.requestCreate()
  assert.equal(warning.confirmCreate(), true)
  warning.cancelCreate()
  assert.equal(warning.confirmCreate(), true)
  warning.reset()
  assert.equal(warning.confirmCreate(), true)
})

for (const item of tests) {
  item.run()
}

console.log(`${tests.length} duplicate-invoice warning dry tests passed`)

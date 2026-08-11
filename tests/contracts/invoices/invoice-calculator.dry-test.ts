import assert from 'node:assert/strict'
import {
  computeInvoiceLine,
  computeInvoiceTotal,
  roundMoney,
} from '../../../contracts/invoices/invoice-calculator.js'

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

// ── computeInvoiceLine ───────────────────────────────────────────────────────

test('FIXED -10 on quantity 10 removes 10 per unit, not 10 off the line', () => {
  const result = computeInvoiceLine({
    quantity: 10,
    unitPrice: 50,
    adjustments: [{ calculation: 'FIXED', value: -10 }],
  })

  assert.equal(result.subtotal, 500)
  assert.equal(result.netTotal, 400)
})

test('FIXED -12 then PERCENT -10 compounds the percent on the already-discounted unit', () => {
  const result = computeInvoiceLine({
    quantity: 4,
    unitPrice: 100,
    adjustments: [
      { calculation: 'FIXED', value: -12 },
      { calculation: 'PERCENT', value: -10 },
    ],
  })

  assert.equal(result.subtotal, 400)
  assert.equal(result.netTotal, 316.8)
})

test('a line with no adjustments returns an exact subtotal and netTotal', () => {
  const result = computeInvoiceLine({
    quantity: 1,
    unitPrice: 150,
    adjustments: [],
  })

  assert.equal(result.subtotal, 150)
  assert.equal(result.netTotal, 150)
})

// ── computeInvoiceTotal ──────────────────────────────────────────────────────

test('three lines plus an invoice-level PERCENT -5 lands on an exact cent, not a float tail', () => {
  const line1 = computeInvoiceLine({
    quantity: 10,
    unitPrice: 50,
    adjustments: [{ calculation: 'FIXED', value: -10 }],
  })
  const line2 = computeInvoiceLine({
    quantity: 4,
    unitPrice: 100,
    adjustments: [
      { calculation: 'FIXED', value: -12 },
      { calculation: 'PERCENT', value: -10 },
    ],
  })
  const line3 = computeInvoiceLine({
    quantity: 1,
    unitPrice: 150,
    adjustments: [],
  })

  const itemsTotal = line1.netTotal + line2.netTotal + line3.netTotal
  assert.equal(itemsTotal, 866.8)

  const invoiceTotal = computeInvoiceTotal(
    [line1.netTotal, line2.netTotal, line3.netTotal],
    [{ calculation: 'PERCENT', value: -5 }],
  )

  assert.equal(invoiceTotal, 823.46)
})

test('computeInvoiceTotal with no adjustments returns the exact rounded sum', () => {
  const invoiceTotal = computeInvoiceTotal([400, 316.8, 150], [])
  assert.equal(invoiceTotal, 866.8)
})

// ── itemsTotal (mirrors invoice.service.ts's response field) ────────────────

test('summing three already-rounded netTotals can drift in raw IEEE 754, roundMoney fixes it', () => {
  const netTotals = [316.8, 400, 150.15]

  // Bare reduce without roundMoney demonstrates the bug: this does NOT equal
  // the mathematically exact 866.95.
  const rawSum = netTotals.reduce((sum, netTotal) => sum + netTotal, 0)
  assert.notEqual(rawSum, 866.95)

  // roundMoney(rawSum) is the correct summed itemsTotal.
  assert.equal(roundMoney(rawSum), 866.95)
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} invoice calculator dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

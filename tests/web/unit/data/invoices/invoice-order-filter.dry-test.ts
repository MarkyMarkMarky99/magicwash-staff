import assert from 'node:assert/strict'
import test from 'node:test'
import { getInvoices } from '@/data/invoices/invoice.service'

test('checks order invoices against a fresh list response on every lookup', async () => {
  const urls: URL[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: URL | string) => {
    urls.push(new URL(String(input), 'http://localhost'))
    const data = urls.length === 1 ? [] : [{ invoiceNumber: 'INV-1' }]
    return Response.json({ data, meta: { pagination: { total: data.length, page: 1, perPage: 1 } } })
  }) as typeof fetch

  try {
    assert.deepEqual((await getInvoices({ orderId: 'ORD-1', perPage: 1 })).invoices, [])
    assert.deepEqual((await getInvoices({ orderId: 'ORD-1', perPage: 1 })).invoices, [
      { invoiceNumber: 'INV-1' },
    ])
    assert.equal(urls.length, 2)
    for (const url of urls) {
      assert.equal(url.pathname, '/api/invoices')
      assert.equal(url.searchParams.get('orderId'), 'ORD-1')
      assert.equal(url.searchParams.get('perPage'), '1')
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

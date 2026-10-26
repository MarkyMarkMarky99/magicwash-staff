import assert from 'node:assert/strict'
import test from 'node:test'
import { checkScannedTag, preloadedLookup, resolveScannedTag, type OrderIntakeScanLookup } from '@/features/orders/utils/order-intake-scan'

const none = () => false

for (const hasTag of [none, (tag: string) => tag === 'AAAA0001']) {
  assert.deepEqual(checkScannedTag('MWG-AAAA0001', hasTag), checkScannedTag('AAAA0001', hasTag))
  assert.deepEqual(checkScannedTag('mwg-AAAA0001', hasTag), checkScannedTag('AAAA0001', hasTag))
}


test('rejects codes that are not garment tags', () => {
  const banner = { tone: 'error', tag: null, message: 'Not a garment tag' }
  assert.deepEqual(checkScannedTag('MWS-STAFF', none), { banner })
  assert.deepEqual(checkScannedTag('short', none), { banner })
})

test('warns about a tag already in the draft and trims valid ones', () => {
  assert.deepEqual(checkScannedTag('AAAA0001', (tag) => tag === 'AAAA0001'), {
    banner: { tone: 'warning', tag: 'AAAA0001', message: 'Already in this order' },
  })
  assert.deepEqual(checkScannedTag(' AAAA0002 ', none), { tag: 'AAAA0002' })
})

function context(lookup: () => Promise<OrderIntakeScanLookup | null>) {
  return { customerId: 'CUS-1', hasTag: none, lookup }
}

test('adds a garment of this customer with its type and photo', async () => {
  const result = await resolveScannedTag('AAAA0001', context(async () => ({ customerId: 'CUS-1', itemId: 'i-shirt', imageUrl: 'https://example.test/a.jpg' })))
  assert.deepEqual(result, {
    kind: 'added',
    garment: { tag: 'AAAA0001', itemId: 'i-shirt', imageUrl: 'https://example.test/a.jpg' },
    banner: { tone: 'success', tag: 'AAAA0001', message: null },
  })
})

test('adds an untyped garment with a null item id', async () => {
  const result = await resolveScannedTag('AAAA0001', context(async () => ({ customerId: 'CUS-1', itemId: null, imageUrl: null })))
  assert.equal(result.kind, 'added')
  assert.equal(result.kind === 'added' && result.garment.itemId, null)
})

test('blocks a tag registered to another customer', async () => {
  const result = await resolveScannedTag('AAAA0001', context(async () => ({ customerId: 'CUS-2', itemId: null, imageUrl: null })))
  assert.deepEqual(result, { kind: 'refused', banner: { tone: 'error', tag: 'AAAA0001', message: 'AAAA0001 belongs to another customer' } })
})

test('blocks an unregistered tag', async () => {
  const result = await resolveScannedTag('AAAA0001', context(async () => null))
  assert.deepEqual(result, { kind: 'refused', banner: { tone: 'error', tag: 'AAAA0001', message: 'AAAA0001 is not registered. Register it on Register Garments first.' } })
})

test('reports a failed lookup without adding', async () => {
  const result = await resolveScannedTag('AAAA0001', context(async () => { throw new Error('network') }))
  assert.deepEqual(result, { kind: 'refused', banner: { tone: 'error', tag: 'AAAA0001', message: 'Could not check AAAA0001. Try again.' } })
})

test('preloaded garments answer without the server; unknown tags fall back', async () => {
  const asked: string[] = []
  const fallback = async (tag: string) => { asked.push(tag); return null }
  const lookup = preloadedLookup(Promise.resolve([{ id: 'AAAA0001', customerId: 'c1', itemId: 'i1', imageUrl: null }]), fallback)
  assert.deepEqual(await lookup('AAAA0001'), { id: 'AAAA0001', customerId: 'c1', itemId: 'i1', imageUrl: null })
  assert.equal(await lookup('AAAA0002'), null)
  assert.deepEqual(asked, ['AAAA0002'])
})

test('a failed preload sends every tag to the server', async () => {
  const asked: string[] = []
  const lookup = preloadedLookup(Promise.reject(new Error('down')), async (tag) => { asked.push(tag); return null })
  await lookup('AAAA0001')
  assert.deepEqual(asked, ['AAAA0001'])
})

import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { loadPackagingOrder, loadPackagingOrderStatus } from '@/features/job-tickets/packaging-bag-source'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import { useCustomerStore } from '@/data/customers/customer.store'
import { confirmPackagingBags } from '@/data/packaging-bags/packaging-bag.service'
import { invalidate, readCache, writeCache } from '@/shared/api/response-cache'
import { generateShortId } from '@shared/utils/id'
import { packagingBagConfirmRequestSchema } from '@contracts/packaging-bags/packaging-bag-api.schema'

setActivePinia(createPinia())
const customers = useCustomerStore()
customers.customers = [{ customerId: 'customer-1', customerName: 'Real customer', customerIndex: '42' }] as typeof customers.customers
const calls: URL[] = []
const originalFetch = globalThis.fetch
let failConfirm = false
const photos: Record<string, string> = { 'tag-1': 'https://storage.example/one.jpg', 'tag-2': 'https://storage.example/two.jpg' }
const job = (id: string, tag: string, department = 'Packaging', status = 'Pending', stepNo = 3) => ({
  id, orderId: 'order-1', customerId: 'customer-1', laundryItemId: tag, scope: 'ITEM', department, status, stepNo, deletedAt: null,
  photoEvidenceUrl: department === 'Packaging' ? photos[tag] ?? null : null,
})
globalThis.fetch = (async (input, init) => {
  const url = new URL(String(input), 'http://localhost')
  calls.push(url)
  const page = Number(url.searchParams.get('page') ?? 1)
  let data: unknown
  if (url.pathname === '/api/work-orders/order-1') data = { orderId: 'order-1', customerId: 'customer-1', status: 'APPROVED' }
  else if (url.pathname === '/api/job-tickets') data = page === 1
    ? [job('p1', 'tag-1'), job('i1', 'tag-1', 'Ironing', 'Pending', 2), job('p2', 'tag-2'), job('p3', 'tag-3'),
      job('deleted', 'tag-deleted'), ...Array.from({ length: 495 }, (_, i) => job(`extra-${i}`, 'extra', 'Washing', 'Completed', 1))]
        .map(row => row.id === 'deleted' ? { ...row, deletedAt: '2026-10-09 10:00:00' } : row)
    : [job('p4', 'tag-4'), { ...job('LOG-order-1-deadbeef-LOG-BAG', '', 'Logistics'), scope: 'ORDER', photoEvidenceUrl: 'https://storage.example/bag.jpg' }]
  else if (url.pathname === '/api/bag-items') data = [
    { bagId: 'deadbeef', laundryItemId: 'tag-3', createdAt: '2026-10-09 11:00:00' },
    { bagId: 'deadbeef', laundryItemId: 'tag-4', createdAt: '2026-10-09 10:00:00' },
  ]
  else if (url.pathname === '/api/packaging-bags/confirm') {
    assert.equal(init?.method, 'POST')
    assert.deepEqual(JSON.parse(String(init?.body)), { orderId: 'order-1', createdBy: 'staff-1', bags: [
      { orderImageId: 'deadbeef', imagePath: 'https://storage.example/bag.jpg', laundryItemIds: ['tag-2'] },
    ] })
    if (failConfirm) return Response.json({ success: false, error: { code: 'CONFLICT', message: 'Garment is in another bag' }, meta: { timestamp: new Date().toISOString() } }, { status: 409 })
    data = { bags: [{ orderImageId: 'deadbeef', printed: true }] }
  } else throw new Error(`Unexpected endpoint ${url.pathname}`)
  return Response.json({ success: true, data, meta: { pagination: { page, perPage: 500 } } })
}) as typeof fetch

try {
  invalidate()
  const store = useJobTicketStore()
  store.rows.set('p2', job('p2', 'tag-2') as any)
  const previews: string[][] = []
  const pending = loadPackagingOrder('order-1', preview => { previews.push(preview.garments.map(row => row.tagId)) })
  assert.deepEqual(previews, [['tag-2']])
  const order = await pending
  assert.equal(store.orderTickets('order-1').length, 502)
  assert.deepEqual(previews.at(-1), ['tag-1', 'tag-2', 'tag-3', 'tag-4'])
  assert.ok(calls.filter(url => url.pathname === '/api/job-tickets').every(url => url.searchParams.get('orderId') === 'order-1' && !url.searchParams.has('department') && url.searchParams.get('perPage') === '500'))
  assert.equal(order.customerName, 'Real customer')
  assert.equal(order.customerIndex, '42')
  assert.equal(order.statusLabel, '')
  assert.ok(!calls.some(url => url.pathname.startsWith('/api/work-orders') || url.pathname === '/api/laundry-photos' || url.pathname === '/api/order-images'))
  assert.equal(await loadPackagingOrderStatus('order-1'), 'Approved')
  assert.deepEqual(order.garments, [
    { tagId: 'tag-1', imageUrl: 'https://storage.example/one.jpg', waitingFor: 'Ironing', confirmedBagId: null },
    { tagId: 'tag-2', imageUrl: 'https://storage.example/two.jpg', waitingFor: null, confirmedBagId: null },
    { tagId: 'tag-3', imageUrl: null, waitingFor: null, confirmedBagId: 'deadbeef' },
    { tagId: 'tag-4', imageUrl: null, waitingFor: null, confirmedBagId: 'deadbeef' },
  ])
  assert.deepEqual(order.confirmedBags, [{ id: 'deadbeef', photoUrl: 'https://storage.example/bag.jpg', confirmedAt: '2026-10-09 10:00:00' }])
  assert.ok(calls.some(url => url.pathname === '/api/job-tickets' && url.searchParams.get('page') === '2'))
  const bagTicket = store.rows.get('LOG-order-1-deadbeef-LOG-BAG')!
  let rebuildWithoutPhoto!: () => typeof order
  await loadPackagingOrder('order-1', (_, rebuild) => { rebuildWithoutPhoto = rebuild })
  store.rows.delete(bagTicket.id)
  assert.equal(rebuildWithoutPhoto().confirmedBags[0]?.photoUrl, null)
  store.rows.set(bagTicket.id, bagTicket)
  assert.equal(rebuildWithoutPhoto().confirmedBags[0]?.photoUrl, 'https://storage.example/bag.jpg')
  const tagOrder = order.garments.map(row => row.tagId)
  const reverseRows = [...store.rows.values()].reverse()
  setActivePinia(createPinia())
  const stableStore = useJobTicketStore()
  for (const row of reverseRows) stableStore.rows.set(row.id, row)
  const stablePreviews: string[][] = []
  const stable = await loadPackagingOrder('order-1', preview => { stablePreviews.push(preview.garments.map(row => row.tagId)) })
  assert.ok(stablePreviews.every(tags => JSON.stringify(tags) === JSON.stringify(tagOrder)))
  assert.deepEqual(stable.garments.map(row => row.tagId), tagOrder)
  for (let i = 0; i < 100; i++) {
    const id = generateShortId()
    assert.equal(packagingBagConfirmRequestSchema.safeParse({ orderId: 'order-1', createdBy: 'staff-1', bags: [
      { orderImageId: id, imagePath: 'https://photo.example/a', laundryItemIds: ['tag-1'] },
    ] }).success, true)
  }
  const payload = { orderId: 'order-1', createdBy: 'staff-1', bags: [
    { orderImageId: 'deadbeef', imagePath: 'https://storage.example/bag.jpg', laundryItemIds: ['tag-2'] },
  ] }
  for (const failure of [false, true]) {
    failConfirm = failure
    for (const path of ['/api/job-tickets', '/api/bag-items', '/api/order-images']) writeCache(`${path}?orderId=order-1`, ['old'])
    if (failure) await assert.rejects(confirmPackagingBags(payload), /Garment is in another bag/)
    else assert.deepEqual(await confirmPackagingBags(payload), { bags: [{ orderImageId: 'deadbeef', printed: true }] })
    for (const path of ['/api/job-tickets', '/api/bag-items', '/api/order-images']) assert.equal(readCache(`${path}?orderId=order-1`), null)
  }
  console.log('packaging-bag-source.dry-test: OK (real reads, paging, photos, gating, bags, customer, confirm envelope/cache/errors)')
} finally {
  globalThis.fetch = originalFetch
  invalidate()
}

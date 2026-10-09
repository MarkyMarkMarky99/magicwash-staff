import assert from 'node:assert/strict'
import { createRouter, createMemoryHistory } from 'vue-router'
import { jobTicketRoutes } from '@/features/job-tickets/routes'
import { loadPackagingOrder } from '@/features/job-tickets/packaging-bag-source'
import {
  bagNumber, canConfirm, confirmBags, confirmedItemCount, formatConfirmedAt, garmentState, restoreBags, scanGarment, toggleGarment, unassignedCount,
  type NewBag,
} from '@/features/job-tickets/packaging-bags'

const order = await loadPackagingOrder('order-1')
const bag = (id: string, garmentTagIds: string[] = [], photoUrl: string | null = null): NewBag => ({ id, garmentTagIds, photoUrl })

assert.equal(order.orderId, 'order-1')
assert.equal(unassignedCount(order, []), 6)
assert.equal(confirmedItemCount(order, 'bag-1'), 4)

let bags = [bag('a'), bag('b')]
assert.equal(bagNumber(order, bags, 'a'), 3)
assert.equal(bagNumber(order, bags, 'b'), 4)
assert.equal(canConfirm([]), false)
assert.equal(canConfirm(bags), false)
assert.equal(canConfirm([bag('a', ['x9a3e5pn'], 'blob:photo')]), true)
assert.equal(canConfirm([bag('a', ['x9a3e5pn'], 'blob:photo'), bag('b', [], 'blob:photo')]), false)
assert.equal(canConfirm([bag('a', ['x9a3e5pn'], 'blob:photo'), bag('b', ['b6j2g8wc'])]), false)

bags = toggleGarment(order, bags, 'a', 'x9a3e5pn')
assert.deepEqual(bags[0]!.garmentTagIds, ['x9a3e5pn'])
assert.deepEqual(toggleGarment(order, bags, 'b', 'x9a3e5pn')[1]!.garmentTagIds, [])
assert.deepEqual(toggleGarment(order, bags, 'a', 'r5t9c1ma')[0]!.garmentTagIds, ['x9a3e5pn'])
assert.deepEqual(toggleGarment(order, bags, 'a', 'k3m9x2qa')[0]!.garmentTagIds, ['x9a3e5pn'])
assert.deepEqual(toggleGarment(order, bags, 'a', 'x9a3e5pn')[0]!.garmentTagIds, [])
assert.deepEqual(garmentState(order, bags, 'b', order.garments.find(row => row.tagId === 'x9a3e5pn')!), { kind: 'inBag', bagNumber: 3 })
assert.deepEqual(garmentState(order, bags, 'b', order.garments.find(row => row.tagId === 'r5t9c1ma')!), { kind: 'waiting', label: 'Ironing' })
assert.equal(unassignedCount(order, bags), 5)

const added = scanGarment(order, bags, 'a', ' b6j2g8wc ')
assert.equal(added.success, true)
assert.deepEqual(added.bags[0]!.garmentTagIds, ['x9a3e5pn', 'b6j2g8wc'])
for (const [value, message] of [
  ['x9a3e5pn', 'Already in this bag'],
  ['unknown1', 'Not a garment of this order'],
  ['k3m9x2qa', 'Already in a confirmed bag'],
  ['r5t9c1ma', 'Waiting: Ironing'],
  ['d8v2h6xi', 'Waiting: Washing'],
] as const) {
  const result = scanGarment(order, bags, 'a', value)
  assert.equal(result.success, false)
  assert.equal(result.message, message)
  assert.deepEqual(result.bags, bags)
}
assert.equal(scanGarment(order, bags, 'b', 'x9a3e5pn').message, 'In Bag 3')

const confirmed = confirmBags(order, added.bags.map(row => ({ ...row, photoUrl: 'blob:photo' })), '2026-10-09 11:00:00')
assert.equal(confirmed.confirmedBags.length, 4)
assert.equal(confirmedItemCount(confirmed, 'a'), 2)
assert.equal(unassignedCount(confirmed, []), 4)
assert.equal(order.confirmedBags.length, 2)

const restored = restoreBags(order, [
  { id: 'a', garmentTagIds: ['x9a3e5pn', 'k3m9x2qa', 'r5t9c1ma', 'missing', 7] },
  { id: 'b', garmentTagIds: ['x9a3e5pn', 'b6j2g8wc'] },
  { id: 'bag-1', garmentTagIds: [] },
  { id: 'a', garmentTagIds: [] },
  { garmentTagIds: [] },
])
assert.deepEqual(restored, [bag('a', ['x9a3e5pn']), bag('b', ['b6j2g8wc'])])
assert.deepEqual(restoreBags(order, 'nope'), [])

assert.equal(formatConfirmedAt('2026-10-09 10:42:00'), '09 Oct 2026 · 10:42')

const router = createRouter({ history: createMemoryHistory(), routes: jobTicketRoutes })
const resolved = router.resolve({ name: 'packaging-order-bags', params: { department: 'packaging', orderId: 'order-1' } })
assert.equal(resolved.path, '/departments/packaging/order-1')
assert.equal(resolved.meta.parent, 'department-work')
assert.equal(router.resolve('/departments/packaging/order-1').name, 'packaging-order-bags')
assert.equal(router.resolve('/departments/packaging').name, 'department-work')
assert.ok(!router.resolve('/departments/washing/x').matched.some(route => route.name === 'packaging-order-bags'))
assert.equal(jobTicketRoutes.findIndex(route => route.name === 'packaging-order-bags') < jobTicketRoutes.findIndex(route => route.name === 'department-work'), true)

console.log('packaging-order-bags.dry-test: OK')

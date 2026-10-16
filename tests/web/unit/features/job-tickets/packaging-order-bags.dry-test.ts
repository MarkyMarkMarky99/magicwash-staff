import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRouter, createMemoryHistory } from 'vue-router'
import { jobTicketRoutes } from '@/features/job-tickets/routes'
import {
  bagNumber, canConfirm, confirmBags, confirmedItemCount, formatConfirmedAt, garmentState, presentBagScan, restoreBags, scanGarment, toggleGarment, unassignedCount,
  type NewBag, type PackagingOrder,
} from '@/features/job-tickets/packaging-bags'

const garment = (tagId: string, confirmedBagId: string | null = null, waitingFor: PackagingOrder['garments'][number]['waitingFor'] = null) => ({ tagId, confirmedBagId, waitingFor, imageUrl: null })
const order: PackagingOrder = {
  orderId: 'order-1', customerName: 'Customer', customerIndex: 'TSK',
  garments: [garment('k3m9x2qa', 'bag-1'), garment('p7d4n8rt', 'bag-1'), garment('w2c6v5hj', 'bag-1'), garment('h8t1b3ze', 'bag-1'),
    garment('m5y9f2ud', 'bag-2'), garment('q4r7s6lk', 'bag-2'), garment('x9a3e5pn'), garment('b6j2g8wc'), garment('z1n4u7ov'),
    garment('f3k8d2ys'), garment('r5t9c1ma', null, 'Ironing'), garment('d8v2h6xi', null, 'Washing')],
  confirmedBags: [{ id: 'bag-1', photoUrl: null, confirmedAt: '2026-10-09 10:42:00' }, { id: 'bag-2', photoUrl: null, confirmedAt: '2026-10-09 10:58:00' }],
}
const bag = (id: string, garmentTagIds: string[] = [], photoUrl: string | null = null): NewBag => ({ id, garmentTagIds, photoUrl })

assert.equal(order.orderId, 'order-1')
assert.equal(unassignedCount(order, []), 6)
assert.equal(confirmedItemCount(order, 'bag-1'), 4)

let bags = [bag('a'), bag('b')]
assert.equal(bagNumber(order, bags, 'a'), 3)
assert.equal(bagNumber(order, bags, 'b'), 4)
assert.equal(canConfirm([]), false)
assert.equal(canConfirm(bags), false)
assert.equal(canConfirm([bag('a', ['x9a3e5pn'], 'https://storage.example/photo.jpg')]), true)
assert.equal(canConfirm([bag('a', ['x9a3e5pn'], 'https://storage.example/photo.jpg'), bag('b', [], 'https://storage.example/photo.jpg')]), false)
assert.equal(canConfirm([bag('a', ['x9a3e5pn'], 'https://storage.example/photo.jpg'), bag('b', ['b6j2g8wc'])]), false)

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

for (const [value, tone] of [['x9a3e5pn', 'warning'], ['unknown1', 'error'], ['k3m9x2qa', 'error'], ['r5t9c1ma', 'error']] as const) assert.equal(scanGarment(order, bags, 'a', value).tone, tone)
assert.equal(scanGarment(order, bags, 'b', 'x9a3e5pn').tone, 'error')
assert.equal(added.tone, 'success')

const withPhoto: PackagingOrder = { ...order, garments: order.garments.map(row => row.tagId === 'b6j2g8wc' ? { ...row, imageUrl: 'https://storage.example/g.jpg' } : row) }
assert.deepEqual(presentBagScan(added, withPhoto, 'Shirt', false), { title: 'Shirt', message: 'Added to this bag', tone: 'success' })
assert.deepEqual(presentBagScan(added, withPhoto, 'Shirt', true), { title: 'Shirt', customerName: undefined, message: 'Added to this bag', tone: 'success',
  scan: { customerIndex: null, photoUrl: 'https://storage.example/g.jpg', matched: true, itemName: 'Shirt' } })
const repeated = scanGarment(order, bags, 'a', 'x9a3e5pn')
assert.equal(presentBagScan(repeated, withPhoto, 'Item', true).tone, 'warning')
assert.equal(presentBagScan(repeated, withPhoto, 'Item', true).scan?.itemName, 'Item')
const unknown = presentBagScan(scanGarment(order, bags, 'a', 'unknown1'), withPhoto, 'Item', true)
assert.deepEqual(unknown, { title: 'Item', message: 'Not a garment of this order', tone: 'error', scan: { customerIndex: null, photoUrl: null, matched: false, unmatchedText: '' } })
for (const display of [unknown, presentBagScan(added, withPhoto, 'Shirt', true), presentBagScan(added, withPhoto, 'Shirt', false)]) assert.ok(!JSON.stringify(display).includes('unknown1') && !JSON.stringify(display).includes('b6j2g8wc'))

const confirmed = confirmBags(order, added.bags.map(row => ({ ...row, photoUrl: 'https://storage.example/photo.jpg' })), '2026-10-09 11:00:00')
assert.equal(confirmed.confirmedBags.length, 4)
assert.equal(confirmedItemCount(confirmed, 'a'), 2)
assert.equal(unassignedCount(confirmed, []), 4)
assert.equal(order.confirmedBags.length, 2)

const restored = restoreBags(order, [
  { id: 'a', garmentTagIds: ['x9a3e5pn', 'k3m9x2qa', 'r5t9c1ma', 'missing', 7], photoUrl: 'https://storage.example/photo.jpg' },
  { id: 'b', garmentTagIds: ['x9a3e5pn', 'b6j2g8wc'] },
  { id: 'a', garmentTagIds: [] },
  { garmentTagIds: [] },
])
assert.deepEqual(restored, [bag('a', ['x9a3e5pn'], 'https://storage.example/photo.jpg'), bag('b', ['b6j2g8wc'])])
assert.deepEqual(restoreBags(order, 'nope'), [])
assert.equal(restoreBags(order, [{ id: 'a', garmentTagIds: [], photoUrl: 'blob:expired' }])[0]?.photoUrl, null)
assert.equal(restoreBags(confirmed, [{ id: 'a', garmentTagIds: ['x9a3e5pn'], photoUrl: 'https://storage.example/photo.jpg' }])[0]?.garmentTagIds.length, 1)

assert.equal(formatConfirmedAt('2026-10-09 10:42:00'), '09 Oct 2026 · 10:42')

const router = createRouter({ history: createMemoryHistory(), routes: jobTicketRoutes })
const resolved = router.resolve({ name: 'packaging-order-bags', params: { department: 'packaging', orderId: 'order-1' } })
assert.equal(resolved.path, '/departments/packaging/order-1')
assert.equal(resolved.meta.parent, 'department-work')
assert.equal(router.resolve('/departments/packaging/order-1').name, 'packaging-order-bags')
assert.equal(router.resolve('/departments/packaging').name, 'department-work')
assert.ok(!router.resolve('/departments/washing/x').matched.some(route => route.name === 'packaging-order-bags'))
assert.equal(jobTicketRoutes.findIndex(route => route.name === 'packaging-order-bags') < jobTicketRoutes.findIndex(route => route.name === 'department-work'), true)

const viewSource = readFileSync(new URL('../../../../../src/features/job-tickets/components/OrderBagsView.vue', import.meta.url), 'utf8')
assert.match(viewSource, /:loading="packaging\.ticketsLoading\.value"/)
assert.doesNotMatch(viewSource, /an empty bag would print an extra tag|before you can confirm/)
assert.match(viewSource, /:disabled="loading \|\| !!error \|\| !packaging\.confirmable\.value"/)
assert.match(viewSource, /Empty · delete or add garments/)
assert.match(viewSource, /useScannerGunInput\(handleGunScan, \(\) => packagingActive\(\) && sheetBag\.value !== null && !sheetScannerOpen\.value\s+&& !cameraOpen\.value && !confirmOpen\.value\)/)
assert.match(viewSource, /<ScanNotice overlay /)
assert.match(viewSource, /const outcome = packaging\.scan\(bag\.id, value\)/)
assert.equal(viewSource.match(/packaging\.scan\(/g)?.length, 1)
const departmentPageSource = readFileSync(new URL('../../../../../src/features/job-tickets/pages/DepartmentWorkPage.vue', import.meta.url), 'utf8')
assert.match(departmentPageSource, /useScanNotice\(\)/)
assert.match(departmentPageSource, /<ScanNotice v-if="!scannerOpen"/)
assert.match(departmentPageSource, /useScannerGunInput\(value => \{[\s\S]*?\}, \(\) => pageActive &&/)
const sheetSource = readFileSync(new URL('../../../../../src/features/job-tickets/components/PackagingBagSheet.vue', import.meta.url), 'utf8')
assert.match(sheetSource, /:primary-text="name"/)
assert.doesNotMatch(sheetSource, /primary-text="garment\.tagId"|Garment \$\{garment\.tagId\}/)
for (const name of ['logistics-order-bags', 'packaging-order-bags']) assert.match(String(jobTicketRoutes.find(route => route.name === name)?.component), /pages\/OrderBagsPage\.vue/)
console.log('packaging-order-bags.dry-test: OK')

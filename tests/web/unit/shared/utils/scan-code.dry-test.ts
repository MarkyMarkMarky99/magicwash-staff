import assert from 'node:assert/strict'
import { readScanCode, anyPageGarmentScan } from '@/shared/utils/scan-code'
import { laundryTagIdSchema, laundryTagPrintRequestSchema } from '@contracts/laundry-tag-prints/laundry-tag-print.schema'
import { jobTicketRoutes } from '@/features/job-tickets/routes'
import { orderRoutes } from '@/features/orders/routes'

for (const [prefix, kind] of [['MWG-', 'garment'], ['MWB-', 'bag'], ['MWO-', 'order']] as const) {
  for (const text of [prefix, prefix.toLowerCase()]) {
    assert.deepEqual(readScanCode(`  ${text}Ab12Cd34  `), { kind, id: 'Ab12Cd34' })
  }
}
assert.deepEqual(readScanCode('  MWS-Ab12Cd34  '), { kind: 'staff', id: 'MWS-Ab12Cd34' })
assert.deepEqual(readScanCode('mws-Ab12Cd34'), { kind: 'staff', id: 'mws-Ab12Cd34' })
assert.deepEqual(readScanCode(' https://host/b/old/b/Ab12Cd34 '), { kind: 'bag', id: 'Ab12Cd34' })
assert.deepEqual(readScanCode(' Ab12Cd34 '), { kind: 'unknown', id: 'Ab12Cd34' })
assert.deepEqual(readScanCode('   '), { kind: 'unknown', id: '' })
assert.equal(anyPageGarmentScan('mwg-Ab12Cd34', true, {}), 'Ab12Cd34')
for (const code of ['MWB-Ab12Cd34', 'MWO-Ab12Cd34', 'MWS-Ab12Cd34', 'Ab12Cd34', 'https://host/b/Ab12Cd34']) {
  assert.equal(anyPageGarmentScan(code, true, {}), null)
}
assert.equal(anyPageGarmentScan('MWG-Ab12Cd34', false, {}), null)
assert.equal(anyPageGarmentScan('MWG-Ab12Cd34', true, { public: true }), null)
assert.equal(anyPageGarmentScan('MWG-Ab12Cd34', true, { ownsWorkScan: true }), null)
const owners = [...jobTicketRoutes, ...orderRoutes].filter(route => route.meta?.ownsWorkScan).map(route => route.name)
assert.deepEqual(owners, ['logistics-order-bags', 'packaging-order-bags', 'department-work', 'order-create-intake'])
assert.equal(laundryTagIdSchema.safeParse('Ab12Cd34').success, true)
assert.equal(laundryTagIdSchema.safeParse('MWG-Ab12Cd34').success, false)
const payload = { customerIndex: '1999', totalCount: 2, tags: [{ sequence: 1, tagId: 'MWG-Ab12Cd34' }, { sequence: 2, tagId: 'MWG-Ab12Cd34' }] }
assert.equal(laundryTagPrintRequestSchema.safeParse(payload).success, false)
assert.equal(laundryTagPrintRequestSchema.safeParse({ ...payload, tags: [payload.tags[0], { sequence: 2, tagId: 'MWG-ab12Cd34' }] }).success, true)
assert.equal(laundryTagPrintRequestSchema.safeParse({ ...payload, tags: [{ sequence: 1, tagId: 'Ab12Cd34' }, payload.tags[1]] }).success, false)
console.log('scan-code.dry-test: OK')

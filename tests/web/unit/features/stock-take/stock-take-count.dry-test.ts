import assert from 'node:assert/strict'
import { ApiError } from '@/shared/api/api-client'
import {
  bagLabel, buildScan, classifySendFailure, departmentZone, MAX_SCANS_PER_REQUEST, packedZone, readCountInput, removeSent,
  restoreScanQueue, retryDelayMs, sameZone, scanKey, takeBatch, zoneLabel,
} from '@/features/stock-take/stock-take-count'

assert.deepEqual(readCountInput('MWG-AB12cd34'), { kind: 'garment', tag: 'AB12cd34' })
assert.deepEqual(readCountInput(' AB12cd34 '), { kind: 'garment', tag: 'AB12cd34' })
assert.deepEqual(readCountInput('MWB-bag-1'), { kind: 'bag', bagId: 'bag-1' })
assert.deepEqual(readCountInput('https://example.com/b/bag-2'), { kind: 'bag', bagId: 'bag-2' })
assert.deepEqual(readCountInput('MWS-staff-1'), { kind: 'staff' })
assert.equal(readCountInput('MWO-ORD-1').kind, 'invalid')
assert.equal(readCountInput('short').kind, 'invalid')
assert.equal(readCountInput('MWB-').kind, 'invalid')
assert.equal(readCountInput('MWB-=bag').kind, 'invalid')

const washing = departmentZone('Washing', 'Pending')
assert.equal(zoneLabel(washing), 'Washing · Pending')
assert.equal(zoneLabel(departmentZone('DryCleaning', 'In Progress')), 'Dry Cleaning · In Progress')
assert.equal(zoneLabel(packedZone), 'Packed')
assert.equal(sameZone(washing, departmentZone('Washing', 'Pending')), true)
assert.equal(sameZone(washing, departmentZone('Washing', 'In Progress')), false)
assert.equal(sameZone(packedZone, washing), false)

assert.deepEqual(buildScan('AB12cd34', washing, { mode: 'bag', bagId: 'ignored' }), { scan: { tag: 'AB12cd34', department: 'Washing', status: 'Pending', bagId: null } })
assert.ok('error' in buildScan('AB12cd34', packedZone, { mode: 'unset' }))
assert.deepEqual(buildScan('AB12cd34', packedZone, { mode: 'bag', bagId: 'bag-1' }), { scan: { tag: 'AB12cd34', department: null, status: 'Packed', bagId: 'bag-1' } })
assert.deepEqual(buildScan('AB12cd34', packedZone, { mode: 'none' }), { scan: { tag: 'AB12cd34', department: null, status: 'Packed', bagId: null } })
assert.equal(bagLabel({ mode: 'unset' }), 'No bag selected')
assert.equal(bagLabel({ mode: 'none' }), 'Bag has no QR')
assert.equal(bagLabel({ mode: 'bag', bagId: 'bag-1' }), 'Bag bag-1')

const a = { tag: 'AB12cd34', department: 'Washing', status: 'Pending', bagId: null } as const
const b = { tag: 'AB12cd34', department: 'Washing', status: 'In Progress', bagId: null } as const
const c = { tag: 'AB12cd34', department: null, status: 'Packed', bagId: 'bag-1' } as const
const d = { tag: 'AB12cd34', department: null, status: 'Packed', bagId: null } as const
assert.equal(new Set([a, b, c, d].map(scanKey)).size, 4)

assert.deepEqual(restoreScanQueue([a, a, c]), [a, c])
assert.deepEqual(restoreScanQueue('nope'), [])
assert.deepEqual(restoreScanQueue([{ tag: 'AB12cd34', department: 'Washing', status: 'Packed', bagId: null }]), [])
assert.deepEqual(removeSent([a, b, c], [b]), [a, c])

const many = Array.from({ length: MAX_SCANS_PER_REQUEST + 5 }, (_, index) => ({ ...a, tag: String(index).padStart(8, '0') }))
assert.equal(takeBatch(many).length, MAX_SCANS_PER_REQUEST)

assert.equal(classifySendFailure(new TypeError('Failed to fetch')).action, 'retry')
assert.equal(classifySendFailure(new ApiError('boom', 503)).action, 'retry')
assert.equal(classifySendFailure(new ApiError('slow', 429)).action, 'retry')
assert.deepEqual(classifySendFailure(new ApiError('Scan a staff card first', 403)), { action: 'hold', message: 'Scan a staff card first' })
assert.deepEqual(classifySendFailure(new ApiError('not active', 409)), { action: 'drop', message: 'not active' })
assert.equal(classifySendFailure(new ApiError('bad scan', 400)).action, 'drop')

assert.equal(retryDelayMs(1), 2_000)
assert.equal(retryDelayMs(3), 8_000)
assert.equal(retryDelayMs(20), 30_000)

console.log('stock-take-count.dry-test: OK')

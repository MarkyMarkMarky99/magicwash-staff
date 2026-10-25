import assert from 'node:assert/strict'
import test from 'node:test'
import { laundryItemResponseSchema } from '@contracts/laundry-items/laundry-item-api.schema'
import { laundryItemPhotoResponseSchema } from '@contracts/laundry-item-photos/laundry-item-photo-api.schema'
import { orderGarmentResponseSchema } from '@contracts/order-garments/order-garment-api.schema'
import { jobTicketResponseSchema } from '@contracts/job-tickets/job-ticket-api.schema'
import type { OrderListDto } from '@/data/orders/order.service'
import { garmentAlbum, garmentCurrentPlace, garmentDate, garmentInOrder, garmentLastSeen, garmentOrderRows, garmentPhotoPreview, garmentPhotoTypeHint, garmentPhotoTypeIcon, garmentPhotoTypeLabel, garmentPhotoTypeOptions, garmentSharedHistory, garmentTimeline } from '@/features/laundry-items/utils/laundry-item-detail'

const audit = { createdAt: '2026-08-12 09:40:00', createdBy: 'staff', updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null }
const tag = 'AAAA0001'
const garment = laundryItemResponseSchema.parse({ ...audit, id: tag, customerId: 'customer', itemId: null, washProgram: null, notes: null, imageUrl: 'https://example.test/registration.jpg' })

function order(orderId: string, receivedDate: string | null, status = 'APPROVED'): OrderListDto {
  return { orderId, receivedDate, status, customerId: 'customer', serviceType: 'WSIR', orderNumber: null, invoiceNumber: null, dueDate: null, quantity: null, note: null }
}

function link(orderId: string, overrides = {}) {
  return orderGarmentResponseSchema.parse({ ...audit, id: `link:${orderId}`, orderId, laundryItemId: tag, orderitemId: null, notes: null, status: 'RECEIVED', ...overrides })
}

function ticket(id: string, stepNo: number, overrides = {}) {
  return jobTicketResponseSchema.parse({ ...audit, id, stepNo, orderId: 'new', laundryItemId: tag, scope: 'ITEM', taskCode: null, department: 'Washing', customerId: 'customer', orderName: null, dueDate: null, specialInstructions: null, notes: null, status: 'Pending', startedAt: null, startedBy: null, completedAt: null, scannedBy: null, photoEvidenceUrl: null, workMinutes: null, ...overrides })
}

function photo(id: string, photoType: 'REGISTRATION' | 'DEFECT' | 'BEFORE' | 'AFTER', overrides = {}) {
  return laundryItemPhotoResponseSchema.parse({ ...audit, id, photoType, laundryItemId: tag, orderId: 'new', imageUrl: `https://example.test/${id}.jpg`, notes: null, ...overrides })
}

test('history joins only live links for this garment, deduplicates links, and orders newest first', () => {
  const orders = [order('old', '2026-09-01'), order('new', '2026-10-24'), order('deleted', '2026-10-25'), order('other', '2026-10-26')]
  const links = [link('old'), link('new'), link('new'), link('missing'), link('deleted', { deletedAt: '2026-10-25 12:00:00' }), link('other', { laundryItemId: 'AAAA0002' })]
  assert.deepEqual(garmentOrderRows(tag, links, orders).map(row => row.orderId), ['new', 'old'])
  assert.deepEqual(garmentOrderRows(tag, [], orders), [])
})

test('current stamp prefers In Progress, otherwise the first Pending step', () => {
  const tickets = [ticket('pending', 3, { department: 'Ironing' }), ticket('current', 2, { status: 'In Progress' }), ticket('earlier', 1, { department: 'Tagging' })]
  assert.equal(garmentCurrentPlace(tag, order('new', '2026-10-24'), tickets), 'Washing now')
  assert.equal(garmentCurrentPlace(tag, order('new', '2026-10-24'), [tickets[0]!, tickets[2]!]), 'Tagging next')
  assert.equal(garmentCurrentPlace(tag, order('new', '2026-10-24'), [ticket('dry', 1, { department: 'DryCleaning' })]), 'Dry cleaning next')
})

test('finished orders and orders without an active step have no stamp', () => {
  for (const status of ['COMPLETED', 'CANCELLED', 'DELIVERED']) assert.equal(garmentCurrentPlace(tag, order('new', null, status), [ticket('pending', 1)]), null)
  assert.equal(garmentCurrentPlace(tag, undefined, []), null)
  assert.equal(garmentCurrentPlace(tag, order('new', null), [ticket('done', 1, { status: 'Completed' })]), null)
})

test('timeline sorts steps, ignores unrelated and deleted tickets, and maps both event actors', () => {
  const steps = garmentTimeline(tag, 'new', [
    ticket('pending', 3),
    ticket('done', 1, { status: 'Completed', startedAt: '2026-10-24 09:00:00', startedBy: 'starter', completedAt: '2026-10-24 10:00:00', scannedBy: 'finisher' }),
    ticket('current', 2, { status: 'In Progress', startedAt: '2026-10-24 11:00:00', startedBy: 'ironer' }),
    ticket('other', 0, { laundryItemId: 'AAAA0002' }), ticket('old-order', 0, { orderId: 'old' }), ticket('deleted', 0, { deletedAt: '2026-10-24 12:00:00' }),
  ])
  assert.deepEqual(steps.map(step => [step.id, step.state]), [['done', 'done'], ['current', 'current'], ['pending', 'future']])
  assert.deepEqual(steps[0]?.events, [{ label: 'Started', at: '2026-10-24 09:00:00', staff: 'starter' }, { label: 'Completed', at: '2026-10-24 10:00:00', staff: 'finisher' }])
  assert.deepEqual(steps[2]?.events, [])
})

test('last seen compares starts and completions across orders and ignores deleted or unrelated rows', () => {
  assert.equal(garmentLastSeen(tag, [
    ticket('latest', 1, { orderId: 'old', completedAt: '2026-10-24 12:00:00' }),
    ticket('start', 2, { startedAt: '2026-10-24 13:48:00' }),
    ticket('deleted', 2, { completedAt: '2026-10-25 12:00:00', deletedAt: '2026-10-25 12:01:00' }),
    ticket('other', 1, { laundryItemId: 'AAAA0002', completedAt: '2026-10-26 12:00:00' }),
  ]), '2026-10-24 13:48:00')
  assert.equal(garmentLastSeen(tag, [ticket('pending', 1)]), null)
})

test('album uses registration photo once, groups nonempty sections in order, and attaches order received dates', () => {
  const groups = garmentAlbum(garment, [
    photo('registration', 'REGISTRATION', { imageUrl: garment.imageUrl, orderId: null }),
    photo('defect', 'DEFECT'), photo('before', 'BEFORE'), photo('after', 'AFTER', { orderId: 'unknown' }),
    photo('deleted', 'DEFECT', { deletedAt: '2026-10-24 12:00:00' }), photo('other', 'DEFECT', { laundryItemId: 'AAAA0002' }),
  ], [order('new', '2026-10-24')])
  assert.deepEqual(groups.map(group => [group.title, group.photos.length]), [['Registration', 1], ['Defects', 1], ['Before', 1], ['After', 1]])
  assert.equal(groups[1]?.photos[0]?.date, '2026-10-24')
  assert.equal(groups[3]?.photos[0]?.date, null)
  assert.equal(garmentAlbum(garment, [], [])[0]?.photos[0]?.src, garment.imageUrl)
  assert.deepEqual(garmentAlbum({ ...garment, imageUrl: null }, [], []), [])
})

test('dates use Bangkok with an unpadded day, no seconds, and empty fallback', () => {
  assert.equal(garmentDate('2026-10-04 13:48:59', true), '4 Oct 2026 13:48')
  assert.equal(garmentDate('2026-10-04'), '4 Oct 2026')
  assert.equal(garmentDate(null, true), '–')
  assert.equal(garmentDate('invalid', true), '–')
})

test('an order filter keeps only that order and an unlinked order yields no rows', () => {
  const orders = [order('old', '2026-09-01'), order('new', '2026-10-24')]
  const links = [link('old'), link('new'), link('gone', { deletedAt: '2026-10-25 12:00:00' })]
  assert.deepEqual(garmentOrderRows(tag, links, orders, 'old').map(row => row.orderId), ['old'])
  assert.deepEqual(garmentOrderRows(tag, links, orders, 'unlinked'), [])
  assert.deepEqual(garmentOrderRows(tag, links, orders, null).map(row => row.orderId), ['new', 'old'])
})

test('a garment is in an order only through a live link to this garment', () => {
  const links = [link('new'), link('gone', { deletedAt: '2026-10-25 12:00:00' }), link('other', { laundryItemId: 'AAAA0002' })]
  assert.equal(garmentInOrder(tag, 'new', links), true)
  assert.equal(garmentInOrder(tag, 'gone', links), false)
  assert.equal(garmentInOrder(tag, 'other', links), false)
  assert.equal(garmentInOrder(tag, 'missing', links), false)
})

test('shared history is live non-registration photos without an order, newest first', () => {
  const history = garmentSharedHistory(tag, [
    photo('registration', 'REGISTRATION', { orderId: null }),
    photo('old', 'DEFECT', { orderId: null, createdAt: '2026-10-01 09:00:00' }),
    photo('new', 'AFTER', { orderId: '', createdAt: '2026-10-20 09:00:00' }),
    photo('ordered', 'BEFORE', { orderId: 'new' }),
    photo('deleted', 'BEFORE', { orderId: null, deletedAt: '2026-10-24 12:00:00' }),
    photo('other', 'BEFORE', { orderId: null, laundryItemId: 'AAAA0002' }),
  ])
  assert.deepEqual(history.map(item => [item.id, item.label, item.alt]), [['new', 'After', 'After photo'], ['old', 'Defect', 'Defect photo']])
  assert.deepEqual(garmentSharedHistory(tag, []), [])
})

test('an order filter keeps registration, shared and that order photos in the album', () => {
  const photos = [
    photo('registration', 'REGISTRATION', { imageUrl: garment.imageUrl, orderId: null }),
    photo('shared', 'BEFORE', { orderId: null }), photo('shared-empty', 'DEFECT', { orderId: '' }),
    photo('mine', 'DEFECT', { orderId: 'new' }), photo('theirs', 'DEFECT', { orderId: 'old' }),
  ]
  const orders = [order('new', '2026-10-24'), order('old', '2026-09-01')]
  const ids = (orderId: string | null) => garmentAlbum(garment, photos, orders, orderId).flatMap(group => group.photos.map(item => item.id))
  assert.deepEqual(ids('new'), ['registration', 'shared-empty', 'mine', 'shared'])
  assert.deepEqual(ids('old'), ['registration', 'shared-empty', 'theirs', 'shared'])
  assert.deepEqual(ids(null), ['registration', 'shared-empty', 'mine', 'theirs', 'shared'])
  assert.deepEqual(ids('unlinked'), ['registration', 'shared-empty', 'shared'])
})

test('photo type choices come from the contract enum without registration', () => {
  assert.deepEqual(garmentPhotoTypeOptions(), [{ value: 'BEFORE', label: 'Before' }, { value: 'AFTER', label: 'After' }, { value: 'DEFECT', label: 'Defect' }])
  assert.equal(garmentPhotoTypeLabel('REGISTRATION'), 'Registration')
})

test('every photo type choice has an icon and the known ones a hint', () => {
  const types = garmentPhotoTypeOptions().map(option => [option.value, garmentPhotoTypeIcon(option.value), garmentPhotoTypeHint(option.value)])
  assert.deepEqual(types, [['BEFORE', 'photo_camera_back', 'As received'], ['AFTER', 'photo_camera_front', 'After cleaning'], ['DEFECT', 'report', 'Damage or stain']])
  assert.equal(garmentPhotoTypeIcon('REGISTRATION'), 'photo_camera')
  assert.equal(garmentPhotoTypeHint('REGISTRATION'), '')
})

test('the header preview holds the album photos newest first', () => {
  const photos = [
    photo('registration', 'REGISTRATION', { imageUrl: garment.imageUrl, orderId: null, createdAt: '2026-08-12 09:40:00' }),
    photo('old', 'DEFECT', { orderId: 'new', createdAt: '2026-10-01 09:00:00' }),
    photo('newest', 'AFTER', { orderId: null, createdAt: '2026-10-20 09:00:00' }),
    photo('theirs', 'DEFECT', { orderId: 'old', createdAt: '2026-10-25 09:00:00' }),
  ]
  const orders = [order('new', '2026-10-24'), order('old', '2026-09-01')]
  const preview = (orderId: string | null) => garmentPhotoPreview(garment, garmentAlbum(garment, photos, orders, orderId), photos).map(item => item.id)
  assert.deepEqual(preview(null), ['theirs', 'newest', 'old', 'registration'])
  assert.deepEqual(preview('new'), ['newest', 'old', 'registration'])
  assert.deepEqual(garmentPhotoPreview(garment, garmentAlbum(garment, [], orders, null), []), [{ id: `registration:${garment.id}`, src: garment.imageUrl }])
})

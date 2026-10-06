import assert from 'node:assert/strict'
import {
  buildJobTicketId,
  buildJobTickets,
  departmentForJobTicketId,
  serviceRoutes,
  type ExistingJobTicket,
  type JobTicketDepartment,
  type ServiceRoutes,
} from '../../../../../server/modules/work-orders/job-ticket-provisioning.js'
import type { WorkRate, WorkRatesByTask } from '../../../../../server/modules/work-orders/work-rate-lookup.js'

const order = {
  orderId: 'order-1',
  customerId: 'customer-1',
  orderName: 'Order one',
  dueDate: '2026-09-30',
  notes: 'Rush',
  createdBy: 'staff-1',
  completedAt: '2026-10-06 10:00:00',
}

function ratesOf(...entries: Array<[string, JobTicketDepartment, number]>): WorkRatesByTask {
  return new Map<string, WorkRate>(entries.map(([taskCode, department, minutes]) => [
    taskCode, { taskCode, department, nameTh: null, minutes },
  ]))
}

const rates = ratesOf(['WSH-STANDARD', 'Washing', 12], ['DRC-STANDARD', 'DryCleaning', 20], ['IRN-STANDARD', 'Ironing', 0])

const expectedRoutes = {
  WASH: [['Washing', 'WSH-STANDARD'], ['Packaging', 'PCK-STANDARD']],
  WSIR: [['Washing', 'WSH-STANDARD'], ['Ironing', 'IRN-STANDARD'], ['Packaging', 'PCK-STANDARD']],
  DRCL: [['DryCleaning', 'DRC-STANDARD'], ['Ironing', 'IRN-STANDARD'], ['Packaging', 'PCK-STANDARD']],
  IRON: [['Ironing', 'IRN-STANDARD'], ['Packaging', 'PCK-STANDARD']],
} as const

const idPrefixes: Record<string, string> = { Washing: 'WSH', DryCleaning: 'DRC', Ironing: 'IRN', Packaging: 'PCK' }

const step = (department: JobTicketDepartment, taskCode: string) => ({ department, taskCode })
const garmentOf = (laundryItemId: string, serviceType: string, taggedBy: string | null = null) => ({
  laundryItemId, taggedBy, serviceType, specialInstructions: null, photoEvidenceUrl: null,
})
const idsOf = (rows: ReadonlyArray<{ id: string }>) => rows.map((row) => row.id)

assert.deepEqual([
  buildJobTicketId('075f2236', 'AU829dj0', step('Tagging', 'TAG-PHOTO')),
  buildJobTicketId('075f2236', 'AU829dj0', step('Washing', 'WSH-STANDARD')),
  buildJobTicketId('075f2236', 'AU829dj0', step('DryCleaning', 'DRC-STANDARD')),
  buildJobTicketId('075f2236', 'AU829dj0', step('Ironing', 'IRN-STANDARD')),
  buildJobTicketId('075f2236', 'AU829dj0', step('Packaging', 'PCK-STANDARD')),
  buildJobTicketId('075f2236', 'AU829dj0', step('Logistics', 'LOG-STANDARD')),
], [
  'TAG-075f2236-AU829dj0-TAG-PHOTO',
  'WSH-075f2236-AU829dj0-WSH-STANDARD',
  'DRC-075f2236-AU829dj0-DRC-STANDARD',
  'IRN-075f2236-AU829dj0-IRN-STANDARD',
  'PCK-075f2236-AU829dj0-PCK-STANDARD',
  'LOG-075f2236-AU829dj0-LOG-STANDARD',
])
assert.equal(departmentForJobTicketId('PCK-075f2236-AU829dj0-CHECK_PACK'), 'Packaging')
assert.equal(departmentForJobTicketId('WSH-075f2236-AU829dj0'), 'Washing')

for (const [serviceType, steps] of Object.entries(expectedRoutes)) {
  assert.deepEqual(serviceRoutes[serviceType as keyof ServiceRoutes].map((route) => [route.department, route.taskCode]), steps)
  const result = buildJobTickets(order, [{
    taggedBy: null,
    laundryItemId: `tag-${serviceType}`,
    serviceType,
    specialInstructions: 'Delicate',
    photoEvidenceUrl: 'https://example.test/before.jpg',
  }], [], rates)
  assert.deepEqual(result.rows.map((row) => [row.department, row.task_code]), steps)
  assert.deepEqual(result.rows.map((row) => row.step_no), steps.map((_value, index) => index + 1))
  assert.deepEqual(idsOf(result.rows), result.rows.map((row) => `${idPrefixes[row.department]}-order-1-tag-${serviceType}-${row.task_code}`))
  assert.ok(result.rows.every((row) => row.scope === 'ITEM' && row.status === 'Pending'))
  assert.ok(result.rows.every((row) => !('service_type' in row)))
  assert.ok(result.rows.every((row) => row.photo_evidence_url === 'https://example.test/before.jpg'))
  assert.deepEqual(result.rows.map((row) => row.work_minutes),
    steps.map(([, taskCode]) => rates.get(taskCode)?.minutes ?? null))
  assert.equal(result.rows.find((row) => row.department === 'Packaging')?.work_minutes, null)
  assert.deepEqual(result.unroutableGarments, [])
}

const multiTaskRoutes: ServiceRoutes = {
  ...serviceRoutes,
  WASH: [step('Washing', 'WSH-A'), step('Washing', 'WSH-B'), step('Packaging', 'PCK-STANDARD')],
}
const multiRates = ratesOf(['WSH-A', 'Washing', 10], ['WSH-B', 'Washing', 25], ['PCK-STANDARD', 'Ironing', 3])
const multiGarment = [garmentOf('tag-multi', 'WASH')]
const multiTask = buildJobTickets(order, multiGarment, [], multiRates, multiTaskRoutes)
assert.deepEqual(multiTask.rows.map((row) => [row.id, row.department, row.task_code, row.step_no, row.work_minutes]), [
  ['WSH-order-1-tag-multi-WSH-A', 'Washing', 'WSH-A', 1, 10],
  ['WSH-order-1-tag-multi-WSH-B', 'Washing', 'WSH-B', 2, 25],
  ['PCK-order-1-tag-multi-PCK-STANDARD', 'Packaging', 'PCK-STANDARD', 3, null],
])
assert.equal(new Set(multiTask.rows.map((row) => row.id)).size, 3)

const existing = (id: string, taskCode: string | null, department = 'Washing'): ExistingJobTicket =>
  ({ id, laundryItemId: 'tag-multi', department, taskCode })
assert.deepEqual(idsOf(buildJobTickets(order, multiGarment, [
  existing('WSH-order-1-tag-multi-WSH-A', 'WSH-A'),
], multiRates, multiTaskRoutes).rows), ['WSH-order-1-tag-multi-WSH-B', 'PCK-order-1-tag-multi-PCK-STANDARD'])
assert.deepEqual(buildJobTickets(order, multiGarment, [
  existing('WSH-order-1-tag-multi-WSH-A', 'WSH-A'),
  existing('WSH-order-1-tag-multi-WSH-B', 'WSH-B'),
  existing('PCK-order-1-tag-multi-PCK-STANDARD', 'PCK-STANDARD', 'Packaging'),
], multiRates, multiTaskRoutes).rows, [])
assert.deepEqual(idsOf(buildJobTickets(order, multiGarment, [
  existing('WSH-order-1-tag-multi-WSH-A', null),
], multiRates, multiTaskRoutes).rows), idsOf(multiTask.rows).slice(1))

const idempotent = buildJobTickets(order, [{
  laundryItemId: 'tag-1',
  taggedBy: null,
  serviceType: 'WSIR',
  specialInstructions: null,
  photoEvidenceUrl: 'https://example.test/new.jpg',
}], [{ id: 'WSH-order-1-tag-1-WSH-STANDARD', laundryItemId: 'tag-1', department: 'Washing', taskCode: 'WSH-STANDARD' }], rates)
assert.deepEqual(idempotent.rows.map((row) => row.department), ['Ironing', 'Packaging'])
assert.ok(idempotent.rows.every((row) => row.photo_evidence_url === 'https://example.test/new.jpg'))

const legacyGarment = [garmentOf('tag-1', 'WSIR', 'tagger-1')]
const legacyTickets = (taskCode: (department: string) => string | null): ExistingJobTicket[] => [
  ['Tagging', 'TAG'], ['Washing', 'WSH'], ['Ironing', 'IRN'], ['Packaging', 'PCK'],
].map(([department, prefix]) => ({
  id: `${prefix}-order-1-tag-1`, laundryItemId: 'tag-1', department: department!, taskCode: taskCode(department!),
}))
for (const taskCode of [() => null, () => 'WSIR', () => '']) {
  assert.deepEqual(buildJobTickets(order, legacyGarment, legacyTickets(taskCode), rates).rows, [])
}
assert.deepEqual(buildJobTickets(order, legacyGarment, legacyTickets((department) => `${department}-backfilled`), rates).rows, [])
const legacyWashOnly = buildJobTickets(order, legacyGarment, legacyTickets(() => null).filter((ticket) => ticket.department === 'Washing'), rates)
assert.deepEqual(legacyWashOnly.rows.map((row) => row.task_code), ['TAG-PHOTO', 'IRN-STANDARD', 'PCK-STANDARD'])

const legacyWashWithSplitRoute = buildJobTickets(order, [garmentOf('tag-1', 'WASH')], [
  { id: 'WSH-order-1-tag-1', laundryItemId: 'tag-1', department: 'Washing', taskCode: null },
], multiRates, multiTaskRoutes)
assert.deepEqual(legacyWashWithSplitRoute.rows.map((row) => row.task_code), ['WSH-A', 'WSH-B', 'PCK-STANDARD'])

const mismatchedLegacy = buildJobTickets(order, [garmentOf('tag-1', 'WASH')], [
  { id: 'WSH-order-1-tag-1', laundryItemId: 'tag-1', department: 'Ironing', taskCode: null },
], rates)
assert.deepEqual(mismatchedLegacy.rows.map((row) => row.task_code), ['WSH-STANDARD', 'PCK-STANDARD'])

const otherGarmentLegacy = buildJobTickets(order, [garmentOf('tag-2', 'WASH')], [
  { id: 'WSH-order-1-tag-1', laundryItemId: 'tag-1', department: 'Washing', taskCode: null },
], rates)
assert.deepEqual(otherGarmentLegacy.rows.map((row) => row.task_code), ['WSH-STANDARD', 'PCK-STANDARD'])

const collidingId = buildJobTickets(order, [garmentOf('tag-1', 'WASH')], [
  { id: 'WSH-order-1-tag-1-WSH-STANDARD', laundryItemId: 'tag-1', department: 'Washing', taskCode: null },
], rates)
assert.deepEqual(collidingId.rows.map((row) => row.task_code), ['PCK-STANDARD'])

const duplicatePhotos = buildJobTickets(order, [
  { taggedBy: null, laundryItemId: 'tag-2', serviceType: 'WASH', specialInstructions: null, photoEvidenceUrl: '' },
  { taggedBy: null, laundryItemId: 'tag-2', serviceType: 'WASH', specialInstructions: null, photoEvidenceUrl: 'https://example.test/first.jpg' },
  { taggedBy: null, laundryItemId: 'tag-2', serviceType: 'WASH', specialInstructions: null, photoEvidenceUrl: 'https://example.test/later.jpg' },
], [], rates)
assert.equal(duplicatePhotos.rows.length, 2)
assert.ok(duplicatePhotos.rows.every((row) => row.photo_evidence_url === 'https://example.test/first.jpg'))

const emptyPhoto = buildJobTickets(order, [
  { taggedBy: null, laundryItemId: 'tag-empty', serviceType: 'WASH', specialInstructions: null, photoEvidenceUrl: '  ' },
], [], rates)
assert.ok(emptyPhoto.rows.every((row) => row.photo_evidence_url === null))

const unroutable = buildJobTickets(order, [
  garmentOf('tag-3', 'FOLD'),
  garmentOf('', 'WASH'),
], [], rates)
assert.deepEqual(unroutable.rows, [])
assert.deepEqual(unroutable.unroutableGarments, [
  { laundryItemId: 'tag-3', serviceType: 'FOLD', reason: 'unsupportedServiceType' },
  { laundryItemId: '', serviceType: 'WASH', reason: 'missingLaundryItemId' },
])

const taggedGarments = [
  { laundryItemId: 'tag-new', taggedBy: null, serviceType: 'WASH', specialInstructions: null, photoEvidenceUrl: 'https://example.test/first.jpg' },
  { laundryItemId: 'tag-new', taggedBy: 'tagger-1', serviceType: 'IRON', specialInstructions: 'Careful', photoEvidenceUrl: null },
  { laundryItemId: 'tag-new', taggedBy: 'tagger-2', serviceType: 'DRCL', specialInstructions: 'Later', photoEvidenceUrl: null },
  { laundryItemId: 'tag-unsupported', taggedBy: 'tagger-1', serviceType: 'FOLD', specialInstructions: null, photoEvidenceUrl: null },
  { laundryItemId: '  ', taggedBy: 'tagger-1', serviceType: 'WASH', specialInstructions: null, photoEvidenceUrl: null },
]
const taggingRates = ratesOf(['TAG-PHOTO', 'Tagging', 3])
const tagging = buildJobTickets(order, taggedGarments, [], taggingRates).rows.filter(row => row.department === 'Tagging')
assert.deepEqual(tagging[0], {
  id: 'TAG-order-1-tag-new-TAG-PHOTO', order_id: 'order-1', laundry_item_id: 'tag-new', scope: 'ITEM',
  task_code: 'TAG-PHOTO', department: 'Tagging', step_no: 0, customer_id: 'customer-1',
  order_name: 'Order one', due_date: '2026-09-30', special_instructions: 'Careful', notes: 'Rush',
  status: 'Completed', started_at: order.completedAt, completed_at: order.completedAt,
  scanned_by: 'tagger-1', updated_by: 'tagger-1', photo_evidence_url: 'https://example.test/first.jpg',
  created_by: 'staff-1', work_minutes: 3,
})
assert.equal(tagging.length, 2)
assert.equal(tagging[1]?.task_code, 'TAG-PHOTO')
assert.equal(tagging[1]?.status, 'Completed')
assert.equal(buildJobTickets(order, taggedGarments, [
  { id: 'TAG-order-1-tag-new-TAG-PHOTO', laundryItemId: 'tag-new', department: 'Tagging', taskCode: 'TAG-PHOTO' },
  { id: 'TAG-order-1-tag-unsupported', laundryItemId: 'tag-unsupported', department: 'Tagging', taskCode: null },
], taggingRates).rows.filter(row => row.department === 'Tagging').length, 0)
assert.equal(buildJobTickets(order, taggedGarments, [], new Map()).rows.find(row => row.department === 'Tagging')?.work_minutes, null)
assert.equal(buildJobTickets(order, taggedGarments, [], ratesOf(['TAG-PHOTO', 'Washing', 3])).rows.find(row => row.department === 'Tagging')?.work_minutes, null)

console.log('job-ticket provisioning dry test passed')

import assert from 'node:assert/strict'
import { BagTagPrintService } from '../../../../../server/modules/bag-tag-prints/bag-tag-print.service.js'
import { requestBagTagPrint } from '../../../../../server/modules/bag-tag-prints/bag-tag-print-client.js'
import { OrderImageService } from '../../../../../server/modules/order-images/order-image.module.js'
import { bagTagPrintRequestSchema } from '../../../../../contracts/bag-tag-prints/bag-tag-print.schema.js'
import type { z } from 'zod'
import type { orderImagesRowSchema } from '../../../../../server/sheets/OrderImages/OrderImages.db-contract.js'
import type { SheetRepositoryContract } from '../../../../../server/shared/repositories/sheet-repository.contract.js'

type Row = z.infer<typeof orderImagesRowSchema>
const envKeys = ['BAG_TAG_PRINT_ENABLED', 'BAG_TAG_TRACKING_URL_BASE', 'PRINT_SERVER_URL', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET'] as const
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
const originalFetch = globalThis.fetch
const originalError = console.error
const originalTimeout = AbortSignal.timeout
const logs: string[] = []
const calls: { url: string; init?: RequestInit }[] = []
let customer: { customerIndex: unknown } | null = { customerIndex: 'A 12._:-z' }
let customerThrows = false
let customerReads = 0
let orderReads = 0
let ticketThrows = false
let ticketCalls = 0
let savedOverrides: Partial<Row> = {}
const appendRows: Partial<Row>[] = []
const payload = {
  orderId: 'order-1', customerId: 'customer-1', imageType: 'WEIGHT',
  imagePath: 'https://storage.example/weight.jpg', quantity: 2.5, createdBy: 'staff-1',
}
const repository: SheetRepositoryContract<Row> = {
  async read() { throw new Error('unexpected read') },
  async append(row) {
    appendRows.push(row)
    return { id: 'deadbeef', customer_id: 'customer-1', delivery_id: null, order_id: 'order-1',
      image_type: 'WEIGHT', image_path: payload.imagePath, notes: null, quantity: 2.5,
      created_at: '2026-10-07 12:34:56', created_by: 'staff-1', ...row, ...savedOverrides }
  },
  async batchAppend() { throw new Error('unexpected batch') },
  async update() { throw new Error('unexpected update') },
  async delete() { throw new Error('unexpected delete') },
}
const printer = new BagTagPrintService({
  async customerReader(id) {
    assert.equal(id, 'customer-1')
    customerReads++
    if (customerThrows) throw new Error('sensitive lookup details')
    return customer
  },
  async orderCustomerIdReader(orderId) {
    assert.equal(orderId, 'order-1')
    orderReads++
    return 'customer-1'
  },
})
const service = new OrderImageService({ repository, bagTagPrintService: printer,
  weightPhotoTicketService: { async provision() { ticketCalls++; if (ticketThrows) throw new Error('ticket failure') } },
})
function successResponse() {
  return Response.json({ success: true, accepted: true, printerName: 'Test printer', totalCount: 1 })
}
function mockFetch(handler: () => Promise<Response> = async () => successResponse()) {
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init })
    return handler()
  }) as typeof fetch
}
function latestFailure() { return JSON.parse(logs.at(-1)!) as Record<string, unknown> }
function lastBody() { return JSON.parse(String(calls.at(-1)!.init!.body)) }

try {
  process.env.BAG_TAG_PRINT_ENABLED = 'true'
  process.env.BAG_TAG_TRACKING_URL_BASE = 'https://staff.example/#/b/'
  process.env.PRINT_SERVER_URL = 'https://printer.example/base'
  process.env.CF_ACCESS_CLIENT_ID = 'test-client-id'
  process.env.CF_ACCESS_CLIENT_SECRET = 'test-client-secret'
  console.error = (...args) => logs.push(args.map(String).join(' '))
  let timeoutMs = 0
  AbortSignal.timeout = (ms) => { timeoutMs = ms; return originalTimeout(ms) }
  mockFetch()
  const saved = await service.create(payload)
  assert.equal(calls.length, 1)
  assert.equal(timeoutMs, 10_000)
  assert.equal(ticketCalls, 1)
  assert.equal(appendRows.length, 1)
  assert.equal(customerReads, 1)
  assert.equal(calls[0]!.url, 'https://printer.example/base/print-bag-tag')
  assert.equal(calls[0]!.init!.method, 'POST')
  assert.deepEqual(calls[0]!.init!.headers, {
    'Content-Type': 'application/json', 'CF-Access-Client-Id': 'test-client-id',
    'CF-Access-Client-Secret': 'test-client-secret',
  })
  const expectedBody = {
    qrValue: `https://staff.example/#/b/${saved.orderImageId}`, barcodeValue: saved.orderImageId,
    customerIndex: 'A 12._:-z', weightKg: 2.5, weighedAt: '2026-10-07 12:34:56',
  }
  assert.deepEqual(lastBody(), expectedBody)
  assert.equal(logs.length, 0)
  for (const flag of [undefined, 'false', 'TRUE', '1', '']) {
    if (flag === undefined) delete process.env.BAG_TAG_PRINT_ENABLED
    else process.env.BAG_TAG_PRINT_ENABLED = flag
    const before: number[] = [calls.length, logs.length, customerReads]
    assert.deepEqual(await service.create(payload), saved)
    assert.deepEqual([calls.length, logs.length, customerReads], before)
  }
  process.env.BAG_TAG_PRINT_ENABLED = 'true'
  for (const imageType of ['BELONGING', 'DOCUMENT']) {
    const count: number = calls.length
    await service.create({ ...payload, imageType, quantity: null })
    assert.equal(calls.length, count)
  }
  for (const [handler, failureKind] of [
    [async () => new Response('printer error', { status: 502 }), 'http_error'],
    [async () => { throw new DOMException('timeout', 'TimeoutError') }, 'fetch_timeout'],
    [async () => { throw Object.assign(new Error('sensitive'), { code: 'ENOTFOUND' }) }, 'fetch_error'],
    [async () => new Response('<html>'), 'invalid_json'],
    [async () => Response.json({ success: false }), 'invalid_response_schema'],
    [async () => Response.json({ success: true, accepted: true, printerName: 'Test', totalCount: 2 }), 'invalid_response_schema'],
  ] as const) {
    mockFetch(handler)
    const count: number = calls.length
    assert.deepEqual(await service.create(payload), saved)
    assert.equal(calls.length, count + 1)
    assert.equal(latestFailure().event, 'bag_tag_print_failure')
    assert.equal(latestFailure().failureKind, failureKind)
  }
  for (const key of envKeys.filter((key) => key !== 'BAG_TAG_PRINT_ENABLED')) {
    const value = process.env[key]
    delete process.env[key]
    const count: number = calls.length
    assert.deepEqual(await service.create(payload), saved)
    assert.equal(calls.length, count)
    assert.equal(latestFailure().failureKind, 'configuration_error')
    assert.deepEqual(latestFailure().missing, [key])
    process.env[key] = value
  }
  mockFetch()
  for (const [value, throws, failureKind] of [
    [null, false, 'customer_not_found'],
    [{ customerIndex: 'unused' }, true, 'customer_lookup_error'],
    [{ customerIndex: 'A/12' }, false, 'invalid_customer_index'],
    [{ customerIndex: 'ไทย' }, false, 'invalid_customer_index'],
  ] as const) {
    customer = value
    customerThrows = throws
    const count: number = calls.length
    assert.deepEqual(await service.create(payload), saved)
    assert.equal(calls.length, count + 1)
    assert.deepEqual(lastBody(), { ...expectedBody, customerIndex: null })
    assert.equal(latestFailure().failureKind, failureKind)
  }
  customerThrows = false
  for (const value of ['', '   ', null]) {
    customer = { customerIndex: value }
    await service.create(payload)
    assert.equal(lastBody().customerIndex, null)
  }
  customer = { customerIndex: 1999 }
  await service.create(payload)
  assert.equal(lastBody().customerIndex, '1999')
  const orderReadsBefore = orderReads
  savedOverrides = { customer_id: null }
  await service.create({ ...payload, customerId: null })
  assert.equal(orderReads, orderReadsBefore + 1)
  assert.equal(lastBody().customerIndex, '1999')
  savedOverrides = {}
  customer = { customerIndex: 'A 12._:-z' }
  for (const quantity of [null, 0, -1, 1000, Infinity, NaN]) {
    savedOverrides = { quantity }
    const count: number = calls.length
    const result = await service.create(payload)
    assert.equal(Object.is(result.quantity, quantity), true)
    assert.equal(calls.length, count)
    assert.equal(latestFailure().failureKind, 'invalid_quantity')
  }
  savedOverrides = {}
  for (const [created_at, weighedAt] of [
    ['2026-10-07 12:34:56', '2026-10-07 12:34:56'],
    ['Date(2026,9,7,12,34,56)', '2026-10-07 12:34:56'],
    ['Date(2026,9,7)', '2026-10-07 00:00:00'],
    ['2026-10-07', '2026-10-07 00:00:00'],
    ['2026-10-07T05:34:56Z', '2026-10-07 12:34:56'],
    ['2026-10-07T12:34:56+07:00', '2026-10-07 12:34:56'],
    ['2026-10-07T12:34:56', '2026-10-07 12:34:56'],
  ]) {
    savedOverrides = { created_at }
    const result = await service.create(payload)
    assert.equal(result.createdAt, created_at, 'printing must not mutate save response')
    assert.equal(lastBody().weighedAt, weighedAt)
  }
  for (const overrides of [{ created_at: 'bad date' }, { id: 'a'.repeat(33) }]) {
    savedOverrides = overrides
    const count: number = calls.length
    await service.create(payload)
    assert.equal(calls.length, count)
    assert.equal(latestFailure().failureKind, 'invalid_request')
  }
  savedOverrides = {}
  ticketThrows = true
  const count: number = calls.length
  assert.deepEqual(await service.create(payload), saved)
  assert.equal(calls.length, count + 1, 'ticket failure must not suppress printing')
  ticketThrows = false
  const throwingService = new OrderImageService({ repository,
    weightPhotoTicketService: { async provision() {} },
    bagTagPrintService: { async print() { throw new Error('test-client-secret') } },
  })
  assert.deepEqual(await throwingService.create(payload), saved)
  assert.equal(latestFailure().failureKind, 'unexpected_error')
  mockFetch(async () => new Response(
    'https://printer.example/base/print-bag-tag test-client-id test-client-secret ' + 'x'.repeat(600),
    { status: 502, headers: { 'cf-ray': 'test-client-secret' } },
  ))
  await service.create(payload)
  assert.equal(String(latestFailure().responseBodyPrefix).length, 500)
  assert.doesNotMatch(logs.join('\n'), /printer\.example|test-client-id|test-client-secret|sensitive lookup/)
  mockFetch(async () => Response.json({ success: true, accepted: true, printerName: 'Test', totalCount: 1, 'test-client-secret': true }))
  await service.create(payload)
  assert.equal(latestFailure().failureKind, 'invalid_response_schema')
  assert.doesNotMatch(logs.at(-1)!, /test-client-secret/)
  mockFetch(async () => {
    const response = successResponse()
    Object.defineProperty(response, 'json', { value: async () => { throw new DOMException('timeout', 'TimeoutError') } })
    return response
  })
  await service.create(payload)
  assert.equal(latestFailure().failureKind, 'fetch_timeout')
  let releasePrint!: () => void
  let enteredPrint!: () => void
  const printStarted = new Promise<void>((resolve) => { enteredPrint = resolve })
  const printReleased = new Promise<void>((resolve) => { releasePrint = resolve })
  mockFetch(async () => { enteredPrint(); await printReleased; return successResponse() })
  let saveCompleted = false
  const pendingSave = service.create(payload).then((image) => { saveCompleted = true; return image })
  await printStarted
  assert.equal(saveCompleted, false, 'save must await the print request')
  releasePrint()
  assert.deepEqual(await pendingSave, saved)
  process.env.PRINT_SERVER_URL = 'invalid url'
  const before = calls.length
  await service.create(payload)
  assert.equal(calls.length, before)
  assert.equal(latestFailure().failureKind, 'invalid_configuration')
  process.env.PRINT_SERVER_URL = 'https://printer.example/base'
  for (const [field, invalidValues] of Object.entries({
    qrValue: ['', 'a'.repeat(65), 'ไทย', 'a\n'],
    barcodeValue: ['', 'a'.repeat(33), 'a\t'],
    customerIndex: ['a/', 'a@', 'a\n'],
    weightKg: [0, 1000, NaN, Infinity],
    weighedAt: ['2026-10-07T12:34:56Z', 'bad'],
  })) {
    for (const value of invalidValues) assert.equal(bagTagPrintRequestSchema.safeParse({ ...expectedBody, [field]: value }).success, false)
  }
  assert.equal(bagTagPrintRequestSchema.safeParse({ ...expectedBody, qrValue: 'a'.repeat(64), barcodeValue: 'a'.repeat(32), weightKg: 999.9 }).success, true)
  const invalidCount = calls.length
  await requestBagTagPrint({ ...expectedBody, qrValue: 'a'.repeat(65) })
  assert.equal(calls.length, invalidCount)
  console.log('bag tag print dry tests passed: save hook, flags, exact request, nonfatal failures, customer fallbacks, quantities, timestamps, validation, redaction')
} finally {
  globalThis.fetch = originalFetch
  console.error = originalError
  AbortSignal.timeout = originalTimeout
  for (const key of envKeys) {
    const value = originalEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

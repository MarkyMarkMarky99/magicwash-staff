import assert from 'node:assert/strict'
import type { z } from 'zod'
import { washQueueRoutes } from '../../../../../server/modules/wash-queue/wash-queue.module.js'
import { getWashProductsRepository } from '../../../../../server/sheets/WashProducts/WashProducts.repository.js'
import { getMachinesRepository } from '../../../../../server/sheets/Machines/Machines.repository.js'
import { getWashQueueRepository } from '../../../../../server/sheets/WashQueue/WashQueue.repository.js'
import { washQueueDbContract, type washQueueRowSchema } from '../../../../../server/sheets/WashQueue/WashQueue.db-contract.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { SheetsApiClient } from '../../../../../server/shared/repositories/sheets-api.client.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'

type WashQueueDbRow = z.infer<typeof washQueueRowSchema>

process.env.JOB_TICKETS_SPREADSHEET_ID = 'wash-queue-wire-test'
const headers = Object.keys(washQueueDbContract.row.shape)
const client = new SheetsApiClient({
  spreadsheetId: 'wash-queue-wire-test', sheetName: 'WashQueue',
  accessTokenProvider: async () => 'mock',
  fetchImpl: async () => { throw new Error('no network allowed') },
})
const options = {
  preRinse: true, soakMinutes: 30, extraWash: false, temperature: '40',
  bleach: null, detergent: null, softener: null, rinses: 2,
} as const
Object.assign(getWashProductsRepository(), { read: async () => [] })
let stored: unknown[] = []
let writes = 0
client.readColumn = async () => [['id'], ...(stored.length ? [[String(stored[0])]] : [])]
client.readRange = async () => [stored as string[]]
client.appendRows = async (rows, valueInput, width) => {
  assert.equal(valueInput, 'USER_ENTERED')
  assert.equal(width, 23)
  assert.equal(rows[0]!.length, 23)
  assert.equal(rows[0]![4], '', 'reserved null uses existing serializer blank-cell behavior')
  assert.equal(rows[0]![13], '2026-10-10 07:00:00')
  assert.equal(rows[0]![15], rows[0]![13])
  assert.equal(rows[0]![17], 12.3)
  assert.deepEqual(rows[0]!.slice(18), ['', '', 'WSH15-01', 'C', JSON.stringify(options)])
  stored = [...rows[0]!]
  writes++
  return { spreadsheetId: 'wash-queue-wire-test', updates: {
    updatedRows: 1, updatedData: { values: rows },
  } }
}
client.updateCells = async (ranges, valueInput) => {
  assert.equal(valueInput, 'USER_ENTERED')
  for (const entry of ranges) {
    const letter = /!([A-W])2/.exec(entry.range)![1]!
    stored[letter.charCodeAt(0) - 65] = entry.values[0]![0]
  }
  writes++
  return { spreadsheetId: 'wash-queue-wire-test', responses: [] }
}
const repository = new SheetRepository<WashQueueDbRow>({
  contract: washQueueDbContract, sheetsApiClient: client,
  sheetHeaderMapLoader: { load: async () => buildSheetHeaderMap(headers, headers, 'id') },
  now: () => new Date('2026-10-10T00:00:00Z'),
})
Object.assign(getWashQueueRepository(), {
  append: repository.append.bind(repository), update: repository.update.bind(repository),
  read: async () => [Object.fromEntries(headers.map((header, index) => [header, stored[index]]))],
})
Object.assign(getMachinesRepository(), {
  read: async () => [
    { id: 'WSH15-01', status: 'ACTIVE', type: 'WSH' },
    { id: 'DRY08-01', status: 'ACTIVE', type: 'DRY' },
    { id: 'WSH15-02', status: 'MAINTENANCE' },
    { id: 'DRY08-02', status: 'RETIRED' },
  ],
})
const staff = { staffId: 'STAFF-me', name: 'Me', email: 'me@example.test', role: 'staff' as const }
const result = await washQueueRoutes.collection.handleRequest({
  method: 'POST', query: {}, headers: {}, params: {}, staff,
  body: { photoUrl: 'https://example.test/basket.jpg', weightBeforeKg: 12.3, machineId: 'WSH15-01', tagCode: 'C', washOptions: options, instruction: 'Ignored' },
})
assert.equal(result.status, 201)
const created = (result.body as { data: Record<string, unknown> }).data
assert.equal(created.workMinutes, null)
assert.equal(created.instruction, null)
assert.equal(stored[3], '')
assert.equal(stored[22], JSON.stringify(options))
assert.deepEqual(created.washOptions, options)
assert.equal(created.weightBeforeKg, 12.3)
assert.equal(created.weightAfterKg, null)
assert.equal(created.unloadPhotoUrl, null)
assert.equal(created.machineId, 'WSH15-01')
assert.equal(created.loadedAt, null)
assert.equal(created.loadedBy, null)
assert.equal(created.createdAt, '2026-10-10 07:00:00')
assert.equal(created.updatedAt, created.createdAt)
assert.equal(stored[14], staff.staffId)
assert.equal(stored[16], staff.staffId)
const updated = await washQueueRoutes.item.handleRequest({
  method: 'PATCH', query: {}, headers: {}, params: { id: String(created.id) }, staff,
  body: { action: 'load' },
})
assert.equal(updated.status, 200)
const loaded = (updated.body as { data: Record<string, unknown> }).data
assert.equal(loaded.status, 'In Progress')
assert.equal(loaded.updatedAt, '2026-10-10 07:00:00')
assert.equal(loaded.loadedBy, staff.staffId)
assert.equal(loaded.workMinutes, null)
assert.equal(loaded.weightBeforeKg, 12.3)
assert.equal(loaded.weightAfterKg, null)
const unloaded = await washQueueRoutes.item.handleRequest({
  method: 'PATCH', query: {}, headers: {}, params: { id: String(created.id) }, staff,
  body: { action: 'unload', weightAfterKg: 15.4, unloadPhotoUrl: 'https://example.test/wet.jpg' },
})
assert.equal(unloaded.status, 200)
const completed = (unloaded.body as { data: Record<string, unknown> }).data
assert.equal(completed.status, 'Completed')
assert.equal(completed.weightAfterKg, 15.4)
assert.equal(completed.unloadPhotoUrl, 'https://example.test/wet.jpg')
assert.equal(completed.machineId, 'WSH15-01')
assert.equal(completed.unloadedBy, staff.staffId)
assert.equal(stored[18], 15.4)
assert.equal(stored[19], 'https://example.test/wet.jpg')
assert.equal(stored[20], 'WSH15-01')
assert.equal(stored[21], 'C')
assert.deepEqual(completed.washOptions, options)
assert.equal(stored[22], JSON.stringify(options))
assert.equal(writes, 3)
console.log('wash queue wire dry test passed (23 columns, repository audit, null echoes, load/unload writes)')

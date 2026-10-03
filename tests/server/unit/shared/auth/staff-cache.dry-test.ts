import assert from 'node:assert/strict'
import { getStaffList, invalidateStaffListCache } from '../../../../../server/shared/auth/staff-list.js'
import { StaffService } from '../../../../../server/modules/staff/staff.service.js'
import { SheetsApiClient, type SheetsApiValues } from '../../../../../server/shared/repositories/sheets-api.client.js'

const previousSpreadsheetId = process.env.STAFF_SPREADSHEET_ID
const originalReadRange = SheetsApiClient.prototype.readRange
process.env.STAFF_SPREADSHEET_ID = 'cache-test'
const headers = ['Email', 'Name', 'Role', 'Active', 'StaffId', 'Phone', 'Address', 'Position', 'StartDate']
let rows = [['new@example.com', 'New', '', false, 'new-id', '', '', '', '']] as (string | boolean)[][]
let reads = 0
let delayed: Promise<SheetsApiValues> | undefined
SheetsApiClient.prototype.readRange = async function (range, options) {
  assert.equal(range, 'A:D')
  assert.equal(options?.valueRenderOption, 'UNFORMATTED_VALUE')
  reads += 1
  return delayed ?? [headers.slice(0, 4), ...rows.map((row) => row.slice(0, 4))]
}
const service = new StaffService({
  readRange: async (range) => range === '1:1' ? [headers] : rows,
  appendRows: async (values) => {
    rows.push([...values[0]!] as (string | boolean)[])
    return { updates: { updatedRows: 1, updatedData: { values } } }
  },
  updateCells: async (data) => {
    for (const { range, values } of data) {
      const match = /^Staff!([A-Z])(\d+)$/.exec(range)!
      rows[Number(match[2]) - 2]![match[1]!.charCodeAt(0) - 65] = values[0]![0] as string | boolean
    }
    return { responses: [] }
  },
})
try {
  invalidateStaffListCache()
  assert.equal((await getStaffList()).has('new@example.com'), false)
  await getStaffList()
  assert.equal(reads, 1)
  await service.update('new-id', 'admin@example.com', { role: 'staff', active: true })
  assert.equal((await getStaffList()).get('new@example.com')?.role, 'staff')
  assert.equal(reads, 2)
  await service.register('another@example.com', { name: 'Another', phone: '001', address: 'Home' })
  await getStaffList()
  assert.equal(reads, 3)
  await assert.rejects(service.register('another@example.com', { name: 'A', phone: '1', address: 'H' }))
  await getStaffList()
  assert.equal(reads, 3)

  invalidateStaffListCache()
  let finishOldRead!: (values: SheetsApiValues) => void
  delayed = new Promise((resolve) => { finishOldRead = resolve })
  const staleRead = getStaffList()
  assert.equal(getStaffList(), staleRead)
  invalidateStaffListCache()
  delayed = undefined
  rows = [['new@example.com', 'Approved', 'admin', true, 'new-id', '', '', '', '']]
  assert.equal((await getStaffList()).get('new@example.com')?.role, 'admin')
  finishOldRead([headers.slice(0, 4), ['old@example.com', 'Old', 'staff', true]])
  await staleRead
  const fresh = await getStaffList()
  assert.equal(fresh.get('new@example.com')?.name, 'Approved')
  assert.equal(fresh.has('old@example.com'), false)
  assert.equal(reads, 5)
} finally {
  SheetsApiClient.prototype.readRange = originalReadRange
  invalidateStaffListCache()
  if (previousSpreadsheetId === undefined) delete process.env.STAFF_SPREADSHEET_ID
  else process.env.STAFF_SPREADSHEET_ID = previousSpreadsheetId
}
console.log('staff cache dry test passed')

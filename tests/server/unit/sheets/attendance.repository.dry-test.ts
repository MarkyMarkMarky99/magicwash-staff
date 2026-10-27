import assert from 'node:assert/strict'
import { AttendanceRepository } from '../../../../server/sheets/Attendance/Attendance.repository.js'
import { attendanceDbContract, attendanceRowSchema } from '../../../../server/sheets/Attendance/Attendance.db-contract.js'
import { SheetsApiClient, type SheetsApiValue, type SheetsApiValueRange } from '../../../../server/shared/repositories/sheets-api.client.js'

const header = ['id', 'staff_id', 'work_date', 'status', 'notes', 'created_at', 'created_by', 'updated_at', 'updated_by', 'deleted_at', 'deleted_by']
assert.deepEqual(Object.keys(attendanceRowSchema.shape), header)
assert.equal(attendanceDbContract.spreadsheetId, 'STAFF_SPREADSHEET_ID')
assert.deepEqual(attendanceDbContract.audit, { onAppend: ['created_at'], onUpdate: ['updated_at'] })
assert.equal(attendanceDbContract.writes.delete, false)
const now = new Date('2026-10-27T17:30:00Z')
const timestamp = '2026-10-28 00:30:00'
const serial = (text: string) => (new Date(`${text.replace(' ', 'T')}Z`).getTime() - Date.UTC(1899, 11, 30)) / 86_400_000
const dateColumns = [2, 5, 7, 9]
let grid: SheetsApiValue[][] = [header]
let appendFailure = false
const requests: { url: URL; method: string; body: Record<string, unknown> | undefined }[] = []
const fetchImpl: typeof fetch = async (input, init) => {
  const url = new URL(String(input))
  assert.equal(url.hostname, 'sheets.googleapis.com')
  assert.ok(url.pathname.startsWith('/v4/spreadsheets/restricted-staff/'))
  assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-token')
  const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined
  requests.push({ url, method: init?.method ?? 'GET', body })
  const range = decodeURIComponent(url.pathname.split('/values/')[1] ?? '')
  let response: unknown
  if (range.endsWith(':append')) {
    if (appendFailure) throw new Error('Uncertain append')
    assert.equal(range, 'Attendance!A:A:append')
    assert.equal(url.searchParams.get('valueInputOption'), 'USER_ENTERED')
    const values = body!.values as SheetsApiValue[][]
    assert.equal(values.length, 1)
    assert.equal(values[0]!.length, 11, 'An eleven-column grid must never receive an L column')
    grid.push(...values.map((row) => row.map((value, column) =>
      dateColumns.includes(column) && value !== '' && value != null ? serial(String(value)) : value)))
    response = { updates: { updatedRows: 1, updatedRange: 'Attendance!A2:K2', updatedData: { values } } }
  } else if (url.pathname.endsWith('/values:batchUpdate')) {
    assert.equal(body!.valueInputOption, 'USER_ENTERED')
    const data = body!.data as SheetsApiValueRange[]
    for (const entry of data) {
      const match = /^Attendance!([A-K])(\d+):[A-K]\d+$/.exec(entry.range)!
      assert.ok(match, 'Only cells in Attendance A:K may be updated')
      const column = match[1]!.charCodeAt(0) - 65
      const value = entry.values[0]![0]!
      grid[Number(match[2]) - 1]![column] = dateColumns.includes(column) && value !== '' ? serial(String(value)) : value
    }
    response = { responses: data.map(() => ({})) }
  } else if (range === 'Attendance!1:1') {
    response = { values: [header] }
  } else if (range === 'Attendance!A:A') {
    response = { values: grid.map((row) => [row[0]]) }
  } else if (range === 'Attendance!A:K') {
    assert.equal(url.searchParams.get('valueRenderOption'), 'UNFORMATTED_VALUE')
    assert.equal(url.searchParams.get('dateTimeRenderOption'), 'SERIAL_NUMBER')
    response = { values: grid }
  } else if (range === 'Attendance!A2:K2') {
    // Generic writer readback can be localized; the repository must not emit these dates.
    response = { values: [grid[1]!.map((value, index) => dateColumns.includes(index) && value ? '28/10/2026 0:30:00' : value)] }
  } else {
    throw new Error(`Unexpected range: ${range}`)
  }
  return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } })
}
const repository = new AttendanceRepository(new SheetsApiClient({
  spreadsheetId: 'restricted-staff', sheetName: 'Attendance', accessTokenProvider: async () => 'test-token', fetchImpl,
}), () => now)
const originalFetch = globalThis.fetch
let unauthenticatedCalls = 0
globalThis.fetch = async () => { unauthenticatedCalls++; throw new Error('GViz must never be used') }
try {
  assert.deepEqual(await repository.read(), [])
  const saved = await repository.append({
    id: 'record', staff_id: 'staff', work_date: '2026-10-30', status: 'DAY_OFF', notes: null,
    created_by: 'scanned-operator', updated_at: null, updated_by: null, deleted_at: null, deleted_by: null,
  })
  assert.equal(saved.created_at, timestamp)
  assert.equal(saved.created_by, 'scanned-operator')
  assert.equal(saved.updated_at, null)
  const [read] = await repository.read()
  assert.deepEqual(read, saved, 'Native date and timestamp serials normalize to the canonical formats')
  const edited = await repository.update('record', { notes: 'leave', status: 'LEAVE', updated_by: 'admin' })
  assert.equal(edited.work_date, '2026-10-30')
  assert.equal(edited.created_at, timestamp)
  assert.equal(edited.updated_at, timestamp)
  assert.equal(edited.updated_by, 'admin')
  assert.equal(edited.notes, 'leave')
  assert.equal((await repository.update('record', { notes: null, updated_by: 'admin' })).notes, null)
  const cancelled = await repository.update('record', { deleted_at: timestamp, deleted_by: 'admin', updated_by: 'admin' })
  assert.equal(cancelled.deleted_at, timestamp)
  assert.equal(cancelled.deleted_by, 'admin')
  assert.equal(requests.filter((request) => request.method === 'DELETE').length, 0)

  appendFailure = true
  await assert.rejects(() => repository.append({ id: 'uncertain', staff_id: 'staff', work_date: '2026-11-02', status: 'DAY_OFF', created_by: 'staff' }))
  assert.equal(unauthenticatedCalls, 0, 'Even an uncertain append must never fall back to GViz')
  grid = [['id', 'wrong']]
  await assert.rejects(() => repository.read(), /eleven contract columns/)
} finally {
  globalThis.fetch = originalFetch
}
console.log('Attendance authenticated repository, eleven-column writes and audit tests passed')

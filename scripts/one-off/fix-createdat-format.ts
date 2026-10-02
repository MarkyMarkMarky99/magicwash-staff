// One-off: some Appointments.CreatedAt cells hold a datetime serial under a plain number format, so
// GViz (column typed datetime) returns null for them. Apply the column's datetime format to every
// CreatedAt cell; values are not changed.
//
// Dry run:  npx tsx --env-file=.env.local scripts/one-off/fix-createdat-format.ts
// Write:    add --write
import { getGoogleAccessToken } from '../../server/shared/repositories/google-auth.js'

const WRITE = process.argv.includes('--write')
const spreadsheetId = process.env.APPOINTMENTS_SPREADSHEET_ID!
const SHEET = 'Appointments'
const PATTERN = 'yyyy"-"mm"-"dd" "hh":"mm":"ss'
const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`

const token = await getGoogleAccessToken()
const api = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json() as Promise<any>
}

const meta = await api(`${base}?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))`)
const sheet = meta.sheets.find((s: any) => s.properties.title === SHEET)?.properties
if (!sheet) throw new Error(`Sheet ${SHEET} not found`)

const header = (await api(`${base}/values/${encodeURIComponent(`'${SHEET}'!1:1`)}`)).values[0] as string[]
const col = header.indexOf('CreatedAt')
if (col < 0) throw new Error('CreatedAt header not found')

const grid = await api(`${base}?ranges=${encodeURIComponent(`'${SHEET}'!A2:A`)}&ranges=${encodeURIComponent(`'${SHEET}'!${String.fromCharCode(65 + col)}2:${String.fromCharCode(65 + col)}`)}&fields=sheets(data(rowData(values(formattedValue,effectiveValue,effectiveFormat(numberFormat)))))`)
const ids = grid.sheets[0].data[0].rowData ?? []
const cells = grid.sheets[0].data[1].rowData ?? []
const wrong = cells.flatMap((r: any, i: number) => {
  const v = r.values?.[0]
  const type = v?.effectiveFormat?.numberFormat?.type
  return typeof v?.effectiveValue?.numberValue === 'number' && type !== 'DATE_TIME' && type !== 'DATE'
    ? [{ row: i + 2, id: ids[i]?.values?.[0]?.formattedValue, shown: v.formattedValue, format: type ?? 'none' }]
    : []
})
console.log(JSON.stringify({ mode: WRITE ? 'WRITE' : 'DRY_RUN', column: String.fromCharCode(65 + col), cellsWithNonDateFormat: wrong.length, sample: wrong.slice(0, 8) }, null, 1))

if (WRITE && wrong.length) {
  await api(`${base}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ repeatCell: {
      range: { sheetId: sheet.sheetId, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: PATTERN } } },
      fields: 'userEnteredFormat.numberFormat',
    } }] }),
  })
  console.log(`Applied ${PATTERN} to ${SHEET}!${String.fromCharCode(65 + col)}2:${String.fromCharCode(65 + col)}`)
}

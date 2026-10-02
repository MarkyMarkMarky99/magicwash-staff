// One-off: convert datetime cells that were written as text into real Sheets datetimes, so GViz
// stops returning null for them.
//   Payments.paid_at        ISO UTC text (liff-verify-slip)      -> Bangkok yyyy-MM-dd HH:mm:ss
//   Appointments.CreatedAt  dd/MM/yyyy HH:mm:ss text (Bangkok)    -> yyyy-MM-dd HH:mm:ss
// Also reports LIFF appointments whose CreatedAt may have been parsed day/month-swapped.
//
// Dry run:  npx tsx --env-file=.env.local scripts/one-off/fix-text-datetimes.ts <outDir>
// Write:    add --write
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SheetsApiClient } from '../../server/shared/repositories/sheets-api.client.js'
import { formatBangkokTimestamp } from '../../server/shared/utils/bangkok-timestamp.js'

const outDir = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!outDir) throw new Error('Pass an output directory')
const WRITE = process.argv.includes('--write')
mkdirSync(outDir, { recursive: true })

const READ = { valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER' } as any
const letter = (index: number) => String.fromCharCode(65 + index)
const BKK_DATETIME = /^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}:\d{2}$/

type Fix = { sheet: string; row: number; key: string; column: string; was: string; to: string }

async function plan(env: string, sheet: string, keyHeader: string, header: string, convert: (v: string) => string | null) {
  const client = new SheetsApiClient({ spreadsheetId: process.env[env]!, sheetName: sheet })
  const values = await client.readRange('A1:Z', READ)
  const headers = values[0]!.map(String)
  const col = headers.indexOf(header), key = headers.indexOf(keyHeader)
  if (col < 0 || key < 0) throw new Error(`${sheet}: missing ${header} or ${keyHeader}`)
  const fixes: Fix[] = []
  const unknown: string[] = []
  values.slice(1).forEach((r, i) => {
    const v = r[col]
    if (v == null || v === '' || typeof v === 'number') return
    const to = convert(String(v))
    if (to) fixes.push({ sheet, row: i + 2, key: String(r[key]), column: letter(col), was: String(v), to })
    else unknown.push(`${r[key]}: ${v}`)
  })
  return { client, fixes, unknown, values, headers }
}

const payments = await plan('INVOICES_SPREADSHEET_ID', 'Payments', 'payment_id', 'paid_at', (v) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v) ? formatBangkokTimestamp(new Date(v)) : BKK_DATETIME.test(v) ? v : null)

const appointments = await plan('APPOINTMENTS_SPREADSHEET_ID', 'Appointments', 'AppointmentID', 'CreatedAt', (v) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(v)
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}:${m[6]}` : BKK_DATETIME.test(v) ? v : null
})

// CreatedAt cells that Sheets DID parse came from the same dd/MM writer, so a day <= 12 was read
// as MM/dd. Flag rows created after their own appointment date where the swapped date is not.
const h = appointments.headers
const [cIdx, dIdx, byIdx, idIdx] = ['CreatedAt', 'AppointmentDate', 'CreatedBy', 'AppointmentID'].map((n) => h.indexOf(n))
const suspicious = appointments.values.slice(1).flatMap((r) => {
  const serial = (x: unknown) => typeof x === 'number' ? formatBangkokTimestamp(new Date(Math.round((x - 25569) * 86400000) - 7 * 3600000)) : String(x ?? '')
  const created = serial(r[cIdx!]), date = serial(r[dIdx!])
  const m = /^(\d{4})-(\d{2})-(\d{2}) /.exec(created)
  if (!m || r[byIdx!] !== 'liff' || +m[3]! > 12 || !/^\d{4}-\d{2}-\d{2}/.test(date)) return []
  const asIs = `${m[1]}-${m[2]}-${m[3]}`, swapped = `${m[1]}-${m[3]}-${m[2]}`
  const appt = date.slice(0, 10)
  return asIs > appt && swapped <= appt ? [{ id: r[idIdx!], createdAt: created, appointmentDate: appt, swappedCreatedDate: swapped }] : []
})

const summary = {
  mode: WRITE ? 'WRITE' : 'DRY_RUN',
  paymentsPaidAt: payments.fixes.length, paymentsUnrecognised: payments.unknown,
  appointmentsCreatedAt: appointments.fixes.length, appointmentsUnrecognised: appointments.unknown,
  suspiciousSwappedCreatedAt: suspicious.length,
}
writeFileSync(join(outDir, 'datetime-fix-plan.json'), JSON.stringify({ summary, fixes: [...payments.fixes, ...appointments.fixes], suspicious }, null, 1))
console.log(JSON.stringify({ ...summary, sample: [payments.fixes[0], appointments.fixes[0]], suspiciousSample: suspicious.slice(0, 5) }, null, 1))

if (WRITE) {
  if (payments.unknown.length || appointments.unknown.length) throw new Error('Aborted: unrecognised text values')
  for (const { client, fixes, values } of [payments, appointments]) {
    if (!fixes.length) continue
    for (const f of fixes) {
      const current = values[f.row - 1]![f.column.charCodeAt(0) - 65]
      if (String(current) !== f.was) throw new Error(`Aborted: ${f.sheet} row ${f.row} changed`)
    }
    await client.updateCells(fixes.map((f) => ({ range: `'${f.sheet}'!${f.column}${f.row}`, values: [[f.to]] })), 'USER_ENTERED')
    console.log(`${fixes[0]!.sheet}: ${fixes.length} cells converted`)
  }
}

import { SheetsApiClient, type SheetsApiValues } from '../repositories/sheets-api.client.js'

export interface StaffMember {
  staffId: string
  email: string
  name: string
  role: 'admin' | 'staff'
}

const CACHE_TTL_MS = 60_000
let cached: { members: Map<string, StaffMember>; expiresAt: number } | undefined
let inFlight: Promise<Map<string, StaffMember>> | undefined
let cacheGeneration = 0

export function invalidateStaffListCache(): void {
  cacheGeneration += 1
  cached = undefined
  inFlight = undefined
}

export function parseStaffList(rows: SheetsApiValues): Map<string, StaffMember> {
  const [header, ...data] = rows
  if (!header) throw new Error('Staff sheet is missing its header row')
  const columns = ['Email', 'Name', 'Role', 'Active', 'StaffId'].map((name) => header.indexOf(name))
  if (columns.some((index) => index < 0)) throw new Error('Staff sheet is missing required columns')
  const [emailColumn, nameColumn, roleColumn, activeColumn, staffIdColumn] = columns as [number, number, number, number, number]
  const members = new Map<string, StaffMember>()
  for (const row of data) {
    const staffId = String(row[staffIdColumn] ?? '').trim()
    const email = String(row[emailColumn] ?? '').trim()
    const name = String(row[nameColumn] ?? '').trim()
    const role = String(row[roleColumn] ?? '').trim().toLowerCase()
    const active = row[activeColumn]
    if (!email || (role !== 'admin' && role !== 'staff')) continue
    if (active !== true && !(typeof active === 'string' && active.trim().toLowerCase() === 'true')) continue
    members.set(email.toLowerCase(), { staffId, email, name, role })
  }
  return members
}

async function loadStaffList(): Promise<Map<string, StaffMember>> {
  const spreadsheetId = process.env.STAFF_SPREADSHEET_ID
  if (!spreadsheetId?.trim()) throw new Error('STAFF_SPREADSHEET_ID is not set')
  const client = new SheetsApiClient({ spreadsheetId, sheetName: 'Staff' })
  return parseStaffList(await client.readRange('A:I', { valueRenderOption: 'UNFORMATTED_VALUE' }))
}

export function getStaffList(): Promise<Map<string, StaffMember>> {
  if (cached && Date.now() < cached.expiresAt) return Promise.resolve(cached.members)
  if (!inFlight) {
    const generation = cacheGeneration
    let pending: Promise<Map<string, StaffMember>>
    pending = loadStaffList().then((members) => {
      if (generation === cacheGeneration) cached = { members, expiresAt: Date.now() + CACHE_TTL_MS }
      return members
    }).finally(() => {
      if (inFlight === pending) inFlight = undefined
    })
    inFlight = pending
  }
  return inFlight
}

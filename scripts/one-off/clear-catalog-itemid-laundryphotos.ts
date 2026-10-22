// One-off (2026-10-23): blank catalog item ids mistakenly stored as LaundryPhotos garment tags.
// Only individual column D cells are updated; rows and all other columns are preserved.
// Dry run: npx tsx --env-file=.env.local scripts/one-off/clear-catalog-itemid-laundryphotos.ts
// Write:   npx tsx --env-file=.env.local scripts/one-off/clear-catalog-itemid-laundryphotos.ts --write
import { mkdir, open } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { laundryPhotosDbContract } from '../../server/sheets/LaundryPhotos/LaundryPhotos.db-contract.js'
import { getGoogleAccessToken } from '../../server/shared/repositories/google-auth.js'

const WRITE = process.argv.includes('--write')
const HEADER = Object.keys(laundryPhotosDbContract.row.shape)
const ITEM_ID_COLUMN = 3
const TARGET_CAP = 500
const sheetResponseSchema = z.object({ values: z.array(z.array(z.string())).default([]) })

type Target = { rowNumber: number, values: string[] }

async function main() {
  const args = process.argv.slice(2)
  if (args.some((arg) => arg !== '--write')) throw new Error('Only --write is supported')
  const spreadsheetId = process.env.ORDERS_SPREADSHEET_ID
  if (!spreadsheetId) throw new Error('ORDERS_SPREADSHEET_ID is not set')
  if (HEADER.length !== 16 || HEADER[ITEM_ID_COLUMN] !== 'item_id') {
    throw new Error('Contract no longer matches LaundryPhotos!A:P with item_id in D')
  }

  console.log(`mode ${WRITE ? 'WRITE' : 'DRY RUN'}`)
  const token = await getGoogleAccessToken()
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`
  const api = async (url: string, init?: RequestInit): Promise<unknown> => {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    return res.json()
  }
  const readSheet = async () => {
    const response = sheetResponseSchema.parse(await api(
      `${base}/values/${encodeURIComponent('LaundryPhotos!A:P')}?valueRenderOption=FORMATTED_VALUE`,
    ))
    const [header, ...rows] = response.values
    if (!header || header.length !== HEADER.length || HEADER.some((name, i) => header[i] !== name)) {
      throw new Error(`LaundryPhotos header mismatch: expected ${JSON.stringify(HEADER)}, got ${JSON.stringify(header ?? [])}`)
    }
    return rows.map((row) => HEADER.map((_, i) => row[i] ?? ''))
  }

  const readOrderItemForms = async () => {
    const response = sheetResponseSchema.parse(await api(
      `${base}/values/${encodeURIComponent('OrderItemForms')}?valueRenderOption=FORMATTED_VALUE`,
    ))
    const [header, ...rows] = response.values
    if (!header || header.filter((name) => name === 'id').length !== 1 || header.filter((name) => name === 'item_id').length !== 1) {
      throw new Error('OrderItemForms header must contain exactly one id and one item_id column')
    }
    const idColumn = header.indexOf('id')
    const itemIdColumn = header.indexOf('item_id')
    const itemIdByOrderItemId = new Map<string, string>()
    for (const row of rows) {
      const id = row[idColumn] ?? ''
      if (!id) continue
      if (itemIdByOrderItemId.has(id)) throw new Error(`OrderItemForms has duplicate id: ${id}`)
      itemIdByOrderItemId.set(id, row[itemIdColumn] ?? '')
    }
    return itemIdByOrderItemId
  }

  const rows = await readSheet()
  const itemIdByOrderItemId = await readOrderItemForms()
  const targets: Target[] = []
  let nonTargetItemIds = 0
  for (const [index, values] of rows.entries()) {
    const itemId = values[ITEM_ID_COLUMN]!
    if (itemId === '') continue
    const orderItemId = values[2]!
    if (orderItemId !== '' && itemIdByOrderItemId.get(orderItemId) === itemId) {
      targets.push({ rowNumber: index + 2, values })
    } else {
      nonTargetItemIds += 1
    }
  }

  const tableRows = (entries: Target[]) => entries.map(({ rowNumber, values }) => ({
    row: rowNumber,
    id: values[0],
    order_id: values[1],
    orderitem_id: values[2],
    item_id: values[ITEM_ID_COLUMN],
  }))
  console.log('Targets:')
  console.table(tableRows(targets))
  console.log(`Target count: ${targets.length}`)
  console.log(`Rows with non-empty item_id that are not targets: ${nonTargetItemIds}`)

  if (targets.length > TARGET_CAP) {
    throw new Error(`Target count ${targets.length} exceeds cap ${TARGET_CAP}. Ask for review before proceeding.`)
  }
  if (!WRITE) {
    console.log('Dry run complete. Nothing written.')
    return
  }
  if (!targets.length) {
    console.log('No targets. Nothing written.')
    return
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDirectory = new URL('./backups/', import.meta.url)
  const backupPath = fileURLToPath(new URL(`clear-catalog-itemid-${timestamp}.json`, backupDirectory))
  await mkdir(backupDirectory, { recursive: true })
  const backupFile = await open(backupPath, 'wx')
  try {
    await backupFile.writeFile(`${JSON.stringify({
      spreadsheetId,
      sheet: 'LaundryPhotos',
      valueRenderOption: 'FORMATTED_VALUE',
      timestamp,
      header: HEADER,
      targets,
    }, null, 2)}\n`, 'utf8')
    await backupFile.sync()
  } finally {
    await backupFile.close()
  }
  console.log(`Backup saved: ${backupPath}`)

  const currentItemIdByOrderItemId = await readOrderItemForms()
  const currentRows = await readSheet()
  const ready: Target[] = []
  for (const target of targets) {
    const current = currentRows[target.rowNumber - 2]
    if (!current || current[0] !== target.values[0] || current[ITEM_ID_COLUMN] !== target.values[ITEM_ID_COLUMN]) {
      console.log(`Skipped row ${target.rowNumber}: id or item_id mismatch; expected ${JSON.stringify({
        id: target.values[0], item_id: target.values[ITEM_ID_COLUMN],
      })}, got ${JSON.stringify({ id: current?.[0], item_id: current?.[ITEM_ID_COLUMN] })}`)
    } else if (!current[2] || currentItemIdByOrderItemId.get(current[2]) !== current[ITEM_ID_COLUMN]) {
      console.log(`Skipped row ${target.rowNumber}: OrderItemForms match no longer holds for orderitem_id ${JSON.stringify(current[2])}`)
    } else {
      ready.push(target)
    }
  }
  console.log(`Recheck: ${ready.length} eligible, ${targets.length - ready.length} skipped`)
  if (!ready.length) {
    console.log('No eligible targets remain. Nothing written.')
    return
  }

  await api(`${base}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: ready.map(({ rowNumber }) => ({ range: `LaundryPhotos!D${rowNumber}`, values: [['']] })),
    }),
  })

  const verifiedRows = await readSheet()
  const failures: { row: number, column: string, before: string, after: string | undefined }[] = []
  for (const target of ready) {
    const actual = verifiedRows[target.rowNumber - 2]
    for (const [index, column] of HEADER.entries()) {
      const expected = index === ITEM_ID_COLUMN ? '' : target.values[index]!
      if (actual?.[index] !== expected) {
        failures.push({ row: target.rowNumber, column, before: expected, after: actual?.[index] })
      }
    }
  }
  if (failures.length) {
    console.table(failures)
    throw new Error(`Verification FAILED: ${failures.length} cell mismatches versus backup/empty D. Backup: ${backupPath}`)
  }
  console.log(`Verification PASSED: ${ready.length} target D cells empty; all other A:P cells unchanged versus backup.`)
  console.log(`Skipped targets left untouched: ${targets.length - ready.length}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})

import type { SheetsApiValue, SheetsApiValues } from './sheets-api.client.js'
import {
  SheetHeaderMapError,
  type SheetHeaderMap,
} from './sheet-header-map.js'

export class DuplicateRowKeyError extends Error {
  constructor(keyColumn: string, keyValue: SheetsApiValue, rowNumbers: readonly number[]) {
    super(
      `Duplicate key '${String(keyValue)}' in column '${keyColumn}' found at rows ${rowNumbers.join(', ')}`,
    )
    this.name = 'DuplicateRowKeyError'
  }
}

/**
 * Find the one-based sheet row whose key column contains the requested value.
 *
 * The returned row number is true only at the instant of this read. The row
 * may move before a later write (the lookup-to-write TOCTOU race). This is an
 * intentionally accepted risk, not an oversight: SheetLib used LockService
 * for both operations, Sheets API cannot provide that same protection here,
 * and the project deliberately accepts the regression. Do not "fix" this by
 * adding CAS, a lock, a retry, or a protected range. If this causes a real
 * incident, move to storage with real transactions or combine lookup and write
 * into one Apps Script operation; do not cover it with retries.
 *
 * A duplicate key is invalid data; §2.9 must classify DuplicateRowKeyError as
 * rejected and must not retry it. `verifyRowIdentity` (§2.6) only detects a
 * row moving between write and read-back; it does not fix the lookup-to-write
 * race described here.
 */
export async function findRowNumberByKey(
  headerMap: SheetHeaderMap,
  keyColumn: string,
  keyValue: SheetsApiValue,
  readColumn: (columnLetter: string) => Promise<SheetsApiValues>,
): Promise<number | null> {
  if (!Object.prototype.hasOwnProperty.call(headerMap.letterByName, keyColumn)) {
    throw new SheetHeaderMapError(
      `Key column '${keyColumn}' is not present in the sheet header map`,
    )
  }

  const columnLetter = headerMap.letterByName[keyColumn]
  const values = await readColumn(columnLetter)
  const normalizedKey = normalizeKeyValue(keyValue)
  const matchingRows: number[] = []

  for (let index = 1; index < values.length; index += 1) {
    const row = values[index]
    const cellValue = row[0]
    if (cellValue === undefined) {
      continue
    }

    const normalizedCellValue = normalizeKeyValue(cellValue)
    if (normalizedKey === '' || normalizedCellValue === '') {
      continue
    }

    if (normalizedCellValue === normalizedKey) {
      matchingRows.push(index + 1)
    }
  }

  if (matchingRows.length > 1) {
    throw new DuplicateRowKeyError(keyColumn, keyValue, matchingRows)
  }

  return matchingRows[0] ?? null
}

function normalizeKeyValue(value: SheetsApiValue): string {
  return String(value ?? '').trim()
}

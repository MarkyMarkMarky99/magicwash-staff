import type { SheetHeaderMap } from './sheet-header-map.js'
import type { SheetsApiValue, SheetsValueInputOption } from './sheets-api.client.js'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function serializeCellValue(value: unknown): SheetsApiValue {
  if (value === undefined || value === null) {
    return ''
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Unsupported cell value: ${String(value)}`)
    }
    return value
  }

  if (Array.isArray(value) || isPlainObject(value)) {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) {
      throw new TypeError('Unsupported cell value: JSON serialization returned undefined')
    }
    return serialized
  }

  throw new TypeError(`Unsupported cell value: ${String(value)}`)
}

export function buildRowValues(
  row: Record<string, unknown>,
  headerMap: SheetHeaderMap,
): SheetsApiValue[] {
  return headerMap.orderedHeaders.map((header) =>
    Object.prototype.hasOwnProperty.call(row, header) ? serializeCellValue(row[header]) : '',
  )
}

export function parseRowValues(
  values: readonly SheetsApiValue[],
  headerMap: SheetHeaderMap,
): Record<string, SheetsApiValue> {
  if (values.length > headerMap.width) {
    throw new RangeError(
      `Cannot parse row values: received ${values.length} values for a header map with width ${headerMap.width}`,
    )
  }

  const row: Record<string, SheetsApiValue> = {}
  for (const [index, header] of headerMap.orderedHeaders.entries()) {
    row[header] = index < values.length ? values[index]! : null
  }
  return row
}

export function resolveValueInputOption(
  column: string,
  policy: Partial<Record<string, SheetsValueInputOption>> | undefined,
): SheetsValueInputOption {
  return policy?.[column] ?? 'RAW'
}

export function resolveRowValueInputOptions(
  headerMap: SheetHeaderMap,
  policy: Partial<Record<string, SheetsValueInputOption>> | undefined,
): Record<string, SheetsValueInputOption> {
  const options: Record<string, SheetsValueInputOption> = {}
  for (const header of headerMap.orderedHeaders) {
    options[header] = resolveValueInputOption(header, policy)
  }
  return options
}

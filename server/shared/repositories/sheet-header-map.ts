/**
 * The physical header layout of a sheet, resolved independently from the
 * order of the database row schema.
 */
export interface SheetHeaderMap {
  readonly orderedHeaders: readonly string[]
  readonly width: number
  readonly indexByName: Readonly<Record<string, number>>
  readonly letterByName: Readonly<Record<string, string>>
}

export class SheetHeaderMapError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SheetHeaderMapError'
  }
}

/** Convert a zero-based column index to its Google Sheets column letter. */
export function columnLetterForIndex(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new SheetHeaderMapError(
      `Column index must be a non-negative integer, received ${String(index)}`,
    )
  }

  let value = index + 1
  let letter = ''
  while (value > 0) {
    value -= 1
    letter = String.fromCharCode(65 + (value % 26)) + letter
    value = Math.floor(value / 26)
  }
  return letter
}

/** Build an A1 range covering one complete physical sheet row. */
export function buildRowRange(headerMap: SheetHeaderMap, rowNumber: number): string {
  if (!Number.isInteger(rowNumber) || rowNumber <= 0) {
    throw new SheetHeaderMapError(
      `Row number must be a positive integer, received ${String(rowNumber)}`,
    )
  }

  if (headerMap.width === 0) {
    throw new SheetHeaderMapError('Cannot build a row range for a zero-width header map')
  }

  const firstColumn = columnLetterForIndex(0)
  const lastColumn = columnLetterForIndex(headerMap.width - 1)
  return `${firstColumn}${rowNumber}:${lastColumn}${rowNumber}`
}

/**
 * Build an address map from the live first-row headers.
 *
 * The input is intentionally unknown at this boundary because it comes from
 * an external Sheets response. Private callers can pass validated values.
 */
export function buildSheetHeaderMap(
  liveHeaders: readonly unknown[],
  knownColumns: readonly string[],
  primaryKey: string,
): SheetHeaderMap {
  if (!Array.isArray(liveHeaders)) {
    throw new SheetHeaderMapError('Live headers must be an array')
  }

  const validatedHeaders: string[] = []
  for (let index = 0; index < liveHeaders.length; index += 1) {
    const header = liveHeaders[index]
    if (typeof header !== 'string') {
      throw new SheetHeaderMapError(`Header at index ${index} must be a string`)
    }
    validatedHeaders.push(header)
  }

  if (!Array.isArray(knownColumns) || !knownColumns.every((column) => typeof column === 'string')) {
    throw new SheetHeaderMapError('Known columns must be an array of strings')
  }
  if (typeof primaryKey !== 'string') {
    throw new SheetHeaderMapError('Primary key must be a string')
  }

  const orderedHeaders = validatedHeaders

  while (
    orderedHeaders.length > 0 &&
    orderedHeaders[orderedHeaders.length - 1].trim() === ''
  ) {
    orderedHeaders.pop()
  }

  for (let index = 0; index < orderedHeaders.length; index += 1) {
    const header = orderedHeaders[index]
    if (header.trim() === '') {
      throw new SheetHeaderMapError(
        `Header at index ${index} is empty or whitespace-only inside the live header row`,
      )
    }
  }

  const indexes = new Map<string, number>()
  const letters = new Map<string, string>()
  for (const [index, header] of orderedHeaders.entries()) {
    if (indexes.has(header)) {
      throw new SheetHeaderMapError(`Duplicate live header '${header}'`)
    }
    indexes.set(header, index)
    letters.set(header, columnLetterForIndex(index))
  }

  const knownColumnSet = new Set(knownColumns)
  if (!knownColumnSet.has(primaryKey)) {
    throw new SheetHeaderMapError(
      `Primary key '${primaryKey}' is not present in the known columns`,
    )
  }

  for (const knownColumn of knownColumns) {
    if (!indexes.has(knownColumn)) {
      throw new SheetHeaderMapError(
        `Known column '${knownColumn}' is missing from the live header row`,
      )
    }
  }

  return {
    orderedHeaders,
    width: orderedHeaders.length,
    indexByName: Object.fromEntries(indexes),
    letterByName: Object.fromEntries(letters),
  }
}

export interface SheetHeaderMapLoader {
  load(): Promise<SheetHeaderMap>
}

/**
 * Per-repository lazy cache. Successful resolution is cached; a failed load
 * clears the in-flight promise so a later call can retry.
 */
export class SheetHeaderMapResolver implements SheetHeaderMapLoader {
  private cachedMap: SheetHeaderMap | undefined
  private inFlight: Promise<SheetHeaderMap> | undefined

  constructor(private readonly loadMap: () => Promise<SheetHeaderMap>) {}

  load(): Promise<SheetHeaderMap> {
    if (this.cachedMap !== undefined) {
      return Promise.resolve(this.cachedMap)
    }
    if (this.inFlight !== undefined) {
      return this.inFlight
    }

    const pending = this.loadMap()
      .then((map) => {
        this.cachedMap = map
        return map
      })
      .finally(() => {
        if (this.inFlight === pending) {
          this.inFlight = undefined
        }
      })

    this.inFlight = pending
    return pending
  }
}
